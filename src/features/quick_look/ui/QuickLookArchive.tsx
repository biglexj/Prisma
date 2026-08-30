import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";
import "./quick-look-archive.css";

interface QuickLookArchiveProps {
  payload: QuickLookPayload;
}

function formatBytes(bytes: number): string {
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;
  if (bytes >= gb) return `${(bytes / gb).toFixed(2)} GB`;
  if (bytes >= mb) return `${(bytes / mb).toFixed(1)} MB`;
  if (bytes >= kb) return `${(bytes / kb).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function QuickLookArchive({ payload }: QuickLookArchiveProps) {
  const [filter, setFilter] = useState("");

  const handleOpenExplorer = () => {
    void invoke("open_in_file_manager", { path: payload.path });
  };

  const handleOpenDefault = () => {
    void invoke("open_path_with_default_app", { path: payload.path });
  };

  const count = payload.archiveItemsCount ?? 0;
  const uncompressedBytes = payload.archiveUncompressedBytes ?? payload.fileSizeBytes;
  const compressedBytes = payload.fileSizeBytes;
  const entries = payload.archiveEntries ?? [];

  const ratio =
    uncompressedBytes > 0 && compressedBytes < uncompressedBytes
      ? Math.round(((uncompressedBytes - compressedBytes) / uncompressedBytes) * 100)
      : null;

  const filteredEntries = filter.trim()
    ? entries.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase()))
    : entries;

  return (
    <div className="quicklook-archive-container">
      <div className="quicklook-archive-header-card">
        <div className="quicklook-archive-hero-icon">
          <Icon name="archive" />
        </div>
        <div className="quicklook-archive-details">
          <h2>{payload.fileName}</h2>
          <div className="quicklook-archive-meta">
            <span className="quicklook-badge">
              <Icon name="file" /> {count > 0 ? `${count} archivos` : payload.extension.toUpperCase()}
            </span>
            <span className="quicklook-badge quicklook-badge-uncompressed">
              <Icon name="hard-drive" /> Descomprimido: {formatBytes(uncompressedBytes)}
            </span>
            {ratio !== null && ratio > 0 && (
              <span className="quicklook-badge quicklook-badge-ratio">
                ⚡ {ratio}% ahorro
              </span>
            )}
          </div>
        </div>
      </div>

      {entries.length > 6 && (
        <div className="quicklook-archive-filter-bar">
          <Icon name="search" />
          <input
            type="text"
            placeholder="Filtrar archivos del archivo..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="quicklook-archive-filter-input"
          />
          {filter && (
            <button
              type="button"
              className="quicklook-archive-filter-clear"
              onClick={() => setFilter("")}
            >
              <Icon name="close" />
            </button>
          )}
        </div>
      )}

      {entries.length > 0 ? (
        <div className="quicklook-archive-entries-list">
          <div className="quicklook-archive-entries-header">
            <span>Nombre</span>
            <span>Tamaño</span>
          </div>
          <div className="quicklook-archive-entries-scroll">
            {filteredEntries.map((entry, i) => (
              <div
                className={`quicklook-archive-entry-row ${entry.isDir ? "is-dir" : ""}`}
                key={`${entry.name}-${i}`}
              >
                <div className="quicklook-archive-entry-name">
                  <Icon name={entry.isDir ? "folder" : "file"} />
                  <span title={entry.name}>{entry.name}</span>
                </div>
                <div className="quicklook-archive-entry-size">
                  {entry.isDir ? "Carpeta" : formatBytes(entry.uncompressedSize)}
                </div>
              </div>
            ))}
            {filteredEntries.length === 0 && (
              <div className="quicklook-archive-empty-filter">
                No se encontraron coincidencias para "{filter}"
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="quicklook-archive-summary-fallback">
          <Icon name="archive" />
          <p>Archivo comprimido ({payload.extension.toUpperCase()})</p>
          <span>{payload.formattedSize}</span>
        </div>
      )}

      <div className="quicklook-archive-actions">
        <button
          className="quicklook-primary-action-btn"
          onClick={handleOpenDefault}
          type="button"
        >
          <Icon name="external-link" />
          <span>Abrir archivo</span>
        </button>
        <button
          className="quicklook-secondary-action-btn"
          onClick={handleOpenExplorer}
          type="button"
        >
          <Icon name="folder-open" />
          <span>Mostrar en el Explorador</span>
        </button>
      </div>
    </div>
  );
}
