import type React from "react";
import type { HierarchicalFolder } from "../../../shared/mediaTree";
import type { MusicLibraryItem } from "../model/types";
import { MusicArtwork } from "./MusicArtwork";
import { Icon } from "../../../shared/ui/Icon";

export interface MusicFolderCardProps {
  folder: HierarchicalFolder<MusicLibraryItem>;
  isActivating?: boolean;
  onContextMenu?: (event: React.MouseEvent) => void;
  onOpen: () => void;
  onPlay: () => void;
}

export function MusicFolderCard({
  folder,
  isActivating,
  onContextMenu,
  onOpen,
  onPlay,
}: MusicFolderCardProps) {
  const isFavorites = folder.isVirtual && folder.virtualType === "favorites";
  const isAll = folder.isVirtual && folder.virtualType === "all";
  const firstCoverItem = folder.allRecursiveItems[0];

  return (
    <div
      className={`music-folder-card ${isActivating ? "is-activating" : ""} ${
        isFavorites ? "is-virtual-favorites" : ""
      } ${isAll ? "is-virtual-all" : ""}`}
      onClick={onOpen}
      onContextMenu={onContextMenu}
      title={`Carpeta ${folder.displayName}`}
    >
      <div className="music-folder-cover-frame">
        {isFavorites ? (
          <div className="music-virtual-card-art is-favorites">
            <Icon name="star" />
          </div>
        ) : isAll ? (
          <div className="music-virtual-card-art is-all">
            <Icon name="disc" />
          </div>
        ) : firstCoverItem ? (
          <MusicArtwork
            alt={folder.displayName}
            className="music-folder-cover-img"
            path={firstCoverItem.path}
          />
        ) : (
          <span className="music-folder-empty-cover">
            <Icon name="folder" />
          </span>
        )}

        <div className="music-folder-hover-overlay">
          {folder.allRecursiveItems.length > 0 ? (
            <button
              className="music-folder-play-btn"
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              title="Reproducir álbum"
            >
              <Icon name="play" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="music-folder-info">
        <strong className="music-folder-title">
          {isFavorites ? "⭐ Favoritos" : folder.displayName}
        </strong>
        <span className="music-folder-count">
          {folder.allRecursiveItems.length}{" "}
          {folder.allRecursiveItems.length === 1 ? "canción" : "canciones"}
        </span>
      </div>
    </div>
  );
}
