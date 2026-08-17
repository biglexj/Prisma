import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";

interface QuickLookProjectProps {
  payload: QuickLookPayload;
  onClose?: () => void;
}

export function QuickLookProject({ payload, onClose }: QuickLookProjectProps) {
  const handleOpenDefault = () => {
    void invoke("open_path_with_default_app", { path: payload.path });
    onClose?.();
  };

  const previewUrl = payload.projectPreviewUrl;

  return (
    <div className="quicklook-project-container">
      {previewUrl ? (
        <div className="quicklook-project-preview-wrap">
          <img
            alt={payload.fileName}
            className="quicklook-project-image"
            src={previewUrl}
          />
          <div className="quicklook-project-badge-overlay">
            <span className="quicklook-badge">{payload.extension.toUpperCase()}</span>
          </div>
        </div>
      ) : (
        <div className="quicklook-project-placeholder">
          <Icon name="layers" />
          <h3>Proyecto {payload.extension.toUpperCase()}</h3>
          <span>{payload.formattedSize}</span>
        </div>
      )}

      <div className="quicklook-project-footer">
        <div className="quicklook-project-meta">
          <span className="quicklook-project-name">{payload.fileName}</span>
          <span className="quicklook-project-size">{payload.formattedSize}</span>
        </div>
        <button
          className="quicklook-primary-action-btn"
          onClick={handleOpenDefault}
          type="button"
        >
          <Icon name="external-link" />
          <span>Abrir archivo</span>
        </button>
      </div>
    </div>
  );
}
