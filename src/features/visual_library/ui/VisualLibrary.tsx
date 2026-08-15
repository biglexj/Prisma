import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import type { VisualFolderSource, VisualLibraryItem, VisualMediaKind } from "../model/types";
import { VisualThumbnail } from "./VisualThumbnail";
import { VideoThumbnail } from "./VideoThumbnail";
import "./visual-library.css";

const VISIBLE_ITEM_LIMIT = 240;

type ViewMode = "timeline" | "folders";
type FolderNavState = { folderName: string } | null;

interface VisualLibraryProps {
  kind: VisualMediaKind;
  folders: VisualFolderSource[];
  items: VisualLibraryItem[];
  loading: boolean;
  error: string | null;
  onAdd: (path: string) => Promise<void>;
  onOpenVideo: (path: string) => void;
  onOpenFolders: () => void;
}

interface TimelineSection {
  title: string;
  items: VisualLibraryItem[];
}

interface FolderSection {
  folderName: string;
  items: VisualLibraryItem[];
}

export function VisualLibrary({
  kind,
  folders,
  items,
  loading,
  error,
  onAdd,
  onOpenVideo,
  onOpenFolders,
}: VisualLibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [selectedImage, setSelectedImage] = useState<VisualLibraryItem | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FolderNavState>(null);

  const isImage = kind === "image";
  const label = isImage ? "Imágenes" : "Vídeos";

  useEffect(() => {
    if (!selectedImage) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedImage(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedImage]);

  const chooseFolder = async () => {
    const selection = await open({
      multiple: false,
      directory: true,
      title: `Añadir carpeta de ${label.toLowerCase()} a Prisma`,
    });
    if (typeof selection === "string") await onAdd(selection);
  };

  const timelineSections = groupByTimeline(items.slice(0, VISIBLE_ITEM_LIMIT));
  const folderSections = groupByFolder(items.slice(0, VISIBLE_ITEM_LIMIT));

  const openedFolder = selectedFolder
    ? (folderSections.find((s) => s.folderName === selectedFolder.folderName) ?? null)
    : null;

  const handleSwitchMode = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedFolder(null);
  };

  return (
    <section className={`visual-library visual-library-${kind}`}>
      <header className="visual-library-heading">
        <div className="section-heading">
          <span className="preview-kicker">BIBLIOTECA VISUAL</span>
          <h1>{label}</h1>
          <p>
            {isImage
              ? "Explora tus fotografías e ilustraciones organizadas en Bento Grid (4x4, 4x2, 2x4) según su proporción nativa."
              : "Organiza y reproduce tus vídeos locales en tu pantalla de cine y reproductor independiente."}
          </p>
        </div>
        <div className="visual-heading-actions">
          <button className="tonal-button" onClick={onOpenFolders}>
            <Icon name="folder" /> Administrar fuentes
          </button>
          <button className="filled-button" onClick={() => void chooseFolder()}>
            <Icon name="plus" /> Añadir carpeta
          </button>
        </div>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          <strong>No se pudo leer la biblioteca de {label.toLowerCase()}</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="visual-controls-bar">
        <div className="visual-summary" aria-live="polite">
          <span>
            <strong>{items.length}</strong> {label.toLowerCase()}
          </span>
          <span>
            <strong>{folders.length}</strong> {folders.length === 1 ? "carpeta" : "carpetas"}
          </span>
          <span>
            <i className={folders.some((folder) => folder.available) ? "is-ready" : ""} /> Escaneo bajo demanda
          </span>
        </div>

        <div className="visual-view-mode-tabs">
          <button
            className={viewMode === "timeline" ? "is-active" : ""}
            onClick={() => handleSwitchMode("timeline")}
            title="Línea de tiempo"
          >
            <Icon name="clock" />
            <span>Línea de tiempo</span>
          </button>
          <button
            className={viewMode === "folders" ? "is-active" : ""}
            onClick={() => handleSwitchMode("folders")}
            title="Carpetas"
          >
            <Icon name="folder" />
            <span>Carpetas</span>
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="visual-empty-state" aria-busy={loading}>
          <span>
            <Icon name={isImage ? "image" : "video"} />
          </span>
          <h2>{loading ? `Buscando ${label.toLowerCase()}…` : `Aún no hay ${label.toLowerCase()}`}</h2>
          <p>Añade una carpeta raíz; Prisma reconocerá también el contenido de sus subcarpetas.</p>
          <button className="filled-button" disabled={loading} onClick={() => void chooseFolder()}>
            <Icon name="folder" /> Seleccionar carpeta
          </button>
        </div>
      ) : viewMode === "timeline" ? (
        <div className="visual-timeline-container" aria-busy={loading}>
          {timelineSections.map((section) => (
            <div className="visual-section" key={section.title}>
              <header className="visual-section-header">
                <h3>{section.title}</h3>
                <span className="visual-section-count">
                  {section.items.length} {section.items.length === 1 ? "elemento" : "elementos"}
                </span>
              </header>
              <div className="visual-grid bento-grid-layout">
                {section.items.map((item, idx) => (
                  <VisualCard
                    index={idx}
                    isImage={isImage}
                    item={item}
                    key={item.path}
                    onClick={() => (isImage ? setSelectedImage(item) : onOpenVideo(item.path))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : openedFolder ? (
        /* ── Vista interna de carpeta ── */
        <div className="visual-folder-view" aria-busy={loading}>
          <header className="visual-folder-view-header">
            <button
              className="visual-folder-back"
              onClick={() => setSelectedFolder(null)}
              title="Volver a carpetas"
            >
              <Icon name="arrow-left" />
            </button>
            <span className="visual-folder-breadcrumb">
              <button
                className="visual-folder-breadcrumb-root"
                onClick={() => setSelectedFolder(null)}
              >
                Carpetas
              </button>
              <Icon name="chevron-right" />
              <strong>{openedFolder.folderName}</strong>
            </span>
            <span className="visual-section-count">
              {openedFolder.items.length} {openedFolder.items.length === 1 ? "archivo" : "archivos"}
            </span>
          </header>
          <div className="visual-grid bento-grid-layout">
            {openedFolder.items.map((item, idx) => (
              <VisualCard
                index={idx}
                isImage={isImage}
                item={item}
                key={item.path}
                onClick={() => (isImage ? setSelectedImage(item) : onOpenVideo(item.path))}
              />
            ))}
          </div>
        </div>
      ) : (
        /* ── Vista de colecciones de carpetas (2×N) ── */
        <div className="visual-folder-collections" aria-busy={loading}>
          {folderSections.map((section) => (
            <FolderCollectionCard
              isImage={isImage}
              key={section.folderName}
              section={section}
              onOpen={() => setSelectedFolder({ folderName: section.folderName })}
            />
          ))}
        </div>
      )}

      {items.length > VISIBLE_ITEM_LIMIT ? (
        <p className="visual-limit-note">
          Se muestran los {VISIBLE_ITEM_LIMIT} elementos más recientes para mantener la interfaz ligera.
        </p>
      ) : null}

      {selectedImage ? (
        <div
          aria-label={selectedImage.title}
          aria-modal="true"
          className="image-viewer"
          onClick={() => setSelectedImage(null)}
          role="dialog"
        >
          <button
            aria-label="Cerrar vista previa"
            className="image-viewer-close"
            onClick={() => setSelectedImage(null)}
          >
            <Icon name="close" />
          </button>
          <figure onClick={(event) => event.stopPropagation()}>
            <img
              alt={selectedImage.title}
              className="image-viewer-media"
              src={convertFileSrc(selectedImage.path)}
              style={{ objectFit: "contain" }}
            />
            <figcaption>
              <strong>{selectedImage.title}</strong>
              <span>{selectedImage.path}</span>
            </figcaption>
          </figure>
        </div>
      ) : null}
    </section>
  );
}

interface VisualCardProps {
  item: VisualLibraryItem;
  index: number;
  isImage: boolean;
  onClick: () => void;
}

function VisualCard({ item, index, isImage, onClick }: VisualCardProps) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Videos start neutral (square) until VideoThumbnail reports real dimensions.
  // Images use an index-based fallback until the real thumbnail loads.
  let bentoClass = isImage
    ? index % 3 === 0 ? "bento-card-vertical" : index % 2 === 0 ? "bento-card-horizontal" : "bento-card-square"
    : "bento-card-square";

  // Override with real aspect ratio once dimensions are known (10% tolerance)
  if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
    const ratio = dimensions.width / dimensions.height;
    if (ratio > 1.1) {
      bentoClass = "bento-card-horizontal";
    } else if (ratio < 0.9) {
      bentoClass = "bento-card-vertical";
    } else {
      bentoClass = "bento-card-square";
    }
  }

  return (
    <button className={`visual-media-card ${bentoClass}`} onClick={onClick} title={item.path}>
      <span className="visual-media-frame">
        {isImage ? (
          <VisualThumbnail
            alt={item.title}
            className="visual-thumbnail"
            onLoadDimensions={(w, h) => setDimensions({ width: w, height: h })}
            path={item.path}
          />
        ) : (
          <VideoThumbnail
            className="visual-thumbnail"
            path={item.path}
            title={item.title}
            onLoadDimensions={(w, h) => setDimensions({ width: w, height: h })}
          />
        )}
        {!isImage ? (
          <i className="visual-play">
            <Icon name="play" />
          </i>
        ) : null}
      </span>
      <span className="visual-card-caption">
        <strong>{item.title}</strong>
        <small>
          {item.relativeFolder} · {formatBytes(item.sizeBytes)}
        </small>
      </span>
    </button>
  );
}

function groupByTimeline(items: VisualLibraryItem[]): TimelineSection[] {
  const groupsMap = new Map<string, VisualLibraryItem[]>();

  const now = new Date();
  const todayTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayTimestamp = todayTimestamp - 86400000;

  for (const item of items) {
    const itemDate = new Date(item.modifiedAtMillis);
    const itemDayTimestamp = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate()).getTime();

    let title: string;
    if (itemDayTimestamp === todayTimestamp) {
      title = "Hoy";
    } else if (itemDayTimestamp === yesterdayTimestamp) {
      title = "Ayer";
    } else {
      title = itemDate.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }

    const existing = groupsMap.get(title);
    if (existing) {
      existing.push(item);
    } else {
      groupsMap.set(title, [item]);
    }
  }

  return Array.from(groupsMap.entries()).map(([title, items]) => ({ title, items }));
}

function groupByFolder(items: VisualLibraryItem[]): FolderSection[] {
  const groupsMap = new Map<string, VisualLibraryItem[]>();

  for (const item of items) {
    const folderName = item.relativeFolder || "Carpeta principal";
    const existing = groupsMap.get(folderName);
    if (existing) {
      existing.push(item);
    } else {
      groupsMap.set(folderName, [item]);
    }
  }

  return Array.from(groupsMap.entries()).map(([folderName, items]) => ({ folderName, items }));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FolderCollectionCardProps {
  section: FolderSection;
  isImage: boolean;
  onOpen: () => void;
}

function FolderCollectionCard({ section, isImage, onOpen }: FolderCollectionCardProps) {
  // Use first 4 items for the mosaic preview
  const preview = section.items.slice(0, 4);

  return (
    <button className="folder-collection-card" onClick={onOpen} title={section.folderName}>
      <span className="folder-collection-mosaic">
        {preview.map((item, i) => (
          <span className="folder-collection-cell" key={item.path} data-index={i}>
            {isImage ? (
              <VisualThumbnail
                alt={item.title}
                className="visual-thumbnail"
                path={item.path}
              />
            ) : (
              <VideoThumbnail className="visual-thumbnail" path={item.path} title={item.title} />
            )}
          </span>
        ))}
        {preview.length === 0 && (
          <span className="folder-collection-empty">
            <Icon name={isImage ? "image" : "video"} />
          </span>
        )}
        <span className="folder-collection-overlay">
          <Icon name="folder-open" />
        </span>
      </span>
      <span className="folder-collection-info">
        <strong className="folder-collection-name">{section.folderName}</strong>
        <small className="folder-collection-count">
          {section.items.length} {section.items.length === 1 ? "archivo" : "archivos"}
        </small>
      </span>
    </button>
  );
}

