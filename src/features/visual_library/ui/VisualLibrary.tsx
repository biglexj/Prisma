import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import { FolderBreadcrumbHeader } from "../../../shared/ui/FolderBreadcrumbHeader";
import { MediaTreeView } from "../../../shared/ui/MediaTreeView";
import {
  cleanPath,
  resolveTreeLevel,
  type HierarchicalFolder,
} from "../../../shared/mediaTree";
import { useFavorites } from "../../../shared/useFavorites";
import type { VisualFolderSource, VisualLibraryItem, VisualMediaKind } from "../model/types";
import { VisualThumbnail } from "./VisualThumbnail";
import { VideoThumbnail } from "./VideoThumbnail";
import { ImageViewer } from "./ImageViewer";
import { playlistsSaveFromItems } from "../../collections/tauri/client";
import { useScrollRestoration } from "../../../shared/useScrollRestoration";
import "./visual-library.css";

const VISIBLE_ITEM_LIMIT = 400;

type ViewMode = "timeline" | "folders" | "tree";

// Memoria de sesión para recordar pestaña y carpeta abierta en imágenes y vídeos
const sessionVisualState: Record<VisualMediaKind, { viewMode: ViewMode; folderPath: string }> = {
  image: { viewMode: "timeline", folderPath: "" },
  video: { viewMode: "timeline", folderPath: "" },
};

interface TimelineSection {
  title: string;
  items: VisualLibraryItem[];
}

interface VisualLibraryProps {
  kind: VisualMediaKind;
  folders: VisualFolderSource[];
  items: VisualLibraryItem[];
  loading: boolean;
  error: string | null;
  initialSelectedImagePath?: string | null;
  onClearInitialSelectedImage?: () => void;
  onAdd: (path: string) => Promise<void>;
  onOpenVideo: (path: string, sessionItems?: VisualLibraryItem[]) => void;
  onOpenFolders: () => void;
}

