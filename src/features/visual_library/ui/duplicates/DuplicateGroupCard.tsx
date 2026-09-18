import React from "react";
import { Icon } from "../../../../shared/ui/Icon";
import { toSafeAssetUrl } from "../../../../shared/mediaTree";
import { VideoThumbnail } from "../VideoThumbnail";
import { useMusicArtwork } from "../../../music_library/useMusicArtwork";
import type {
  DuplicateGroup,
  DuplicateCandidate,
  VisualLibraryItem,
} from "../../model/types";

export type DuplicateScanKind = "image" | "video" | "music";

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  activeKind: DuplicateScanKind;
  selectedPaths: Set<string>;
  previewPath?: string | null;
  isPreviewPlaying?: boolean;
  onTogglePreview?: (path: string) => void;
  toggleGroupSelection: (group: DuplicateGroup) => void;
  toggleSelectPath: (path: string) => void;
  handleReplaceBase: (originalPath: string, upgradedPath: string) => void;
  handleOpenComparison: (original: VisualLibraryItem, duplicate: VisualLibraryItem) => void;
  toVisualLibraryItem: (candidate: DuplicateCandidate) => VisualLibraryItem;
  formatBytes: (bytes: number) => string;
}

interface DuplicateMusicThumbProps {
  path: string;
  isPlaying: boolean;
  onToggle: () => void;
}

