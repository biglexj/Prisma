import { useState, useMemo } from "react";
import { Icon } from "../../../shared/ui/Icon";
import type { MusicLibraryItem } from "../../music_library/model/types";
import { MusicArtwork } from "../../music_library/ui/MusicArtwork";
import { parseTrackInfo } from "../../music_library/model/trackInfo";
import type { VisualLibraryItem } from "../../visual_library/model/types";
import { VisualThumbnail } from "../../visual_library/ui/VisualThumbnail";
import { VideoThumbnail } from "../../visual_library/ui/VideoThumbnail";
import { cleanPath } from "../../../shared/mediaTree";
import { useHistory } from "../../../shared/useHistory";
import { FavoriteFullView } from "./FavoriteFullView";
import type { FavoriteMediaType } from "../model/types";
import { useScrollRestoration } from "../../../shared/useScrollRestoration";
import "./collections.css";

const HISTORY_SHELF_LIMIT = 16; // Máximo 2 filas de 8 ítems (o 2 filas en videos)

interface HistoryViewProps {
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
  const relativeFolder = segments.length > 1 ? segments[segments.length - 2] : "Historial";
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
  const relativeFolder = segments.length > 1 ? segments[segments.length - 2] : "Historial";
  return {
    path,
    title,
    sourcePath: path,
    relativeFolder,
    sizeBytes: 0,
    modifiedAtMillis: Date.now(),
  };
}

export function HistoryView({
  musicItems,
  images,
  videos,
  onPlayMusic,
  onOpenImage,
  onPlayVideo,
}: HistoryViewProps) {
  const { store, clearHistory } = useHistory();
  const [fullViewType, setFullViewType] = useState<FavoriteMediaType | null>(null);

  useScrollRestoration(`view:history:${fullViewType ?? "summary"}`);

  // Mapear rutas de historial con los objetos reales de la biblioteca o sintetizar respaldo
  const historyMusicItems = useMemo(() => {
    const musicMap = new Map(musicItems.map((it) => [normalizePath(it.path), it]));
    return store.music.map((item) => musicMap.get(normalizePath(item.path)) || synthesizeMusicItem(item.path));
  }, [store.music, musicItems]);

  const historyImageItems = useMemo(() => {
    const imgMap = new Map(images.map((it) => [normalizePath(it.path), it]));
    return store.images.map((item) => imgMap.get(normalizePath(item.path)) || synthesizeVisualItem(item.path));
  }, [store.images, images]);

  const historyVideoItems = useMemo(() => {
    const vidMap = new Map(videos.map((it) => [normalizePath(it.path), it]));
    return store.videos.map((item) => vidMap.get(normalizePath(item.path)) || synthesizeVisualItem(item.path));
  }, [store.videos, videos]);

  const totalHistory =
    historyMusicItems.length + historyImageItems.length + historyVideoItems.length;

  if (fullViewType) {
    const items =
      fullViewType === "music"
        ? historyMusicItems
        : fullViewType === "image"
        ? historyImageItems
        : historyVideoItems;

    return (
      <FavoriteFullView
        items={items}
        mediaType={fullViewType}
        onBack={() => setFullViewType(null)}
        onOpenImage={onOpenImage}
        onPlayMusic={onPlayMusic}
        onPlayVideo={(path) => onPlayVideo(path, historyVideoItems)}
        onToggleFavorite={() => {}}
      />
    );
  }

  return (
    <section className="collections-view favorites-timeline-view">
      <header className="collections-heading">
        <div className="section-heading">
          <span className="preview-kicker">REPRODUCCIÓN RECIENTE</span>
          <h1>Historial</h1>
          <p>
            Tus elementos de música, imágenes y vídeos reproducidos o vistos recientemente.
          </p>
        </div>
        {totalHistory > 0 ? (
          <button
            className="text-button"
            onClick={() => clearHistory()}
            style={{ color: "var(--outline)" }}
            title="Borrar todo el historial"
          >
            Limpiar historial
          </button>
        ) : null}
      </header>

      {/* Barra de estadísticas superiores */}
      <div className="home-stat-row collections-stat-row">
        <button
          className={historyMusicItems.length > 0 ? "is-active" : ""}
          onClick={() => historyMusicItems.length > 0 && setFullViewType("music")}
        >
          <span>
            <Icon name="music" />
          </span>
          <strong>{historyMusicItems.length}</strong>
          <small>Canciones</small>
        </button>

        <button
          className={historyImageItems.length > 0 ? "is-active" : ""}
          onClick={() => historyImageItems.length > 0 && setFullViewType("image")}
        >
          <span>
            <Icon name="image" />
          </span>
          <strong>{historyImageItems.length}</strong>
          <small>Imágenes</small>
        </button>

        <button
          className={historyVideoItems.length > 0 ? "is-active" : ""}
          onClick={() => historyVideoItems.length > 0 && setFullViewType("video")}
        >
          <span>
            <Icon name="video" />
          </span>
          <strong>{historyVideoItems.length}</strong>
          <small>Vídeos</small>
        </button>
      </div>

      {totalHistory === 0 ? (
        <div className="collections-empty-state">
          <div className="collections-empty-icon">
            <Icon name="folder" />
          </div>
          <h2>Sin historial todavía</h2>
          <p>
            Los archivos multimedia de música, imágenes y vídeos que abras o reproduzcas aparecerán aquí organizados por tipo.
          </p>
        </div>
      ) : null}

      {/* Sección Vídeos Recientes (Prioridad visual destacada con tamaño adaptativo) */}
      {historyVideoItems.length > 0 ? (
        <section className="home-media-shelf favorites-shelf">
          <header>
            <div>
              <span className="preview-kicker">VÍDEOS</span>
              <h2>Vídeos recientes</h2>
            </div>
            {historyVideoItems.length > HISTORY_SHELF_LIMIT ? (
              <button className="text-button" onClick={() => setFullViewType("video")}>
                Ver todo ({historyVideoItems.length})
              </button>
            ) : null}
          </header>
          <div className="favorites-grid-shelf is-video-shelf">
            {historyVideoItems.slice(0, HISTORY_SHELF_LIMIT).map((item) => (
              <button
                className="home-media-card is-video-card"
                key={item.path}
                onClick={() => onPlayVideo(item.path, historyVideoItems)}
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

      {/* Sección Música Reciente */}
      {historyMusicItems.length > 0 ? (
        <section className="home-media-shelf favorites-shelf">
          <header>
            <div>
              <span className="preview-kicker">MÚSICA</span>
              <h2>Música reciente</h2>
            </div>
            {historyMusicItems.length > HISTORY_SHELF_LIMIT ? (
              <button className="text-button" onClick={() => setFullViewType("music")}>
                Ver todo ({historyMusicItems.length})
              </button>
            ) : null}
          </header>
          <div className="favorites-grid-shelf">
            {historyMusicItems.slice(0, HISTORY_SHELF_LIMIT).map((item) => {
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

      {/* Sección Imágenes Recientes */}
      {historyImageItems.length > 0 ? (
        <section className="home-media-shelf favorites-shelf">
          <header>
            <div>
              <span className="preview-kicker">IMÁGENES</span>
              <h2>Imágenes recientes</h2>
            </div>
            {historyImageItems.length > HISTORY_SHELF_LIMIT ? (
              <button className="text-button" onClick={() => setFullViewType("image")}>
                Ver todo ({historyImageItems.length})
              </button>
            ) : null}
          </header>
          <div className="favorites-grid-shelf">
            {historyImageItems.slice(0, HISTORY_SHELF_LIMIT).map((item) => (
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
    </section>
  );
}
