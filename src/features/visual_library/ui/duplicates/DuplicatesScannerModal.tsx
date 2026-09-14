import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Icon } from "../../../../shared/ui/Icon";
import { toSafeAssetUrl, cleanPath } from "../../../../shared/mediaTree";
import { deleteMediaItems } from "../../../../shared/mediaOperations";
import { visualLibraryClient } from "../../tauri/client";
import { musicLibraryClient } from "../../../music_library/tauri/client";
import type {
  DuplicateGroup,
  DuplicateCandidate,
  VisualLibraryItem,
} from "../../model/types";
import { DuplicateGroupCard, type DuplicateScanKind } from "./DuplicateGroupCard";
import { DuplicatesEmptyState } from "./DuplicatesEmptyState";
import { ImageComparisonModal } from "../comparison/ImageComparisonModal";
import "./duplicates-scanner.css";

interface DuplicatesScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  kind?: DuplicateScanKind;
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
  const [activeKind, setActiveKind] = useState<DuplicateScanKind>(kind);

  useEffect(() => {
    if (kind) {
      setActiveKind(kind);
    }
  }, [kind]);

  const [scanMode, setScanMode] = useState<"single_folder" | "two_folders" | "library">("single_folder");
  const [singleFolder, setSingleFolder] = useState<string>("");
  const [baseFolder, setBaseFolder] = useState<string>("");
  const [targetFolder, setTargetFolder] = useState<string>("");
  const [isTwoFoldersExpanded, setIsTwoFoldersExpanded] = useState(false);
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
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [hoveredDropZone, setHoveredDropZone] = useState<"single" | "base" | "target" | null>(null);
  const hoveredDropZoneRef = useRef<"single" | "base" | "target" | null>(null);
  const [internalComparisonPair, setInternalComparisonPair] = useState<{
    original: VisualLibraryItem;
    duplicate: VisualLibraryItem;
  } | null>(null);

  const handleOpenComparison = (original: VisualLibraryItem, duplicate: VisualLibraryItem) => {
    if (onOpenComparison) {
      onOpenComparison(original, duplicate);
    } else {
      setInternalComparisonPair({ original, duplicate });
    }
  };

  const toggleGroupSelection = (group: DuplicateGroup) => {
    const dupPaths = group.duplicates.map((d) => d.path);
    if (dupPaths.length === 0) return;

    setSelectedPaths((prev) => {
      const next = new Set(prev);
      const allSelected = dupPaths.every((p) => next.has(p));
      if (allSelected) {
        for (const p of dupPaths) {
          next.delete(p);
        }
      } else {
        for (const p of dupPaths) {
          next.add(p);
        }
      }
      return next;
    });
  };

  const applyDroppedPaths = useCallback(
    (rawPaths: string[], dropZoneHint?: "single" | "base" | "target" | null) => {
      if (!rawPaths || rawPaths.length === 0) return;
      const paths = rawPaths.map(cleanPath).filter(Boolean);
      if (paths.length === 0) return;

      if (scanMode === "two_folders") {
        if (paths.length >= 2) {
          setBaseFolder(paths[0]);
          setTargetFolder(paths[1]);
          setStatusMessage("¡Ambas carpetas asignadas automáticamente (Base y Depuración)!");
          return;
        }

        const chosenZone = dropZoneHint || hoveredDropZoneRef.current;
        if (chosenZone === "base") {
          setBaseFolder(paths[0]);
          setStatusMessage(`Carpeta Base asignada: ${paths[0]}`);
        } else if (chosenZone === "target") {
          setTargetFolder(paths[0]);
          setStatusMessage(`Carpeta a Depurar asignada: ${paths[0]}`);
        } else {
          if (!baseFolder) {
            setBaseFolder(paths[0]);
            setStatusMessage(`Carpeta Base asignada: ${paths[0]}`);
          } else {
            setTargetFolder(paths[0]);
            setStatusMessage(`Carpeta a Depurar asignada: ${paths[0]}`);
          }
        }
      } else {
        // Modo 1 carpeta o biblioteca
        if (scanMode === "library") {
          setScanMode("single_folder");
        }
        setSingleFolder(paths[0]);
        setStatusMessage(`Carpeta cargada para análisis: ${paths[0]}`);
      }
    },
    [scanMode, baseFolder],
  );

  useEffect(() => {
    const unlistens: UnlistenFn[] = [];
    let isCancelled = false;

    // 1. Escucha de evento drop nativo de Tauri v2
    listen<{ paths?: string[]; position?: { x: number; y: number } }>("prisma://native-drag-drop", (event) => {
      if (isCancelled) return;
      setIsDraggingOver(false);
      const dropZone = hoveredDropZoneRef.current;
      setHoveredDropZone(null);
      hoveredDropZoneRef.current = null;
      if (event.payload?.paths && event.payload.paths.length > 0) {
        applyDroppedPaths(event.payload.paths, dropZone);
      }
    }).then((unlisten) => {
      if (isCancelled) unlisten();
      else unlistens.push(unlisten);
    }).catch(() => {});

    // 2. Escucha de drag-enter
    listen("prisma://native-drag-enter", () => {
      if (isCancelled) return;
      setIsDraggingOver(true);
    }).then((unlisten) => {
      if (isCancelled) unlisten();
      else unlistens.push(unlisten);
    }).catch(() => {});

    // 3. Escucha de drag-leave
    listen("prisma://native-drag-leave", () => {
      if (isCancelled) return;
      setIsDraggingOver(false);
      setHoveredDropZone(null);
      hoveredDropZoneRef.current = null;
    }).then((unlisten) => {
      if (isCancelled) unlisten();
      else unlistens.push(unlisten);
    }).catch(() => {});

    // 4. Escucha de drag-over
    listen<{ position?: { x: number; y: number } }>("prisma://native-drag-over", (event) => {
      if (isCancelled) return;
      setIsDraggingOver(true);
      if (event.payload?.position) {
        const dpr = window.devicePixelRatio || 1;
        const clientX = event.payload.position.x / dpr;
        const clientY = event.payload.position.y / dpr;
        const el = document.elementFromPoint(clientX, clientY);
        if (el) {
          if (el.closest(".is-base") || el.closest("[data-drop-zone='base']")) {
            setHoveredDropZone("base");
            hoveredDropZoneRef.current = "base";
          } else if (el.closest(".is-target") || el.closest("[data-drop-zone='target']")) {
            setHoveredDropZone("target");
            hoveredDropZoneRef.current = "target";
          } else if (el.closest(".is-single") || el.closest("[data-drop-zone='single']")) {
            setHoveredDropZone("single");
            hoveredDropZoneRef.current = "single";
          } else if (scanMode === "two_folders") {
            const twoPanel = el.closest(".duplicates-two-folders-panel");
            if (twoPanel) {
              const rect = twoPanel.getBoundingClientRect();
              const zone = clientX < rect.left + rect.width / 2 ? "base" : "target";
              setHoveredDropZone(zone);
              hoveredDropZoneRef.current = zone;
            }
          }
        }
      }
    }).then((unlisten) => {
      if (isCancelled) unlisten();
      else unlistens.push(unlisten);
    }).catch(() => {});

    // Fallback secundario con getCurrentWebview()
    try {
      const webview = getCurrentWebview();
      webview.onDragDropEvent((event) => {
        if (isCancelled) return;
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDraggingOver(true);
        } else if (event.payload.type === "drop" && event.payload.paths) {
          setIsDraggingOver(false);
          applyDroppedPaths(event.payload.paths, hoveredDropZoneRef.current);
          setHoveredDropZone(null);
          hoveredDropZoneRef.current = null;
        } else if (event.payload.type === "leave") {
          setIsDraggingOver(false);
          setHoveredDropZone(null);
          hoveredDropZoneRef.current = null;
        }
      }).then((unlisten) => {
        if (isCancelled) unlisten();
        else unlistens.push(unlisten);
      }).catch(() => {});
    } catch {}

    return () => {
      isCancelled = true;
      for (const u of unlistens) {
        try {
          u();
        } catch {}
      }
    };
  }, [scanMode, applyDroppedPaths]);

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
      let results: DuplicateGroup[];
      if (activeKind === "music") {
        results = await musicLibraryClient.scanDuplicates({
          paths: scanPaths,
          minSimilarityPct,
          checkVisualSimilarity,
          baseFolder: base,
          targetFolder: target,
          preferHigherResolution,
        });
      } else {
        results = await visualLibraryClient.scanDuplicates(activeKind, {
          paths: scanPaths,
          minSimilarityPct,
          checkVisualSimilarity,
          baseFolder: base,
          targetFolder: target,
          preferHigherResolution,
        });
      }
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
    kind: activeKind === "video" ? "video" : "image",
    modifiedAtMillis: cand.modifiedAtMillis,
    sizeBytes: cand.sizeBytes,
  });

  return (
    <div
      className={embedded ? "duplicates-workspace-view" : "duplicates-modal-backdrop"}
      onClick={embedded ? undefined : onClose}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDraggingOver(false);
          setHoveredDropZone(null);
          hoveredDropZoneRef.current = null;
        }
      }}
    >
      <div
        className={embedded ? "duplicates-workspace-card" : "duplicates-modal-card"}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        style={{ position: "relative" }}
      >
        {/* Overlay Drag & Drop Material 3 Expressive */}
        {isDraggingOver && (
          <div className="duplicates-drop-overlay">
            {scanMode === "two_folders" ? (
              <div className="duplicates-drop-split-container">
                <div className={`duplicates-drop-split-side is-base ${hoveredDropZone === "base" ? "is-active" : ""}`}>
                  <div className="duplicates-drop-pulse base">
                    <Icon name="star" />
                  </div>
                  <h3>Carpeta Base</h3>
                  <p>A proteger y mantener intacta</p>
                </div>
                <div className="duplicates-drop-split-divider">
                  <span>o suelta 2 carpetas a la vez</span>
                </div>
                <div className={`duplicates-drop-split-side is-target ${hoveredDropZone === "target" ? "is-active" : ""}`}>
                  <div className="duplicates-drop-pulse target">
                    <Icon name="trash" />
                  </div>
                  <h3>Carpeta a Depurar</h3>
                  <p>A comparar y limpiar duplicados</p>
                </div>
              </div>
            ) : (
              <div className="duplicates-drop-card">
                <div className="duplicates-drop-pulse">
                  <Icon name="folder" />
                </div>
                <h3>Suelta tu carpeta aquí</h3>
                <p>Se analizarán todos los archivos y subcarpetas con detección inteligente</p>
              </div>
            )}
          </div>
        )}
        {/* Header */}
        <header className="duplicates-modal-header">
          <div className="duplicates-header-info">
            <span className="duplicates-header-icon">
              <Icon name="layers" />
            </span>
            <div>
              <h2 className="duplicates-header-title">
                {activeKind === "music" ? "Buscador y Comparador de Duplicados (Música)" : "Buscador y Comparador de Duplicados"}
              </h2>
              <p className="duplicates-header-subtitle">
                {activeKind === "music"
                  ? "Detección por hash, metadatos Lofty y comparativa de calidad de audio (Hi-Res)"
                  : `Detección por hash, similitud visual y comparativa cruzada de carpetas (${activeKind === "image" ? "Imágenes" : "Vídeos"})`}
              </p>
            </div>
          </div>
          <div className="duplicates-header-actions">
            <div className="duplicates-kind-switcher">
              <button
                type="button"
                className={`duplicates-kind-btn ${activeKind === "music" ? "is-active" : ""}`}
                onClick={() => {
                  if (activeKind !== "music") {
                    setActiveKind("music");
                    setGroups([]);
                    setHasScanned(false);
                    setSelectedPaths(new Set());
                  }
                }}
              >
                <Icon name="music" />
                <span>Música</span>
              </button>
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
              <span>Toda la Biblioteca ({activeKind === "music" ? "Música" : activeKind === "image" ? "Imágenes" : "Vídeos"})</span>
            </button>
          </div>

          <label
            className="duplicates-upgrade-toggle"
            title={
              activeKind === "music"
                ? "Conserva pistas Hi-Res (FLAC, ALAC, WAV o mayor bitrate) y nombres limpios sobre pistas comprimidas"
                : "Conserva la mejor resolución HD/4K y nombres humanos descriptivos sobre volcados mecánicos o hashes"
            }
          >
            <input
              type="checkbox"
              checked={preferHigherResolution}
              onChange={(e) => setPreferHigherResolution(e.target.checked)}
            />
            <Icon name="sparkles" />
            <span>
              {activeKind === "music"
                ? "Priorizar Hi-Res (FLAC / 320kbps) y Nombres Limpios"
                : "Priorizar Resolución y Nombres Naturales"}
            </span>
          </label>
        </div>

        {/* Barra Compacta para 1 Carpeta (Solo cuando ya se seleccionó una carpeta) */}
        {scanMode === "single_folder" && singleFolder && (
          <div className="duplicates-compact-folder-bar">
            <div className="duplicates-compact-folder-meta">
              <span className="duplicates-compact-folder-badge">
                <Icon name="folder" />
                <span>Carpeta</span>
              </span>
              <span className="duplicates-compact-folder-path" title={singleFolder}>
                {singleFolder}
              </span>
            </div>
            <button
              type="button"
              className="duplicates-compact-folder-btn"
              onClick={handlePickSingleFolder}
              title="Cambiar carpeta a analizar"
            >
              <Icon name="edit" />
              <span>Cambiar...</span>
            </button>
          </div>
        )}

        {/* Panel de selección de Carpetas Cruzadas */}
        {scanMode === "two_folders" && (baseFolder && targetFolder && !isTwoFoldersExpanded ? (
          <div className="duplicates-two-folders-compact-bar">
            {/* Cápsula Carpeta Base */}
            <div
              className={`duplicates-compact-folder-capsule is-base ${hoveredDropZone === "base" ? "is-drag-over" : ""}`}
              data-drop-zone="base"
              onClick={handlePickBaseFolder}
              title={`Carpeta Base (A proteger / intacta):\n${baseFolder}`}
            >
              <span className="compact-capsule-badge base">
                <Icon name="star" />
                <span>Base</span>
              </span>
              <span className="compact-capsule-path">{baseFolder}</span>
              <button
                type="button"
                className="compact-capsule-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePickBaseFolder();
                }}
                title="Cambiar Carpeta Base"
              >
                <Icon name="edit" />
                <span>Cambiar</span>
              </button>
            </div>

            {/* Botón intercambiar roles */}
            <button
              type="button"
              className="duplicates-compact-swap-btn"
              onClick={handleSwapFolders}
              title="Intercambiar Carpeta Base ⇄ Carpeta a Depurar"
            >
              <span className="swap-icon">⇄</span>
            </button>

            {/* Cápsula Carpeta a Depurar */}
            <div
              className={`duplicates-compact-folder-capsule is-target ${hoveredDropZone === "target" ? "is-drag-over" : ""}`}
              data-drop-zone="target"
              onClick={handlePickTargetFolder}
              title={`Carpeta a Depurar (A limpiar / origen):\n${targetFolder}`}
            >
              <span className="compact-capsule-badge target">
                <Icon name="trash" />
                <span>A Depurar</span>
              </span>
              <span className="compact-capsule-path">{targetFolder}</span>
              <button
                type="button"
                className="compact-capsule-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePickTargetFolder();
                }}
                title="Cambiar Carpeta a Depurar"
              >
                <Icon name="edit" />
                <span>Cambiar</span>
              </button>
            </div>

            {/* Botón expandir a tarjetas detalladas */}
            <button
              type="button"
              className="duplicates-compact-expand-btn"
              onClick={() => setIsTwoFoldersExpanded(true)}
              title="Expandir panel detallado de carpetas"
            >
              <Icon name="fullscreen" />
            </button>
          </div>
        ) : (
          <div className="duplicates-two-folders-panel">
            {/* Carpeta Base */}
            <div
              className={`duplicates-folder-card is-base ${hoveredDropZone === "base" ? "is-drag-over" : ""}`}
              data-drop-zone="base"
              onClick={handlePickBaseFolder}
              onDragEnter={() => {
                setHoveredDropZone("base");
                hoveredDropZoneRef.current = "base";
              }}
              onDragLeave={() => {
                if (hoveredDropZoneRef.current === "base") {
                  setHoveredDropZone(null);
                  hoveredDropZoneRef.current = null;
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (e.dataTransfer) {
                  e.dataTransfer.dropEffect = "copy";
                }
                if (hoveredDropZoneRef.current !== "base") {
                  setHoveredDropZone("base");
                  hoveredDropZoneRef.current = "base";
                }
              }}
            >
              <div className="folder-card-label">
                <Icon name="star" />
                <span>Carpeta Base (A Proteger / Intacta)</span>
              </div>
              <div className="folder-card-picker">
                <Icon name="folder" />
                <span className="folder-path-text" title={baseFolder || "Arrastra carpeta base aquí o haz clic para examinar..."}>
                  {baseFolder || "Arrastra carpeta base aquí o haz clic para examinar..."}
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
                Arrastra la carpeta base aquí. Los archivos aquí se eligen como referencia original y se mantienen protegidos.
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
            <div
              className={`duplicates-folder-card is-target ${hoveredDropZone === "target" ? "is-drag-over" : ""}`}
              data-drop-zone="target"
              onClick={handlePickTargetFolder}
              onDragEnter={() => {
                setHoveredDropZone("target");
                hoveredDropZoneRef.current = "target";
              }}
              onDragLeave={() => {
                if (hoveredDropZoneRef.current === "target") {
                  setHoveredDropZone(null);
                  hoveredDropZoneRef.current = null;
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (e.dataTransfer) {
                  e.dataTransfer.dropEffect = "copy";
                }
                if (hoveredDropZoneRef.current !== "target") {
                  setHoveredDropZone("target");
                  hoveredDropZoneRef.current = "target";
                }
              }}
            >
              <div className="folder-card-label">
                <Icon name="trash" />
                <span>Carpeta a Depurar (A Limpiar / Origen)</span>
              </div>
              <div className="folder-card-picker">
                <Icon name="smartphone" />
                <span className="folder-path-text" title={targetFolder || "Arrastra carpeta a depurar aquí o haz clic para examinar..."}>
                  {targetFolder || "Arrastra carpeta a depurar aquí o haz clic para examinar..."}
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
                Arrastra la carpeta a depurar aquí. Los archivos que coincidan con la base se marcarán para depurar, mover o actualizar.
              </p>
            </div>

            {baseFolder && targetFolder && (
              <button
                type="button"
                className="duplicates-collapse-btn"
                onClick={() => setIsTwoFoldersExpanded(false)}
                title="Contraer a modo compacto (ahorrar espacio)"
              >
                <Icon name="fullscreen-exit" />
                <span>Modo compacto</span>
              </button>
            )}
          </div>
        ))}

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
            <DuplicatesEmptyState
              hasScanned={hasScanned}
              scanMode={scanMode}
              singleFolder={singleFolder}
              activeKind={activeKind}
              hoveredDropZone={hoveredDropZone}
              isScanning={isScanning}
              handlePickSingleFolder={handlePickSingleFolder}
              handleStartScan={handleStartScan}
              applyDroppedPaths={applyDroppedPaths}
              setHasScanned={setHasScanned}
              setHoveredDropZone={setHoveredDropZone}
              hoveredDropZoneRef={hoveredDropZoneRef}
              setIsDraggingOver={setIsDraggingOver}
            />
          ) : (
            groups.map((group) => (
              <DuplicateGroupCard
                key={group.groupId}
                group={group}
                activeKind={activeKind}
                selectedPaths={selectedPaths}
                toggleGroupSelection={toggleGroupSelection}
                toggleSelectPath={toggleSelectPath}
                handleReplaceBase={handleReplaceBase}
                handleOpenComparison={handleOpenComparison}
                toVisualLibraryItem={toVisualLibraryItem}
                formatBytes={formatBytes}
              />
            ))
          )}
        </div>
      </div>

      {internalComparisonPair && (
        <ImageComparisonModal
          initialItem={internalComparisonPair.original}
          secondItem={internalComparisonPair.duplicate}
          onClose={() => setInternalComparisonPair(null)}
        />
      )}
    </div>
  );
}
