import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";

interface QuickLookFallbackProps {
  payload: QuickLookPayload;
}

export function QuickLookFallback({ payload }: QuickLookFallbackProps) {
  const handleOpenDefault = () => {
    void invoke("open_in_file_manager", { path: payload.path });
  };

  const ext = payload.extension ? `.${payload.extension.toUpperCase()}` : "ARCHIVO";

  return (
    <div className="quicklook-fallback-container">
      <div className="quicklook-fallback-card">
        <div className="quicklook-fallback-icon-box">
          <Icon name="file" />
          <span className="quicklook-fallback-ext">{ext}</span>
        </div>
        <div className="quicklook-fallback-info">
          <h2>{payload.fileName}</h2>
          <div className="quicklook-fallback-meta-pills">
            <span className="quicklook-badge">{payload.formattedSize}</span>
            {payload.modifiedDate ? (
              <span className="quicklook-badge-subtle">{payload.modifiedDate}</span>
            ) : null}
          </div>
          <p className="quicklook-fallback-path" title={payload.path}>
            {payload.path}
          </p>
        </div>
      </div>

      <div className="quicklook-fallback-actions">
        <button
          className="quicklook-primary-action-btn"
          onClick={handleOpenDefault}
          type="button"
        >
          <Icon name="external-link" />
          <span>Abrir con la aplicación predeterminada</span>
        </button>
      </div>
    </div>
  );
}
