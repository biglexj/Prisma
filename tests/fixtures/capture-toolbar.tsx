// Componente real con IPC simulado: esta página nunca graba la pantalla.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { ScreenCaptureOverlay } from "../../src/features/screen_capture/ui/ScreenCaptureOverlay";
import type { CaptureSessionInit } from "../../src/features/screen_capture/model/types";
import "../../src/app/styles.css";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#192332"/><path d="M0 180H1280M0 360H1280M0 540H1280M320 0V720M640 0V720M960 0V720" stroke="#30445f"/><text x="80" y="180" fill="#dde8f8" font-family="sans-serif" font-size="32">Fondo de prueba · La imagen debe permanecer inmóvil</text></svg>`;
let session: CaptureSessionInit | null = {
  sessionId: 1, intent: "image", defaultMode: "window", virtualX: 0, virtualY: 0,
  virtualWidth: innerWidth, virtualHeight: innerHeight,
  snapshotDataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  targets: [], monitors: [{ id: 1, name: "Pantalla de prueba", x: 0, y: 0, width: innerWidth, height: innerHeight, isPrimary: true }],
};
const status = document.createElement("output");
status.style.cssText = "position:fixed;left:24px;bottom:24px;z-index:2000000;padding:12px;background:#192332;color:white;pointer-events:none;font:14px monospace";
status.textContent = "IPC simulado · Sin grabaciones";
document.body.append(status);
let recordings = 0;
mockWindows("screen_capture_overlay");
mockIPC((command, payload) => {
  if (command === "screen_capture_get_session") return session;
  if (command === "screen_capture_set_intent" && session) {
    session = { ...session, intent: payload?.intent as "image" | "video" };
    status.textContent = `Sesión ${session.sessionId} · ${session.intent} · Grabaciones: ${recordings}`;
    return session;
  }
  if (command === "screen_capture_cancel") {
    session = null;
    status.textContent = `Cancelado · Grabaciones: ${recordings}`;
  }
  if (command === "screen_recorder_start") {
    recordings += 1;
    status.textContent = `Inicio de grabación simulado: ${recordings}`;
    return { outputPath: "simulated.mp4" };
  }
  if (command === "screen_capture_detect_window_at" || command === "screen_capture_detect_subregion") return null;
  if (command === "screen_capture_pick_color") return { hex: "#00C9B9", r: 0, g: 201, b: 185 };
  return null;
}, { shouldMockEvents: true });
document.documentElement.classList.add("is-capture-overlay");
createRoot(document.getElementById("root")!).render(<StrictMode><ScreenCaptureOverlay /></StrictMode>);
