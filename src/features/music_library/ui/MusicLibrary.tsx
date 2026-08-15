import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { FolderBreadcrumbHeader } from "../../../shared/ui/FolderBreadcrumbHeader";
import { MediaTreeView } from "../../../shared/ui/MediaTreeView";
import {
  resolveTreeLevel,
  type HierarchicalFolder,
} from "../../../shared/mediaTree";
import { useFavorites } from "../../../shared/useFavorites";
import type { MusicFolderSource, MusicLibraryItem } from "../model/types";
import type { MusicQueueItem } from "../../playback/model/queue";
import { MusicArtwork } from "./MusicArtwork";
import "./music-library.css";

const VISIBLE_ITEM_LIMIT = 400;

type ViewMode = "bento" | "folders" | "tree";

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
  const [viewMode, setViewMode] = useState<ViewMode>("bento");
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

  // Árbol jerárquico y colecciones
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
            Explora tu colección de canciones locales en vista Bento Grid, mosaico de carpetas o árbol de directorios interactivo.
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
            className={viewMode === "bento" ? "is-active" : ""}
            onClick={() => handleSwitchMode("bento")}
            title="Cuadrícula Bento"
          >
            <Icon name="layout" />
            <span>Bento Grid</span>
          </button>
          <button
            className={viewMode === "folders" ? "is-active" : ""}
            onClick={() => handleSwitchMode("folders")}
            title="Colecciones de carpetas"
          >
            <Icon name="folder" />
            <span>Carpetas</span>
          </button>
          <button
            className={viewMode === "tree" ? "is-active" : ""}
            onClick={() => handleSwitchMode("tree")}
            title="Vista en árbol"
          >
            <Icon name="folder-open" />
            <span>Árbol</span>
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
      ) : viewMode === "bento" ? (
        /* ── 1. Cuadrícula Bento Unificada ── */
        <div className="music-bento-container" aria-busy={loading}>
          <div className="music-auto-grid">
            {visibleItems.map((item, idx) => (
              <MusicCard
                isFavorite={favorites.isFavorite(item.path)}
                item={item}
                key={item.path}
                onClick={() => handlePlayItemInList(visibleItems, idx, "Música")}
                onAddToQueue={onAddToQueue ? () => onAddToQueue([toQueueItem(item)]) : undefined}
                onToggleFavorite={() => favorites.toggleFavorite(item.path)}
              />
            ))}
          </div>
        </div>
      ) : viewMode === "folders" ? (
        /* ── 2. Vista de Colecciones de Carpetas ── */
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
          ) : null}
        </div>
      ) : (
        /* ── 3. Vista en Árbol Expandible (Lienzo Style) ── */
        <MediaTreeView
          items={items}
          mediaType="music"
          onAddFolderToQueue={onAddToQueue ? (folderItems) => onAddToQueue(folderItems.map(toQueueItem)) : undefined}
          onAddToQueue={onAddToQueue ? (item) => onAddToQueue([toQueueItem(item)]) : undefined}
          onPlayFolder={(folderItems, name) => handlePlayFolder(folderItems, name)}
          onPlayItem={(item, list) => {
            const idx = list.findIndex((it) => it.path === item.path);
            handlePlayItemInList(list, idx >= 0 ? idx : 0, "Árbol de Música");
          }}
        />
      )}

      {items.length > VISIBLE_ITEM_LIMIT && viewMode === "bento" ? (
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
  const firstCoverItem = folder.allRecursiveItems[0];

  return (
    <div
      className={`music-folder-card ${isFavorites ? "is-virtual-favorites" : ""} ${isAll ? "is-virtual-all" : ""}`}
      onClick={onOpen}
      title={`Carpeta ${folder.displayName}`}
    >
      <div className="music-folder-cover-frame">
        {isFavorites ? (
          <div className="music-virtual-card-art is-favorites">
            <Icon name="star" />
          </div>
        ) : isAll ? (
          <div className="music-virtual-card-art is-all">
            <Icon name="disc" />
          </div>
        ) : firstCoverItem ? (
          <MusicArtwork alt={folder.displayName} className="music-folder-cover-img" path={firstCoverItem.path} />
        ) : (
          <span className="music-folder-empty-cover">
            <Icon name="folder" />
          </span>
        )}

        <div className="music-folder-hover-overlay">
          {folder.allRecursiveItems.length > 0 ? (
            <button
              className="music-folder-play-btn"
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              title="Reproducir álbum"
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
