import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";
import "./quick-look-exif.css";

interface QuickLookHeaderProps {
  payload: QuickLookPayload;
  imageDimensions: { width: number; height: number } | null;
  isMaximized: boolean;
  isPinned?: boolean;
  onClose: () => void;
  onOpenInMain: () => void;
  onTogglePin?: () => void;
  onEdit?: () => void;
  onCompare?: () => void;
  onToggleMaximize?: () => void;
  onStepSelection: (forward: boolean) => void;
}

export function QuickLookHeader({
  payload,
  imageDimensions,
  isMaximized,
  isPinned,
  onClose,
  onOpenInMain,
  onTogglePin,
  onEdit,
  onCompare,
  onToggleMaximize,
  onStepSelection,
}: QuickLookHeaderProps) {
  const [showExif, setShowExif] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  // Arrastre nativo acelerado por hardware a máxima tasa de refresco (144Hz+)
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.button !== 0 && e.buttons !== 1) || isMaximized) return;
    if (
      (e.target as HTMLElement).closest(
        "button, a, input, .quicklook-exif-popover, .quicklook-header-actions, .quicklook-selection-pager",
      )
    ) {
      return;
    }

    void getCurrentWebviewWindow().startDragging().catch(() => {
      void invoke("quick_look_start_dragging").catch(() => {});
    });
  };

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
      data-tauri-drag-region
      onPointerDown={handlePointerDown}
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

        {/* 1. Abrir en Prisma */}
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

        {/* 2. Fijar / Bloquear ventana */}
        {onTogglePin && (
          <button
            type="button"
            className={`quicklook-btn-icon-action ${isPinned ? "is-pinned is-active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            title={isPinned ? "Desbloquear ventana (reactivar seguimiento del explorador)" : "Bloquear / Fijar ventana (aislar e ignorar clics fuera)"}
          >
            <Icon name="pin" />
          </button>
        )}

        {/* Botón Editar para documentos y texto si está disponible */}
        {onEdit && (
          <button
            type="button"
            className="quicklook-btn-icon-action"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Editar en Prisma (Editor de documentos)"
          >
            <Icon name="edit" />
          </button>
        )}

        {/* 3. Copiar ruta */}
        <button
          type="button"
          className="quicklook-btn-icon-action"
          onClick={handleCopyPath}
          title={copiedPath ? "¡Ruta copiada!" : "Copiar ruta del archivo"}
        >
          <Icon name={copiedPath ? "check" : "copy"} />
        </button>

        {/* 4. Comparar imagen */}
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

        {/* 5. Expandir / Maximizar */}
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

        {/* 6. Cerrar */}
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
