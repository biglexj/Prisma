import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
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
import { parseTrackInfo } from "../model/trackInfo";
import { playlistsSaveFromItems } from "../../collections/tauri/client";
import { useScrollRestoration } from "../../../shared/useScrollRestoration";
import "./music-library.css";

const VISIBLE_ITEM_LIMIT = 400;

type ViewMode = "timeline" | "folders" | "tree";

// Memoria de sesión para recordar la pestaña y carpeta abierta
const sessionMusicState = {
  viewMode: "timeline" as ViewMode,
  folderPath: "",
};

interface MusicLibraryProps {
  folders: MusicFolderSource[];
  items: MusicLibraryItem[];
  loading: boolean;
  error: string | null;
  currentPlayingPath?: string | null;
  isPlaying?: boolean;
  onAdd: (path: string) => Promise<void>;
  onPlay: (path: string) => void;
  onPlayQueue?: (items: MusicQueueItem[], startIndex?: number, name?: string) => void;
  onPlayFolder?: (folderName: string, items: MusicQueueItem[], startIndex?: number) => void;
  onAddToQueue?: (items: MusicQueueItem[]) => void;
  onOpenFolders: () => void;
}

function toQueueItem(item: MusicLibraryItem): MusicQueueItem {
  const { title, artist } = parseTrackInfo(item.title);
  return {
    id: item.path,
    path: item.path,
    title,
    artist: artist || null,
    folder: item.relativeFolder,
    sizeBytes: item.sizeBytes,
  };
}

