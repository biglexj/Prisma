import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";

interface QuickLookHeaderProps {
  payload: QuickLookPayload;
  onOpenInMain: () => void;
  onClose: () => void;
}

export function QuickLookHeader({
  payload,
  onOpenInMain,
  onClose,
}: QuickLookHeaderProps) {
  const iconName =
    payload.mediaType === "audio"
      ? "music"
      : payload.mediaType === "video"
        ? "video"
        : "image";

  return (
    <header className="quicklook-header">
      <div className="quicklook-header-drag" data-tauri-drag-region>
        <span className="quicklook-file-icon">
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

      <div className="quicklook-header-actions">
        <button
          className="quicklook-btn-open"
          onClick={onOpenInMain}
          title="Abrir en ventana completa de Prisma"
        >
          <Icon name="layout" />
          <span>Abrir en Prisma</span>
        </button>

        <button
          className="quicklook-btn-close"
          onClick={onClose}
          title="Cerrar vista previa (Esc)"
        >
          <Icon name="close" />
        </button>
      </div>
    </header>
  );
}
