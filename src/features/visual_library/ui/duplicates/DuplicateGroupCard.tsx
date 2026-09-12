import React from "react";
import { Icon } from "../../../../shared/ui/Icon";
import { toSafeAssetUrl } from "../../../../shared/mediaTree";
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
  toggleGroupSelection: (group: DuplicateGroup) => void;
  toggleSelectPath: (path: string) => void;
  handleReplaceBase: (originalPath: string, upgradedPath: string) => void;
  handleOpenComparison: (original: VisualLibraryItem, duplicate: VisualLibraryItem) => void;
  toVisualLibraryItem: (candidate: DuplicateCandidate) => VisualLibraryItem;
  formatBytes: (bytes: number) => string;
}

export const DuplicateGroupCard: React.FC<DuplicateGroupCardProps> = ({
  group,
  activeKind,
  selectedPaths,
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
        <div className="duplicate-card is-original">
          <div className="duplicate-card-tag is-original-tag">
            <Icon name="star" />
            <span>{group.original.isFromBaseFolder ? "Original (Carpeta Base)" : "Original / Referencia"}</span>
          </div>
          <div className="duplicate-card-thumb">
            {activeKind === "music" ? (
              <div className="music-thumb-placeholder" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", width: "100%", background: "var(--surface-container-high, rgba(255,255,255,0.05))" }}>
                <Icon name="music" />
              </div>
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

        {/* Lista de Duplicados */}
        {group.duplicates.map((dup) => {
          const isSelected = selectedPaths.has(dup.path);
          return (
            <div
              key={dup.path}
              className={`duplicate-card is-duplicate ${isSelected ? "is-selected" : ""} ${
                dup.hasHigherResolution ? "has-resolution-upgrade" : ""
              }`}
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
                  <div className="music-thumb-placeholder" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", width: "100%", background: "var(--surface-container-high, rgba(255,255,255,0.05))" }}>
                    <Icon name="music" />
                  </div>
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

                  {activeKind === "image" && (
                    <button
                      type="button"
                      className="duplicate-btn-action"
                      onClick={() =>
                        handleOpenComparison(
                          toVisualLibraryItem(group.original),
                          toVisualLibraryItem(dup)
                        )
                      }
                      title="Comparar frente a frente en visor interactivo"
                    >
                      <Icon name="split" />
                      <span>Comparar</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
