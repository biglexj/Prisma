import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { FolderBreadcrumbHeader } from "../../../shared/ui/FolderBreadcrumbHeader";
import {
  resolveTreeLevel,
  FAVORITES_FOLDER_ID,
  ALL_MEDIA_FOLDER_ID,
  type HierarchicalFolder,
} from "../../../shared/mediaTree";
import { useFavorites } from "../../../shared/useFavorites";
import type { MusicFolderSource, MusicLibraryItem } from "../model/types";
import type { MusicQueueItem } from "../../playback/model/queue";
import { MusicArtwork } from "./MusicArtwork";
import "./music-library.css";

const VISIBLE_ITEM_LIMIT = 400;

type ViewMode = "timeline" | "folders";

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
  const [currentFolderPath, setCurrentFolderPath] = useState<string>("");
  const favorites = useFavorites();

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

  // Árbol jerárquico real con soporte para Favoritos y Todas las canciones
  const treeLevel = resolveTreeLevel(items, currentFolderPath, favorites.favorites, {
    allName: "Todas las canciones",
    mediaType: "music",
  });

  const isInsideFolder = currentFolderPath !== "";

  const handlePlayAll = () => {
    if (items.length === 0) return;
    const queueItems = items.map(toQueueItem);
    if (onPlayQueue) {
      onPlayQueue(queueItems, 0, "Toda la Música");
    } else {
      onPlay(items[0].path);
    }
  };

  const handlePlayFolder = (folderItems: MusicLibraryItem[], name: string) => {
    if (folderItems.length === 0) return;
    const queueItems = folderItems.map(toQueueItem);
    if (onPlayQueue) {
      onPlayQueue(queueItems, 0, name);
    } else {
      onPlay(folderItems[0].path);
    }
  };

  const handleAddFolderToQueue = (folderItems: MusicLibraryItem[]) => {
    if (folderItems.length === 0 || !onAddToQueue) return;
    onAddToQueue(folderItems.map(toQueueItem));
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
    setCurrentFolderPath("");
  };

  return (
    <section className="music-library">
      <header className="music-library-heading">
        <div className="section-heading">
          <span className="preview-kicker">BIBLIOTECA MUSICAL</span>
          <h1>Música</h1>
          <p>
            Explora tu colección de canciones locales organizadas en línea de tiempo, árbol jerárquico de carpetas con carátulas y gestión de colas.
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
            title="Árbol de carpetas"
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
                    isFavorite={favorites.isFavorite(item.path)}
                    item={item}
                    key={item.path}
                    onClick={() => handlePlayItemInList(section.items, idx, section.title)}
                    onAddToQueue={onAddToQueue ? () => onAddToQueue([toQueueItem(item)]) : undefined}
                    onToggleFavorite={() => favorites.toggleFavorite(item.path)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Vista Árbol Jerárquico de Carpetas (Inspirado en Lienzo) ── */
        <div className="music-folder-tree-view" aria-busy={loading}>
          {isInsideFolder ? (
            <FolderBreadcrumbHeader
              currentPath={currentFolderPath}
              itemCount={treeLevel.allRecursiveItems.length}
              onNavigate={(path) => setCurrentFolderPath(path ?? "")}
              onPlayFolder={() => handlePlayFolder(treeLevel.allRecursiveItems, treeLevel.currentDisplayName)}
              onAddFolderToQueue={onAddToQueue ? () => handleAddFolderToQueue(treeLevel.allRecursiveItems) : undefined}
            />
          ) : null}

          {/* Subcarpetas / Colecciones en este nivel */}
          {treeLevel.subfolders.length > 0 ? (
            <div className="music-folder-collections-section">
              {isInsideFolder && treeLevel.directItems.length > 0 ? (
                <h3 className="music-section-subtitle">Subcarpetas</h3>
              ) : null}
              <div className="music-folder-collections">
                {treeLevel.subfolders.map((folder) => (
                  <MusicFolderCard
                    folder={folder}
                    key={folder.id}
                    onOpen={() => setCurrentFolderPath(folder.id)}
                    onPlay={() => handlePlayFolder(folder.allRecursiveItems, folder.displayName)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* Canciones directas o lista de carpeta virtual */}
          {treeLevel.directItems.length > 0 ? (
            <div className="music-direct-items-section">
              {treeLevel.subfolders.length > 0 ? (
                <h3 className="music-section-subtitle">Canciones</h3>
              ) : null}
              <div className="music-auto-grid">
                {treeLevel.directItems.map((item, idx) => (
                  <MusicCard
                    isFavorite={favorites.isFavorite(item.path)}
                    item={item}
                    key={item.path}
                    onClick={() => handlePlayItemInList(treeLevel.directItems, idx, treeLevel.currentDisplayName)}
                    onAddToQueue={onAddToQueue ? () => onAddToQueue([toQueueItem(item)]) : undefined}
                    onToggleFavorite={() => favorites.toggleFavorite(item.path)}
                  />
                ))}
              </div>
            </div>
          ) : treeLevel.subfolders.length === 0 && treeLevel.allRecursiveItems.length === 0 ? (
            <div className="music-empty-folder-state">
              <Icon name="folder" />
              <p>Esta carpeta no contiene archivos de música directos.</p>
            </div>
          ) : null}
        </div>
      )}

      {items.length > VISIBLE_ITEM_LIMIT && viewMode === "timeline" ? (
        <p className="music-limit-note">
          Se muestran las {VISIBLE_ITEM_LIMIT} canciones más recientes para mantener la interfaz fluida.
        </p>
      ) : null}
    </section>
  );
}

interface MusicCardProps {
  item: MusicLibraryItem;
  isFavorite: boolean;
  onClick: () => void;
  onAddToQueue?: () => void;
  onToggleFavorite?: () => void;
}

function MusicCard({ item, isFavorite, onClick, onAddToQueue, onToggleFavorite }: MusicCardProps) {
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

      <div className="music-card-actions-bar">
        {onToggleFavorite ? (
          <button
            className={`music-card-fav-btn ${isFavorite ? "is-favorite" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
          >
            <Icon name="heart" />
          </button>
        ) : null}

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
    </div>
  );
}

interface MusicFolderCardProps {
  folder: HierarchicalFolder<MusicLibraryItem>;
  onOpen: () => void;
  onPlay: () => void;
}

function MusicFolderCard({ folder, onOpen, onPlay }: MusicFolderCardProps) {
  const isFavorites = folder.isVirtual && folder.virtualType === "favorites";
  const isAll = folder.isVirtual && folder.virtualType === "all";
  const preview = folder.allRecursiveItems.slice(0, 4);

  return (
    <div
      className={`music-folder-card ${isFavorites ? "is-virtual-favorites" : ""} ${isAll ? "is-virtual-all" : ""}`}
      onClick={onOpen}
      title={`Carpeta ${folder.displayName}`}
    >
      <div className="music-folder-mosaic">
        {isFavorites ? (
          <div className="music-virtual-card-art is-favorites">
            <Icon name="star" />
          </div>
        ) : isAll ? (
          <div className="music-virtual-card-art is-all">
            <Icon name="disc" />
          </div>
        ) : (
          <>
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
          </>
        )}

        <div className="music-folder-hover-overlay">
          {folder.allRecursiveItems.length > 0 ? (
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
          ) : null}
        </div>
      </div>
      <div className="music-folder-info">
        <strong className="music-folder-title">
          {isFavorites ? "⭐ Favoritos" : folder.displayName}
        </strong>
        <span className="music-folder-count">
          {folder.allRecursiveItems.length}{" "}
          {folder.allRecursiveItems.length === 1 ? "canción" : "canciones"}
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
