import { useState, useMemo, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../../shared/ui/Icon";
import { toSafeAssetUrl, cleanPath } from "../../../../shared/mediaTree";
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
  kind?: VisualMediaKind;
  onOpenComparison?: (original: VisualLibraryItem, duplicate: VisualLibraryItem) => void;
  onRefreshLibrary?: () => void;
  embedded?: boolean;
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
  kind = "image",
  onOpenComparison,
  onRefreshLibrary,
  embedded = false,
}: DuplicatesScannerModalProps) {
  const [activeKind, setActiveKind] = useState<VisualMediaKind>(kind);

  useEffect(() => {
    if (kind) {
      setActiveKind(kind);
    }
  }, [kind]);

  const [scanMode, setScanMode] = useState<"single_folder" | "two_folders" | "library">("single_folder");
  const [singleFolder, setSingleFolder] = useState<string>("");
  const [baseFolder, setBaseFolder] = useState<string>("");
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [preferHigherResolution, setPreferHigherResolution] = useState(true);

  const [isScanning, setIsScanning] = useState(false);
  const [checkVisualSimilarity, setCheckVisualSimilarity] = useState(true);
  const [minSimilarityPct, setMinSimilarityPct] = useState(90);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePickSingleFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Seleccionar Carpeta para analizar (incluye subcarpetas)",
    });
    if (typeof selected === "string") {
      setSingleFolder(cleanPath(selected));
    }
  };

  const handlePickBaseFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Seleccionar Carpeta Base (a proteger / mantener intacta)",
    });
    if (typeof selected === "string") {
      setBaseFolder(cleanPath(selected));
    }
  };

  const handlePickTargetFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Seleccionar Carpeta a Depurar (origen / a limpiar)",
    });
    if (typeof selected === "string") {
      setTargetFolder(cleanPath(selected));
    }
  };

  const handleSwapFolders = () => {
    const temp = baseFolder;
    setBaseFolder(targetFolder);
    setTargetFolder(temp);
  };

  const handleStartScan = async () => {
    let scanPaths: string[] = [];
    let base: string | undefined = undefined;
    let target: string | undefined = undefined;

    if (scanMode === "single_folder") {
      if (!singleFolder) {
        setStatusMessage("Por favor selecciona una carpeta para analizar sus archivos y subcarpetas.");
        return;
      }
      scanPaths = [singleFolder];
    } else if (scanMode === "two_folders") {
      if (!baseFolder || !targetFolder) {
        setStatusMessage("Por favor selecciona tanto la Carpeta Base como la Carpeta a Depurar antes de escanear.");
        return;
      }
      if (baseFolder.toLowerCase() === targetFolder.toLowerCase()) {
        setStatusMessage("La Carpeta Base y la Carpeta a Depurar no pueden ser la misma carpeta.");
        return;
      }
      base = baseFolder;
      target = targetFolder;
    }

    setIsScanning(true);
    setStatusMessage("Escaneando archivos y calculando firmas de similitud...");
    setSelectedPaths(new Set());
    try {
      const results = await visualLibraryClient.scanDuplicates(activeKind, {
        paths: scanPaths,
        minSimilarityPct,
        checkVisualSimilarity,
        baseFolder: base,
        targetFolder: target,
        preferHigherResolution,
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
      setStatusMessage(
        results.length === 0
          ? "No se encontraron duplicados con los criterios establecidos."
          : null
      );
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

  const selectedHighResCount = useMemo(() => {
    let count = 0;
    for (const g of groups) {
      for (const d of g.duplicates) {
        if (selectedPaths.has(d.path) && d.hasHigherResolution) {
          count++;
        }
      }
    }
    return count;
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

  const handleMoveSelected = async () => {
    if (selectedPaths.size === 0) return;
    const pathsToMove = Array.from(selectedPaths);
    const dest = await open({
      directory: true,
      multiple: false,
      title: `Seleccionar carpeta destino para ${pathsToMove.length} archivo(s) duplicado(s)`,
    });
    if (typeof dest !== "string") return;

    setIsMoving(true);
    try {
      const moved = await visualLibraryClient.moveDuplicates(pathsToMove, dest);
      if (moved > 0) {
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
        setStatusMessage(`Se movieron exitosamente ${moved} archivo(s) a: ${dest}`);
      }
    } catch (err) {
      alert(`Error al mover archivos: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsMoving(false);
    }
  };

  const handleReplaceBase = async (basePath: string, highResPath: string) => {
    const confirmed = window.confirm(
      "¿Reemplazar la versión base con esta copia de mayor resolución?\n\n" +
        "• La versión base anterior de menor resolución se enviará a la Papelera de reciclaje.\n" +
        "• El archivo de alta resolución se colocará en la carpeta base conservando su calidad."
    );
    if (!confirmed) return;

    try {
      await visualLibraryClient.replaceDuplicate(basePath, highResPath);
      setGroups((prevGroups) =>
        prevGroups
          .map((g) => {
            if (g.original.path === basePath) {
              return {
                ...g,
                duplicates: g.duplicates.filter((d) => d.path !== highResPath),
              };
            }
            return g;
          })
          .filter((g) => g.duplicates.length > 0)
      );
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        next.delete(highResPath);
        return next;
      });
      onRefreshLibrary?.();
    } catch (err) {
      alert(`Error al reemplazar versión base: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleBulkReplaceHighRes = async () => {
    const upgrades: Array<{ base: string; highRes: string }> = [];
    for (const g of groups) {
      for (const d of g.duplicates) {
        if (selectedPaths.has(d.path) && d.hasHigherResolution) {
          upgrades.push({ base: g.original.path, highRes: d.path });
        }
      }
    }

    if (upgrades.length === 0) return;

    const confirmed = window.confirm(
      `¿Reemplazar ${upgrades.length} archivo(s) base con sus versiones de mayor resolución?\n\n` +
        "Las versiones de menor resolución se enviarán a la Papelera de reciclaje de forma segura."
    );
    if (!confirmed) return;

    setIsUpgrading(true);
    let successCount = 0;
    try {
      for (const u of upgrades) {
        try {
          await visualLibraryClient.replaceDuplicate(u.base, u.highRes);
          successCount++;
          setGroups((prevGroups) =>
            prevGroups
              .map((g) => {
                if (g.original.path === u.base) {
                  return {
                    ...g,
                    duplicates: g.duplicates.filter((d) => d.path !== u.highRes),
                  };
                }
                return g;
              })
              .filter((g) => g.duplicates.length > 0)
          );
          setSelectedPaths((prev) => {
            const next = new Set(prev);
            next.delete(u.highRes);
            return next;
          });
        } catch (e) {
          console.error("Error al reemplazar:", e);
        }
      }
      onRefreshLibrary?.();
      setStatusMessage(`Se actualizaron exitosamente ${successCount} archivo(s) a alta resolución.`);
    } finally {
      setIsUpgrading(false);
    }
  };

  const toVisualLibraryItem = (cand: DuplicateCandidate): VisualLibraryItem => ({
    path: cand.path,
    title: cand.title,
    sourcePath: cand.path,
    relativeFolder: cand.relativeFolder,
    kind: activeKind,
    modifiedAtMillis: cand.modifiedAtMillis,
    sizeBytes: cand.sizeBytes,
  });

  return (
    <div
      className={embedded ? "duplicates-workspace-view" : "duplicates-modal-backdrop"}
      onClick={embedded ? undefined : onClose}
    >
      <div
        className={embedded ? "duplicates-workspace-card" : "duplicates-modal-card"}
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
              <h2 className="duplicates-header-title">Buscador y Comparador de Duplicados</h2>
              <p className="duplicates-header-subtitle">
                Detección por hash, similitud visual y comparativa cruzada de carpetas ({activeKind === "image" ? "Imágenes" : "Vídeos"})
              </p>
            </div>
          </div>
          <div className="duplicates-header-actions">
            <div className="duplicates-kind-switcher">
              <button
                type="button"
                className={`duplicates-kind-btn ${activeKind === "image" ? "is-active" : ""}`}
                onClick={() => {
                  if (activeKind !== "image") {
                    setActiveKind("image");
                    setGroups([]);
                    setHasScanned(false);
                    setSelectedPaths(new Set());
                  }
                }}
              >
                <Icon name="image" />
                <span>Imágenes</span>
              </button>
              <button
                type="button"
                className={`duplicates-kind-btn ${activeKind === "video" ? "is-active" : ""}`}
                onClick={() => {
                  if (activeKind !== "video") {
                    setActiveKind("video");
                    setGroups([]);
                    setHasScanned(false);
                    setSelectedPaths(new Set());
                  }
                }}
              >
                <Icon name="video" />
                <span>Vídeos</span>
              </button>
            </div>
            <button
              type="button"
              className="duplicates-btn-close"
              onClick={onClose}
              title={embedded ? "Volver al Inicio" : "Cerrar (Esc)"}
            >
              <Icon name="close" />
            </button>
          </div>
        </header>

        {/* Selector de Alcance: 1 Carpeta vs 2 Carpetas vs Toda la Biblioteca */}
        <div className="duplicates-scope-bar">
          <div className="duplicates-scope-tabs">
            <button
              type="button"
              className={`duplicates-scope-tab ${scanMode === "single_folder" ? "is-active" : ""}`}
              onClick={() => setScanMode("single_folder")}
            >
              <Icon name="folder" />
              <span>Escanear 1 Carpeta (y subcarpetas)</span>
            </button>
            <button
              type="button"
              className={`duplicates-scope-tab ${scanMode === "two_folders" ? "is-active" : ""}`}
              onClick={() => setScanMode("two_folders")}
            >
              <Icon name="split" />
              <span>Comparar 2 Carpetas (Base vs Depurar)</span>
            </button>
            <button
              type="button"
              className={`duplicates-scope-tab ${scanMode === "library" ? "is-active" : ""}`}
              onClick={() => setScanMode("library")}
            >
              <Icon name="layers" />
              <span>Toda la Biblioteca ({activeKind === "image" ? "Imágenes" : "Vídeos"})</span>
            </button>
          </div>

          <label
            className="duplicates-upgrade-toggle"
            title="Conserva la mejor resolución HD/4K y nombres humanos descriptivos sobre volcados mecánicos o hashes"
          >
            <input
              type="checkbox"
              checked={preferHigherResolution}
              onChange={(e) => setPreferHigherResolution(e.target.checked)}
            />
            <Icon name="sparkles" />
            <span>Priorizar Resolución y Nombres Naturales</span>
          </label>
        </div>

        {/* Panel para Escanear 1 Carpeta (con todas sus subcarpetas) */}
        {scanMode === "single_folder" && (
          <div className="duplicates-single-folder-panel">
            <div className="duplicates-folder-card is-single" onClick={handlePickSingleFolder}>
              <div className="folder-card-label">
                <Icon name="folder" />
                <span>Carpeta a Analizar (incluye subcarpetas)</span>
              </div>
              <div className="folder-card-picker">
                <Icon name="folder-open" />
                <span className="folder-path-text" title={singleFolder || "Haz clic para seleccionar una carpeta..."}>
                  {singleFolder || "Seleccionar cualquier carpeta de la PC o disco externo (ej. Telefono o Descargas)..."}
                </span>
                <button
                  type="button"
                  className="folder-pick-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePickSingleFolder();
                  }}
                >
                  Examinar...
                </button>
              </div>
              <p className="folder-card-hint">
                Se analizarán todos los archivos y subcarpetas. La inteligencia de nombres prioriza nombres humanos sobre hashes o volcados mecánicos (como <code>file_00000000...</code>).
              </p>
            </div>
          </div>
        )}

        {/* Panel de selección de Carpetas Cruzadas */}
        {scanMode === "two_folders" && (
          <div className="duplicates-two-folders-panel">
            {/* Carpeta Base */}
            <div className="duplicates-folder-card is-base" onClick={handlePickBaseFolder}>
              <div className="folder-card-label">
                <Icon name="star" />
                <span>Carpeta Base (A Proteger / Intacta)</span>
              </div>
              <div className="folder-card-picker">
                <Icon name="folder" />
                <span className="folder-path-text" title={baseFolder || "Haz clic para seleccionar carpeta base..."}>
                  {baseFolder || "Seleccionar carpeta base (ej. Proyecto o Biblioteca)..."}
                </span>
                <button
                  type="button"
                  className="folder-pick-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePickBaseFolder();
                  }}
                >
                  Examinar...
                </button>
              </div>
              <p className="folder-card-hint">
                Los archivos aquí se eligen como referencia original y se mantienen protegidos.
              </p>
            </div>

            {/* Botón intercambiar roles */}
            <button
              type="button"
              className="duplicates-swap-btn"
              onClick={handleSwapFolders}
              title="Intercambiar Carpeta Base ⇄ Carpeta a Depurar"
            >
              <span className="swap-icon">⇄</span>
            </button>

            {/* Carpeta a Depurar */}
            <div className="duplicates-folder-card is-target" onClick={handlePickTargetFolder}>
              <div className="folder-card-label">
                <Icon name="trash" />
                <span>Carpeta a Depurar (A Limpiar / Origen)</span>
              </div>
              <div className="folder-card-picker">
                <Icon name="smartphone" />
                <span className="folder-path-text" title={targetFolder || "Haz clic para seleccionar carpeta a depurar..."}>
                  {targetFolder || "Seleccionar carpeta a depurar (ej. Copia del Teléfono)..."}
                </span>
                <button
                  type="button"
                  className="folder-pick-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePickTargetFolder();
                  }}
                >
                  Examinar...
                </button>
              </div>
              <p className="folder-card-hint">
                Los archivos que coincidan con la base se marcarán para depurar, mover o actualizar.
              </p>
            </div>
          </div>
        )}

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
              <span>
                Espacio a recuperar: <strong>{formatBytes(recoverableBytes)}</strong>
              </span>
            </div>
            <div className="duplicates-bulk-buttons">
              <button
                type="button"
                className="duplicates-btn-secondary"
                onClick={selectedPaths.size === totalDuplicatesCount ? handleDeselectAll : handleSelectAll}
              >
                {selectedPaths.size === totalDuplicatesCount ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>

              {selectedHighResCount > 0 && (
                <button
                  type="button"
                  className="duplicates-btn-upgrade-bulk"
                  onClick={handleBulkReplaceHighRes}
                  disabled={isUpgrading}
                  title="Reemplazar la versión base con las copias de mayor calidad seleccionadas"
                >
                  <Icon name="sparkles" />
                  <span>Reemplazar versión base ({selectedHighResCount} HD)</span>
                </button>
              )}

              <button
                type="button"
                className="duplicates-btn-secondary"
                onClick={handleMoveSelected}
                disabled={selectedPaths.size === 0 || isMoving}
                title="Mover los duplicados seleccionados a otra carpeta sin eliminarlos"
              >
                <Icon name="folder" />
                <span>Mover a carpeta...</span>
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
                  ? "Las carpetas o biblioteca no contienen archivos duplicados con los criterios seleccionados."
                  : scanMode === "single_folder"
                  ? "Selecciona cualquier carpeta (ej. Telefono, Descargas o Fotos) para encontrar duplicados en todas sus subcarpetas."
                  : scanMode === "two_folders"
                  ? "Selecciona la carpeta base a proteger y la carpeta a depurar, luego pulsa 'Escanear duplicados'."
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
                    {group.hasResolutionUpgrade && (
                      <span className="resolution-upgrade-pill" title="Este grupo incluye una versión con mayor resolución que la base">
                        <Icon name="sparkles" />
                        <span>Mejora de Resolución Disponible</span>
                      </span>
                    )}
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
                      <span>{group.original.isFromBaseFolder ? "Original (Carpeta Base)" : "Original / Referencia"}</span>
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
                          <div className="duplicate-res-badge" title="Este archivo tiene mayor resolución que la versión base">
                            <Icon name="sparkles" />
                            <span>Mayor resolución HD/4K</span>
                          </div>
                        )}

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
                                title="Reemplazar la versión base con esta versión de mayor resolución"
                              >
                                <Icon name="sparkles" />
                                <span>Reemplazar base</span>
                              </button>
                            )}

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
