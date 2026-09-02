import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { computeRenamingPreview } from "../model/renamerEngine";
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

export function useRenamer() {
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
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

  // Escanear carpeta
  const scanFolderInternal = useCallback(
    async (
      folderPath: string,
      filter: FilterMode,
      extsStr: string,
      subfolders: boolean,
      target: "files" | "folders" | "both"
    ) => {
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

        setItems(scanned);
        // Por defecto, seleccionar todos los elementos encontrados
        setSelectedPaths(new Set(scanned.map((it) => it.path)));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setItems([]);
        setSelectedPaths(new Set());
      } finally {
        setIsScanning(false);
      }
    },
    []
  );

  const loadFolder = useCallback(
    (folderPath: string) => {
      setCurrentFolder(folderPath);
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

  const refreshFolder = useCallback(() => {
    if (currentFolder) {
      loadFolder(currentFolder);
    }
  }, [currentFolder, loadFolder]);

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
      if (currentFolder) {
        void scanFolderInternal(
          currentFolder,
          newFilter,
          customExtensions,
          includeSubfolders,
          targetType
        );
      }
    },
    [currentFolder, customExtensions, includeSubfolders, scanFolderInternal, targetType]
  );

  const handleSubfoldersToggle = useCallback(
    (enabled: boolean) => {
      setIncludeSubfolders(enabled);
      if (currentFolder) {
        void scanFolderInternal(
          currentFolder,
          filterMode,
          customExtensions,
          enabled,
          targetType
        );
      }
    },
    [currentFolder, customExtensions, filterMode, scanFolderInternal, targetType]
  );

  const handleTargetTypeChange = useCallback(
    (target: "files" | "folders" | "both") => {
      setTargetType(target);
      if (currentFolder) {
        void scanFolderInternal(
          currentFolder,
          filterMode,
          customExtensions,
          includeSubfolders,
          target
        );
      }
    },
    [currentFolder, customExtensions, filterMode, includeSubfolders, scanFolderInternal]
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
  const previewItems: PreviewItem[] = useMemo(() => {
    return computeRenamingPreview(items, steps, selectedPaths);
  }, [items, steps, selectedPaths]);

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
      if (currentFolder) {
        loadFolder(currentFolder);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecuting(false);
    }
  }, [currentFolder, loadFolder, previewItems]);

  // Ejecutar deshacer
  const executeUndo = useCallback(async () => {
    setIsExecuting(true);
    setError(null);
    try {
      const result = await renamerClient.undoBatch();
      setLastResult(result);
      setCanUndo(false);
      if (currentFolder) {
        loadFolder(currentFolder);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecuting(false);
    }
  }, [currentFolder, loadFolder]);

  // Drag & drop nativo de Tauri v2
  useEffect(() => {
    let unlistenPromise: Promise<() => void> | undefined;

    try {
      const appWindow = getCurrentWebviewWindow();
      unlistenPromise = appWindow.onDragDropEvent((event) => {
        if (event.payload.type === "over" || event.payload.type === "enter") {
          setIsDraggingOver(true);
        } else if (event.payload.type === "drop") {
          setIsDraggingOver(false);
          const droppedPaths = event.payload.paths;
          if (droppedPaths && droppedPaths.length > 0) {
            loadFolder(droppedPaths[0]);
          }
        } else {
          setIsDraggingOver(false);
        }
      });
    } catch (err) {
      console.warn("No se pudo iniciar listener de DragDrop en Renombrador:", err);
    }

    return () => {
      if (unlistenPromise) {
        unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
      }
    };
  }, [loadFolder]);

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
    canUndo,
    isDraggingOver,
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
