import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";
import "./quick-look-exif.css";

interface QuickLookHeaderProps {
  payload: QuickLookPayload;
  imageDimensions?: { width: number; height: number } | null;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onOpenInMain: () => void;
  onOpenDetached?: () => void;
  onCompare?: () => void;
  onEdit?: () => void;
  onStepSelection?: (forward: boolean) => void;
  onClose: () => void;
}

export function QuickLookHeader({
  payload,
  imageDimensions,
  isMaximized = false,
  onToggleMaximize,
  onOpenInMain,
  onOpenDetached,
  onCompare,
  onEdit,
  onStepSelection,
  onClose,
}: QuickLookHeaderProps) {
  const [showExif, setShowExif] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  // Arrastre universal continuo compatible con lápiz de tableta gráfica (Huion/Wacom/XP-Pen), ratón y touch
  const isDraggingWindowRef = useRef(false);
  const dragStartPointerRef = useRef({ x: 0, y: 0 });
  const dragStartWinPosRef = useRef({ x: 0, y: 0 });
  const targetWinPosRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);

  const handlePointerDown = async (e: React.PointerEvent) => {
    if ((e.button !== 0 && e.buttons !== 1) || isMaximized) return;
    if ((e.target as HTMLElement).closest("button, a, input, .quicklook-exif-popover, .quicklook-header-actions")) {
      return;
    }

    e.preventDefault();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    try {
      const [curX, curY] = await invoke<[number, number]>("quick_look_get_position");
      dragStartPointerRef.current = { x: e.screenX, y: e.screenY };
      dragStartWinPosRef.current = { x: curX, y: curY };
      targetWinPosRef.current = { x: curX, y: curY };
      isDraggingWindowRef.current = true;
    } catch {
      void invoke("quick_look_start_dragging").catch(() => {});
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingWindowRef.current || isMaximized) return;

    const dx = e.screenX - dragStartPointerRef.current.x;
    const dy = e.screenY - dragStartPointerRef.current.y;
    targetWinPosRef.current = {
      x: Math.round(dragStartWinPosRef.current.x + dx),
      y: Math.round(dragStartWinPosRef.current.y + dy),
    };

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (isDraggingWindowRef.current) {
          void invoke("quick_look_set_position", {
            x: targetWinPosRef.current.x,
            y: targetWinPosRef.current.y,
          }).catch(() => {});
        }
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingWindowRef.current) {
      isDraggingWindowRef.current = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      void invoke("quick_look_set_position", {
        x: targetWinPosRef.current.x,
        y: targetWinPosRef.current.y,
      }).catch(() => {});
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  useEffect(() => {
    const handleGlobalEnd = () => {
      if (isDraggingWindowRef.current) {
        isDraggingWindowRef.current = false;
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      }
    };
    window.addEventListener("pointerup", handleGlobalEnd);
    window.addEventListener("pointercancel", handleGlobalEnd);
    return () => {
      window.removeEventListener("pointerup", handleGlobalEnd);
      window.removeEventListener("pointercancel", handleGlobalEnd);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const getMediaIcon = (type: string) => {
    switch (type) {
      case "audio":
        return "music";
      case "video":
        return "video";
      case "image":
        return "image";
      case "archive":
        return "archive";
      case "epub":
        return "book";
      case "folder":
        return "folder";
      case "project":
        return "layers";
      case "playlist":
        return "list";
      case "pdf":
      case "text":
      case "markdown":
      case "html":
      case "lyrics":
        return "file-text";
      default:
        return "file";
    }
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(payload.path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } catch {
      // Fallback si clipboard falla
    }
  };

  const effectiveDims =
    imageDimensions ||
    (payload.width && payload.height && payload.width > 0 && payload.width <= 8192 && payload.height > 0 && payload.height <= 8192
      ? { width: payload.width, height: payload.height }
      : null);

  const hasExif =
    payload.mediaType === "image" &&
    Boolean(
      payload.exifCamera ||
        payload.exifIso ||
        payload.exifAperture ||
        payload.exifLens ||
        payload.exifShutter ||
        payload.exifDateTaken ||
        payload.exifFocalLength
    );

  return (
    <header
      className="quicklook-header"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={onToggleMaximize}
    >
      <div className="quicklook-header-drag">
        <span className="quicklook-file-icon">
          <Icon name={getMediaIcon(payload.mediaType)} />
        </span>
        <div className="quicklook-file-info">
          <span className="quicklook-file-name" title={payload.path}>
            {payload.fileName}
          </span>
          <span className="quicklook-file-badge">
            {payload.formattedSize}
          </span>
        </div>
      </div>

      <div
        className="quicklook-header-actions"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Paginación de selección múltiple */}
        {payload.selectionTotal && payload.selectionTotal > 1 && onStepSelection && (
          <div className="quicklook-selection-pager" title="Navegar lote seleccionado en Explorer">
            <button
              type="button"
              className="quicklook-pager-btn"
              onClick={() => onStepSelection(false)}
              title="Elemento anterior"
            >
              <Icon name="chevron-left" />
            </button>
            <span className="quicklook-pager-label">
              {payload.selectionIndex || 1} / {payload.selectionTotal}
            </span>
            <button
              type="button"
              className="quicklook-pager-btn"
              onClick={() => onStepSelection(true)}
              title="Elemento siguiente"
            >
              <Icon name="chevron-right" />
            </button>
          </div>
        )}

        {effectiveDims && (
          <span
            className="quicklook-file-badge quicklook-dims-badge"
            title="Resolución"
          >
            {effectiveDims.width} × {effectiveDims.height} px
          </span>
        )}

        {/* Inspector EXIF flotante */}
        {hasExif && (
          <div className="quicklook-exif-wrapper">
            <button
              type="button"
              className={`quicklook-btn-icon-action ${showExif ? "is-active" : ""}`}
              onClick={() => setShowExif(!showExif)}
              title="Información de captura EXIF"
            >
              <Icon name="info" />
            </button>

            {showExif && (
              <div className="quicklook-exif-popover" onMouseDown={(e) => e.stopPropagation()}>
                <div className="quicklook-exif-header">
                  <Icon name="camera" />
                  <span>Datos de Captura EXIF</span>
                </div>
                {payload.exifCamera && (
                  <div className="quicklook-exif-row">
                    <span className="quicklook-exif-label">Cámara</span>
                    <span className="quicklook-exif-val">{payload.exifCamera}</span>
                  </div>
                )}
                {payload.exifLens && (
                  <div className="quicklook-exif-row">
                    <span className="quicklook-exif-label">Lente</span>
                    <span className="quicklook-exif-val">{payload.exifLens}</span>
                  </div>
                )}
                <div className="quicklook-exif-chips">
                  {payload.exifAperture && (
                    <div className="quicklook-exif-chip">
                      <span className="chip-key">Apertura</span>
                      <span className="chip-val">{payload.exifAperture}</span>
                    </div>
                  )}
                  {payload.exifShutter && (
                    <div className="quicklook-exif-chip">
                      <span className="chip-key">Obturador</span>
                      <span className="chip-val">{payload.exifShutter}</span>
                    </div>
                  )}
                  {payload.exifIso && (
                    <div className="quicklook-exif-chip">
                      <span className="chip-key">ISO</span>
                      <span className="chip-val">{payload.exifIso}</span>
                    </div>
                  )}
                  {payload.exifFocalLength && (
                    <div className="quicklook-exif-chip">
                      <span className="chip-key">Focal</span>
                      <span className="chip-val">{payload.exifFocalLength}</span>
                    </div>
                  )}
                </div>
                {payload.exifDateTaken && (
                  <div className="quicklook-exif-footer">
                    <Icon name="clock" />
                    <span>{payload.exifDateTaken}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="quicklook-btn-icon-action quicklook-btn-primary-action"
          onClick={(e) => {
            e.stopPropagation();
            onOpenInMain();
          }}
          title={["markdown", "text", "html", "lyrics", "pdf", "epub"].includes(payload.mediaType) ? "Abrir visor completo en Prisma" : "Abrir en Prisma"}
        >
          <Icon name="external-link" />
        </button>

        {/* Botón Editar para documentos y texto */}
        {onEdit && (
          <button
            type="button"
            className="quicklook-btn-icon-action"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Editar con el editor predeterminado de Windows"
          >
            <Icon name="edit" />
          </button>
        )}

        {/* Botón rápido de copiar ruta */}
        <button
          type="button"
          className="quicklook-btn-icon-action"
          onClick={handleCopyPath}
          title={copiedPath ? "¡Ruta copiada!" : "Copiar ruta del archivo"}
        >
          <Icon name={copiedPath ? "check" : "copy"} />
        </button>

        {onCompare && payload.mediaType === "image" && (
          <button
            type="button"
            className="quicklook-btn-icon-action"
            onClick={(e) => {
              e.stopPropagation();
              onCompare();
            }}
            title="Comparar esta imagen con otra (Lado a lado, cortinilla, cuadrícula)"
          >
            <Icon name="compare" />
          </button>
        )}

        {onOpenDetached && (
          <button
            type="button"
            className="quicklook-btn-icon-action"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetached();
            }}
            title="Fijar en ventana flotante independiente (sin barra de tareas)"
          >
            <Icon name="layers" />
          </button>
        )}

        {onToggleMaximize && (
          <button
            type="button"
            className="quicklook-btn-icon-action"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMaximize();
            }}
            title={isMaximized ? "Restaurar tamaño" : "Pantalla completa / Maximizar"}
          >
            <Icon name={isMaximized ? "fullscreen-exit" : "fullscreen"} />
          </button>
        )}

        <button
          type="button"
          className="quicklook-btn-close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Cerrar vista previa (Esc)"
        >
          <Icon name="close" />
        </button>
      </div>
    </header>
  );
}
