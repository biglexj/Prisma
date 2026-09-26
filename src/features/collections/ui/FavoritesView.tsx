import { useState, useMemo, useCallback, useRef } from "react";
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
import { useFavorites } from "../useFavorites";
import { FavoriteFullView } from "./FavoriteFullView";
import type { FavoriteMediaType } from "../model/types";
import { useScrollRestoration } from "../../../shared/useScrollRestoration";
import "./collections.css";

const FAVORITE_SHELF_LIMIT = 16; // Máximo 2 filas de 8 ítems

interface FavoritesViewProps {
  musicItems: MusicLibraryItem[];
  images: VisualLibraryItem[];
  videos: VisualLibraryItem[];
  onPlayMusic: (path: string, sessionItems?: MusicLibraryItem[], queueName?: string) => void;
  onOpenImage?: (path: string, sessionItems?: VisualLibraryItem[]) => void;
  onPlayVideo: (path: string, sessionItems?: VisualLibraryItem[]) => void;
  onAddToQueue?: (item: MusicLibraryItem) => void;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
}

function synthesizeVisualItem(path: string): VisualLibraryItem {
  const normalized = path.replace(/\\/g, "/");
  const fileName = normalized.substring(normalized.lastIndexOf("/") + 1) || path;
  const dotIdx = fileName.lastIndexOf(".");
  const title = dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName;
  const segments = normalized.split("/").filter(Boolean);
  const relativeFolder = segments.length > 1 ? segments[segments.length - 2] : "Favoritos";
  const ext = dotIdx > 0 ? fileName.substring(dotIdx + 1).toLowerCase() : "";
  const isVideo = ["mp4", "mkv", "webm", "avi", "mov", "wmv", "flv", "m4v"].includes(ext);

  return {
    path,
    title,
    sourcePath: path,
    relativeFolder,
    kind: isVideo ? "video" : "image",
    sizeBytes: 0,
    modifiedAtMillis: Date.now(),
  };
}

function synthesizeMusicItem(path: string): MusicLibraryItem {
  const normalized = path.replace(/\\/g, "/");
  const fileName = normalized.substring(normalized.lastIndexOf("/") + 1) || path;
  const dotIdx = fileName.lastIndexOf(".");
  const title = dotIdx > 0 ? fileName.substring(0, dotIdx) : fileName;
  const segments = normalized.split("/").filter(Boolean);
  const relativeFolder = segments.length > 1 ? segments[segments.length - 2] : "Favoritos";
  return {
    path,
    title,
    sourcePath: path,
    relativeFolder,
    sizeBytes: 0,
    modifiedAtMillis: Date.now(),
  };
}

let sessionFavoritesFullViewType: FavoriteMediaType | null = null;