export function MusicLibrary({
  folders,
  items,
  loading,
  error,
  currentPlayingPath,
  isPlaying,
  onAdd,
  onPlay,
  onPlayQueue,
  onPlayFolder,
  onAddToQueue,
  onOpenFolders,
}: MusicLibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => sessionMusicState.viewMode);
  const [currentFolderPath, setCurrentFolderPath] = useState<string>(() => sessionMusicState.folderPath);
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

  const nonExcludedItems = items.filter((it) => !it.isExcluded);
  const visibleItems = nonExcludedItems.slice(0, VISIBLE_ITEM_LIMIT);

  // Árbol jerárquico y colecciones (contiene todas las carpetas y archivos para navegación en Carpetas y Árbol)
  const treeLevel = resolveTreeLevel(items, currentFolderPath, favorites.favorites, {
    allName: "Todas las canciones",
    mediaType: "music",
  });

  const isInsideFolder = currentFolderPath !== "";

  const handlePlayAll = () => {
    if (nonExcludedItems.length === 0) return;
    const queueItems = nonExcludedItems.map(toQueueItem);
    if (onPlayQueue) {
      onPlayQueue(queueItems, 0, "Árbol de Música");
    } else {
      onPlay(nonExcludedItems[0].path);
    }
  };

  const handlePlayFolder = (folderItems: MusicLibraryItem[], name: string) => {
    if (folderItems.length === 0) return;
    const queueItems = folderItems.map(toQueueItem);
    const cleanName = name
      .replace(/^Álbum:\s*/i, "")
      .split(/[/\\]/)
      .filter(Boolean)
      .slice(-2)
      .join(" · ") || name;

    if (onPlayFolder) {
      onPlayFolder(cleanName, queueItems, 0);
    } else if (onPlayQueue) {
      onPlayQueue(queueItems, 0, `Árbol de Música · ${cleanName}`);
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
      onPlayQueue(queueItems, index, queueName ?? "Árbol de Música");
    } else {
      onPlay(list[index].path);
    }
  };

  const handleCreatePlaylistFromFolder = async (folderItems: MusicLibraryItem[], folderName: string) => {
    const cleanName = folderName.replace(/^[⭐📂]\s*/, "");
    const name = window.prompt("Nombre de la nueva lista de reproducción:", cleanName);
    if (!name || !name.trim()) return;
    try {
      const playlistItems = folderItems.map((it) => {
        const { title, artist } = parseTrackInfo(it.title);
        return {
          path: it.path,
          title: artist ? `${artist} - ${title}` : title,
          durationSecs: 0,
        };
      });
      await playlistsSaveFromItems(name.trim(), playlistItems);
      alert(`✅ Lista "${name.trim()}.m3u" creada exitosamente con ${folderItems.length} canciones.`);
    } catch (err) {
      console.error("Error creando lista desde carpeta:", err);
    }
  };

  // Preservar y restaurar la posición exacta del scroll al navegar o volver
  useScrollRestoration(`view:music:${viewMode}:${currentFolderPath}`, !loading);

  const handleSwitchMode = (mode: ViewMode) => {
    setViewMode(mode);
    sessionMusicState.viewMode = mode;
  };

  const handleNavigateFolder = (path: string) => {
    setCurrentFolderPath(path);
    sessionMusicState.folderPath = path;
  };

  return (
    <section className="music-library">
      <header className="music-library-heading">
        <div className="section-heading">
          <span className="preview-kicker">BIBLIOTECA MUSICAL</span>
          <h1>Música</h1>
          <p>
            Explora tu colección de canciones locales organizadas en cuadrícula fluida, colecciones por carpetas o vista en árbol.
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
            <strong>{nonExcludedItems.length}</strong> {nonExcludedItems.length === 1 ? "canción" : "canciones"}
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
            <span>Tiempo</span>
          </button>
          <button
            className={viewMode === "folders" ? "is-active" : ""}
            onClick={() => handleSwitchMode("folders")}
            title="Carpetas"
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
      ) : viewMode === "timeline" ? (
        /* ── 1. Cuadrícula de Canciones ── */
        <div className="music-bento-container" aria-busy={loading}>
          <div className="music-auto-grid">
            {visibleItems.map((item, idx) => (
              <MusicCard
                isFavorite={favorites.isFavorite(item.path)}
                isPlaying={isPlaying && currentPlayingPath === item.path}
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
        /* ── 2. Vista de Colecciones de Carpetas como Álbumes ── */
        <div className="music-folder-tree-view" aria-busy={loading}>
          {isInsideFolder ? (
            <FolderBreadcrumbHeader
              currentPath={currentFolderPath}
              itemCount={treeLevel.allRecursiveItems.length}
              onNavigate={(path) => handleNavigateFolder(path ?? "")}
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
                    onOpen={() => handleNavigateFolder(folder.id)}
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
                {treeLevel.directItems.slice(0, VISIBLE_ITEM_LIMIT).map((item, idx) => (
                  <MusicCard
                    isFavorite={favorites.isFavorite(item.path)}
                    isPlaying={isPlaying && currentPlayingPath === item.path}
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
        /* ── 3. Vista en Árbol Expandible ── */
        <MediaTreeView
          items={items}
          mediaType="music"
          onAddFolderToQueue={onAddToQueue ? (folderItems) => onAddToQueue(folderItems.map(toQueueItem)) : undefined}
          onAddToQueue={onAddToQueue ? (item) => onAddToQueue([toQueueItem(item)]) : undefined}
          onCreatePlaylistFromFolder={handleCreatePlaylistFromFolder}
          onPlayFolder={(folderItems, name) => handlePlayFolder(folderItems, name)}
          onPlayItem={(item, list) => {
            const idx = list.findIndex((it) => it.path === item.path);
            handlePlayItemInList(list, idx >= 0 ? idx : 0, "Árbol de Música");
          }}
        />
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
  isPlaying?: boolean;
  onClick: () => void;
  onAddToQueue?: () => void;
  onToggleFavorite?: () => void;
}

function MusicCard({ item, isFavorite, isPlaying, onClick, onAddToQueue, onToggleFavorite }: MusicCardProps) {
  const { title, artist } = parseTrackInfo(item.title);

  return (
    <div className="music-media-card-wrapper">
      <button
        className="music-media-card"
        onClick={onClick}
        title={artist ? `${artist} — ${title}` : title}
      >
        <span className={`music-media-frame ${isPlaying ? "is-now-playing" : ""}`}>
          <span className="music-frame-placeholder">
            <Icon name="music" />
          </span>
          <MusicArtwork alt={title} className="music-card-artwork" path={item.path} />

          {isPlaying ? (
            <span className="music-card-playing-indicator" title="Reproduciendo ahora">
              <i /><i /><i />
            </span>
          ) : null}

          <span className="music-hover-overlay">
            <i className="music-play-badge">
              <Icon name="play" />
            </i>
            <div className="music-hover-info">
              <strong className="music-hover-title" title={title}>
                {title}
              </strong>
              {artist ? (
                <span className="music-hover-artist" title={artist}>
                  {artist}
                </span>
              ) : null}
            </div>
          </span>
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
