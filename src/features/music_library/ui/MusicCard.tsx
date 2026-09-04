import type React from "react";
import type { MusicLibraryItem } from "../model/types";
import { resolveLibraryTrackInfo } from "../model/trackInfo";
import { MusicArtwork } from "./MusicArtwork";
import { Icon } from "../../../shared/ui/Icon";

export interface MusicCardProps {
  item: MusicLibraryItem;
  isFavorite: boolean;
  isPlaying?: boolean;
  isActivating?: boolean;
  onClick: () => void;
  onAddToQueue?: () => void;
  onToggleFavorite?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  onDeleteRequest?: () => void;
}

export function MusicCard({
  item,
  isFavorite,
  isPlaying,
  isActivating,
  onClick,
  onAddToQueue,
  onToggleFavorite,
  onContextMenu,
  onDeleteRequest,
}: MusicCardProps) {
  const { title, artist } = resolveLibraryTrackInfo(item);

  return (
    <div className="music-media-card-wrapper">
      <button
        className={`music-media-card ${isActivating ? "is-activating" : ""}`}
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

          <i className="music-play-badge">
            <Icon name="play" />
          </i>
        </span>
        <strong className="music-card-title">{title}</strong>
        <small className="music-card-artist">{artist || "Pista local"}</small>
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
