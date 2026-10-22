import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SystemDropZone } from "./app/ui/SystemDropZone";
import "./app/styles.css";

/**
 * Entrada propia de la barra superior Synapse.
 *
 * Va en un HTML aparte para no compartir la caché del WebView2 con la
 * ventana principal, el visor rápido o el flyout: si compartieran entrada,
 * una ventana podía quedarse con el contenido de otra.
 */
document.documentElement.classList.add("is-system-drop-zone");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SystemDropZone />
  </StrictMode>
);
