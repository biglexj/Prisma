import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import { ContextMenu, type ContextMenuItem } from "../../../shared/ui/ContextMenu";
import type { MusicLibraryItem } from "../../music_library/model/types";
import { MusicArtwork } from "../../music_library/ui/MusicArtwork";
import { resolveLibraryTrackInfo } from "../../music_library/model/trackInfo";
import type { VisualLibraryItem } from "../../visual_library/model/types";
import { VisualThumbnail } from "../../visual_library/ui/VisualThumbnail";
import { VideoThumbnail } from "../../visual_library/ui/VideoThumbnail";
import { copyImageToClipboard } from "../../visual_library/services/imageClipboard";
import { cleanPath } from "../../../shared/mediaTree";
import type { FavoriteMediaType } from "../model/types";

interface FavoriteFullViewProps {
  mediaType: FavoriteMediaType;
  items: Array<MusicLibraryItem | VisualLibraryItem>;
  onBack: () => void;
  onPlayMusic?: (path: string, sessionItems?: MusicLibraryItem[], queueName?: string) => void;
  onOpenImage?: (path: string, sessionItems?: VisualLibraryItem[]) => void;
  onPlayVideo?: (path: string, sessionItems?: VisualLibraryItem[]) => void;
  onAddToQueue?: (item: MusicLibraryItem) => void;
  onToggleFavorite: (mediaType: FavoriteMediaType, path: string) => void;
}

