import { useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import type { MusicLibraryItem } from "../../music_library/model/types";
import { MusicArtwork } from "../../music_library/ui/MusicArtwork";
import { parseTrackInfo } from "../../music_library/model/trackInfo";
import type { VisualLibraryItem } from "../../visual_library/model/types";
import { VisualThumbnail } from "../../visual_library/ui/VisualThumbnail";
import { VideoThumbnail } from "../../visual_library/ui/VideoThumbnail";
import { cleanPath } from "../../../shared/mediaTree";
import type { FavoriteMediaType } from "../model/types";

interface FavoriteFullViewProps {
  mediaType: FavoriteMediaType;
  items: Array<MusicLibraryItem | VisualLibraryItem>;
  onBack: () => void;
  onPlayMusic?: (path: string) => void;
  onOpenImage?: (path: string) => void;
  onPlayVideo?: (path: string) => void;
  onToggleFavorite: (mediaType: FavoriteMediaType, path: string) => void;
}

export function FavoriteFullView({
  mediaType,
  items,
  onBack,
  onPlayMusic,
  onOpenImage,
  onPlayVideo,
  onToggleFavorite,
}: FavoriteFullViewProps) {
  const [filter, setFilter] = useState("");

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
              const { title: songTitle, artist } = parseTrackInfo(musicItem.title);
              return (
                <div className="favorite-full-card is-music" key={musicItem.path}>
                  <div
                    className="favorite-card-media"
                    onClick={() => onPlayMusic && onPlayMusic(musicItem.path)}
                  >
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
                <div className="favorite-full-card is-image" key={visualItem.path}>
                  <div
                    className="favorite-card-media"
                    onClick={() => onOpenImage && onOpenImage(visualItem.path)}
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
              <div className="favorite-full-card is-video" key={visualItem.path}>
                <div
                  className="favorite-card-media"
                  onClick={() => onPlayVideo && onPlayVideo(visualItem.path)}
                >
                  <VideoThumbnail path={visualItem.path} title={visualItem.title} />
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
    </div>
  );
}
