// Ejecutar con Vite: /tests/fixtures/synapse-notch-size.html.
// Monta el componente real en un iframe inicialmente de 100×3 y simula
// únicamente el IPC de Tauri, incluido el retraso del redimensionado nativo.
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import "../../src/app/styles.css";

type Size = { width: number; height: number; focus?: boolean };
const origin = location.origin;
const root = document.getElementById("root")!;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

if (new URLSearchParams(location.search).has("frame")) {
  let counter = 0;
  const pending = new Map<number, () => void>();
  mockWindows("system_drop_zone");
  mockIPC((command, payload) => {
    if (command === "vault_list") return [];
    if (command === "drop_zone_pointer_inside") return false;
    if (command === "vault_import") {
      parent.postMessage({ type: "notch-import", payload }, origin);
      return { items: [], path: "clipboard.png" };
    }
    if (command === "system_drop_zone_set_size") {
      const id = ++counter;
      parent.postMessage({ type: "notch-size", id, size: payload }, origin);
      return new Promise<void>((resolve) => pending.set(id, resolve));
    }
  }, { shouldMockEvents: true });
  window.addEventListener("message", ({ data, origin: source }) => {
    if (source !== origin) return;
    if (data.type === "notch-applied") { pending.get(data.id)?.(); pending.delete(data.id); }
    if (data.type === "notch-event") void emit(data.name, { paths: [], position: { x: 300, y: 10 } });
    if (data.type === "notch-paste") {
      const transfer = new DataTransfer();
      if (data.text) transfer.setData("text/plain", data.text);
      else transfer.items.add(new File([new Uint8Array([137, 80, 78, 71])], "clipboard.png", { type: "image/png" }));
      const target = data.target === "card" ? document.querySelector(".vault-card")! : document.body;
      target.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
    }
  });
  document.documentElement.classList.add("is-system-drop-zone");
  const { SystemDropZone } = await import("../../src/app/ui/SystemDropZone");
  createRoot(root).render(<SystemDropZone />);
  await pause(150);
  parent.postMessage({ type: "notch-ready" }, origin);
} else {
  const button = document.createElement("button");
  button.textContent = "Run sizing checks";
  button.disabled = true;
  const output = document.createElement("pre");
  output.id = "result";
  const frame = document.createElement("iframe");
  frame.title = "Notch under test";
  frame.style.cssText = "display:block;width:100px;height:3px;border:0";
  frame.src = `${location.pathname}?frame=1`;
  const pasteButton = document.createElement("button");
  pasteButton.textContent = "Run paste checks";
  root.append(button, pasteButton, output, frame);
  let sizes: Size[] = [];
  let imports: { text: string; pinned: boolean }[] = [];
  window.addEventListener("message", ({ data, origin: source, source: sender }) => {
    if (source !== origin || sender !== frame.contentWindow) return;
    if (data.type === "notch-ready") button.disabled = false;
    if (data.type === "notch-import") imports.push(data.payload);
    if (data.type === "notch-size") {
      sizes.push({ width: data.size.width, height: data.size.height, focus: data.size.focus });
      setTimeout(() => {
        frame.style.width = `${data.size.width}px`;
        frame.style.height = `${Math.min(420, data.size.height)}px`;
        frame.contentWindow?.postMessage({ type: "notch-applied", id: data.id }, origin);
      }, 30);
    }
  });
  pasteButton.onclick = async () => {
    pasteButton.disabled = true;
    imports = [];
    sizes = [];
    frame.contentWindow?.postMessage({ type: "notch-event", name: "prisma:vault-open" }, origin);
    await pause(450);
    for (const payload of [{ target: "body" }, { target: "card" }, { target: "body", text: "Prueba de pegado: canción" }]) {
      frame.contentWindow?.postMessage({ type: "notch-paste", ...payload }, origin);
      await pause(200);
    }
    const passed = imports.length === 3 && imports[0].text.startsWith("data:image/png;base64,")
      && imports[1].text.startsWith("data:image/png;base64,") && imports[2].text === "Prueba de pegado: canción"
      && imports.every((entry) => entry.pinned === false) && sizes.some((size) => size.focus);
    output.textContent = JSON.stringify({ passed, imports, sizes }, null, 2);
    pasteButton.disabled = false;
  };
  button.onclick = async () => {
    button.disabled = true;
    sizes = [];
    const event = (name: string) => frame.contentWindow?.postMessage({ type: "notch-event", name }, origin);
    for (let cycle = 0; cycle < 3; cycle++) {
      event("prisma:vault-open"); await pause(450);
      event("prisma:vault-open"); await pause(250);
    }
    event("prisma:vault-drag-enter"); await pause(450);
    event("prisma:vault-drag-leave"); await pause(50);
    event("prisma:vault-open"); await pause(250);
    const passed = sizes.some((size) => size.width > 100) && sizes.every((size) => size.height <= 200)
      && sizes.filter((size) => size.height === 3).length >= 3
      && sizes.some((size) => size.height === 165 && size.focus === false)
      && sizes.some((size) => size.height === 155 && size.focus === true);
    output.textContent = JSON.stringify({ passed, maximumRequestedHeight: Math.max(...sizes.map((size) => size.height)), sizes }, null, 2);
    button.disabled = false;
  };
}
