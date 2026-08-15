import { useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { ContextMenu } from "../../../shared/ui/ContextMenu";
import { cleanPath } from "../../../shared/mediaTree";
import { useFavorites } from "../../../shared/useFavorites";
import { useMediaDelete } from "../../../shared/useMediaDelete";
import { useMediaRename } from "../../../shared/useMediaRename";
import { RenameMediaDialog } from "../../../shared/ui/RenameMediaDialog";
import { addToHistory } from "../../../shared/useHistory";
import type { VisualLibraryItem } from "../model/types";
import { ImageEditor } from "./editor/ImageEditor";
import "./visual-library.css";
import "./image-viewer.css";

export interface ImageViewerProps {
  item: VisualLibraryItem;
  itemsList?: VisualLibraryItem[];
  onClose: () => void;
  onSelectImage?: (item: VisualLibraryItem) => void;
  confirmDeletion: boolean;
  onRefresh: () => void | Promise<void>;
}

const IMAGE_CROSSFADE_MS = 480;

export function ImageViewer({
  item,
  itemsList = [],
  onClose,
  onSelectImage,
  confirmDeletion,
  onRefresh,
}: ImageViewerProps) {
  const [currentItem, setCurrentItem] = useState<VisualLibraryItem>(item);
  const [isSlideshowActive, setIsSlideshowActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isAutoFitActive, setIsAutoFitActive] = useState(false);
  const isAutoFitRef = useRef(false); // Ref para evitar stale closure en onLoad
  const [zoomToast, setZoomToast] = useState<string | null>(null);
  const zoomToastTimerRef = useRef<number | null>(null);
  const [isEntering, setIsEntering] = useState(false);
  const [previousLayer, setPreviousLayer] = useState<{
    item: VisualLibraryItem;
    scale: number;
    pan: { x: number; y: number };
  } | null>(null);
  const clearPrevTimerRef = useRef<number | null>(null);
  const suppressTransformTransitionRef = useRef(true);
  const controlsSuppressUntilRef = useRef(0);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const favorites = useFavorites();

  const activeList = itemsList.length > 0 ? itemsList : [currentItem];
  const currentIndex = activeList.findIndex((it) => it.path === currentItem.path);

  const mediaDelete = useMediaDelete({
    confirmDeletion,
    onRefresh,
    onDeleted: () => {
      if (activeList.length > 1) {
        // Navegar a la siguiente sin fundido cruzado (el archivo eliminado ya no puede recargarse)
        const next = activeList[(currentIndex + 1) % activeList.length];
        if (next && next.path !== currentItem.path) {
          setPreviousLayer(null);
          setCurrentItem(next);
          setIsEntering(false);
          addToHistory(next.path, "image");
          onSelectImage?.(next);
        } else {
          closeViewer();
        }
      } else {
        closeViewer();
      }
    },
  });

  const [isEditing, setIsEditing] = useState(false);

  const mediaRename = useMediaRename({
    onRefresh,
    onRenamed: (result) => {
      setCurrentItem((prev) => ({
        ...prev,
        path: result.newPath,
        title: result.newName,
      }));
      onSelectImage?.({
        ...currentItem,
        path: result.newPath,
        title: result.newName,
      });
    },
  });

  const handleSaveSuccess = async (savedPath: string, isOverwrite: boolean) => {
    await onRefresh();
    setIsEditing(false);
    if (!isOverwrite) {
      const fileName = savedPath.replace(/\\/g, "/").split("/").pop() || "imagen.png";
      const newItem: VisualLibraryItem = {
        ...currentItem,
        path: savedPath,
        title: fileName,
      };
      setCurrentItem(newItem);
      onSelectImage?.(newItem);
    } else {
      setCurrentItem({ ...currentItem });
    }
  };

  const showZoomToast = (scale: number) => {
    if (zoomToastTimerRef.current) window.clearTimeout(zoomToastTimerRef.current);
    setZoomToast(`${Math.round(scale * 100)}%`);
    zoomToastTimerRef.current = window.setTimeout(() => setZoomToast(null), 1200);
  };

  const setAutoFit = (value: boolean) => {
    isAutoFitRef.current = value;
    setIsAutoFitActive(value);
  };

  const resetImageTransform = (fitScale?: number) => {
    // Volver al ajuste de pantalla (fit) no a 1:1 pixel crudo
    const scale = fitScale ?? zoomScale;
    setZoomScale(scale);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setAutoFit(false);
  };

  useEffect(() => {
    if (item.path === currentItem.path) return;
    setCurrentItem(item);
    resetImageTransform();
    setPreviousLayer(null);
    setIsEntering(false);
    addToHistory(item.path, "image");
  }, [item]);

  // Historial del primer elemento al abrir el visor
  useEffect(() => {
    addToHistory(item.path, "image");
    // Solo al montar
  }, []);

  const handleUserActivity = () => {
    if (Date.now() < controlsSuppressUntilRef.current) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const closeViewer = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
    resetImageTransform();
    onClose();
  };

  const toggleFullscreen = () => {
    const viewerElement = document.querySelector(".image-viewer");
    if (!viewerElement) return;

    if (!document.fullscreenElement) {
      void viewerElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
    // Al expandir o minimizar con atajo, no mostrar los controles: solo el cambio de pantalla.
    setShowControls(false);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsSuppressUntilRef.current = Date.now() + 2500;
  };

  const applyAutoFitToImage = (img: HTMLImageElement) => {
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    if (!naturalW || !naturalH) return;
    const scaleX = window.innerWidth / naturalW;
    const scaleY = window.innerHeight / naturalH;
    const fitScale = Math.round(Math.min(scaleX, scaleY) * 100) / 100;
    setZoomScale(fitScale);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const transitionToImage = (nextItem: VisualLibraryItem) => {
    if (!nextItem || nextItem.path === currentItem.path) return;
    setPreviousLayer({ item: currentItem, scale: zoomScale, pan: panOffset });
    setCurrentItem(nextItem);
    setIsEntering(false);
    suppressTransformTransitionRef.current = true;
    if (clearPrevTimerRef.current) window.clearTimeout(clearPrevTimerRef.current);
    clearPrevTimerRef.current = window.setTimeout(() => setPreviousLayer(null), IMAGE_CROSSFADE_MS);
    addToHistory(nextItem.path, "image");
    onSelectImage?.(nextItem);
  };

  const handlePreviousImage = () => {
    if (activeList.length === 0 || currentIndex < 0) return;
    const prevIndex = (currentIndex - 1 + activeList.length) % activeList.length;
    transitionToImage(activeList[prevIndex]);
  };

  const handleNextImage = () => {
    if (activeList.length === 0 || currentIndex < 0) return;
    const nextIndex = (currentIndex + 1) % activeList.length;
    transitionToImage(activeList[nextIndex]);
  };

  const handleZoomIn = () => {
    setAutoFit(false);
    setZoomScale((prev) => {
      const next = Math.min(5, Math.round((prev + 0.25) * 100) / 100);
      showZoomToast(next);
      return next;
    });
  };

  const handleZoomOut = () => {
    setAutoFit(false);
    setZoomScale((prev) => {
      const next = Math.max(0.5, Math.round((prev - 0.25) * 100) / 100);
      if (next <= 1) setPanOffset({ x: 0, y: 0 });
      showZoomToast(next);
      return next;
    });
  };

  const handleResetZoom = () => {
    // Volver al ajuste de pantalla calculando la escala actual desde las dimensiones del img
    const img = imgRef.current;
    if (img && img.naturalWidth) {
      const scaleX = window.innerWidth / img.naturalWidth;
      const scaleY = window.innerHeight / img.naturalHeight;
      const fitScale = Math.round(Math.min(scaleX, scaleY) * 10000) / 10000;
      setZoomScale(fitScale);
      setPanOffset({ x: 0, y: 0 });
      setIsDragging(false);
      setAutoFit(false);
      showZoomToast(fitScale);
    } else {
      resetImageTransform();
    }
  };

  const handleToggleZoom = () => {
    if (zoomScale > 1) {
      handleResetZoom();
    } else {
      setZoomScale(2);
    }
  };


  const handleAutoScale = () => {
    if (isAutoFitRef.current) {
      resetImageTransform();
      showZoomToast(1);
      return;
    }

    const img = imgRef.current;
    if (!img) return;

    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    if (!naturalW || !naturalH) return;

    const scaleX = window.innerWidth / naturalW;
    const scaleY = window.innerHeight / naturalH;
    const fitScale = Math.round(Math.min(scaleX, scaleY) * 100) / 100;

    setZoomScale(fitScale);
    setPanOffset({ x: 0, y: 0 });
    setAutoFit(true);
    showZoomToast(fitScale);
  };

  const handleWheel = (e: React.WheelEvent) => {
    setAutoFit(false);
    if (e.deltaY < 0) {
      setZoomScale((prev) => {
        const next = Math.min(5, Math.round((prev + 0.15) * 100) / 100);
        showZoomToast(next);
        return next;
      });
    } else {
      setZoomScale((prev) => {
        const next = Math.max(0.5, Math.round((prev - 0.15) * 100) / 100);
        if (next <= 1) setPanOffset({ x: 0, y: 0 });
        showZoomToast(next);
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

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Mouse activity listener for auto-hiding controls
  useEffect(() => {
    const onMouseMove = () => {
      handleUserActivity();
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => {
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    mediaDelete.openMenu(e, {
      path: currentItem.path,
      title: currentItem.title,
      kind: "image",
    });
  };

  const buildContextMenuItems = () => {
    const target = mediaDelete.menu;
    if (!target) return [];
    const isFav = favorites.isFavorite(target.item.path);
    return [
      {
        id: "edit",
        label: "Editar imagen",
        icon: "crop" as const,
        onSelect: () => setIsEditing(true),
      },
      {
        id: "rename",
        label: "Renombrar",
        icon: "edit" as const,
        onSelect: () =>
          mediaRename.requestRename({
            path: target.item.path,
            title: target.item.title,
            kind: "image",
          }),
      },
      {
        id: "favorite",
        label: isFav ? "Quitar de favoritos" : "Añadir a favoritos",
        icon: "heart" as const,
        onSelect: () => favorites.toggleFavorite(target.item.path, "image"),
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (mediaDelete.pendingDelete || mediaRename.pendingRename || isEditing) return;
      if (event.key === "Escape") {
        if (mediaDelete.menu) {
          mediaDelete.closeMenu();
        } else if (zoomScale > 1) {
          handleResetZoom();
        } else if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        } else {
          closeViewer();
        }
      } else if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        setIsEditing(true);
      } else if (event.key === "F2") {
        event.preventDefault();
        mediaRename.requestRename({
          path: currentItem.path,
          title: currentItem.title,
          kind: "image",
        });
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFullscreen();
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
      } else if (
        event.key === "Delete" ||
        event.key === "Del" ||
        event.key === "Supr" ||
        event.code === "Delete"
      ) {
        event.preventDefault();
        mediaDelete.requestDelete({
          path: currentItem.path,
          title: currentItem.title,
          kind: "image",
        });
      } else if (event.key === " " && !isDragging) {
        event.preventDefault();
        setIsSlideshowActive((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentIndex,
    activeList,
    currentItem,
    zoomScale,
    isDragging,
    isEditing,
    mediaDelete.pendingDelete,
    mediaDelete.menu,
    mediaDelete.requestDelete,
    mediaDelete.closeMenu,
    mediaRename.pendingRename,
    mediaRename.requestRename,
  ]);

  // Slideshow timer
  useEffect(() => {
    if (!isSlideshowActive || activeList.length <= 1) return;
    const interval = window.setInterval(() => {
      handleNextImage();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [isSlideshowActive, currentIndex, activeList]);

  // Limpieza del temporizador de transición entre imágenes
  useEffect(() => {
    return () => {
      if (clearPrevTimerRef.current) window.clearTimeout(clearPrevTimerRef.current);
    };
  }, []);

  // Al maximizar/minimizar la ventana (con atajos), ocultar los controles de inmediato
  useEffect(() => {
    const onResize = () => {
      setShowControls(false);
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
      controlsSuppressUntilRef.current = Math.max(
        controlsSuppressUntilRef.current,
        Date.now() + 1500,
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      id="image-cinema-container"
      role="dialog"
      aria-label={currentItem.title}
      aria-modal="true"
      className={`image-viewer ${isFullscreen ? "is-fullscreen-mode" : ""} ${!showControls ? "controls-hidden" : ""}`}
      onContextMenu={handleContextMenu}
      onMouseMove={handleUserActivity}
    >
      <div className="image-viewer-top-bar" onClick={(event) => event.stopPropagation()}>
        <div className="image-viewer-top-left">
          <button
            className="image-viewer-top-btn is-icon-only image-viewer-back-btn"
            onClick={closeViewer}
            title="Volver (Esc)"
          >
            <Icon name="arrow-left" />
          </button>
          {activeList.length > 1 ? (
            <span className="image-viewer-pill-badge">
              Foto {currentIndex >= 0 ? currentIndex + 1 : 1} de {activeList.length}
            </span>
          ) : null}
          <button
            className="image-viewer-top-btn image-viewer-edit-btn"
            onClick={() => setIsEditing(true)}
            title="Editar imagen (E)"
          >
            <Icon name="crop" />
            <span>Editar</span>
          </button>
          <button
            className="image-viewer-top-btn"
            onClick={() => {
              invoke("show_in_file_manager", { path: currentItem.path }).catch(() => {});
            }}
            title="Mostrar en explorador de archivos"
          >
            <Icon name="folder" />
            <span>Ubicación</span>
          </button>
        </div>

        <div className="image-viewer-top-center">
          <h2 className="image-viewer-title" title={currentItem.title}>
            {currentItem.title}
          </h2>
        </div>

        <div className="image-viewer-top-right">
          <button
            aria-label={favorites.isFavorite(currentItem.path) ? "Quitar de favoritos" : "Añadir a favoritos"}
            className={`image-viewer-top-btn is-icon-only image-viewer-fav-btn ${favorites.isFavorite(currentItem.path) ? "is-favorite" : ""}`}
            onClick={() => favorites.toggleFavorite(currentItem.path, "image")}
            title={favorites.isFavorite(currentItem.path) ? "Quitar de favoritos" : "Añadir a favoritos"}
          >
            <Icon name="heart" />
          </button>
          <button
            aria-label="Mover a la papelera (Supr)"
            className="image-viewer-top-btn is-icon-only image-viewer-delete-btn"
            onClick={() =>
              mediaDelete.requestDelete({
                path: currentItem.path,
                title: currentItem.title,
                kind: "image",
              })
            }
            title="Mover a la papelera (Supr)"
          >
            <Icon name="trash" />
          </button>
          <button
            className={`image-viewer-top-btn image-viewer-slideshow-btn ${isSlideshowActive ? "is-active" : ""}`}
            onClick={() => setIsSlideshowActive(!isSlideshowActive)}
            title={isSlideshowActive ? "Detener presentación" : "Iniciar presentación automática"}
          >
            <Icon name={isSlideshowActive ? "pause" : "play"} />
            <span>{isSlideshowActive ? "Pausar" : "Presentación"}</span>
          </button>
          <button
            aria-label={isFullscreen ? "Salir de pantalla completa (F)" : "Pantalla completa (F)"}
            className={`image-viewer-top-btn is-icon-only ${isFullscreen ? "is-active" : ""}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Salir de pantalla completa (F)" : "Pantalla completa (F)"}
          >
            <Icon name={isFullscreen ? "fullscreen-exit" : "fullscreen"} />
          </button>
          <button
            aria-label="Cerrar vista previa (Esc)"
            className="image-viewer-top-btn is-icon-only image-viewer-close-btn"
            onClick={closeViewer}
            title="Cerrar (Esc)"
          >
            <Icon name="close" />
          </button>
        </div>
      </div>

      {activeList.length > 1 ? (
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
        <div className="image-viewer-media-container">
          {previousLayer ? (
            <div
              className="image-viewer-media-layer is-leaving"
              key={previousLayer.item.path}
              style={{
                transform: `translate(${previousLayer.pan.x}px, ${previousLayer.pan.y}px) scale(${previousLayer.scale})`,
              }}
            >
              <img
                alt={previousLayer.item.title}
                className="image-viewer-media"
                draggable={false}
                src={convertFileSrc(cleanPath(previousLayer.item.path))}
              />
            </div>
          ) : null}
          <div
            className={`image-viewer-media-layer is-current${isEntering ? " is-entering" : ""}`}
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
              transition: isDragging
                ? "none"
                : suppressTransformTransitionRef.current
                  ? "none"
                  : "transform 0.16s ease-out",
            }}
          >
            <img
              alt={currentItem.title}
              className="image-viewer-media"
              draggable={false}
              ref={imgRef}
              src={convertFileSrc(cleanPath(currentItem.path))}
              onError={() => setIsEntering(true)}
              onLoad={(e) => {
                const img = e.currentTarget;
                const naturalW = img.naturalWidth || img.width;
                const naturalH = img.naturalHeight || img.height;
                if (!naturalW || !naturalH) return;

                const scaleX = window.innerWidth / naturalW;
                const scaleY = window.innerHeight / naturalH;
                const fitScale = Math.round(Math.min(scaleX, scaleY) * 10000) / 10000;

                // Ajustar a pantalla al cargar sin animar la escala durante el fundido cruzado
                suppressTransformTransitionRef.current = true;
                setZoomScale(fitScale);
                setPanOffset({ x: 0, y: 0 });
                setIsEntering(true);
                requestAnimationFrame(() => {
                  suppressTransformTransitionRef.current = false;
                });
              }}
            />
          </div>
        </div>
      </figure>

      {/* Toast de escala al hacer zoom */}
      {zoomToast && (
        <div className="image-viewer-zoom-toast" key={zoomToast}>
          {zoomToast}
        </div>
      )}

      {/* Barra de control de Zoom y Escala Automática */}
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
        <button
          className={`image-viewer-autofit-btn${isAutoFitActive ? " is-active" : ""}`}
          onClick={handleAutoScale}
          title={isAutoFitActive ? "Desactivar ajuste automático" : "Ajustar a la pantalla automáticamente"}
        >
          <Icon name="fit-screen" />
        </button>
      </div>

      {mediaDelete.deleteError ? (
        <div className="image-viewer-delete-error" role="alert">
          No se pudo eliminar: {mediaDelete.deleteError}
        </div>
      ) : null}

      {mediaDelete.menu ? (
        <ContextMenu
          items={buildContextMenuItems()}
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
          title="Mover imagen a la papelera"
        />
      ) : null}

      {isEditing && (
        <ImageEditor
          item={currentItem}
          onClose={() => setIsEditing(false)}
          onSaveSuccess={handleSaveSuccess}
        />
      )}

      {mediaRename.pendingRename && (
        <RenameMediaDialog
          currentPath={mediaRename.pendingRename.path}
          currentTitle={mediaRename.pendingRename.title}
          onConfirm={mediaRename.confirmRename}
          onCancel={mediaRename.cancelRename}
        />
      )}
    </div>
  );
}
