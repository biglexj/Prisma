import { useState, useMemo } from "react";
import { Icon } from "../../../shared/ui/Icon";
import type { MusicLibraryItem } from "../../music_library/model/types";
import { MusicArtwork } from "../../music_library/ui/MusicArtwork";
import { parseTrackInfo } from "../../music_library/model/trackInfo";
import type { VisualLibraryItem } from "../../visual_library/model/types";
import { VisualThumbnail } from "../../visual_library/ui/VisualThumbnail";
import { VideoThumbnail } from "../../visual_library/ui/VideoThumbnail";
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
  onPlayMusic: (path: string) => void;
  onOpenImage?: (path: string) => void;
  onPlayVideo: (path: string, sessionItems?: VisualLibraryItem[]) => void;
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

export function FavoritesView({
  musicItems,
  images,
  videos,
  onPlayMusic,
  onOpenImage,
  onPlayVideo,
}: FavoritesViewProps) {
  const { store, toggle } = useFavorites();
  const [fullViewType, setFullViewType] = useState<FavoriteMediaType | null>(null);

  useScrollRestoration(`view:favorites:${fullViewType ?? "summary"}`);

  // Mapear rutas de favoritos con los objetos reales de la biblioteca o sintetizar respaldo
  const favoriteMusicItems = useMemo(() => {
    const musicMap = new Map(musicItems.map((it) => [normalizePath(it.path), it]));
    return store.music.map((path) => musicMap.get(normalizePath(path)) || synthesizeMusicItem(path));
  }, [store.music, musicItems]);

  const favoriteImageItems = useMemo(() => {
    const imgMap = new Map(images.map((it) => [normalizePath(it.path), it]));
    return store.images.map((path) => imgMap.get(normalizePath(path)) || synthesizeVisualItem(path));
  }, [store.images, images]);

  const favoriteVideoItems = useMemo(() => {
    const vidMap = new Map(videos.map((it) => [normalizePath(it.path), it]));
    return store.videos.map((path) => vidMap.get(normalizePath(path)) || synthesizeVisualItem(path));
  }, [store.videos, videos]);

  const totalFavorites =
    favoriteMusicItems.length + favoriteImageItems.length + favoriteVideoItems.length;

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
        onBack={() => setFullViewType(null)}
        onOpenImage={onOpenImage}
        onPlayMusic={onPlayMusic}
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
              const { title, artist } = parseTrackInfo(item.title);
              return (
                <button
                  className="home-media-card"
                  key={item.path}
                  onClick={() => onPlayMusic(item.path)}
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
              <button
                className="home-media-card"
                key={item.path}
                onClick={() => (onOpenImage ? onOpenImage(item.path) : undefined)}
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
              <button
                className="home-media-card is-video-card"
                key={item.path}
                onClick={() => onPlayVideo(item.path, favoriteVideoItems)}
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
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
