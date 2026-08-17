import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";
import { quickLookClient } from "../tauri/client";

interface QuickLookPlaylistProps {
  payload: QuickLookPayload;
}

export function QuickLookPlaylist({ payload }: QuickLookPlaylistProps) {
  const count = payload.folderItemsCount ?? 0;
  const items = payload.folderPreviewItems ?? [];
  const ext = (payload.extension || "m3u").toUpperCase();

  const handlePlay = () => {
    void quickLookClient.openInMain(payload.path);
  };

  return (
    <div className="quicklook-folder-container">
      {/* Cabecera de la lista */}
      <div className="quicklook-folder-hero">
        <div className="quicklook-folder-icon-wrapper" style={{ background: "rgba(227, 184, 245, 0.15)", color: "#e3b8f5" }}>
          <Icon name="list-music" />
        </div>
        <div className="quicklook-folder-hero-info">
          <span className="quicklook-folder-badge" style={{ background: "rgba(227, 184, 245, 0.2)", color: "#f3d5fc" }}>
            LISTA DE REPRODUCCIÓN · {ext}
          </span>
          <h2 className="quicklook-folder-title">{payload.fileName}</h2>
          <p className="quicklook-folder-meta">
            {count} {count === 1 ? "canción o vídeo" : "canciones o vídeos"} · {payload.formattedSize}
          </p>
        </div>
      </div>

      {/* Listado de pistas — scrollable, con espacio reservado para el botón */}
      <div className="quicklook-folder-preview-section">
        <span className="quicklook-folder-section-title">Contenido de la lista</span>
        {items.length > 0 ? (
          <ul className="quicklook-folder-items-list">
            {items.map((name, idx) => (
              <li key={idx} className="quicklook-folder-item">
                <span style={{ fontSize: "0.75rem", opacity: 0.5, minWidth: "1.5rem" }}>{idx + 1}.</span>
                <Icon name="music" />
                <span className="quicklook-folder-item-name">{name}</span>
              </li>
            ))}
            {count > items.length ? (
              <li className="quicklook-folder-item-more">
                +{count - items.length} pistas más en esta lista...
              </li>
            ) : null}
          </ul>
        ) : (
          <div className="quicklook-folder-empty-state">
            <Icon name="list-music" />
            <p>Lista vacía o sin pistas legibles</p>
          </div>
        )}
      </div>

      {/* Botón fijo al fondo — nunca se corta */}
      <div className="quicklook-playlist-action">
        <button
          className="quicklook-primary-action-btn"
          onClick={handlePlay}
          style={{ background: "linear-gradient(135deg, #733380 0%, #9c4ba3 100%)" }}
          type="button"
        >
          <Icon name="play" />
          <span>Reproducir lista en Prisma</span>
        </button>
      </div>
    </div>
  );
}
