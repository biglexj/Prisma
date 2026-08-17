import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";

interface QuickLookFolderProps {
  payload: QuickLookPayload;
}

export function QuickLookFolder({ payload }: QuickLookFolderProps) {
  const handleOpenExplorer = () => {
    void invoke("open_in_file_manager", { path: payload.path });
  };

  const count = payload.folderItemsCount ?? 0;
  const items = payload.folderPreviewItems ?? [];

  return (
    <div className="quicklook-folder-container">
      <div className="quicklook-folder-card">
        <div className="quicklook-folder-hero-icon">
          <Icon name="folder" />
        </div>
        <div className="quicklook-folder-details">
          <h2>{payload.fileName}</h2>
          <div className="quicklook-folder-meta">
            <span className="quicklook-badge">
              <Icon name="folder-open" /> {count} {count === 1 ? "elemento" : "elementos"}
            </span>
            <span>{payload.formattedSize}</span>
          </div>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="quicklook-folder-preview-list">
          <span className="quicklook-folder-preview-title">Contenido inmediato</span>
          <div className="quicklook-folder-items-grid">
            {items.map((name, i) => (
              <div className="quicklook-folder-item" key={i}>
                <Icon name="file" />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="quicklook-folder-actions">
        <button className="quicklook-primary-action-btn" onClick={handleOpenExplorer} type="button">
          <Icon name="folder-open" />
          <span>Abrir en el Explorador de archivos</span>
        </button>
      </div>
    </div>
  );
}
