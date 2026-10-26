import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { cleanPath } from "../../../shared/mediaTree";
import { computeRenamingPreview } from "../model/renamerEngine";
import { createSourceDropQueue, mergeSourceSelection, orderSourceSelection } from "../model/sourceSelection";
import { renamerClient } from "../tauri/client";
import type {
  FilterMode,
  PresetTemplate,
  PreviewItem,
  RenameBatchResult,
  RenameOperation,
  RenamerFileItem,
  RuleStep,
  RuleType,
} from "../model/types";

export const BUILTIN_PRESETS: PresetTemplate[] = [
  {
    id: "numbered-collection",
    name: "Colección Numerada",
    description: "Reemplaza el nombre por el nombre de la carpeta + contador de dos dígitos (ej. Carpeta - 01.jpg)",
    steps: [
      {
        id: "step-num-1",
        title: "Plantilla Base",
        enabled: true,
        type: "template",
        config: {
          pattern: "[Carpeta] - [Contador]",
          counterStart: 1,
          counterPadding: 2,
          counterStep: 1,
        },
      },
    ],
  },
  {
    id: "clean-title-case",
    name: "Limpieza y Título",
    description: "Reemplaza guiones bajos por espacios, limpia corchetes y aplica formato Título",
    steps: [
      {
        id: "step-clean-1",
        title: "Reemplazar _ por espacio",
        enabled: true,
        type: "replace",
        config: {
          find: "_",
          replace: " ",
          matchCase: false,
          useRegex: false,
          replaceAll: true,
        },
      },
      {
        id: "step-clean-2",
        title: "Eliminar corchetes",
        enabled: true,
        type: "remove",
        config: {
          removeType: "brackets",
        },
      },
      {
        id: "step-clean-3",
        title: "Mayúscula Cada Palabra",
        enabled: true,
        type: "case",
        config: {
          mode: "titlecase",
          target: "name",
        },
      },
      {
        id: "step-clean-4",
        title: "Recortar espacios sobrantes",
        enabled: true,
        type: "remove",
        config: {
          removeType: "spaces",
        },
      },
    ],
  },
  {
    id: "date-prefix",
    name: "Prefijo de Fecha",
    description: "Añade la fecha de modificación al inicio de cada archivo (ej. 2026-08-30 - Archivo.jpg)",
    steps: [
      {
        id: "step-date-1",
        title: "Añadir Fecha al Inicio",
        enabled: true,
        type: "template",
        config: {
          pattern: "[Fecha] - [Nombre]",
          counterStart: 1,
          counterPadding: 2,
          counterStep: 1,
        },
      },
    ],
  },
  {
    id: "web-kebab",
    name: "Formato Web (kebab-case)",
    description: "Convierte todo a minúsculas y sustituye espacios y signos por guiones simples",
    steps: [
      {
        id: "step-web-1",
        title: "kebab-case",
        enabled: true,
        type: "case",
        config: {
          mode: "kebabcase",
          target: "name",
        },
      },
      {
        id: "step-web-2",
        title: "Extensión en minúsculas",
        enabled: true,
        type: "extension",
        config: {
          mode: "lowercase",
        },
      },
    ],
  },
];

type TargetType = "files" | "folders" | "both";

interface SourceOverrides {
  append?: boolean;
  preserveOrder?: boolean;
  filterMode?: FilterMode;
  customExtensions?: string;
  includeSubfolders?: boolean;
  targetType?: TargetType;
}

/** Convierte "png, jpg" en ["png", "jpg"]. */
function parseCustomExtensions(extsStr: string): string[] {
  return extsStr
    .split(/[,;\s]+/)
    .map((e) => e.trim().replace(/^\./, ""))
    .filter(Boolean);
}