const DuplicateMusicThumb: React.FC<DuplicateMusicThumbProps> = ({ path, isPlaying, onToggle }) => {
  const artwork = useMusicArtwork(path);
  return (
    <div
      className={`duplicate-music-thumb ${isPlaying ? "is-playing" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {artwork ? (
        <img src={artwork} alt="Portada" className="duplicate-music-cover" />
      ) : (
        <div className="duplicate-music-placeholder">
          <Icon name="music" />
        </div>
      )}
      <button
        type="button"
        className={`duplicate-preview-play-btn ${isPlaying ? "is-playing" : ""}`}
        title={isPlaying ? "Pausar audio" : "Escuchar audio"}
      >
        <Icon name={isPlaying ? "pause" : "play"} />
      </button>
    </div>
  );
};

interface DuplicateVideoThumbProps {
  path: string;
  title: string;
  isPlaying: boolean;
  onToggle: () => void;
}

const DuplicateVideoThumb: React.FC<DuplicateVideoThumbProps> = ({ path, title, isPlaying, onToggle }) => {
  if (isPlaying) {
    return (
      <div className="duplicate-video-player-box" onClick={(e) => e.stopPropagation()}>
        <video
          src={toSafeAssetUrl(path)}
          controls
          autoPlay
          className="duplicate-inline-video"
          onEnded={onToggle}
        />
        <button
          type="button"
          className="duplicate-video-close-btn"
          onClick={onToggle}
          title="Cerrar reproductor"
        >
          <Icon name="close" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="duplicate-video-thumb-box"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <VideoThumbnail path={path} title={title} fit="cover" />
      <button
        type="button"
        className="duplicate-preview-play-btn"
        title="Previsualizar vídeo"
      >
        <Icon name="play" />
      </button>
    </div>
  );
};

export const DuplicateGroupCard: React.FC<DuplicateGroupCardProps> = ({
  group,
  activeKind,
  selectedPaths,
  previewPath,
  isPreviewPlaying,
  onTogglePreview,
  toggleGroupSelection,
  toggleSelectPath,
  handleReplaceBase,
  handleOpenComparison,
  toVisualLibraryItem,
  formatBytes,
}) => {
  const dupPaths = group.duplicates.map((d) => d.path);
  const selectedInGroupCount = dupPaths.filter((p) => selectedPaths.has(p)).length;
  const allSelectedInGroup = dupPaths.length > 0 && selectedInGroupCount === dupPaths.length;
  const someSelectedInGroup = selectedInGroupCount > 0 && !allSelectedInGroup;

  return (
    <div className="duplicates-group-card">
      <div className="duplicates-group-header">
        <div className="duplicates-group-badge">
          <span className={`match-tag is-${group.matchType}`}>
            {group.matchType === "exact"
              ? "Idéntico (100%)"
              : activeKind === "music"
              ? "Similitud acústica / tags"
              : "Similitud visual"}
          </span>
          <span className="duplicates-group-title">Grupo #{group.groupId}</span>
          {group.hasResolutionUpgrade && (
            <span
              className="resolution-upgrade-pill"
              title={
                activeKind === "music"
                  ? "Este grupo incluye una pista con mayor calidad o bitrate que la base"
                  : "Este grupo incluye una versión con mayor resolución que la base"
              }
            >
              <Icon name="sparkles" />
              <span>{activeKind === "music" ? "Mejora de Fidelidad (Hi-Res)" : "Mejora de Resolución Disponible"}</span>
            </span>
          )}
        </div>
        <div className="duplicates-group-actions">
          <button
            type="button"
            className={`duplicates-group-select-btn ${
              allSelectedInGroup ? "is-all-selected" : someSelectedInGroup ? "is-partial-selected" : ""
            }`}
            onClick={() => toggleGroupSelection(group)}
            title={allSelectedInGroup ? "Deseleccionar grupo" : "Seleccionar todos los duplicados de este grupo"}
          >
            <input
              type="checkbox"
              checked={allSelectedInGroup}
              ref={(el) => {
                if (el) el.indeterminate = someSelectedInGroup;
              }}
              readOnly
              className="duplicates-group-select-checkbox"
            />
            <span>
              {allSelectedInGroup
                ? "Grupo seleccionado"
                : someSelectedInGroup
                ? `Seleccionados ${selectedInGroupCount}/${dupPaths.length}`
                : "Seleccionar grupo"}
            </span>
          </button>

          <span className="duplicates-group-count">
            {group.duplicates.length + 1} archivos en este grupo
          </span>
        </div>
      </div>

      <div className="duplicates-items-grid">
        {/* Item Original / Referencia */}
        {(() => {
          const isOriginalVideoPlaying =
            activeKind === "video" && Boolean(previewPath === group.original.path && isPreviewPlaying);
          return (
            <div className={`duplicate-card is-original ${isOriginalVideoPlaying ? "is-video-playing" : ""}`}>
              <div className="duplicate-card-tag is-original-tag">
                <Icon name="star" />
                <span>{group.original.isFromBaseFolder ? "Original (Carpeta Base)" : "Original / Referencia"}</span>
              </div>
              <div className="duplicate-card-thumb">
                {activeKind === "music" ? (
                  <DuplicateMusicThumb
                    path={group.original.path}
                    isPlaying={Boolean(previewPath === group.original.path && isPreviewPlaying)}
                    onToggle={() => onTogglePreview?.(group.original.path)}
                  />
                ) : activeKind === "video" ? (
                  <DuplicateVideoThumb
                    path={group.original.path}
                    title={group.original.title}
                    isPlaying={isOriginalVideoPlaying}
                    onToggle={() => onTogglePreview?.(group.original.path)}
                  />
                ) : (
                  <img
                    src={toSafeAssetUrl(group.original.path)}
                    alt={group.original.title}
                    loading="lazy"
                    draggable={false}
                  />
                )}
              </div>
              <div className="duplicate-card-meta">
                <span className="duplicate-name" title={group.original.path}>
                  {group.original.title}
                </span>
                <div className="duplicate-details">
                  {group.original.width && group.original.height && (
                    <span className="dim-badge">
                      {group.original.width} × {group.original.height} px
                    </span>
                  )}
                  <span className="size-badge">{formatBytes(group.original.sizeBytes)}</span>
                </div>
                <span className="duplicate-folder-name" title={group.original.path}>
                  {group.original.relativeFolder || group.original.path}
                </span>
              </div>
            </div>
          );
        })()}

        {/* Lista de Duplicados */}
        {group.duplicates.map((dup) => {
          const isSelected = selectedPaths.has(dup.path);
          const isDupVideoPlaying =
            activeKind === "video" && Boolean(previewPath === dup.path && isPreviewPlaying);
          return (
            <div
              key={dup.path}
              className={`duplicate-card is-duplicate ${isSelected ? "is-selected" : ""} ${
                dup.hasHigherResolution ? "has-resolution-upgrade" : ""
              } ${isDupVideoPlaying ? "is-video-playing" : ""}`}
              onClick={() => toggleSelectPath(dup.path)}
            >
              <div className="duplicate-card-tag is-dup-tag">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="duplicate-checkbox"
                />
                <span>
                  {dup.isExactMatch
                    ? "Copia exacta (100%)"
                    : `${dup.similarityPct.toFixed(1)}% similar`}
                </span>
              </div>

              {dup.hasHigherResolution && (
                <div
                  className="duplicate-res-badge"
                  title={
                    activeKind === "music"
                      ? "Este archivo tiene mayor fidelidad/bitrate que la versión base"
                      : "Este archivo tiene mayor resolución que la versión base"
                  }
                >
                  <Icon name="sparkles" />
                  <span>{activeKind === "music" ? "Mayor Fidelidad (Hi-Res)" : "Mayor resolución HD/4K"}</span>
                </div>
              )}

              <div className="duplicate-card-thumb">
                {activeKind === "music" ? (
                  <DuplicateMusicThumb
                    path={dup.path}
                    isPlaying={Boolean(previewPath === dup.path && isPreviewPlaying)}
                    onToggle={() => onTogglePreview?.(dup.path)}
                  />
                ) : activeKind === "video" ? (
                  <DuplicateVideoThumb
                    path={dup.path}
                    title={dup.title}
                    isPlaying={Boolean(previewPath === dup.path && isPreviewPlaying)}
                    onToggle={() => onTogglePreview?.(dup.path)}
                  />
                ) : (
                  <img
                    src={toSafeAssetUrl(dup.path)}
                    alt={dup.title}
                    loading="lazy"
                    draggable={false}
                  />
                )}
              </div>
              <div className="duplicate-card-meta">
                <span className="duplicate-name" title={dup.path}>
                  {dup.title}
                </span>
                <div className="duplicate-details">
                  {dup.width && dup.height && (
                    <span className={`dim-badge ${dup.hasHigherResolution ? "is-higher-res" : ""}`}>
                      {dup.width} × {dup.height} px
                    </span>
                  )}
                  <span className="size-badge">{formatBytes(dup.sizeBytes)}</span>
                </div>
                <span className="duplicate-folder-name" title={dup.path}>
                  {dup.relativeFolder || dup.path}
                </span>

                {/* Acciones individuales */}
                <div className="duplicate-actions" onClick={(e) => e.stopPropagation()}>
                  {dup.hasHigherResolution && (
                    <button
                      type="button"
                      className="duplicate-btn-upgrade"
                      onClick={() => handleReplaceBase(group.original.path, dup.path)}
                      title={
                        activeKind === "music"
                          ? "Reemplazar la versión base con esta versión de mayor fidelidad de audio"
                          : "Reemplazar la versión base con esta versión de mayor resolución"
                      }
                    >
                      <Icon name="sparkles" />
                      <span>Reemplazar base</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="duplicate-btn-action"
                    onClick={() =>
                      handleOpenComparison(
                        toVisualLibraryItem(group.original),
                        toVisualLibraryItem(dup)
                      )
                    }
                    title={
                      activeKind === "music"
                        ? "Comparar audios frente a frente en reproductor interactivo"
                        : "Comparar frente a frente en visor interactivo"
                    }
                  >
                    <Icon name="split" />
                    <span>Comparar</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