export function FavoriteFullView({
  mediaType,
  items,
  onBack,
  onPlayMusic,
  onOpenImage,
  onPlayVideo,
  onAddToQueue,
  onToggleFavorite,
}: FavoriteFullViewProps) {
  const [filter, setFilter] = useState("");
  const [activatingPath, setActivatingPath] = useState<string | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((text: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToastText(text);
    toastTimerRef.current = window.setTimeout(() => setToastText(null), 2000);
  }, []);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: MusicLibraryItem | VisualLibraryItem;
  } | null>(null);

  const triggerActivation = (path: string) => {
    setActivatingPath(path);
    window.setTimeout(() => {
      setActivatingPath((curr) => (curr === path ? null : curr));
    }, 600);
  };

  const handleCardContextMenu = (
    event: React.MouseEvent,
    item: MusicLibraryItem | VisualLibraryItem,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      item,
    });
  };

  const title =
    mediaType === "music"
      ? "Música Favorita"
      : mediaType === "image"
      ? "Imágenes Favoritas"
      : "Vídeos Favoritos";

  const kicker =
    mediaType === "music"
      ? "COLECCIONES · MÚSICA"
      : mediaType === "image"
      ? "COLECCIONES · IMÁGENES"
      : "COLECCIONES · VÍDEOS";

  const filteredItems = items.filter((item) => {
    if (!filter) return true;
    const query = filter.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      item.relativeFolder.toLowerCase().includes(query)
    );
  });

  const buildContextMenuItems = (): ContextMenuItem[] => {
    if (!contextMenu) return [];
    const item = contextMenu.item;
    const menuItems: ContextMenuItem[] = [];

    // 1. Reproducir / Abrir
    if (mediaType === "video") {
      menuItems.push({
        id: "play-video",
        label: "Reproducir vídeo",
        icon: "play",
        onSelect: () => {
          triggerActivation(item.path);
          onPlayVideo?.(item.path, filteredItems as VisualLibraryItem[]);
        },
      });
    } else if (mediaType === "music") {
      menuItems.push({
        id: "play-music",
        label: "Reproducir canción",
        icon: "play",
        onSelect: () => {
          triggerActivation(item.path);
          onPlayMusic?.(item.path, filteredItems as MusicLibraryItem[], "Favoritos");
        },
      });
      if (onAddToQueue) {
        menuItems.push({
          id: "queue-music",
          label: "Añadir a la cola",
          icon: "queue",
          onSelect: () => {
            onAddToQueue(item as MusicLibraryItem);
            showToast("🎵 Añadido a la cola");
          },
        });
      }
    } else if (mediaType === "image") {
      menuItems.push({
        id: "open-image",
        label: "Abrir imagen",
        icon: "image",
        onSelect: () => onOpenImage?.(item.path, filteredItems as VisualLibraryItem[]),
      });
    }

    // 2. Quitar de favoritos (Funciona siempre, incluso si el archivo se movió de disco)
    menuItems.push({
      id: "toggle-fav",
      label: "Quitar de favoritos",
      icon: "heart",
      onSelect: () => {
        onToggleFavorite(mediaType, item.path);
        showToast("🤍 Eliminado de favoritos");
      },
    });

    // 3. Específico de imagen: Copiar al portapapeles
    if (mediaType === "image") {
      menuItems.push({
        id: "copy-image",
        label: "Copiar imagen",
        icon: "copy",
        onSelect: () => {
          void copyImageToClipboard(item.path).then((ok) => {
            if (ok) {
              showToast("📋 Imagen copiada al portapapeles");
            } else {
              showToast("❌ No se pudo copiar la imagen");
            }
          });
        },
      });
    }

    // 4. Mostrar en carpeta
    menuItems.push({
      id: "show-in-folder",
      label: "Mostrar en carpeta",
      icon: "folder-open",
      onSelect: () => {
        void invoke("show_in_file_manager", { path: item.path }).catch(() => {
          showToast("❌ No se pudo abrir la carpeta");
        });
      },
    });

    // 5. Herramientas Prisma
    if (mediaType === "music") {
      menuItems.push({
        id: "convert-music",
        label: "Convertir en Convertidor Prisma",
        icon: "refresh",
        onSelect: () => {
          window.dispatchEvent(
            new CustomEvent("prisma-open-converter", {
              detail: {
                path: item.path,
                mode: "audio_transcode",
              },
            }),
          );
        },
      });
    } else if (mediaType === "video") {
      menuItems.push(
        {
          id: "convert-video",
          label: "Convertir / Extraer audio",
          icon: "refresh",
          onSelect: () => {
            window.dispatchEvent(
              new CustomEvent("prisma-open-converter", {
                detail: {
                  path: item.path,
                  mode: "video_to_audio",
                },
              }),
            );
          },
        },
        {
          id: "send-to-mobile",
          label: "Enviar a Super Galería (Móvil)",
          icon: "smartphone",
          onSelect: () => {
            window.dispatchEvent(
              new CustomEvent("prisma-send-to-supergallery", {
                detail: { path: item.path, title: item.title },
              }),
            );
          },
        },
      );
    } else if (mediaType === "image") {
      menuItems.push(
        {
          id: "convert-image",
          label: "Convertir imagen",
          icon: "refresh",
          onSelect: () => {
            window.dispatchEvent(
              new CustomEvent("prisma-open-converter", {
                detail: {
                  path: item.path,
                  mode: "image",
                },
              }),
            );
          },
        },
        {
          id: "send-to-mobile",
          label: "Enviar a Super Galería (Móvil)",
          icon: "smartphone",
          onSelect: () => {
            window.dispatchEvent(
              new CustomEvent("prisma-send-to-supergallery", {
                detail: { path: item.path, title: item.title },
              }),
            );
          },
        },
      );
    }

    // 6. Copiar ruta
    menuItems.push({
      id: "copy-path",
      label: "Copiar ruta",
      icon: "copy",
      onSelect: () => {
        void navigator.clipboard.writeText(item.path).then(() => {
          showToast("📋 Ruta copiada al portapapeles");
        });
      },
    });

    return menuItems;
  };

  return (
    <div className="favorite-full-view">
      <header className="favorite-full-header">
        <div className="favorite-full-title-row">
          <button className="icon-button back-btn" onClick={onBack} title="Volver a Favoritos">
            <Icon name="arrow-left" />
          </button>
          <div>
            <span className="preview-kicker">{kicker}</span>
            <h1>{title}</h1>
          </div>
        </div>

        <div className="favorite-full-controls">
          <div className="favorite-search-box">
            <Icon name="music" />
            <input
              type="text"
              placeholder={`Buscar en ${title.toLowerCase()}…`}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoFocus
            />
            {filter ? (
              <button
                className="icon-button clear-btn"
                onClick={() => setFilter("")}
                title="Limpiar búsqueda"
              >
                <Icon name="close" />
              </button>
            ) : null}
          </div>
          <span className="favorite-count-badge">
            {filteredItems.length} {filteredItems.length === 1 ? "elemento" : "elementos"}
          </span>
        </div>
      </header>

      {filteredItems.length === 0 ? (
        <div className="collections-empty-state">
          <div className="collections-empty-icon">
            <Icon name="heart" />
          </div>
          <h2>No se encontraron elementos</h2>
          <p>
            {filter
              ? `No hay favoritos que coincidan con "${filter}".`
              : "No tienes ningún elemento marcado en esta categoría."}
          </p>
        </div>
      ) : (
        <div className={`favorite-full-grid is-${mediaType}`}>
          {filteredItems.map((item) => {
            if (mediaType === "music") {
              const musicItem = item as MusicLibraryItem;
              const { title: songTitle, artist } = resolveLibraryTrackInfo(musicItem);
              return (
                <div
                  className={`favorite-full-card is-music ${activatingPath === musicItem.path ? "is-activating" : ""}`}
                  key={musicItem.path}
                  onClick={() => {
                    triggerActivation(musicItem.path);
                    if (onPlayMusic) {
                      onPlayMusic(
                        musicItem.path,
                        filteredItems as MusicLibraryItem[],
                        "Favoritos",
                      );
                    }
                  }}
                  onContextMenu={(e) => handleCardContextMenu(e, musicItem)}
                >
                  <div className="favorite-card-media">
                    <MusicArtwork path={musicItem.path} alt={songTitle} />
                    <span className="favorite-play-overlay">
                      <Icon name="play" />
                    </span>
                  </div>
                  <div className="favorite-card-meta">
                    <strong title={songTitle}>{songTitle}</strong>
                    <small title={artist || "Pista local"}>{artist || "Pista local"}</small>
                  </div>
                  <button
                    className="favorite-toggle-btn is-favorited"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite("music", musicItem.path);
                      showToast("🤍 Eliminado de favoritos");
                    }}
                    title="Quitar de favoritos"
                  >
                    <Icon name="heart" />
                  </button>
                </div>
              );
            }

            if (mediaType === "image") {
              const visualItem = item as VisualLibraryItem;
              return (
                <div
                  className="favorite-full-card is-image"
                  key={visualItem.path}
                  onContextMenu={(e) => handleCardContextMenu(e, visualItem)}
                >
                  <div
                    className="favorite-card-media"
                    onClick={() =>
                      onOpenImage &&
                      onOpenImage(visualItem.path, filteredItems as VisualLibraryItem[])
                    }
                  >
                    <VisualThumbnail path={visualItem.path} alt={visualItem.title} />
                  </div>
                  <div className="favorite-card-meta">
                    <strong title={visualItem.title}>{visualItem.title}</strong>
                    <small title={cleanPath(visualItem.relativeFolder)}>
                      {cleanPath(visualItem.relativeFolder)}
                    </small>
                  </div>
                  <button
                    className="favorite-toggle-btn is-favorited"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite("image", visualItem.path);
                      showToast("🤍 Eliminado de favoritos");
                    }}
                    title="Quitar de favoritos"
                  >
                    <Icon name="heart" />
                  </button>
                </div>
              );
            }

            // Video
            const visualItem = item as VisualLibraryItem;
            return (
              <div
                className={`favorite-full-card is-video ${activatingPath === visualItem.path ? "is-activating" : ""}`}
                key={visualItem.path}
                onClick={() => {
                  triggerActivation(visualItem.path);
                  if (onPlayVideo) {
                    onPlayVideo(visualItem.path, filteredItems as VisualLibraryItem[]);
                  }
                }}
                onContextMenu={(e) => handleCardContextMenu(e, visualItem)}
              >
                <div className="favorite-card-media is-video-media">
                  <VideoThumbnail eager path={visualItem.path} title={visualItem.title} />
                  <span className="favorite-play-overlay">
                    <Icon name="play" />
                  </span>
                </div>
                <div className="favorite-card-meta">
                  <strong title={visualItem.title}>{visualItem.title}</strong>
                  <small title={cleanPath(visualItem.relativeFolder)}>
                    {cleanPath(visualItem.relativeFolder)}
                  </small>
                </div>
                <button
                  className="favorite-toggle-btn is-favorited"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite("video", visualItem.path);
                    showToast("🤍 Eliminado de favoritos");
                  }}
                  title="Quitar de favoritos"
                >
                  <Icon name="heart" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Menú Contextual (Anticlic) */}
      {contextMenu ? (
        <ContextMenu
          items={buildContextMenuItems()}
          onClose={() => setContextMenu(null)}
          x={contextMenu.x}
          y={contextMenu.y}
        />
      ) : null}

      {/* Feedback Toast */}
      {toastText ? (
        <div className="collections-toast" key={toastText}>
          <span>{toastText}</span>
        </div>
      ) : null}
    </div>
  );
}
