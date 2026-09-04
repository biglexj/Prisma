import type React from "react";
import type { MusicLibraryItem } from "../model/types";
import { resolveLibraryTrackInfo } from "../model/trackInfo";
import { MusicArtwork } from "./MusicArtwork";
import { Icon } from "../../../shared/ui/Icon";

export interface MusicAlbumCardProps {
  item: MusicLibraryItem;
  albumName: string;
  artistName?: string;
  songCount: number;
  isFavorite: boolean;
  isPlaying?: boolean;
  isActivating?: boolean;
  onOpenAlbum: () => void;
  onPlayAlbum: () => void;
  onAddToQueue?: () => void;
  onToggleFavorite?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  onDeleteRequest?: () => void;
}

export function MusicAlbumCard({
  item,
  albumName,
  artistName,
  songCount,
  isFavorite,
  isPlaying,
  isActivating,
  onOpenAlbum,
  onPlayAlbum,
  onAddToQueue,
  onToggleFavorite,
  onContextMenu,
  onDeleteRequest,
}: MusicAlbumCardProps) {
  const parsed = resolveLibraryTrackInfo(item);
  const displayArtist = artistName || item.artist || parsed.artist;

  return (
    <div className="music-media-card-wrapper">
      <button
        className={`music-media-card ${isActivating ? "is-activating" : ""}`}
        onClick={onOpenAlbum}
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
        title={
          displayArtist
            ? `${displayArtist} — ${albumName} (${songCount} ${songCount === 1 ? "canción" : "canciones"})`
            : `${albumName} (${songCount} ${songCount === 1 ? "canción" : "canciones"})`
        }
      >
        <span className={`music-media-frame ${isPlaying ? "is-now-playing" : ""}`}>
          <MusicArtwork alt={albumName} className="music-card-artwork" path={item.path} />

          {isPlaying ? (
            <span className="music-card-playing-indicator" title="Reproduciendo ahora">
              <i /><i /><i />
            </span>
          ) : null}

          <i
            className="music-play-badge"
            onClick={(e) => {
              e.stopPropagation();
              onPlayAlbum();
            }}
            role="button"
            tabIndex={0}
            title="Reproducir álbum directamente"
          >
            <Icon name="play" />
          </i>
        </span>
        <strong className="music-card-title">{albumName}</strong>
        <small className="music-card-artist">
          {displayArtist ? `${displayArtist} • ` : ""}
          {songCount} {songCount === 1 ? "canción" : "canciones"}
        </small>
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
            title="Añadir álbum a la cola"
          >
            <Icon name="queue" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
