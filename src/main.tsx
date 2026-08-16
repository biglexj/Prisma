import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { App } from "./app/App";
import { QuickLookWindow } from "./features/quick_look/ui/QuickLookWindow";
import "./app/styles.css";

const isQuickLook =
  window.location.hash === "#quicklook" ||
  getCurrentWebviewWindow().label === "quicklook";

if (isQuickLook) {
  document.documentElement.classList.add("is-quicklook");
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isQuickLook ? <QuickLookWindow /> : <App />}
  </StrictMode>,
);
