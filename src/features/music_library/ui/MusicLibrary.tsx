import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { FolderBreadcrumbHeader } from "../../../shared/ui/FolderBreadcrumbHeader";
import type { MusicFolderSource, MusicLibraryItem } from "../model/types";
import type { MusicQueueItem } from "../../playback/model/queue";
import { MusicArtwork } from "./MusicArtwork";
import "./music-library.css";

const VISIBLE_ITEM_LIMIT = 300;

type ViewMode = "timeline" | "folders";
type FolderNavState = { folderName: string } | null;

interface MusicLibraryProps {
  folders: MusicFolderSource[];
  items: MusicLibraryItem[];
  loading: boolean;
  error: string | null;
  onAdd: (path: string) => Promise<void>;
  onPlay: (path: string) => void;
  onPlayQueue?: (items: MusicQueueItem[], startIndex?: number, name?: string) => void;
  onAddToQueue?: (items: MusicQueueItem[]) => void;
  onOpenFolders: () => void;
}

interface TimelineSection {
  title: string;
  items: MusicLibraryItem[];
}

interface FolderSection {
  folderName: string;
  items: MusicLibraryItem[];
}

function toQueueItem(item: MusicLibraryItem): MusicQueueItem {
  return {
    id: item.path,
    path: item.path,
    title: item.title,
    artist: item.relativeFolder,
    folder: item.relativeFolder,
    sizeBytes: item.sizeBytes,
  };
}

