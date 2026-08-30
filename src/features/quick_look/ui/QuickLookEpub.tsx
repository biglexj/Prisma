import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";
import "./quick-look-epub.css";

interface QuickLookEpubProps {
  payload: QuickLookPayload;
}

export function QuickLookEpub({ payload }: QuickLookEpubProps) {
  const [activeTab, setActiveTab] = useState<"synopsis" | "chapters">("synopsis");

  const handleOpenExplorer = () => {
    void invoke("open_in_file_manager", { path: payload.path });
  };

  const handleOpenDefault = () => {
    void invoke("open_path_with_default_app", { path: payload.path });
  };

  const coverUrl = payload.epubCoverDataUrl;
  const author = payload.epubAuthor || "Autor no especificado";
  const description = payload.epubDescription;
  const chapters = payload.epubChapters ?? [];

  return (
    <div className="quicklook-epub-container">
      <div className="quicklook-epub-body">
        <div className="quicklook-epub-cover-column">
          <div className="quicklook-epub-book-3d">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={payload.fileName}
                className="quicklook-epub-cover-img"
              />
            ) : (
              <div className="quicklook-epub-cover-fallback">
                <Icon name="book" />
                <span className="quicklook-epub-fallback-title">{payload.fileName}</span>
                <span className="quicklook-epub-fallback-author">{author}</span>
              </div>
            )}
            <div className="quicklook-epub-book-spine" />
          </div>
          <div className="quicklook-epub-file-meta">
            <span className="quicklook-badge">EPUB</span>
            <span className="quicklook-badge">{payload.formattedSize}</span>
          </div>
        </div>

        <div className="quicklook-epub-info-column">
          <div className="quicklook-epub-header">
            <h2 className="quicklook-epub-title">{payload.fileName.replace(/\.epub$/i, "")}</h2>
            <div className="quicklook-epub-author">
              <Icon name="user" />
              <span>{author}</span>
            </div>
          </div>

          <div className="quicklook-epub-tabs">
            <button
              type="button"
              className={`quicklook-epub-tab ${activeTab === "synopsis" ? "is-active" : ""}`}
              onClick={() => setActiveTab("synopsis")}
            >
              <Icon name="file-text" />
              <span>Sinopsis</span>
            </button>
            {chapters.length > 0 && (
              <button
                type="button"
                className={`quicklook-epub-tab ${activeTab === "chapters" ? "is-active" : ""}`}
                onClick={() => setActiveTab("chapters")}
              >
                <Icon name="list" />
                <span>Capítulos ({chapters.length})</span>
              </button>
            )}
          </div>

          <div className="quicklook-epub-tab-content">
            {activeTab === "synopsis" ? (
              <div className="quicklook-epub-synopsis">
                {description ? (
                  <p>{description}</p>
                ) : (
                  <div className="quicklook-epub-no-synopsis">
                    <Icon name="info" />
                    <span>Sin sinopsis disponible en los metadatos del libro.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="quicklook-epub-chapters-list">
                {chapters.map((ch, idx) => (
                  <div className="quicklook-epub-chapter-row" key={`${ch}-${idx}`}>
                    <span className="quicklook-epub-chapter-num">{idx + 1}</span>
                    <span className="quicklook-epub-chapter-name">{ch}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="quicklook-epub-actions">
        <button
          className="quicklook-primary-action-btn"
          onClick={handleOpenDefault}
          type="button"
        >
          <Icon name="external-link" />
          <span>Leer libro</span>
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