export function FavoritesView({
  musicItems,
  images,
  videos,
  onPlayMusic,
  onOpenImage,
  onPlayVideo,
  onAddToQueue,
}: FavoritesViewProps) {
  const { store, toggle } = useFavorites();
  const [activatingPath, setActivatingPath] = useState<string | null>(null);
  const [fullViewType, setFullViewTypeState] = useState<FavoriteMediaType | null>(() => sessionFavoritesFullViewType);
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
    mediaType: FavoriteMediaType;
  } | null>(null);

  const setFullViewType = useCallback((type: FavoriteMediaType | null) => {
    sessionFavoritesFullViewType = type;
    setFullViewTypeState(type);
  }, []);

  const triggerActivation = (path: string) => {
    setActivatingPath(path);
    window.setTimeout(() => {
      setActivatingPath((curr) => (curr === path ? null : curr));
    }, 600);
  };

  const handlePlayMusicWithFeedback = (path: string) => {
    triggerActivation(path);
    onPlayMusic(path, favoriteMusicItems, "Favoritos");
  };

  const handlePlayVideoWithFeedback = (path: string) => {
    triggerActivation(path);
    onPlayVideo(path, favoriteVideoItems);
  };

  const handleCardContextMenu = (
    event: React.MouseEvent,
    item: MusicLibraryItem | VisualLibraryItem,
    mediaType: FavoriteMediaType,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      item,
      mediaType,
    });
  };

  useScrollRestoration(`view:favorites:${fullViewType ?? "summary"}`);

  // Mapear rutas de favoritos con los objetos reales de la biblioteca o sintetizar respaldo
  const favoriteMusicItems = useMemo(() => {
    const musicMap = new Map(musicItems.map((it) => [normalizePath(it.path), it]));
    return store.music
      .map((path) => musicMap.get(normalizePath(path)) || synthesizeMusicItem(path))
      .filter((it) => {
        const real = musicMap.get(normalizePath(it.path));
        return real ? !real.isExcluded : true;
      });
  }, [store.music, musicItems]);

  const favoriteImageItems = useMemo(() => {
    const imgMap = new Map(images.map((it) => [normalizePath(it.path), it]));
    return store.images
      .map((path) => imgMap.get(normalizePath(path)) || synthesizeVisualItem(path))
      .filter((it) => {
        const real = imgMap.get(normalizePath(it.path));
        return real ? !real.isExcluded : true;
      });
  }, [store.images, images]);

  const favoriteVideoItems = useMemo(() => {
    const vidMap = new Map(videos.map((it) => [normalizePath(it.path), it]));
    return store.videos
      .map((path) => vidMap.get(normalizePath(path)) || synthesizeVisualItem(path))
      .filter((it) => {
        const real = vidMap.get(normalizePath(it.path));
        return real ? !real.isExcluded : true;
      });
  }, [store.videos, videos]);

  const totalFavorites =
    favoriteMusicItems.length + favoriteImageItems.length + favoriteVideoItems.length;

  const buildContextMenuItems = (): ContextMenuItem[] => {
    if (!contextMenu) return [];
    const { item, mediaType } = contextMenu;
    const items: ContextMenuItem[] = [];

    // 1. Reproducir / Abrir
    if (mediaType === "video") {
      items.push({
        id: "play-video",
        label: "Reproducir vídeo",
        icon: "play",
        onSelect: () => handlePlayVideoWithFeedback(item.path),
      });
    } else if (mediaType === "music") {
      items.push({
        id: "play-music",
        label: "Reproducir canción",
        icon: "play",
        onSelect: () => handlePlayMusicWithFeedback(item.path),
      });
      if (onAddToQueue) {
        items.push({
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
      items.push({
        id: "open-image",
        label: "Abrir imagen",
        icon: "image",
        onSelect: () => onOpenImage?.(item.path, favoriteImageItems),
      });
    }

    // 2. Quitar de favoritos (Funciona siempre, incluso si el archivo se movió de disco)
    items.push({
      id: "toggle-fav",
      label: "Quitar de favoritos",
      icon: "heart",
      onSelect: () => {
        void toggle(mediaType, item.path);
        showToast("🤍 Eliminado de favoritos");
      },
    });

    // 3. Específico de imagen: Copiar al portapapeles
    if (mediaType === "image") {
      items.push({
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
    items.push({
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
      items.push({
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
      items.push(
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
      items.push(
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
    items.push({
      id: "copy-path",
      label: "Copiar ruta",
      icon: "copy",
      onSelect: () => {
        void navigator.clipboard.writeText(item.path).then(() => {
          showToast("📋 Ruta copiada al portapapeles");
        });
      },
    });

    return items;
  };

  if (fullViewType) {
    const items =
      fullViewType === "music"
        ? favoriteMusicItems
        : fullViewType === "image"
        ? favoriteImageItems
        : favoriteVideoItems;

    return (
      <FavoriteFullView
        items={items}
        mediaType={fullViewType}
        onAddToQueue={onAddToQueue}
        onBack={() => setFullViewType(null)}
        onOpenImage={(path) => onOpenImage?.(path, favoriteImageItems)}
        onPlayMusic={(path) => onPlayMusic(path, favoriteMusicItems, "Favoritos")}
        onPlayVideo={(path) => onPlayVideo(path, favoriteVideoItems)}
        onToggleFavorite={toggle}
      />
    );
  }

  return (
    <section className="collections-view favorites-timeline-view">
      <header className="collections-heading">
        <div className="section-heading">
          <span className="preview-kicker">COLECCIONES</span>
          <h1>Favoritos</h1>
          <p>
            Tus elementos preferidos de música, imágenes y vídeos reunidos en un lienzo cronológico.
          </p>
        </div>
      </header>

      {/* Barra de estadísticas superiores */}
      <div className="home-stat-row collections-stat-row">
        <button
          className={favoriteMusicItems.length > 0 ? "is-active" : ""}
          onClick={() => favoriteMusicItems.length > 0 && setFullViewType("music")}
        >
          <span>
            <Icon name="music" />
          </span>
          <strong>{favoriteMusicItems.length}</strong>
          <small>Canciones</small>
        </button>

        <button
          className={favoriteImageItems.length > 0 ? "is-active" : ""}
          onClick={() => favoriteImageItems.length > 0 && setFullViewType("image")}
        >
          <span>
            <Icon name="image" />
          </span>
          <strong>{favoriteImageItems.length}</strong>
          <small>Imágenes</small>
        </button>

        <button
          className={favoriteVideoItems.length > 0 ? "is-active" : ""}
          onClick={() => favoriteVideoItems.length > 0 && setFullViewType("video")}
        >
          <span>
            <Icon name="video" />
          </span>
          <strong>{favoriteVideoItems.length}</strong>
          <small>Vídeos</small>
        </button>
      </div>

      {totalFavorites === 0 ? (
        <div className="collections-empty-state">
          <div className="collections-empty-icon">
            <Icon name="heart" />
          </div>
          <h2>Sin favoritos todavía</h2>
          <p>
            Marca tus canciones, imágenes y vídeos favoritos pulsando el icono del corazón en la
            biblioteca o en el reproductor.
          </p>
        </div>
      ) : null}

      {/* Sección Música Favorita */}
      {favoriteMusicItems.length > 0 ? (
        <section className="home-media-shelf favorites-shelf">
          <header>
            <div>
              <span className="preview-kicker">MÚSICA</span>
              <h2>Música favorita</h2>
            </div>
            <button className="text-button" onClick={() => setFullViewType("music")}>
              Ver todo ({favoriteMusicItems.length})
            </button>
          </header>
          <div className="favorites-grid-shelf">
            {favoriteMusicItems.slice(0, FAVORITE_SHELF_LIMIT).map((item) => {
              const { title, artist } = resolveLibraryTrackInfo(item);
              return (
                <div className="favorites-media-card-wrapper" key={item.path}>
                  <button
                    className={`home-media-card ${activatingPath === item.path ? "is-activating" : ""}`}
                    onClick={() => handlePlayMusicWithFeedback(item.path)}
                    onContextMenu={(e) => handleCardContextMenu(e, item, "music")}
                    title={artist ? `${artist} — ${title}` : title}
                  >
                    <span className="home-media-frame">
                      <Icon name="music" />
                      <MusicArtwork
                        alt={`Carátula de ${title}`}
                        className="home-media-thumbnail"
                        path={item.path}
                      />
                      <i className="home-media-play-btn">
                        <Icon name="play" />
                      </i>
                    </span>
                    <strong>{title}</strong>
                    <small>{artist || "Pista local"}</small>
                  </button>

                  <button
                    className="favorites-card-fav-btn is-favorite"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggle("music", item.path);
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
        </section>
      ) : null}

      {/* Sección Imágenes Favoritas */}
      {favoriteImageItems.length > 0 ? (
        <section className="home-media-shelf favorites-shelf">
          <header>
            <div>
              <span className="preview-kicker">IMÁGENES</span>
              <h2>Imágenes favoritas</h2>
            </div>
            <button className="text-button" onClick={() => setFullViewType("image")}>
              Ver todo ({favoriteImageItems.length})
            </button>
          </header>
          <div className="favorites-grid-shelf">
            {favoriteImageItems.slice(0, FAVORITE_SHELF_LIMIT).map((item) => (
              <div className="favorites-media-card-wrapper" key={item.path}>
                <button
                  className="home-media-card"
                  onClick={() => (onOpenImage ? onOpenImage(item.path, favoriteImageItems) : undefined)}
                  onContextMenu={(e) => handleCardContextMenu(e, item, "image")}
                  title={item.title}
                >
                  <span className="home-media-frame">
                    <VisualThumbnail
                      alt={item.title}
                      className="home-media-thumbnail"
                      path={item.path}
                    />
                  </span>
                  <strong>{item.title}</strong>
                  <small>{cleanPath(item.relativeFolder)}</small>
                </button>

                <button
                  className="favorites-card-fav-btn is-favorite"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggle("image", item.path);
                    showToast("🤍 Eliminado de favoritos");
                  }}
                  title="Quitar de favoritos"
                >
                  <Icon name="heart" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Sección Vídeos Favoritos */}
      {favoriteVideoItems.length > 0 ? (
        <section className="home-media-shelf favorites-shelf">
          <header>
            <div>
              <span className="preview-kicker">VÍDEOS</span>
              <h2>Vídeos favoritos</h2>
            </div>
            <button className="text-button" onClick={() => setFullViewType("video")}>
              Ver todo ({favoriteVideoItems.length})
            </button>
          </header>
          <div className="favorites-grid-shelf is-video-shelf">
            {favoriteVideoItems.slice(0, FAVORITE_SHELF_LIMIT).map((item) => (
              <div className="favorites-media-card-wrapper is-video-wrapper" key={item.path}>
                <button
                  className={`home-media-card is-video-card ${activatingPath === item.path ? "is-activating" : ""}`}
                  onClick={() => handlePlayVideoWithFeedback(item.path)}
                  onContextMenu={(e) => handleCardContextMenu(e, item, "video")}
                  title={item.title}
                >
                  <span className="home-media-frame is-video-frame">
                    <VideoThumbnail
                      className="home-media-thumbnail"
                      eager
                      path={item.path}
                      title={item.title}
                    />
                    <i className="home-media-play-btn">
                      <Icon name="play" />
                    </i>
                  </span>
                  <strong>{item.title}</strong>
                  <small>{cleanPath(item.relativeFolder)}</small>
                </button>

                <button
                  className="favorites-card-fav-btn is-favorite"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggle("video", item.path);
                    showToast("🤍 Eliminado de favoritos");
                  }}
                  title="Quitar de favoritos"
                >
                  <Icon name="heart" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
    </section>
  );
}
