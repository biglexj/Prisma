import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import { ScreenCaptureRecorderBar } from "../../src/features/screen_capture/ui/ScreenCaptureRecorderBar";
import { RecordingHud } from "../../src/features/screen_capture/ui/RecordingHud";
import type { RecordingInfo } from "../../src/features/screen_capture/model/types";
import "../../src/app/styles.css";

const theme = new URLSearchParams(location.search).get("theme");
document.documentElement.classList.add("is-capture-recorder");
if (theme === "light" || theme === "dark") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

let failStop = false;
let stopped = false;
const recording: RecordingInfo = { status: "recording", outputPath: "Prisma_prueba.mp4", startedAtMs: Date.now() - 14000, elapsedMs: 14000, region: { x: 0, y: 0, width: 1920, height: 1080 }, fps: 30, width: 1920, height: 1080, paused: false };
const status = document.createElement("output");
status.textContent = "Simulación · Sin grabar el escritorio";
const fail = document.createElement("button");
fail.textContent = "Simular fallo de parada";
fail.onclick = () => { failStop = !failStop; status.textContent = `Fallo de parada: ${failStop}`; };
const shortcut = document.createElement("button");
const reveal = document.createElement("button");
reveal.textContent = "Mostrar controles (simulado)";
reveal.onclick = async () => {
  document.getElementById("root")!.style.display = "block";
  await emit("prisma://recording-controls-shown", {});
  status.textContent = "Controles visibles (simulado)";
};
shortcut.textContent = "Simular parada por atajo";
shortcut.onclick = async () => {
  stopped = true;
  await emit("prisma://recording-state", { ...recording, status: "finished" });
  status.textContent = "Guardado por atajo (simulado)";
};
document.body.prepend(fail, shortcut, reveal, status);
document.body.style.cssText = "padding:24px;box-sizing:border-box";
document.getElementById("root")!.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);width:320px;height:56px";
mockWindows("screen_capture_recorder");
mockIPC(async (command) => {
  if (command === "screen_recorder_status") return stopped ? null : recording;
  if (command === "screen_recorder_pause") {
    recording.paused = !recording.paused;
    await emit("prisma://recording-state", { ...recording });
    status.textContent = recording.paused ? "Pausa simulada" : "Reanudación simulada";
    return { ...recording };
  }
  if (command === "screen_recorder_stop") {
    if (failStop) throw new Error("Fallo de prueba");
    stopped = true;
    status.textContent = "Grabación detenida (simulada)";
    return { ...recording, status: "finished" };
  }
  if (command === "plugin:window|start_dragging") status.textContent = "Arrastre nativo solicitado";
  if (command === "plugin:window|hide") {
    document.getElementById("root")!.style.display = "none";
    status.textContent = "Controles ocultos (simulado)";
  }
  if (command === "show_in_file_manager") status.textContent = "Mostrar archivo guardado (simulado)";
  return null;
}, { shouldMockEvents: true });
createRoot(document.getElementById("root")!).render(<><ScreenCaptureRecorderBar /><RecordingHud /></>);