export function useRenamer() {
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  // Rutas de una selección explícita de archivos (null = modo carpeta)
  const [sourcePaths, setSourcePaths] = useState<string[] | null>(null);
  const [items, setItems] = useState<RenamerFileItem[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [customExtensions, setCustomExtensions] = useState<string>("");
  const [includeSubfolders, setIncludeSubfolders] = useState(false);
  const [targetType, setTargetType] = useState<"files" | "folders" | "both">("files");

  const [steps, setSteps] = useState<RuleStep[]>([
    {
      id: "step-initial",
      title: "Reemplazar con Plantilla",
      enabled: true,
      type: "template",
      config: {
        pattern: "",
        counterStart: 1,
        counterPadding: 2,
        counterStep: 1,
      },
    },
  ]);

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [lastResult, setLastResult] = useState<RenameBatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dragCounterRef = useRef(0);
  const loadedItemsRef = useRef(items);
  const selectedPathsRef = useRef(selectedPaths);
  const sourceLoadRevisionRef = useRef(0);
  const enqueueDrop = useMemo(() => createSourceDropQueue(), []);
  const shiftPressedRef = useRef(false);
  const [isAppendingDrop, setIsAppendingDrop] = useState(false);
  loadedItemsRef.current = items;
  selectedPathsRef.current = selectedPaths;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      shiftPressedRef.current = event.shiftKey;
      setIsAppendingDrop(event.shiftKey);
    };
    const onDrag = (event: DragEvent) => {
      shiftPressedRef.current = event.shiftKey;
      setIsAppendingDrop(event.shiftKey);
    };
    const onBlur = () => { shiftPressedRef.current = false; setIsAppendingDrop(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("dragover", onDrag);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("dragover", onDrag);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    void renamerClient.canUndo().then((available) => {
      if (!disposed) setCanUndo(available);
    }).catch(() => {});
    return () => { disposed = true; };
  }, []);

  // Escanear carpeta
  const scanFolderInternal = useCallback(
    async (
      folderPath: string,
      filter: FilterMode,
      extsStr: string,
      subfolders: boolean,
      target: "files" | "folders" | "both"
    ) => {
      const revision = ++sourceLoadRevisionRef.current;
      setIsScanning(true);
      setError(null);
      try {
        const customExts = extsStr
          .split(/[,;\s]+/)
          .map((e) => e.trim().replace(/^\./, ""))
          .filter(Boolean);

        const scanned = await renamerClient.scanFolder(
          folderPath,
          filter,
          customExts,
          subfolders,
          target
        );

        if (revision !== sourceLoadRevisionRef.current) return;
        loadedItemsRef.current = scanned;
        selectedPathsRef.current = new Set(scanned.map((it) => it.path));
        setItems(scanned);
        // Por defecto, seleccionar todos los elementos encontrados
        setSelectedPaths(new Set(scanned.map((it) => it.path)));
      } catch (err) {
        if (revision !== sourceLoadRevisionRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setItems([]);
        setSelectedPaths(new Set());
      } finally {
        if (revision === sourceLoadRevisionRef.current) setIsScanning(false);
      }
    },
    []
  );

  const loadFolder = useCallback(
    (folderPath: string) => {
      setCurrentFolder(folderPath);
      setSourcePaths(null);
      void scanFolderInternal(
        folderPath,
        filterMode,
        customExtensions,
        includeSubfolders,
        targetType
      );
    },
    [customExtensions, filterMode, includeSubfolders, scanFolderInternal, targetType]
  );

  /**
   * Carga un origen de trabajo a partir de rutas sueltas (soltar en la ventana).
   * Una sola carpeta se escanea completa; una selección de archivos carga
   * únicamente esos archivos, sin expandir la carpeta que los contiene.
   */
  const loadSource = useCallback(
    async (paths: string[], overrides?: SourceOverrides) => {
      const cleaned = paths.map((p) => cleanPath(p).trim()).filter(Boolean);
      if (cleaned.length === 0) return;
      const revision = ++sourceLoadRevisionRef.current;

      const filter = overrides?.filterMode ?? filterMode;
      const extsStr = overrides?.customExtensions ?? customExtensions;
      const subfolders = overrides?.includeSubfolders ?? includeSubfolders;
      const target = overrides?.targetType ?? targetType;

      setIsScanning(true);
      setError(null);
      try {
        const result = await renamerClient.loadSource(
          cleaned,
          filter,
          parseCustomExtensions(extsStr),
          subfolders,
          target
        );

        if (revision !== sourceLoadRevisionRef.current) return;
        const incoming = overrides?.preserveOrder ? orderSourceSelection(result.items, cleaned) : result.items;
        const merged = mergeSourceSelection(loadedItemsRef.current, incoming, selectedPathsRef.current, !!overrides?.append);
        loadedItemsRef.current = merged.items;
        selectedPathsRef.current = merged.selected;
        setItems(merged.items);
        setSelectedPaths(merged.selected);
        setCurrentFolder(overrides?.append ? `${merged.items.length} elementos en la selección acumulada` : result.display);
        // Una única carpeta vuelve al modo carpeta; una selección queda anclada a sus archivos.
        setSourcePaths(overrides?.append ? merged.items.map((item) => item.path) : result.kind === "files" ? cleaned : null);
      } catch (err) {
        if (revision !== sourceLoadRevisionRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
        if (!overrides?.append) {
          setItems([]);
          setSelectedPaths(new Set());
        }
      } finally {
        if (revision === sourceLoadRevisionRef.current) setIsScanning(false);
      }
    },
    [customExtensions, filterMode, includeSubfolders, targetType]
  );

  /** Recarga el origen activo respetando el modo actual (carpeta o selección). */
  const reloadCurrentSource = useCallback(() => {
    if (sourcePaths && sourcePaths.length > 0) {
      void loadSource(sourcePaths, { preserveOrder: true });
    } else if (currentFolder) {
      loadFolder(currentFolder);
    }
  }, [currentFolder, loadFolder, loadSource, sourcePaths]);

  const refreshFolder = useCallback(() => {
    reloadCurrentSource();
  }, [reloadCurrentSource]);

  // Diálogo para seleccionar carpeta
  const pickFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Seleccionar Carpeta para Renombrado",
      });
      if (selected && typeof selected === "string") {
        loadFolder(selected);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [loadFolder]);

  // Reaccionar a cambios en filtros
  const handleFilterChange = useCallback(
    (newFilter: FilterMode) => {
      setFilterMode(newFilter);
      if (sourcePaths && sourcePaths.length > 0) {
        void loadSource(sourcePaths, { filterMode: newFilter, preserveOrder: true });
      } else if (currentFolder) {
        void scanFolderInternal(
          currentFolder,
          newFilter,
          customExtensions,
          includeSubfolders,
          targetType
        );
      }
    },
    [
      currentFolder,
      customExtensions,
      includeSubfolders,
      loadSource,
      scanFolderInternal,
      sourcePaths,
      targetType,
    ]
  );

  const handleSubfoldersToggle = useCallback(
    (enabled: boolean) => {
      setIncludeSubfolders(enabled);
      if (sourcePaths && sourcePaths.length > 0) {
        void loadSource(sourcePaths, { includeSubfolders: enabled, preserveOrder: true });
      } else if (currentFolder) {
        void scanFolderInternal(
          currentFolder,
          filterMode,
          customExtensions,
          enabled,
          targetType
        );
      }
    },
    [
      currentFolder,
      customExtensions,
      filterMode,
      loadSource,
      scanFolderInternal,
      sourcePaths,
      targetType,
    ]
  );

  const handleTargetTypeChange = useCallback(
    (target: TargetType) => {
      setTargetType(target);
      if (sourcePaths && sourcePaths.length > 0) {
        void loadSource(sourcePaths, { targetType: target, preserveOrder: true });
      } else if (currentFolder) {
        void scanFolderInternal(
          currentFolder,
          filterMode,
          customExtensions,
          includeSubfolders,
          target
        );
      }
    },
    [
      currentFolder,
      customExtensions,
      filterMode,
      includeSubfolders,
      loadSource,
      scanFolderInternal,
      sourcePaths,
    ]
  );

  // Gestión de pasos de regla
  const addStep = useCallback((type: RuleType) => {
    const id = `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let title = "Nuevo Paso";
    let config: any = {};

    switch (type) {
      case "template":
        title = "Reemplazar con Plantilla";
        config = {
          pattern: "",
          counterStart: 1,
          counterPadding: 2,
          counterStep: 1,
        };
        break;
      case "replace":
        title = "Buscar y Reemplazar";
        config = {
          find: "",
          replace: "",
          matchCase: false,
          useRegex: false,
          replaceAll: true,
        };
        break;
      case "add":
        title = "Añadir Texto (Prefijo / Sufijo)";
        config = {
          text: "",
          position: "end",
          customIndex: 0,
        };
        break;
      case "counter":
        title = "Añadir Contador / Numeración";
        config = {
          start: 1,
          step: 1,
          padding: 2,
          position: "end",
          prefix: " - ",
          suffix: "",
        };
        break;
      case "case":
        title = "Mayúsculas / Minúsculas";
        config = {
          mode: "titlecase",
          target: "name",
        };
        break;
      case "remove":
        title = "Eliminar / Recortar";
        config = {
          removeType: "first_n",
          count: 1,
          customText: "",
        };
        break;
      case "extension":
        title = "Gestionar Extensión";
        config = {
          mode: "lowercase",
          customExt: "",
        };
        break;
    }

    setSteps((prev) => [...prev, { id, title, enabled: true, type, config }]);
  }, []);

  const updateStep = useCallback((id: string, newConfig: any) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, config: { ...s.config, ...newConfig } } : s))
    );
  }, []);

  const toggleStep = useCallback((id: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  }, []);

  const removeStep = useCallback((id: string) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const moveStep = useCallback((index: number, direction: -1 | 1) => {
    setSteps((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  }, []);

  const loadPreset = useCallback((preset: PresetTemplate) => {
    setSteps(
      preset.steps.map((s) => ({
        ...s,
        id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      }))
    );
  }, []);

  // Selección de archivos
  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedPaths(new Set(items.map((it) => it.path)));
      } else {
        setSelectedPaths(new Set());
      }
    },
    [items]
  );

  const toggleSelectItem = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Cálculo de vista previa en tiempo real
  const basePreviewItems: PreviewItem[] = useMemo(() => {
    return computeRenamingPreview(items, steps, selectedPaths);
  }, [items, steps, selectedPaths]);

  const previewRequest = useMemo(() => ({ items, steps, selectedPaths, lastResult }),
    [items, steps, selectedPaths, lastResult]);
  const [validation, setValidation] = useState<{
    request: typeof previewRequest | null; items: PreviewItem[]; error?: string;
  }>({ request: null, items: [] });
  const isCheckingConflicts = validation.request !== previewRequest;

  useEffect(() => {
    let disposed = false;
    const timer = window.setTimeout(() => {
      const check = async () => {
        const { items, steps, selectedPaths } = previewRequest;
        const occupied = items.length ? await renamerClient.occupiedPaths(items.map((item) => item.path)) : [];
        if (disposed) return;
        const preview = computeRenamingPreview(items, steps, selectedPaths, new Set(occupied));
        const operations = preview.filter((p) => p.selected && p.status === "ready").map((p) => ({
          oldPath: p.original.path, newPath: p.newPath, originalName: p.original.name, newName: p.newName,
        }));
        const conflicts = operations.length ? await renamerClient.validateBatch(operations) : [];
        if (disposed) return;
        const messages = new Map(conflicts.map((c) => [c.oldPath, c.message]));
        setValidation({ request: previewRequest, items: preview.map((p) => {
          const message = messages.get(p.original.path);
          return message ? { ...p, status: "conflict", error: message } : p;
        }) });
      };
      void check().catch((err) => {
        if (!disposed) setValidation({ request: previewRequest, items: [], error: String(err) });
      });
    }, 180);
    return () => { disposed = true; window.clearTimeout(timer); };
  }, [previewRequest]);

  const previewItems = validation.request === previewRequest && !validation.error
    ? validation.items : basePreviewItems;
  const skippedNumberCount = previewItems.reduce((total, item) => total + (item.skippedNumbers ?? 0), 0);

  // Elementos filtrados por la búsqueda rápida de la tabla
  const filteredPreviewItems = useMemo(() => {
    if (!searchQuery.trim()) return previewItems;
    const q = searchQuery.toLowerCase();
    return previewItems.filter(
      (p) =>
        p.original.name.toLowerCase().includes(q) ||
        p.newName.toLowerCase().includes(q)
    );
  }, [previewItems, searchQuery]);

  // Métricas
  const totalCount = items.length;
  const selectedCount = previewItems.filter((p) => p.selected).length;
  const readyCount = previewItems.filter((p) => p.status === "ready").length;
  const conflictCount = previewItems.filter((p) => p.status === "conflict").length;
  const invalidCount = previewItems.filter((p) => p.status === "invalid").length;

  // Ejecución de renombrado por lotes
  const executeRename = useCallback(async () => {
    if (isCheckingConflicts || validation.error || conflictCount > 0 || invalidCount > 0) {
      setError(validation.error ?? "Resuelve los conflictos antes de renombrar.");
      return;
    }
    const readyOps: RenameOperation[] = previewItems
      .filter((p) => p.selected && p.status === "ready")
      .map((p) => ({
        oldPath: p.original.path,
        newPath: p.newPath,
        originalName: p.original.name,
        newName: p.newName,
      }));

    if (readyOps.length === 0) {
      setError("No hay archivos listos para renombrar.");
      return;
    }

    setIsExecuting(true);
    setError(null);
    try {
      const result = await renamerClient.executeBatch(readyOps);
      setLastResult(result);
      setCanUndo(result.canUndo);
      if (sourcePaths && sourcePaths.length > 0) {
        // En modo selección hay que seguir las rutas nuevas de los archivos renombrados.
        const remap = new Map(result.operations.map((op) => [op.oldPath, op.newPath]));
        await loadSource(sourcePaths.map((p) => remap.get(p) ?? p), { preserveOrder: true });
      } else if (currentFolder) {
        loadFolder(currentFolder);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecuting(false);
    }
  }, [currentFolder, loadFolder, loadSource, previewItems, sourcePaths, isCheckingConflicts, validation.error, conflictCount, invalidCount]);

  // Ejecutar deshacer
  const executeUndo = useCallback(async () => {
    setIsExecuting(true);
    setError(null);
    try {
      const result = await renamerClient.undoBatch();
      setLastResult(result);
      setCanUndo(result.canUndo);
      if (sourcePaths && sourcePaths.length > 0) {
        // Tras deshacer, las rutas vuelven a ser las originales.
        const remap = new Map(result.operations.map((op) => [op.oldPath, op.newPath]));
        await loadSource(sourcePaths.map((p) => remap.get(p) ?? p), { preserveOrder: true });
      } else if (currentFolder) {
        loadFolder(currentFolder);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecuting(false);
    }
  }, [currentFolder, loadFolder, loadSource, sourcePaths]);

  // Drag & drop nativo de Tauri v2 (soporte universal de carpetas y archivos)
  useEffect(() => {
    const unlistens: UnlistenFn[] = [];
    let isCancelled = false;

    const handleDrop = (paths: string[], append: boolean, channel: "native" | "webview") => {
      setIsDraggingOver(false);
      if (!paths || paths.length === 0) return;
      const cleaned = paths.map((p) => cleanPath(p).trim()).filter(Boolean);
      if (cleaned.length === 0) return;
      // Se envía el conjunto completo: el backend decide si es una carpeta o una
      // selección de archivos. Antes solo se tomaba paths[0] y se cargaba su carpeta.
      void enqueueDrop(cleaned, channel, async () => {
        if (!isCancelled) await loadSource(cleaned, { append });
      });
    };

    // 1. Canal OLE propio de Prisma para Windows/WebView2
    listen<{ paths?: string[]; shiftKey?: boolean }>("prisma://native-drag-drop", (event) => {
      if (isCancelled) return;
      if (event.payload?.paths && event.payload.paths.length > 0) {
        handleDrop(event.payload.paths, event.payload.shiftKey ?? shiftPressedRef.current, "native");
      } else {
        setIsDraggingOver(false);
      }
    })
      .then((unlisten) => {
        if (isCancelled) unlisten();
        else unlistens.push(unlisten);
      })
      .catch(() => {});

    listen<{ shiftKey?: boolean }>("prisma://native-drag-enter", ({ payload }) => {
      if (!isCancelled) {
        setIsDraggingOver(true);
        setIsAppendingDrop(!!payload?.shiftKey);
      }
    })
      .then((unlisten) => {
        if (isCancelled) unlisten();
        else unlistens.push(unlisten);
      })
      .catch(() => {});

    listen<{ shiftKey?: boolean }>("prisma://native-drag-over", ({ payload }) => {
      if (!isCancelled) setIsAppendingDrop(!!payload?.shiftKey);
    }).then((unlisten) => {
      if (isCancelled) unlisten(); else unlistens.push(unlisten);
    }).catch(() => {});

    listen("prisma://native-drag-leave", () => {
      if (!isCancelled) setIsDraggingOver(false);
    })
      .then((unlisten) => {
        if (isCancelled) unlisten();
        else unlistens.push(unlisten);
      })
      .catch(() => {});

    // 2. Webview onDragDropEvent
    try {
      const webview = getCurrentWebview();
      webview
        .onDragDropEvent((event) => {
          if (isCancelled) return;
          if (event.payload.type === "over" || event.payload.type === "enter") {
            setIsDraggingOver(true);
          } else if (event.payload.type === "drop") {
            if (event.payload.paths && event.payload.paths.length > 0) {
              handleDrop(event.payload.paths, shiftPressedRef.current, "webview");
            } else {
              setIsDraggingOver(false);
            }
          } else {
            setIsDraggingOver(false);
          }
        })
        .then((unlisten) => {
          if (isCancelled) unlisten();
          else unlistens.push(unlisten);
        })
        .catch(() => {});
    } catch {}

    return () => {
      isCancelled = true;
      for (const u of unlistens) {
        try {
          u();
        } catch {}
      }
    };
  }, [loadSource, enqueueDrop]);

  // Listener para recibir apertura directa de carpeta desde menús contextuales
  useEffect(() => {
    const handleExternalLoad = (e: Event) => {
      const customEvent = e as CustomEvent<{ folderPath?: string; filterMode?: FilterMode }>;
      if (customEvent.detail?.folderPath) {
        if (customEvent.detail.filterMode) {
          setFilterMode(customEvent.detail.filterMode);
        }
        loadFolder(customEvent.detail.folderPath);
      }
    };
    window.addEventListener("prisma-renamer-load-folder", handleExternalLoad);
    return () => window.removeEventListener("prisma-renamer-load-folder", handleExternalLoad);
  }, [loadFolder]);

  return {
    currentFolder,
    sourcePaths,
    items,
    previewItems,
    filteredPreviewItems,
    steps,
    filterMode,
    customExtensions,
    includeSubfolders,
    targetType,
    selectedPaths,
    searchQuery,
    isScanning,
    isExecuting,
    isCheckingConflicts,
    skippedNumberCount,
    conflictCheckError: validation.error,
    canUndo,
    isDraggingOver,
    isAppendingDrop,
    lastResult,
    error,
    totalCount,
    selectedCount,
    readyCount,
    conflictCount,
    invalidCount,
    setSearchQuery,
    setCustomExtensions,
    pickFolder,
    loadFolder,
    loadSource,
    refreshFolder,
    handleFilterChange,
    handleSubfoldersToggle,
    handleTargetTypeChange,
    addStep,
    updateStep,
    toggleStep,
    removeStep,
    moveStep,
    loadPreset,
    toggleSelectAll,
    toggleSelectItem,
    executeRename,
    executeUndo,
    clearError: () => setError(null),
    clearResult: () => setLastResult(null),
  };
}
