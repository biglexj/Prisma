import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Icon } from "../../shared/ui/Icon";
import { armDropZone, claimDropPaths, disarmDropZone } from "../../shared/dropRouter";import "./file-drop-zone.css";

type DropDestination = "supergallery" | "images" | "videos" | "music" | "open" | "reveal";

interface FileDropZoneProps {
  /** Envía los archivos al sistema de transferencias de Super Galería. */
  onSendToSuperGallery: (paths: string[]) => void;
  /** Añade la carpeta del archivo a una biblioteca de Prisma. */
  onAddToLibrary: (kind: "images" | "videos" | "music", paths: string[]) => void;
  /** Abre el archivo con la aplicación predeterminada de Windows. */
  onOpenWithDefaultApp: (paths: string[]) => void;
  /** Muestra el archivo en el Explorador de archivos. */
  onRevealInExplorer: (paths: string[]) => void;
}

interface DragPreview {
  count: number;
  name: string;
  size: number;
}

function isFileDrag(event: { dataTransfer: DataTransfer | null }): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  return Array.from(types).includes("Files");
}

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/**
 * Zona de recepción en la parte superior central.
 *
 * Reposa como una muesca discreta (~50 × 3 px) y se despliega cuando entra un
 * archivo arrastrado. Al soltarlo aparece el menú de destinos: Super Galería,
 * las bibliotecas de Prisma o las acciones del Explorador.
 */
export function FileDropZone({
  onSendToSuperGallery,
  onAddToLibrary,
  onOpenWithDefaultApp,
  onRevealInExplorer,
}: FileDropZoneProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [pendingPaths, setPendingPaths] = useState<string[]>([]);
  const isHoveringRef = useRef(false);

  const setHovering = useCallback((value: boolean) => {
    isHoveringRef.current = value;
    setIsHovering(value);
    if (value) armDropZone();
    else disarmDropZone();
  }, []);

  const readPreview = useCallback((event: { dataTransfer: DataTransfer | null }) => {
    const items = event.dataTransfer?.items;
    if (!items || items.length === 0) return;
    const first = items[0];
    const file = first.kind === "file" ? first.getAsFile() : null;
    setPreview({
      count: items.length,
      name: file?.name ?? `${items.length} archivo${items.length === 1 ? "" : "s"}`,
      size: file?.size ?? 0,
    });
  }, []);

  // El despliegue se activa cuando entra cualquier archivo en la ventana.
  useEffect(() => {
    const handleDragEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      readPreview(event);
      setIsExpanded(true);
    };
    const handleDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) {
        setIsExpanded(false);
        setPreview(null);
        setHovering(false);
      }
    };
    const handleDrop = () => {
      setIsExpanded(false);
      setPreview(null);
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
  }, [readPreview, setHovering]);

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
          setHovering(false);
          setIsExpanded(true);
          setPendingPaths(paths);
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

  const closeMenu = useCallback(() => {
    setPendingPaths([]);
    setPreview(null);
    setIsExpanded(false);
  }, []);

  const handleDestination = useCallback(
    (destination: DropDestination) => {
      const paths = pendingPaths;
      closeMenu();
      if (paths.length === 0) return;

      switch (destination) {
        case "supergallery":
          onSendToSuperGallery(paths);
          break;
        case "images":
          onAddToLibrary("images", paths);
          break;
        case "videos":
          onAddToLibrary("videos", paths);
          break;
        case "music":
          onAddToLibrary("music", paths);
          break;
        case "open":
          onOpenWithDefaultApp(paths);
          break;
        case "reveal":
          onRevealInExplorer(paths);
          break;
      }
    },
    [closeMenu, onAddToLibrary, onOpenWithDefaultApp, onRevealInExplorer, onSendToSuperGallery, pendingPaths]
  );

  const hasMenu = pendingPaths.length > 0;

  return (
    <div
      className={`file-drop-zone ${isExpanded ? "is-expanded" : ""} ${isHovering ? "is-hovering" : ""} ${
        hasMenu ? "has-menu" : ""
      }`}
      onDragEnter={(event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        readPreview(event);
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

      {isExpanded && !hasMenu && (
        <div className="file-drop-zone-panel">
          <span className="file-drop-zone-icon" aria-hidden="true">
            <Icon name="upload" width={18} height={18} />
          </span>
          <span className="file-drop-zone-label">
            {preview ? (
              <>
                <strong>{preview.name}</strong>
                {preview.count > 1 ? ` · ${preview.count} archivos` : ""}
                {preview.size ? ` · ${formatBytes(preview.size)}` : ""}
              </>
            ) : isHovering ? (
              "Suelta para elegir el destino"
            ) : (
              "Arrastra un archivo hasta aquí"
            )}
          </span>
        </div>
      )}

      {hasMenu && (
        <div className="file-drop-zone-menu" role="menu">
          <div className="file-drop-zone-menu-header">
            <strong>
              {pendingPaths.length === 1
                ? pendingPaths[0].replace(/.*[/\\]/, "")
                : `${pendingPaths.length} archivos`}
            </strong>
            <button
              type="button"
              className="file-drop-zone-menu-close"
              onClick={closeMenu}
              aria-label="Cerrar el menú de destinos"
            >
              <Icon name="close" width={13} height={13} />
            </button>
          </div>
          <button type="button" role="menuitem" onClick={() => handleDestination("supergallery")}>
            <Icon name="smartphone" width={16} height={16} />
            <span>Enviar a Super Galería</span>
          </button>
          <button type="button" role="menuitem" onClick={() => handleDestination("images")}>
            <Icon name="image" width={16} height={16} />
            <span>Añadir a Imágenes</span>
          </button>
          <button type="button" role="menuitem" onClick={() => handleDestination("videos")}>
            <Icon name="film" width={16} height={16} />
            <span>Añadir a Vídeos</span>
          </button>
          <button type="button" role="menuitem" onClick={() => handleDestination("music")}>
            <Icon name="music" width={16} height={16} />
            <span>Añadir a Música</span>
          </button>
          <button type="button" role="menuitem" onClick={() => handleDestination("open")}>
            <Icon name="expand" width={16} height={16} />
            <span>Abrir con la aplicación predeterminada</span>
          </button>
          <button type="button" role="menuitem" onClick={() => handleDestination("reveal")}>
            <Icon name="folder" width={16} height={16} />
            <span>Mostrar en el Explorador</span>
          </button>
        </div>
      )}
    </div>
  );
}
