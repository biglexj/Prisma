import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Icon } from "../../shared/ui/Icon";
import { armDropZone, claimDropPaths, disarmDropZone } from "../../shared/dropRouter";
import "./file-drop-zone.css";

function isFileDrag(event: { dataTransfer: DataTransfer | null }): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes("Files");
}

/**
 * Zona de recepción en la parte superior central.
 *
 * Reposa como una muesca discreta (~50 × 3 px) y se despliega cuando entra un
 * archivo arrastrado desde el Explorador. Al soltarlo, el archivo viaja por el
 * sistema de transferencias hacia Super Galería.
 */
export function FileDropZone() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const isHoveringRef = useRef(false);
  const zoneRef = useRef<HTMLDivElement | null>(null);

  const setHovering = useCallback((value: boolean) => {
    isHoveringRef.current = value;
    setIsHovering(value);
    if (value) armDropZone();
    else disarmDropZone();
  }, []);

  // El despliegue se activa cuando entra cualquier archivo en la ventana.
  useEffect(() => {
    const handleDragEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      setIsExpanded(true);
    };
    const handleDragLeave = (event: DragEvent) => {
      // relatedTarget nulo significa que el arrastre salió de la ventana.
      if (event.relatedTarget === null) {
        setIsExpanded(false);
        setHovering(false);
      }
    };
    const handleDrop = () => {
      setIsExpanded(false);
      setHovering(false);
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [setHovering]);

  // Las rutas las entrega el canal nativo: el DOM no expone archivos del SO.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;

    try {
      const webview = getCurrentWebview();
      webview
        .onDragDropEvent((event) => {
          if (event.payload.type !== "drop") return;
          const paths = event.payload.paths ?? [];
          if (paths.length === 0) return;
          if (!isHoveringRef.current) return;

          claimDropPaths(paths);
          disarmDropZone();
          setIsExpanded(false);
          setHovering(false);

          const path = paths[0];
          const title = path.replace(/.*[/\\]/, "");
          window.dispatchEvent(
            new CustomEvent("prisma-send-to-supergallery", { detail: { path, title } })
          );
        })
        .then((fn) => {
          if (disposed) fn();
          else unlisten = fn;
        })
        .catch(() => undefined);
    } catch {
      // Fuera del contexto de webview: la zona simplemente no recibe archivos.
    }

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [setHovering]);

  return (
    <div
      ref={zoneRef}
      className={`file-drop-zone ${isExpanded ? "is-expanded" : ""} ${isHovering ? "is-hovering" : ""}`}
      onDragEnter={(event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        setHovering(true);
      }}
      onDragOver={(event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setHovering(true);
      }}
      onDragLeave={() => setHovering(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      aria-hidden={!isExpanded}
    >
      <span className="file-drop-zone-notch" aria-hidden="true" />
      {isExpanded && (
        <div className="file-drop-zone-panel">
          <span className="file-drop-zone-icon" aria-hidden="true">
            <Icon name="upload" width={18} height={18} />
          </span>
          <span className="file-drop-zone-label">
            {isHovering ? "Suelta para enviar a Super Galería" : "Arrastra un archivo hasta aquí"}
          </span>
        </div>
      )}
    </div>
  );
}