export function MusicLibrary({
  folders,
  items,
  loading,
  error,
  onAdd,
  onPlay,
  onPlayQueue,
  onAddToQueue,
  onOpenFolders,
}: MusicLibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [selectedFolder, setSelectedFolder] = useState<FolderNavState>(null);

  const chooseFolder = async () => {
    const selection = await open({
      multiple: false,
      directory: true,
      title: "Añadir carpeta de música a Prisma",
    });
    if (typeof selection === "string") {
      await onAdd(selection);
    }
  };

  const visibleItems = items.slice(0, VISIBLE_ITEM_LIMIT);
  const timelineSections = groupByTimeline(visibleItems);
  const folderSections = groupByFolder(visibleItems);

  const openedFolder = selectedFolder
    ? (folderSections.find((s) => s.folderName === selectedFolder.folderName) ?? null)
    : null;

  const handlePlayAll = () => {
    if (items.length === 0) return;
    const queueItems = items.map(toQueueItem);
    if (onPlayQueue) {
      onPlayQueue(queueItems, 0, "Toda la Música");
    } else {
      onPlay(items[0].path);
    }
  };

  const handlePlayFolder = (folderName: string) => {
    const target = folderSections.find((s) => s.folderName === folderName);
    if (!target || target.items.length === 0) return;
    const queueItems = target.items.map(toQueueItem);
    if (onPlayQueue) {
      onPlayQueue(queueItems, 0, target.folderName);
    } else {
      onPlay(target.items[0].path);
    }
  };

  const handleAddFolderToQueue = (folderName: string) => {
    const target = folderSections.find((s) => s.folderName === folderName);
    if (!target || !onAddToQueue) return;
    onAddToQueue(target.items.map(toQueueItem));
  };

  const handlePlayItemInList = (list: MusicLibraryItem[], index: number, queueName?: string) => {
    if (onPlayQueue) {
      const queueItems = list.map(toQueueItem);
      onPlayQueue(queueItems, index, queueName ?? "Música");
    } else {
      onPlay(list[index].path);
    }
  };

  const handleSwitchMode = (mode: ViewMode) => {
    setViewMode(mode);
    setSelectedFolder(null);
  };

  return (
    <section className="music-library">
      <header className="music-library-heading">
        <div className="section-heading">
          <span className="preview-kicker">BIBLIOTECA MUSICAL</span>
          <h1>Música</h1>
          <p>
            Explora tu colección de canciones locales organizadas en línea de tiempo, árbol de carpetas con carátulas y gestión de colas.
          </p>
        </div>
        <div className="music-heading-actions">
          {items.length > 0 ? (
            <button className="tonal-button is-primary" onClick={handlePlayAll} title="Reproducir toda la música en cola">
              <Icon name="play" /> Reproducir todo
            </button>
          ) : null}
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
          <strong>No se pudo leer la biblioteca de música</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <div className="music-controls-bar">
        <div className="music-summary" aria-live="polite">
          <span>
            <strong>{items.length}</strong> {items.length === 1 ? "canción" : "canciones"}
          </span>
          <span>
            <strong>{folders.length}</strong> {folders.length === 1 ? "carpeta" : "carpetas"}
          </span>
          <span>
            <i className={folders.some((folder) => folder.available) ? "is-ready" : ""} /> Escaneo bajo demanda
          </span>
        </div>

        <div className="music-view-mode-tabs">
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
        <div className="music-empty-state" aria-busy={loading}>
          <span>
            <Icon name="music" />
          </span>
          <h2>{loading ? "Buscando canciones…" : "Aún no hay música en tu biblioteca"}</h2>
          <p>Añade una carpeta con música local; Prisma reconocerá también tus archivos en subcarpetas.</p>
          <button className="filled-button" disabled={loading} onClick={() => void chooseFolder()}>
            <Icon name="folder" /> Seleccionar carpeta
          </button>
        </div>
      ) : viewMode === "timeline" ? (
        <div className="music-timeline-container" aria-busy={loading}>
          {timelineSections.map((section) => (
            <div className="music-section" key={section.title}>
              <header className="music-section-header">
                <h3>{section.title}</h3>
                <span className="music-section-count">
                  {section.items.length} {section.items.length === 1 ? "canción" : "canciones"}
                </span>
              </header>
              <div className="music-auto-grid">
                {section.items.map((item, idx) => (
                  <MusicCard
                    item={item}
                    key={item.path}
                    onClick={() => handlePlayItemInList(section.items, idx, section.title)}
                    onAddToQueue={onAddToQueue ? () => onAddToQueue([toQueueItem(item)]) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : openedFolder ? (
        /* ── Vista interna de carpeta con Breadcrumbs de Lienzo ── */
        <div className="music-folder-internal-view" aria-busy={loading}>
          <FolderBreadcrumbHeader
            currentPath={openedFolder.folderName}
            itemCount={openedFolder.items.length}
            onNavigate={() => setSelectedFolder(null)}
            onPlayFolder={() => handlePlayFolder(openedFolder.folderName)}
            onAddFolderToQueue={onAddToQueue ? () => handleAddFolderToQueue(openedFolder.folderName) : undefined}
          />
          <div className="music-auto-grid">
            {openedFolder.items.map((item, idx) => (
              <MusicCard
                item={item}
                key={item.path}
                onClick={() => handlePlayItemInList(openedFolder.items, idx, openedFolder.folderName)}
                onAddToQueue={onAddToQueue ? () => onAddToQueue([toQueueItem(item)]) : undefined}
              />
            ))}
          </div>
        </div>
      ) : (
        /* ── Vista de colecciones de carpetas en árbol/mosaico ── */
        <div className="music-folder-collections" aria-busy={loading}>
          {folderSections.map((section) => (
            <MusicFolderCard
              key={section.folderName}
              section={section}
              onOpen={() => setSelectedFolder({ folderName: section.folderName })}
              onPlay={() => handlePlayFolder(section.folderName)}
            />
          ))}
        </div>
      )}

      {items.length > VISIBLE_ITEM_LIMIT ? (
        <p className="music-limit-note">
          Se muestran las {VISIBLE_ITEM_LIMIT} canciones más recientes para mantener la interfaz fluida y ligera.
        </p>
      ) : null}
    </section>
  );
}

interface MusicCardProps {
  item: MusicLibraryItem;
  onClick: () => void;
  onAddToQueue?: () => void;
}

function MusicCard({ item, onClick, onAddToQueue }: MusicCardProps) {
  return (
    <div className="music-media-card-wrapper">
      <button className="music-media-card" onClick={onClick} title={`${item.title} — ${item.relativeFolder}`}>
        <span className="music-media-frame">
          <span className="music-frame-placeholder">
            <Icon name="music" />
          </span>
          <MusicArtwork alt={item.title} className="music-card-artwork" path={item.path} />

          <span className="music-hover-overlay">
            <i className="music-play-badge">
              <Icon name="play" />
            </i>
            <div className="music-hover-info">
              <strong className="music-hover-title" title={item.title}>
                {item.title}
              </strong>
              <span className="music-hover-artist" title={item.relativeFolder}>
                {item.relativeFolder}
              </span>
            </div>
          </span>
        </span>
        <span className="music-card-caption">
          <strong>{item.title}</strong>
          <small>
            {item.relativeFolder}
            {item.sizeBytes ? ` · ${formatBytes(item.sizeBytes)}` : ""}
          </small>
        </span>
      </button>

      {onAddToQueue ? (
        <button
          className="music-card-queue-btn"
          onClick={(e) => {
            e.stopPropagation();
            onAddToQueue();
          }}
          title="Añadir a la cola"
        >
          <Icon name="queue" />
        </button>
      ) : null}
    </div>
  );
}

interface MusicFolderCardProps {
  section: FolderSection;
  onOpen: () => void;
  onPlay: () => void;
}

function MusicFolderCard({ section, onOpen, onPlay }: MusicFolderCardProps) {
  const preview = section.items.slice(0, 4);

  return (
    <div className="music-folder-card" onClick={onOpen} title={`Carpeta ${section.folderName}`}>
      <div className="music-folder-mosaic">
        {preview.map((item, idx) => (
          <span className="music-folder-mosaic-cell" key={item.path} data-index={idx}>
            <MusicArtwork alt={item.title} className="music-card-artwork" path={item.path} />
          </span>
        ))}
        {preview.length === 0 && (
          <span className="music-folder-mosaic-empty">
            <Icon name="folder" />
          </span>
        )}
        <div className="music-folder-hover-overlay">
          <button
            className="music-folder-play-btn"
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            title="Reproducir carpeta"
          >
            <Icon name="play" />
          </button>
        </div>
      </div>
      <div className="music-folder-info">
        <strong className="music-folder-title">{section.folderName}</strong>
        <span className="music-folder-count">
          {section.items.length} {section.items.length === 1 ? "canción" : "canciones"}
        </span>
      </div>
    </div>
  );
}

function groupByTimeline(items: MusicLibraryItem[]): TimelineSection[] {
  const groupsMap = new Map<string, MusicLibraryItem[]>();

  const now = new Date();
  const todayTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayTimestamp = todayTimestamp - 86400000;

  for (const item of items) {
    if (!item.modifiedAtMillis) {
      const fallbackTitle = "Colección";
      const existing = groupsMap.get(fallbackTitle);
      if (existing) existing.push(item);
      else groupsMap.set(fallbackTitle, [item]);
      continue;
    }

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

function groupByFolder(items: MusicLibraryItem[]): FolderSection[] {
  const groupsMap = new Map<string, MusicLibraryItem[]>();

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
