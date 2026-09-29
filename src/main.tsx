import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { App } from "./app/App";
import { QuickLookWindow } from "./features/quick_look/ui/QuickLookWindow";
import { FlyoutWindow } from "./features/playback/ui/FlyoutWindow";
import "./app/styles.css";

function isQuickLookWindow(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.hash === "#quicklook" || window.location.search.includes("quicklook=true")) {
    return true;
  }
  try {
    const win = getCurrentWebviewWindow();
    return Boolean(win && typeof win.label === "string" && win.label.startsWith("quicklook"));
  } catch {
    return false;
  }
}

function isFlyoutWindow(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.hash === "#flyout" || window.location.search.includes("flyout=true")) {
    return true;
  }
  try {
    const win = getCurrentWebviewWindow();
    return Boolean(win && typeof win.label === "string" && win.label.startsWith("flyout"));
  } catch {
    return false;
  }
}

const isQuickLook = isQuickLookWindow();
const isFlyout = isFlyoutWindow();

if (isQuickLook) {
  document.documentElement.classList.add("is-quicklook");
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
} else if (isFlyout) {
  document.documentElement.classList.add("is-flyout");
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isQuickLook ? <QuickLookWindow /> : isFlyout ? <FlyoutWindow /> : <App />}
  </StrictMode>,
);

