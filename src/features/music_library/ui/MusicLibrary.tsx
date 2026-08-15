import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import { FolderBreadcrumbHeader } from "../../../shared/ui/FolderBreadcrumbHeader";
import { MediaTreeView } from "../../../shared/ui/MediaTreeView";
import { ContextMenu } from "../../../shared/ui/ContextMenu";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import {
  resolveTreeLevel,
  type HierarchicalFolder,
} from "../../../shared/mediaTree";
import { useFavorites } from "../../../shared/useFavorites";
import { useMediaDelete } from "../../../shared/useMediaDelete";
import type { MusicFolderSource, MusicLibraryItem } from "../model/types";
import type { MusicQueueItem } from "../../playback/model/queue";
import { MusicArtwork } from "./MusicArtwork";
import { parseTrackInfo } from "../model/trackInfo";
import { playlistsSaveFromItems } from "../../collections/tauri/client";
import { useScrollRestoration } from "../../../shared/useScrollRestoration";
import "./music-library.css";

const VISIBLE_ITEM_LIMIT = 400;

type ViewMode = "timeline" | "folders" | "tree";

export type MusicSortField = "date" | "name" | "size" | "random";
export type MusicSortDirection = "desc" | "asc";

// Memoria de sesión para recordar la pestaña, carpeta abierta y criterio de ordenación
const sessionMusicState = {
  viewMode: "timeline" as ViewMode,
  folderPath: "",
  sortField: "name" as MusicSortField,
  sortDirection: "asc" as MusicSortDirection,
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
  confirmDeletion: boolean;
  onRefresh: () => void | Promise<void>;
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
  confirmDeletion,
  onRefresh,
}: MusicLibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => sessionMusicState.viewMode);
  const [currentFolderPath, setCurrentFolderPath] = useState<string>(() => sessionMusicState.folderPath);
  const [sortField, setSortField] = useState<MusicSortField>(() => sessionMusicState.sortField);
  const [sortDirection, setSortDirection] = useState<MusicSortDirection>(() => sessionMusicState.sortDirection);
  const [randomSeed, setRandomSeed] = useState(1);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const favorites = useFavorites();
  const mediaDelete = useMediaDelete({
    confirmDeletion,
    onRefresh,
  });

  // Cerrar menú de ordenación al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    if (showSortMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSortMenu]);

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

  // Hash determinista para ordenación aleatoria pero estable
  const hashString = (str: string, seed: number) => {
    let hash = seed;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return hash;
  };

  // Función de ordenación pura aplicable a cualquier colección de canciones
  const sortItemList = (itemList: MusicLibraryItem[]): MusicLibraryItem[] => {
    return [...itemList].sort((a, b) => {
      let comparison = 0;
      if (sortField === "date") {
        comparison = (b.modifiedAtMillis || 0) - (a.modifiedAtMillis || 0);
      } else if (sortField === "name") {
        comparison = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
      } else if (sortField === "size") {
        comparison = (b.sizeBytes || 0) - (a.sizeBytes || 0);
      } else if (sortField === "random") {
        const hashA = hashString(a.path, randomSeed);
        const hashB = hashString(b.path, randomSeed);
        comparison = hashA - hashB;
      }
      return sortDirection === "asc" ? -comparison : comparison;
    });
  };

  const sortedNonExcludedItems = sortItemList(nonExcludedItems);
  const visibleItems = sortedNonExcludedItems.slice(0, VISIBLE_ITEM_LIMIT);

  // Agrupar las canciones visibles por álbum (carpeta) para que el timeline muestre
  // UNA tarjeta por álbum y no repita la misma carátula por cada canción.
  const albumGroups = useMemo(() => {
    const map = new Map<string, MusicLibraryItem[]>();
    for (const item of visibleItems) {
      const key = item.relativeFolder || "Carpeta principal";
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    }
    const groups: { folderKey: string; displayName: string; representative: MusicLibraryItem; items: MusicLibraryItem[] }[] = [];
    for (const [key, itemsInAlbum] of map.entries()) {
      const lastSeg = key.split(/[\\/]/).filter(Boolean).pop() || key;
      groups.push({
        folderKey: key,
        displayName: lastSeg,
        representative: itemsInAlbum[0],
        items: itemsInAlbum,
      });
    }
    groups.sort((a, b) => {
      const aTime = Math.max(0, ...a.items.map((it) => it.modifiedAtMillis ?? 0));
      const bTime = Math.max(0, ...b.items.map((it) => it.modifiedAtMillis ?? 0));
      return bTime - aTime;
    });
    return groups;
  }, [visibleItems]);

  // Árbol jerárquico y colecciones
  const treeLevel = resolveTreeLevel(items, currentFolderPath, favorites.favorites, {
    allName: "Todas las canciones",
    mediaType: "music",
  });

  const sortedDirectItems = sortItemList(treeLevel.directItems);

  const isInsideFolder = currentFolderPath !== "";

  const handlePlayAll = () => {
    if (nonExcludedItems.length === 0) return;
    const queueItems = nonExcludedItems.map(toQueueItem);
    if (onPlayFolder) {
      // Crear una cola propia para la línea de tiempo (no sobrescribir la cola por defecto)
      onPlayFolder("Línea de tiempo", queueItems, 0);
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
      .pop() || name;

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

  const buildTrackDisplayTitle = (item: MusicLibraryItem) => {
    const { title, artist } = parseTrackInfo(item.title);
    return artist ? `${artist} — ${title}` : title;
  };

  const handleCardContextMenu = (event: React.MouseEvent, item: MusicLibraryItem) => {
    mediaDelete.openMenu(event, {
      path: item.path,
      title: buildTrackDisplayTitle(item),
      kind: "music",
    });
  };

  const handleCardDeleteRequest = (item: MusicLibraryItem) => {
    mediaDelete.requestDelete({
      path: item.path,
      title: buildTrackDisplayTitle(item),
      kind: "music",
    });
  };

  const buildMenuItems = () => {
    const target = mediaDelete.menu;
    if (!target) return [];
    const isFav = favorites.isFavorite(target.item.path);
    return [
      {
        id: "favorite",
        label: isFav ? "Quitar de favoritos" : "Añadir a favoritos",
        icon: "heart" as const,
        onSelect: () => favorites.toggleFavorite(target.item.path),
      },
      {
        id: "show",
        label: "Mostrar en carpeta",
        icon: "folder-open" as const,
        onSelect: () => {
          void invoke("show_in_file_manager", { path: target.item.path }).catch(() => {});
        },
      },
      {
        id: "delete",
        label: "Mover a la papelera",
        icon: "trash" as const,
        danger: true,
        onSelect: () => mediaDelete.requestDelete(target.item),
      },
    ];
  };

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

      {mediaDelete.deleteError ? (
        <div className="error-banner" role="alert">
          <strong>No se pudo eliminar el archivo</strong>
          <span>{mediaDelete.deleteError}</span>
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

        <div className="music-controls-right">
          {/* Selector de Ordenación Material 3 Expressive para Música */}
          <div className="music-sort-container" ref={sortMenuRef}>
            <button
              className={`music-sort-trigger ${showSortMenu ? "is-open" : ""}`}
              onClick={() => setShowSortMenu(!showSortMenu)}
              title="Cambiar orden de las canciones"
              type="button"
            >
              <Icon name={sortField === "random" ? "shuffle" : sortDirection === "asc" ? "sort-asc" : "sort-desc"} />
              <span>
                {sortField === "date" ? "Fecha" : sortField === "name" ? "Nombre" : sortField === "size" ? "Tamaño" : "Aleatorio"}
              </span>
              <Icon className="sort-chevron" name="chevron-down" />
            </button>

            {showSortMenu ? (
              <div className="music-sort-menu" role="menu">
                <span className="music-sort-section-title">Ordenar por</span>
                <button
                  className={`music-sort-item ${sortField === "date" ? "is-selected" : ""}`}
                  onClick={() => {
                    setSortField("date");
                    sessionMusicState.sortField = "date";
                  }}
                  type="button"
                >
                  <span>Fecha de modificación</span>
                  {sortField === "date" ? <Icon name="check" /> : null}
                </button>
                <button
                  className={`music-sort-item ${sortField === "name" ? "is-selected" : ""}`}
                  onClick={() => {
                    setSortField("name");
                    sessionMusicState.sortField = "name";
                  }}
                  type="button"
                >
                  <span>Nombre de la canción</span>
                  {sortField === "name" ? <Icon name="check" /> : null}
                </button>
                <button
                  className={`music-sort-item ${sortField === "size" ? "is-selected" : ""}`}
                  onClick={() => {
                    setSortField("size");
                    sessionMusicState.sortField = "size";
                  }}
                  type="button"
                >
                  <span>Tamaño de archivo</span>
                  {sortField === "size" ? <Icon name="check" /> : null}
                </button>
                <button
                  className={`music-sort-item ${sortField === "random" ? "is-selected" : ""}`}
                  onClick={() => {
                    setSortField("random");
                    setRandomSeed(Date.now());
                    sessionMusicState.sortField = "random";
                  }}
                  type="button"
                >
                  <span>🎲 Aleatorio (Mezclar)</span>
                  {sortField === "random" ? <Icon name="check" /> : null}
                </button>

                {sortField !== "random" ? (
                  <>
                    <div className="music-sort-divider" />
                    <span className="music-sort-section-title">Dirección</span>
                    <button
                      className={`music-sort-item ${sortDirection === "asc" ? "is-selected" : ""}`}
                      onClick={() => {
                        setSortDirection("asc");
                        sessionMusicState.sortDirection = "asc";
                      }}
                      type="button"
                    >
                      <span>
                        {sortField === "date" ? "Más antiguos primero" : sortField === "name" ? "A a Z" : "Más ligeros primero"}
                      </span>
                      {sortDirection === "asc" ? <Icon name="check" /> : null}
                    </button>
                    <button
                      className={`music-sort-item ${sortDirection === "desc" ? "is-selected" : ""}`}
                      onClick={() => {
                        setSortDirection("desc");
                        sessionMusicState.sortDirection = "desc";
                      }}
                      type="button"
                    >
                      <span>
                        {sortField === "date" ? "Más recientes primero" : sortField === "name" ? "Z a A" : "Más pesados primero"}
                      </span>
                      {sortDirection === "desc" ? <Icon name="check" /> : null}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="music-sort-divider" />
                    <button
                      className="music-sort-item"
                      onClick={() => setRandomSeed(Date.now())}
                      style={{ color: "var(--primary)" }}
                      type="button"
                    >
                      <span>⚡ Volver a mezclar</span>
                      <Icon name="refresh" />
                    </button>
                  </>
                )}
              </div>
            ) : null}
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
        /* ── 1. Cuadrícula de Álbumes (agrupados por carpeta) ── */
        <div className="music-bento-container" aria-busy={loading}>
          <div className="music-auto-grid">
            {albumGroups.map((album) => (
              <MusicAlbumCard
                albumName={album.displayName}
                isFavorite={favorites.isFavorite(album.representative.path)}
                isPlaying={isPlaying && album.items.some((it) => it.path === currentPlayingPath)}
                item={album.representative}
                key={album.folderKey}
                onAddToQueue={onAddToQueue ? () => onAddToQueue(album.items.map(toQueueItem)) : undefined}
                onClick={() => handlePlayFolder(album.items, album.folderKey)}
                onContextMenu={(event) => handleCardContextMenu(event, album.representative)}
                onDeleteRequest={() => handleCardDeleteRequest(album.representative)}
                onToggleFavorite={() => favorites.toggleFavorite(album.representative.path)}
                songCount={album.items.length}
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
          {sortedDirectItems.length > 0 ? (
            <div className="music-direct-items-section">
              <div className="music-auto-grid">
                {sortedDirectItems.slice(0, VISIBLE_ITEM_LIMIT).map((item, idx) => (
                  <MusicCard
                    isFavorite={favorites.isFavorite(item.path)}
                    isPlaying={isPlaying && currentPlayingPath === item.path}
                    item={item}
                    key={item.path}
                    onClick={() => handlePlayItemInList(sortedDirectItems, idx, treeLevel.currentDisplayName)}
                    onAddToQueue={onAddToQueue ? () => onAddToQueue([toQueueItem(item)]) : undefined}
                    onContextMenu={(event) => handleCardContextMenu(event, item)}
                    onDeleteRequest={() => handleCardDeleteRequest(item)}
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
          onOpenItemMenu={(event, item) => handleCardContextMenu(event, item)}
          onDeleteRequest={handleCardDeleteRequest}
        />
      )}

      {items.length > VISIBLE_ITEM_LIMIT && viewMode === "timeline" ? (
        <p className="music-limit-note">
          Se muestran las {VISIBLE_ITEM_LIMIT} canciones más recientes para mantener la interfaz fluida.
        </p>
      ) : null}

      {mediaDelete.menu ? (
        <ContextMenu
          items={buildMenuItems()}
          onClose={mediaDelete.closeMenu}
          x={mediaDelete.menu.x}
          y={mediaDelete.menu.y}
        />
      ) : null}

      {mediaDelete.pendingDelete ? (
        <ConfirmDialog
          cancelLabel="Cancelar"
          confirmLabel="Mover a la papelera"
          danger
          message={
            <span>
              Se enviará <strong>{mediaDelete.pendingDelete.title}</strong> a la papelera de
              reciclaje del sistema.
            </span>
          }
          onCancel={mediaDelete.cancelDelete}
          onConfirm={mediaDelete.confirmDelete}
          title="Mover canción a la papelera"
        />
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
  onContextMenu?: (event: React.MouseEvent) => void;
  onDeleteRequest?: () => void;
}

function MusicCard({ item, isFavorite, isPlaying, onClick, onAddToQueue, onToggleFavorite, onContextMenu, onDeleteRequest }: MusicCardProps) {
  const { title, artist } = parseTrackInfo(item.title);

  return (
    <div className="music-media-card-wrapper">
      <button
        className="music-media-card"
        onClick={onClick}
        onContextMenu={onContextMenu}
        onKeyDown={(event) => {
          if (
            onDeleteRequest &&
            (event.key === "Delete" ||
              event.key === "Del" ||
              event.key === "Supr" ||
              event.code === "Delete")
          ) {
            event.preventDefault();
            event.stopPropagation();
            onDeleteRequest();
          }
        }}
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

interface MusicAlbumCardProps {
  item: MusicLibraryItem;
  albumName: string;
  songCount: number;
  isFavorite: boolean;
  isPlaying?: boolean;
  onClick: () => void;
  onAddToQueue?: () => void;
  onToggleFavorite?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  onDeleteRequest?: () => void;
}

function MusicAlbumCard({ item, albumName, songCount, isFavorite, isPlaying, onClick, onAddToQueue, onToggleFavorite, onContextMenu, onDeleteRequest }: MusicAlbumCardProps) {
  const { artist } = parseTrackInfo(item.title);
  return (
    <div className="music-media-card-wrapper">
      <button
        className="music-media-card"
        onClick={onClick}
        onContextMenu={onContextMenu}
        onKeyDown={(event) => {
          if (
            onDeleteRequest &&
            (event.key === "Delete" ||
              event.key === "Del" ||
              event.key === "Supr" ||
              event.code === "Delete")
          ) {
            event.preventDefault();
            event.stopPropagation();
            onDeleteRequest();
          }
        }}
        title={artist ? `${artist} — ${albumName} (${songCount} ${songCount === 1 ? "canción" : "canciones"})` : `${albumName} (${songCount} ${songCount === 1 ? "canción" : "canciones"})`}
      >
        <span className={`music-media-frame ${isPlaying ? "is-now-playing" : ""}`}>
          <MusicArtwork alt={albumName} className="music-card-artwork" path={item.path} />

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
              <strong className="music-hover-title" title={albumName}>
                {albumName}
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
            title="Añadir álbum a la cola"
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
