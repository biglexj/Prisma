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

type ViewMode = "bento" | "folders" | "tree";

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
  const [viewMode, setViewMode] = useState<ViewMode>("bento");
  const [currentFolderPath, setCurrentFolderPath] = useState<string>("");
  const [selectedImage, setSelectedImage] = useState<VisualLibraryItem | null>(null);
  const [isSlideshowActive, setIsSlideshowActive] = useState(false);
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

  // Árbol jerárquico y colecciones
  const treeLevel = resolveTreeLevel(items, currentFolderPath, favorites.favorites, {
    allName: isImage ? "Todas las imágenes" : "Todos los vídeos",
    mediaType: isImage ? "image" : "video",
  });

  const isInsideFolder = currentFolderPath !== "";

  // Active list for current view (for next/prev in image viewer or video player queue)
  const currentActiveList = isInsideFolder
    ? (treeLevel.directItems.length > 0 ? treeLevel.directItems : treeLevel.allRecursiveItems)
    : items;

  const selectedImageIndex = selectedImage
    ? currentActiveList.findIndex((it) => it.path === selectedImage.path)
    : -1;

  const handlePreviousImage = () => {
    if (currentActiveList.length === 0 || selectedImageIndex < 0) return;
    const prevIdx =
      selectedImageIndex > 0 ? selectedImageIndex - 1 : currentActiveList.length - 1;
    setSelectedImage(currentActiveList[prevIdx]);
  };

  const handleNextImage = () => {
    if (currentActiveList.length === 0 || selectedImageIndex < 0) return;
    const nextIdx =
      selectedImageIndex < currentActiveList.length - 1 ? selectedImageIndex + 1 : 0;
    setSelectedImage(currentActiveList[nextIdx]);
  };

  // Keyboard navigation for image lightbox
  useEffect(() => {
    if (!selectedImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedImage(null);
        setIsSlideshowActive(false);
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
  }, [selectedImage, selectedImageIndex, currentActiveList]);

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
    setCurrentFolderPath("");
  };

  return (
    <section className={`visual-library visual-library-${kind}`}>
      <header className="visual-library-heading">
        <div className="section-heading">
          <span className="preview-kicker">BIBLIOTECA VISUAL</span>
          <h1>{label}</h1>
          <p>
            {isImage
              ? "Explora tus fotografías e ilustraciones en Bento Grid adaptativo, mosaico de carpetas o árbol de directorios."
              : "Organiza y reproduce tus vídeos locales con Bento Grid, carpetas, favoritos, árbol de directorios y reproductor de cine."}
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
      ) : viewMode === "bento" ? (
        /* ── 1. Cuadrícula Bento Dinámica Adaptativa ── */
        <div className="visual-timeline-container" aria-busy={loading}>
          <div className="visual-grid bento-grid-layout">
            {visibleItems.map((item, idx) => (
              <VisualCard
                index={idx}
                isFavorite={favorites.isFavorite(item.path)}
                isImage={isImage}
                item={item}
                key={item.path}
                onClick={() =>
                  isImage
                    ? setSelectedImage(item)
                    : onOpenVideo(item.path, visibleItems)
                }
                onToggleFavorite={() => favorites.toggleFavorite(item.path)}
              />
            ))}
          </div>
        </div>
      ) : viewMode === "folders" ? (
        /* ── 2. Vista de Colecciones de Carpetas ── */
        <div className="visual-folder-tree-view" aria-busy={loading}>
          {isInsideFolder ? (
            <FolderBreadcrumbHeader
              currentPath={currentFolderPath}
              itemCount={treeLevel.allRecursiveItems.length}
              onNavigate={(path) => setCurrentFolderPath(path ?? "")}
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
                    onOpen={() => setCurrentFolderPath(folder.id)}
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
                        ? setSelectedImage(item)
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
              setSelectedImage(item);
            } else {
              onOpenVideo(item.path, list);
            }
          }}
        />
      )}

      {items.length > VISIBLE_ITEM_LIMIT && viewMode === "bento" ? (
        <p className="visual-limit-note">
          Se muestran los {VISIBLE_ITEM_LIMIT} elementos más recientes para mantener la interfaz ligera.
        </p>
      ) : null}

      {/* Visor Cinematográfico de Imágenes */}
      {selectedImage ? (
        <div
          aria-label={selectedImage.title}
          aria-modal="true"
          className="image-viewer"
          onClick={() => {
            setSelectedImage(null);
            setIsSlideshowActive(false);
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
