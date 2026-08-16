import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";

interface QuickLookHeaderProps {
  payload: QuickLookPayload;
  imageDimensions?: { width: number; height: number } | null;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onOpenInMain: () => void;
  onClose: () => void;
}

export function QuickLookHeader({
  payload,
  imageDimensions,
  isMaximized = false,
  onToggleMaximize,
  onOpenInMain,
  onClose,
}: QuickLookHeaderProps) {
  const iconName =
    payload.mediaType === "audio"
      ? "music"
      : payload.mediaType === "video"
        ? "video"
        : "image";

  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest("button")) {
      void invoke("quick_look_start_dragging").catch(() => {});
    }
  };

  const effectiveDims =
    imageDimensions ||
    (payload.width && payload.height
      ? { width: payload.width, height: payload.height }
      : null);

  return (
    <header
      className="quicklook-header"
      data-tauri-drag-region
      onMouseDown={handleDragStart}
    >
      <div
        className="quicklook-header-drag"
        data-tauri-drag-region
        onDoubleClick={onToggleMaximize}
      >
        <span className="quicklook-file-icon" data-tauri-drag-region>
          <Icon name={iconName} />
        </span>
        <div className="quicklook-file-info" data-tauri-drag-region>
          <span className="quicklook-file-name" title={payload.path} data-tauri-drag-region>
            {payload.fileName}
          </span>
          <span className="quicklook-file-badge" data-tauri-drag-region>
            {payload.formattedSize}
          </span>
        </div>
      </div>

      <div
        className="quicklook-header-actions"
        data-tauri-drag-region="false"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {effectiveDims && (
          <span
            className="quicklook-file-badge quicklook-dims-badge"
            title="Resolución"
          >
            {effectiveDims.width} × {effectiveDims.height} px
          </span>
        )}

        <button
          type="button"
          className="quicklook-btn-open"
          onClick={(e) => {
            e.stopPropagation();
            onOpenInMain();
          }}
          title="Abrir en Prisma"
        >
          <Icon name="external-link" />
          <span>Abrir en Prisma</span>
        </button>

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
