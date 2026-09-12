import { useState, useMemo } from "react";
import { Icon } from "../../../../shared/ui/Icon";
import { toSafeAssetUrl } from "../../../../shared/mediaTree";
import { deleteMediaItems } from "../../../../shared/mediaOperations";
import { visualLibraryClient } from "../../tauri/client";
import type {
  DuplicateGroup,
  DuplicateCandidate,
  VisualLibraryItem,
  VisualMediaKind,
} from "../../model/types";
import "./duplicates-scanner.css";

interface DuplicatesScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  kind: VisualMediaKind;
  onOpenComparison?: (original: VisualLibraryItem, duplicate: VisualLibraryItem) => void;
  onRefreshLibrary?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function DuplicatesScannerModal({
  isOpen,
  onClose,
  kind,
  onOpenComparison,
  onRefreshLibrary,
}: DuplicatesScannerModalProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [checkVisualSimilarity, setCheckVisualSimilarity] = useState(true);
  const [minSimilarityPct, setMinSimilarityPct] = useState(90);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartScan = async () => {
    setIsScanning(true);
    setStatusMessage("Escaneando archivos y calculando firmas de similitud...");
    setSelectedPaths(new Set());
    try {
      const results = await visualLibraryClient.scanDuplicates(kind, {
        paths: [],
        minSimilarityPct,
        checkVisualSimilarity,
      });
      setGroups(results);
      setHasScanned(true);

      // Auto-seleccionar todos los duplicados por defecto para conveniencia del usuario
      const autoSelected = new Set<string>();
      for (const g of results) {
        for (const d of g.duplicates) {
          autoSelected.add(d.path);
        }
      }
      setSelectedPaths(autoSelected);
      setStatusMessage(null);
    } catch (err) {
      setStatusMessage(`Error en escaneo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSelectPath = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const all = new Set<string>();
    for (const g of groups) {
      for (const d of g.duplicates) {
        all.add(d.path);
      }
    }
    setSelectedPaths(all);
  };

  const handleDeselectAll = () => {
    setSelectedPaths(new Set());
  };

  const totalDuplicatesCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.duplicates.length, 0);
  }, [groups]);

  const recoverableBytes = useMemo(() => {
    let sum = 0;
    for (const g of groups) {
      for (const d of g.duplicates) {
        if (selectedPaths.has(d.path)) {
          sum += d.sizeBytes;
        }
      }
    }
    return sum;
  }, [groups, selectedPaths]);

  const handleDeleteSelected = async () => {
    if (selectedPaths.size === 0) return;
    const pathsToDelete = Array.from(selectedPaths);
    const confirmed = window.confirm(
      `¿Mover ${pathsToDelete.length} archivo(s) duplicado(s) a la Papelera de reciclaje?`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const res = await deleteMediaItems(pathsToDelete);
      if (res.deleted > 0) {
        // Remover de la lista local
        setGroups((prevGroups) =>
          prevGroups
            .map((g) => ({
              ...g,
              duplicates: g.duplicates.filter((d) => !selectedPaths.has(d.path)),
            }))
            .filter((g) => g.duplicates.length > 0)
        );
        setSelectedPaths(new Set());
        onRefreshLibrary?.();
      }
    } catch (err) {
      alert(`Error al eliminar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const toVisualLibraryItem = (cand: DuplicateCandidate): VisualLibraryItem => ({
    path: cand.path,
    title: cand.title,
    sourcePath: cand.path,
    relativeFolder: cand.relativeFolder,
    kind,
    modifiedAtMillis: cand.modifiedAtMillis,
    sizeBytes: cand.sizeBytes,
  });

  return (
    <div className="duplicates-modal-backdrop" onClick={onClose}>
      <div
        className="duplicates-modal-card"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Header */}
        <header className="duplicates-modal-header">
          <div className="duplicates-header-info">
            <span className="duplicates-header-icon">
              <Icon name="layers" />
            </span>
            <div>
              <h2 className="duplicates-header-title">Buscador de Duplicados (dupeGuru Engine)</h2>
              <p className="duplicates-header-subtitle">
                Detección exacta por hash y similitud perceptual visual ({kind === "image" ? "Imágenes" : "Vídeos"})
              </p>
            </div>
          </div>
          <button
            type="button"
            className="duplicates-btn-close"
            onClick={onClose}
            title="Cerrar (Esc)"
          >
            <Icon name="close" />
          </button>
        </header>

        {/* Toolbar de configuración del escáner */}
        <div className="duplicates-toolbar">
          <div className="duplicates-toolbar-modes">
            <button
              type="button"
              className={`duplicates-mode-chip ${!checkVisualSimilarity ? "is-active" : ""}`}
              onClick={() => setCheckVisualSimilarity(false)}
            >
              <Icon name="check" />
              <span>Exacto (100% Hash)</span>
            </button>
            <button
              type="button"
              className={`duplicates-mode-chip ${checkVisualSimilarity ? "is-active" : ""}`}
              onClick={() => setCheckVisualSimilarity(true)}
            >
              <Icon name="image" />
              <span>Similitud Perceptual (dHash)</span>
            </button>
          </div>

          {checkVisualSimilarity && (
            <div className="duplicates-slider-box" title="Umbral mínimo de similitud visual">
              <span className="duplicates-slider-label">Tolerancia:</span>
              <input
                type="range"
                min="75"
                max="100"
                step="1"
                value={minSimilarityPct}
                onChange={(e) => setMinSimilarityPct(Number(e.target.value))}
                className="duplicates-slider"
              />
              <span className="duplicates-slider-val">{minSimilarityPct}%</span>
            </div>
          )}

          <button
            type="button"
            className="duplicates-btn-scan"
            onClick={handleStartScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <Icon name="refresh" className="spin" />
                <span>Analizando...</span>
              </>
            ) : (
              <>
                <Icon name="search" />
                <span>Escanear duplicados</span>
              </>
            )}
          </button>
        </div>

        {statusMessage && (
          <div className="duplicates-status-banner">
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Acciones por lote si hay resultados */}
        {groups.length > 0 && (
          <div className="duplicates-action-bar">
            <div className="duplicates-summary-text">
              <strong>{groups.length} grupos</strong> detectados ({totalDuplicatesCount} duplicados) •{" "}
              <span>Espacio a recuperar: <strong>{formatBytes(recoverableBytes)}</strong></span>
            </div>
            <div className="duplicates-bulk-buttons">
              <button
                type="button"
                className="duplicates-btn-secondary"
                onClick={selectedPaths.size === totalDuplicatesCount ? handleDeselectAll : handleSelectAll}
              >
                {selectedPaths.size === totalDuplicatesCount ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>
              <button
                type="button"
                className="duplicates-btn-danger"
                onClick={handleDeleteSelected}
                disabled={selectedPaths.size === 0 || isDeleting}
              >
                <Icon name="trash" />
                <span>Mover {selectedPaths.size} a la Papelera</span>
              </button>
            </div>
          </div>
        )}

        {/* Contenido / Lista de grupos */}
        <div className="duplicates-body-scroll">
          {groups.length === 0 ? (
            <div className="duplicates-empty-view">
              <Icon name="copy" />
              <h3>{hasScanned ? "¡No se encontraron archivos duplicados!" : "Listo para escanear"}</h3>
              <p>
                {hasScanned
                  ? "Tu biblioteca está completamente limpia con los criterios de similitud seleccionados."
                  : "Pulsa 'Escanear duplicados' para comparar hashes exactos y gradientes perceptuales de imágenes."}
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.groupId} className="duplicates-group-card">
                <div className="duplicates-group-header">
                  <div className="duplicates-group-badge">
                    <span className={`match-tag is-${group.matchType}`}>
                      {group.matchType === "exact" ? "Idéntico (100%)" : "Similitud visual"}
                    </span>
                    <span className="duplicates-group-title">Grupo #{group.groupId}</span>
                  </div>
                  <span className="duplicates-group-count">
                    {group.duplicates.length + 1} archivos en este grupo
                  </span>
                </div>

                <div className="duplicates-items-grid">
                  {/* Item Original / Referencia */}
                  <div className="duplicate-card is-original">
                    <div className="duplicate-card-tag is-original-tag">
                      <Icon name="star" />
                      <span>Original / Referencia</span>
                    </div>
                    <div className="duplicate-card-thumb">
                      <img
                        src={toSafeAssetUrl(group.original.path)}
                        alt={group.original.title}
                        loading="lazy"
                        draggable={false}
                      />
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
                    </div>
                  </div>

                  {/* Lista de Duplicados */}
                  {group.duplicates.map((dup) => {
                    const isSelected = selectedPaths.has(dup.path);
                    return (
                      <div
                        key={dup.path}
                        className={`duplicate-card is-duplicate ${isSelected ? "is-selected" : ""}`}
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
                        <div className="duplicate-card-thumb">
                          <img
                            src={toSafeAssetUrl(dup.path)}
                            alt={dup.title}
                            loading="lazy"
                            draggable={false}
                          />
                        </div>
                        <div className="duplicate-card-meta">
                          <span className="duplicate-name" title={dup.path}>
                            {dup.title}
                          </span>
                          <div className="duplicate-details">
                            {dup.width && dup.height && (
                              <span className="dim-badge">
                                {dup.width} × {dup.height} px
                              </span>
                            )}
                            <span className="size-badge">{formatBytes(dup.sizeBytes)}</span>
                          </div>

                          {/* Acciones individuales */}
                          <div className="duplicate-actions" onClick={(e) => e.stopPropagation()}>
                            {onOpenComparison && (
                              <button
                                type="button"
                                className="duplicate-btn-action"
                                onClick={() =>
                                  onOpenComparison(
                                    toVisualLibraryItem(group.original),
                                    toVisualLibraryItem(dup)
                                  )
                                }
                                title="Comparar frente a frente en visor interactivo"
                              >
                                <Icon name="compare" />
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
