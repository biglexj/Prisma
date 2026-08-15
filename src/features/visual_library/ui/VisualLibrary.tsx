import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import { FolderBreadcrumbHeader } from "../../../shared/ui/FolderBreadcrumbHeader";
import { MediaTreeView } from "../../../shared/ui/MediaTreeView";
import {
  resolveTreeLevel,
  type HierarchicalFolder,
} from "../../../shared/mediaTree";
import { useFavorites } from "../../../shared/useFavorites";
import type { VisualFolderSource, VisualLibraryItem, VisualMediaKind } from "../model/types";
import { VisualThumbnail } from "./VisualThumbnail";
import { VideoThumbnail } from "./VideoThumbnail";
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
  onAdd,
  onOpenVideo,
  onOpenFolders,
}: VisualLibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => sessionVisualState[kind].viewMode);
  const [currentFolderPath, setCurrentFolderPath] = useState<string>(() => sessionVisualState[kind].folderPath);
  const [selectedImage, setSelectedImage] = useState<VisualLibraryItem | null>(null);
  const [isSlideshowActive, setIsSlideshowActive] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
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

  const visibleItems = items.slice(0, VISIBLE_ITEM_LIMIT);
  const timelineSections = groupByTimeline(visibleItems);

  // Árbol jerárquico y colecciones
  const treeLevel = resolveTreeLevel(items, currentFolderPath, favorites.favorites, {
    allName: isImage ? "Todas las imágenes" : "Todos los vídeos",
    mediaType: isImage ? "image" : "video",
  });

  const isInsideFolder = currentFolderPath !== "";

  // Active list for current view
  const currentActiveList = isInsideFolder
    ? (treeLevel.directItems.length > 0 ? treeLevel.directItems : treeLevel.allRecursiveItems)
    : items;

  const selectedImageIndex = selectedImage
    ? currentActiveList.findIndex((it) => it.path === selectedImage.path)
    : -1;

  const resetImageTransform = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const handleSelectImage = (item: VisualLibraryItem) => {
    resetImageTransform();
    setSelectedImage(item);
  };

  const handlePreviousImage = () => {
    if (currentActiveList.length === 0 || selectedImageIndex < 0) return;
    resetImageTransform();
    const prevIdx =
      selectedImageIndex > 0 ? selectedImageIndex - 1 : currentActiveList.length - 1;
    setSelectedImage(currentActiveList[prevIdx]);
  };

  const handleNextImage = () => {
    if (currentActiveList.length === 0 || selectedImageIndex < 0) return;
    resetImageTransform();
    const nextIdx =
      selectedImageIndex < currentActiveList.length - 1 ? selectedImageIndex + 1 : 0;
    setSelectedImage(currentActiveList[nextIdx]);
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(5, Math.round((prev + 0.25) * 100) / 100));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => {
      const next = Math.max(0.5, Math.round((prev - 0.25) * 100) / 100);
      if (next <= 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleToggleZoom = () => {
    if (zoomScale > 1) {
      handleResetZoom();
    } else {
      setZoomScale(2);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    if (e.deltaY < 0) {
      setZoomScale((prev) => Math.min(5, Math.round((prev + 0.15) * 100) / 100));
    } else {
      setZoomScale((prev) => {
        const next = Math.max(0.5, Math.round((prev - 0.15) * 100) / 100);
        if (next <= 1) setPanOffset({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1 || e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomScale <= 1) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Keyboard navigation for image lightbox
  useEffect(() => {
    if (!selectedImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (zoomScale > 1) {
          handleResetZoom();
        } else {
          setSelectedImage(null);
          setIsSlideshowActive(false);
        }
      } else if ((event.ctrlKey || event.metaKey) && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        handleZoomIn();
      } else if ((event.ctrlKey || event.metaKey) && (event.key === "-" || event.key === "_")) {
        event.preventDefault();
        handleZoomOut();
      } else if ((event.ctrlKey || event.metaKey) && event.key === "0") {
        event.preventDefault();
        handleResetZoom();
      } else if (event.key === "ArrowLeft") {
        handlePreviousImage();
      } else if (event.key === "ArrowRight") {
        handleNextImage();
      } else if (event.key.toLowerCase() === " ") {
        event.preventDefault();
        setIsSlideshowActive((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage, selectedImageIndex, currentActiveList, zoomScale]);

  // Slideshow timer
  useEffect(() => {
    if (!isSlideshowActive || !selectedImage) return;
    const timer = window.setInterval(() => {
      handleNextImage();
    }, 3500);
    return () => window.clearInterval(timer);
  }, [isSlideshowActive, selectedImage, selectedImageIndex, currentActiveList]);

  const handlePlayAllVideos = () => {
    if (items.length === 0) return;
    onOpenVideo(items[0].path, items);
  };

  const handlePlayFolderVideos = (folderItems: VisualLibraryItem[]) => {
    if (folderItems.length === 0) return;
    onOpenVideo(folderItems[0].path, folderItems);
  };

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
        /* ── 1. Cuadrícula Bento Dinámica Adaptativa con Tiempo ── */
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
                    isFavorite={favorites.isFavorite(item.path)}
                    isImage={isImage}
                    item={item}
                    key={item.path}
                    onClick={() =>
                      isImage
                        ? handleSelectImage(item)
                        : onOpenVideo(item.path, section.items)
                    }
                    onToggleFavorite={() => favorites.toggleFavorite(item.path)}
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
              <div className="visual-grid bento-grid-layout">
                {treeLevel.directItems.map((item, idx) => (
                  <VisualCard
                    index={idx}
                    isFavorite={favorites.isFavorite(item.path)}
                    isImage={isImage}
                    item={item}
                    key={item.path}
                    onClick={() =>
                      isImage
                        ? handleSelectImage(item)
                        : onOpenVideo(item.path, treeLevel.directItems)
                    }
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
          mediaType={isImage ? "image" : "video"}
          onPlayFolder={!isImage ? (folderItems) => handlePlayFolderVideos(folderItems) : undefined}
          onPlayItem={(item, list) => {
            if (isImage) {
              handleSelectImage(item);
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
        <div
          aria-label={selectedImage.title}
          aria-modal="true"
          className="image-viewer"
          onClick={() => {
            setSelectedImage(null);
            setIsSlideshowActive(false);
            resetImageTransform();
          }}
          role="dialog"
        >
          <div className="image-viewer-top-bar" onClick={(e) => e.stopPropagation()}>
            <span className="image-viewer-counter">
              Foto {selectedImageIndex >= 0 ? selectedImageIndex + 1 : 1} de {currentActiveList.length}
            </span>
            <div className="image-viewer-top-actions">
              <button
                className={`image-viewer-fav-btn ${favorites.isFavorite(selectedImage.path) ? "is-favorite" : ""}`}
                onClick={() => favorites.toggleFavorite(selectedImage.path)}
                title={favorites.isFavorite(selectedImage.path) ? "Quitar de favoritos" : "Añadir a favoritos"}
              >
                <Icon name="heart" />
              </button>
              <button
                className={`image-viewer-slideshow-btn ${isSlideshowActive ? "is-active" : ""}`}
                onClick={() => setIsSlideshowActive(!isSlideshowActive)}
                title={isSlideshowActive ? "Detener presentación" : "Iniciar presentación automática"}
              >
                <Icon name="play" />
                <span>{isSlideshowActive ? "Pausar Diapositivas" : "Presentación"}</span>
              </button>
              <button
                aria-label="Cerrar vista previa"
                className="image-viewer-close"
                onClick={() => {
                  setSelectedImage(null);
                  setIsSlideshowActive(false);
                  resetImageTransform();
                }}
              >
                <Icon name="close" />
              </button>
            </div>
          </div>

          {currentActiveList.length > 1 ? (
            <>
              <button
                className="image-viewer-nav-btn is-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreviousImage();
                }}
                title="Imagen anterior (←)"
              >
                <Icon name="chevron-left" />
              </button>
              <button
                className="image-viewer-nav-btn is-next"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage();
                }}
                title="Imagen siguiente (→)"
              >
                <Icon name="chevron-right" />
              </button>
            </>
          ) : null}

          <figure
            className="image-viewer-stage"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={handleToggleZoom}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            style={{
              cursor: zoomScale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
            }}
          >
            <div
              className="image-viewer-media-container"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                transition: isDragging ? "none" : "transform 0.16s ease-out",
              }}
            >
              <img
                alt={selectedImage.title}
                className="image-viewer-media"
                draggable={false}
                src={convertFileSrc(selectedImage.path)}
              />
            </div>
            <figcaption>
              <strong>{selectedImage.title}</strong>
              <span>{selectedImage.path}</span>
            </figcaption>
          </figure>

          {/* Barra de control de Zoom */}
          <div className="image-viewer-zoom-controls" onClick={(e) => e.stopPropagation()}>
            <button onClick={handleZoomOut} title="Alejar (Ctrl - / Rueda abajo)">
              <Icon name="minus" />
            </button>
            <button className="image-viewer-zoom-level" onClick={handleResetZoom} title="Restablecer zoom 100% (Ctrl 0)">
              {Math.round(zoomScale * 100)}%
            </button>
            <button onClick={handleZoomIn} title="Acercar (Ctrl + / Rueda arriba)">
              <Icon name="plus" />
            </button>
          </div>
        </div>
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

  let bentoClass = isImage
    ? index % 3 === 0
      ? "bento-card-vertical"
      : index % 2 === 0
      ? "bento-card-horizontal"
      : "bento-card-square"
    : "bento-card-square";

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
    <div className={`visual-media-card-wrapper ${bentoClass}`}>
      <button className="visual-media-card" onClick={onClick} title={item.path}>
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