export function VisualLibrary({
  kind,
  folders,
  items,
  loading,
  error,
  initialSelectedImagePath,
  onClearInitialSelectedImage,
  onAdd,
  onOpenVideo,
  onOpenFolders,
}: VisualLibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => sessionVisualState[kind].viewMode);
  const [currentFolderPath, setCurrentFolderPath] = useState<string>(() => sessionVisualState[kind].folderPath);
  const [selectedImage, setSelectedImage] = useState<VisualLibraryItem | null>(null);
  const [activeImageSessionList, setActiveImageSessionList] = useState<VisualLibraryItem[] | null>(null);
  const favorites = useFavorites();

  const isImage = kind === "image";
  const label = isImage ? "Imágenes" : "Vídeos";

  const chooseFolder = async () => {
    const selection = await open({
      multiple: false,
      directory: true,
      title: `Añadir carpeta de ${label.toLowerCase()} a Prisma`,
    });
    if (typeof selection === "string") await onAdd(selection);
  };

  const nonExcludedItems = items.filter((it) => !it.isExcluded);
  const visibleItems = nonExcludedItems.slice(0, VISIBLE_ITEM_LIMIT);
  const timelineSections = groupByTimeline(visibleItems);

  // Árbol jerárquico y colecciones (incluye todas las carpetas y archivos para navegación en Carpetas y Árbol)
  const treeLevel = resolveTreeLevel(items, currentFolderPath, favorites.favorites, {
    allName: isImage ? "Todas las imágenes" : "Todos los vídeos",
    mediaType: isImage ? "image" : "video",
  });

  const isInsideFolder = currentFolderPath !== "";

  // Active list for current view
  const currentActiveList = activeImageSessionList ?? (
    isInsideFolder
      ? (treeLevel.directItems.length > 0 ? treeLevel.directItems : treeLevel.allRecursiveItems)
      : (viewMode === "timeline" ? nonExcludedItems : items)
  );

  const handleSelectImage = (item: VisualLibraryItem, queueList?: VisualLibraryItem[]) => {
    setSelectedImage(item);
    setActiveImageSessionList(queueList ?? null);
  };

  const closeImageViewer = () => {
    setSelectedImage(null);
    setActiveImageSessionList(null);
  };

  const handlePlayAllVideos = () => {
    if (items.length === 0) return;
    onOpenVideo(items[0].path, items);
  };

  const handlePlayFolderVideos = (folderItems: VisualLibraryItem[]) => {
    if (folderItems.length === 0) return;
    onOpenVideo(folderItems[0].path, folderItems);
  };

  const handleCreatePlaylistFromFolder = async (folderItems: VisualLibraryItem[], folderName: string) => {
    const cleanName = folderName.replace(/^[⭐📂]\s*/, "");
    const name = window.prompt("Nombre de la nueva lista de reproducción:", cleanName);
    if (!name || !name.trim()) return;
    try {
      const playlistItems = folderItems.map((it) => ({
        path: it.path,
        title: it.title,
        durationSecs: 0,
      }));
      await playlistsSaveFromItems(name.trim(), playlistItems);
      alert(`✅ Lista "${name.trim()}.m3u" creada exitosamente con ${folderItems.length} archivos.`);
    } catch (err) {
      console.error("Error creando lista desde carpeta:", err);
    }
  };

  // Abrir imagen seleccionada externamente (por ejemplo, desde Inicio)
  useEffect(() => {
    if (initialSelectedImagePath && items.length > 0) {
      const found = items.find((it) => it.path === initialSelectedImagePath);
      if (found) {
        handleSelectImage(found);
        onClearInitialSelectedImage?.();
      }
    }
  }, [initialSelectedImagePath, items]);

  // Preservar y restaurar la posición exacta del scroll al navegar o volver
  useScrollRestoration(`view:${kind}:${viewMode}:${currentFolderPath}`, !loading);

  const handleSwitchMode = (mode: ViewMode) => {
    setViewMode(mode);
    sessionVisualState[kind].viewMode = mode;
  };

  const handleNavigateFolder = (path: string) => {
    setCurrentFolderPath(path);
    sessionVisualState[kind].folderPath = path;
  };

  return (
    <section className={`visual-library visual-library-${kind}`}>
      <header className="visual-library-heading">
        <div className="section-heading">
          <span className="preview-kicker">BIBLIOTECA VISUAL</span>
          <h1>{label}</h1>
          <p>
            {isImage
              ? "Explora tus fotografías e ilustraciones organizadas en Bento Grid adaptativo, árbol jerárquico de carpetas y visor cinematográfico con zoom."
              : "Organiza y reproduce tus vídeos locales con árbol de carpetas, favoritos, gestión de colas y reproductor de cine."}
          </p>
        </div>
        <div className="visual-heading-actions">
          {!isImage && items.length > 0 ? (
            <button className="tonal-button is-primary" onClick={handlePlayAllVideos} title="Reproducir todos los vídeos">
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
        /* ── 1. Cuadrícula Bento (Imágenes) / Cuadrícula 16:9 (Vídeos) ── */
        <div className="visual-timeline-container" aria-busy={loading}>
          {timelineSections.map((section) => (
            <div className="visual-section" key={section.title}>
              <header className="visual-section-header">
                <h3>{section.title}</h3>
                <span className="visual-section-count">
                  {section.items.length} {section.items.length === 1 ? "elemento" : "elementos"}
                </span>
              </header>
              <div className={`visual-grid ${isImage ? "bento-grid-layout" : "video-grid-layout"}`}>
                {section.items.map((item, idx) => (
                  <VisualCard
                    index={idx}
                    isFavorite={favorites.isFavorite(item.path)}
                    isImage={isImage}
                    item={item}
                    key={item.path}
                    onClick={() =>
                      isImage
                        ? handleSelectImage(item, items)
                        : onOpenVideo(item.path, items)
                    }
                    onToggleFavorite={() => favorites.toggleFavorite(item.path, kind)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "folders" ? (
        /* ── 2. Vista de Colecciones de Carpetas como Álbumes ── */
        <div className="visual-folder-tree-view" aria-busy={loading}>
          {isInsideFolder ? (
            <FolderBreadcrumbHeader
              currentPath={currentFolderPath}
              itemCount={treeLevel.allRecursiveItems.length}
              onNavigate={(path) => handleNavigateFolder(path ?? "")}
              onPlayFolder={!isImage ? () => handlePlayFolderVideos(treeLevel.allRecursiveItems) : undefined}
            />
          ) : null}

          {/* Subcarpetas / Colecciones en este nivel */}
          {treeLevel.subfolders.length > 0 ? (
            <div className="visual-folder-collections-section">
              <div className="visual-folder-collections">
                {treeLevel.subfolders.map((folder) => (
                  <VisualFolderCard
                    folder={folder}
                    isImage={isImage}
                    key={folder.id}
                    onOpen={() => handleNavigateFolder(folder.id)}
                    onPlayVideo={!isImage ? () => handlePlayFolderVideos(folder.allRecursiveItems) : undefined}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* Archivos directos o lista de carpeta virtual */}
          {treeLevel.directItems.length > 0 ? (
            <div className="visual-direct-items-section">
              <div className={`visual-grid ${isImage ? "bento-grid-layout" : "video-grid-layout"}`}>
                {treeLevel.directItems.map((item, idx) => (
                  <VisualCard
                    index={idx}
                    isFavorite={favorites.isFavorite(item.path)}
                    isImage={isImage}
                    item={item}
                    key={item.path}
                    onClick={() =>
                      isImage
                        ? handleSelectImage(item, treeLevel.directItems)
                        : onOpenVideo(item.path, treeLevel.directItems)
                    }
                    onToggleFavorite={() => favorites.toggleFavorite(item.path, kind)}
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
          mediaType={isImage ? "image" : "video"}
          onCreatePlaylistFromFolder={handleCreatePlaylistFromFolder}
          onPlayFolder={!isImage ? (folderItems) => handlePlayFolderVideos(folderItems) : undefined}
          onPlayItem={(item, list) => {
            if (isImage) {
              handleSelectImage(item, list);
            } else {
              onOpenVideo(item.path, list);
            }
          }}
        />
      )}

      {items.length > VISIBLE_ITEM_LIMIT && viewMode === "timeline" ? (
        <p className="visual-limit-note">
          Se muestran los {VISIBLE_ITEM_LIMIT} elementos más recientes para mantener la interfaz ligera.
        </p>
      ) : null}

      {/* Visor Cinematográfico de Imágenes con Zoom y Pan */}
      {selectedImage ? (
        <ImageViewer
          item={selectedImage}
          itemsList={currentActiveList}
          onClose={closeImageViewer}
          onSelectImage={(item) => handleSelectImage(item, currentActiveList)}
        />
      ) : null}
    </section>
  );
}

interface VisualCardProps {
  item: VisualLibraryItem;
  index: number;
  isImage: boolean;
  isFavorite: boolean;
  onClick: () => void;
  onToggleFavorite?: () => void;
}

function VisualCard({ item, index, isImage, isFavorite, onClick, onToggleFavorite }: VisualCardProps) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  let layoutClass = isImage
    ? index % 3 === 0
      ? "bento-card-vertical"
      : index % 2 === 0
        ? "bento-card-horizontal"
        : "bento-card-square"
    : "video-card-16-9";

  if (isImage && dimensions && dimensions.width > 0 && dimensions.height > 0) {
    const ratio = dimensions.width / dimensions.height;
    if (ratio > 1.1) {
      layoutClass = "bento-card-horizontal";
    } else if (ratio < 0.9) {
      layoutClass = "bento-card-vertical";
    } else {
      layoutClass = "bento-card-square";
    }
  }

  return (
    <div className={`visual-media-card-wrapper ${layoutClass}`}>
      <button className="visual-media-card" onClick={onClick} title={cleanPath(item.path)}>
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
            {cleanPath(item.relativeFolder)} · {formatBytes(item.sizeBytes)}
          </small>
        </span>
      </button>

      {onToggleFavorite ? (
        <button
          className={`visual-card-fav-btn ${isFavorite ? "is-favorite" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
        >
          <Icon name="heart" />
        </button>
      ) : null}
    </div>
  );
}

interface VisualFolderCardProps {
  folder: HierarchicalFolder<VisualLibraryItem>;
  isImage: boolean;
  onOpen: () => void;
  onPlayVideo?: () => void;
}

function VisualFolderCard({
  folder,
  isImage,
  onOpen,
  onPlayVideo,
}: VisualFolderCardProps) {
  const isFavorites = folder.isVirtual && folder.virtualType === "favorites";
  const isAll = folder.isVirtual && folder.virtualType === "all";
  const firstItem = folder.allRecursiveItems[0];

  return (
    <div
      className={`folder-collection-card ${isFavorites ? "is-virtual-favorites" : ""} ${isAll ? "is-virtual-all" : ""}`}
      onClick={onOpen}
      title={folder.displayName}
    >
      <div className="folder-collection-cover-frame">
        {isFavorites ? (
          <div className="folder-virtual-card-art is-favorites">
            <Icon name="star" />
          </div>
        ) : isAll ? (
          <div className="folder-virtual-card-art is-all">
            <Icon name={isImage ? "image" : "video"} />
          </div>
        ) : firstItem ? (
          isImage ? (
            <VisualThumbnail
              alt={folder.displayName}
              className="folder-cover-thumbnail"
              path={firstItem.path}
            />
          ) : (
            <VideoThumbnail
              className="folder-cover-thumbnail"
              path={firstItem.path}
              title={folder.displayName}
            />
          )
        ) : (
          <span className="folder-collection-empty">
            <Icon name={isImage ? "image" : "video"} />
          </span>
        )}

        <div className="folder-collection-hover-overlay">
          {onPlayVideo && folder.allRecursiveItems.length > 0 ? (
            <button
              className="folder-play-overlay-btn"
              onClick={(e) => {
                e.stopPropagation();
                onPlayVideo();
              }}
              title="Reproducir vídeos del álbum"
            >
              <Icon name="play" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="folder-collection-info">
        <strong className="folder-collection-name">
          {isFavorites ? "⭐ Favoritos" : folder.displayName}
        </strong>
        <span className="folder-collection-count">
          {folder.allRecursiveItems.length}{" "}
          {folder.allRecursiveItems.length === 1 ? "archivo" : "archivos"}
        </span>
      </div>
    </div>
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
