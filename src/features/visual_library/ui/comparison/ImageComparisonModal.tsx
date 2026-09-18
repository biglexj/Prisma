import { useState, useRef, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Icon } from "../../../../shared/ui/Icon";
import { cleanPath, toSafeAssetUrl } from "../../../../shared/mediaTree";
import { VisualThumbnail } from "../VisualThumbnail";
import type { VisualLibraryItem } from "../../model/types";
import type { ComparisonMode, ComparisonImageSlot } from "./types";
import {
  isImagePath,
  createVisualItemFromPath,
  SUPPORTED_IMAGE_EXTENSIONS,
} from "./types";
import { ImageComparisonSelector } from "./ImageComparisonSelector";
import { ImageComparisonEmptySlot } from "./ImageComparisonEmptySlot";
import { ImageComparisonFilmstrip } from "./ImageComparisonFilmstrip";
import { ImageComparisonCurtain } from "./ImageComparisonCurtain";
import "./image-comparison.css";

interface ImageComparisonModalProps {
  initialItem?: VisualLibraryItem;
  secondItem?: VisualLibraryItem;
  itemsList?: VisualLibraryItem[];
  onClose: () => void;
  embedded?: boolean;
}

export function ImageComparisonModal({
  initialItem,
  secondItem,
  itemsList = [],
  onClose,
  embedded = false,
}: ImageComparisonModalProps) {
  const [mode, setMode] = useState<ComparisonMode>("split");
  const [syncZoom, setSyncZoom] = useState(true);
  const [splitOrientation, setSplitOrientation] = useState<"horizontal" | "vertical">("horizontal");
  const [curtainPosition, setCurtainPosition] = useState(50); // 0 to 100%
  const [activeFlickIndex, setActiveFlickIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectorTargetSlotId, setSelectorTargetSlotId] = useState<string | null>(null);
  const [isAddingNewSlot, setIsAddingNewSlot] = useState(false);
  const [activeSlotAId, setActiveSlotAId] = useState<string>("slot-0");
  const [activeSlotBId, setActiveSlotBId] = useState<string>("slot-1");
  const [showFilmstrip, setShowFilmstrip] = useState(true);

  // Estados de Drag & Drop nativo
  const [isNativeDragging, setIsNativeDragging] = useState(false);
  const [hoveredNativeDropZone, setHoveredNativeDropZone] = useState<string | null>(null);
  const hoveredNativeDropZoneRef = useRef<string | null>(null);

  // Initialize slots (vacío si no hay initialItem, para modo herramienta independiente)
  const [slots, setSlots] = useState<ComparisonImageSlot[]>(() => {
    const list: ComparisonImageSlot[] = [];
    if (initialItem) {
      list.push({
        id: "slot-0",
        item: initialItem,
        zoom: 1,
        pan: { x: 0, y: 0 },
      });
    }

    if (secondItem && secondItem.path !== initialItem?.path) {
      list.push({
        id: "slot-1",
        item: secondItem,
        zoom: 1,
        pan: { x: 0, y: 0 },
      });
    }

    return list;
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const curtainRef = useRef<HTMLDivElement | null>(null);
  const isDraggingCurtainRef = useRef(false);

  // Dragging state for pan
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPansRef = useRef<Record<string, { x: number; y: number }>>({});

  // Reset transforms
  const handleResetZoom = useCallback(() => {
    setSlots((prev) =>
      prev.map((s) => ({
        ...s,
        zoom: 1,
        pan: { x: 0, y: 0 },
      })),
    );
  }, []);

  // Swap active primary and secondary comparison images
  const handleSwapPrimary = useCallback(() => {
    setActiveSlotAId((prevA) => {
      setActiveSlotBId(prevA);
      return activeSlotBId;
    });
    setSlots((prev) => {
      if (prev.length < 2) return prev;
      const next = [...prev];
      const temp = next[0];
      next[0] = next[1];
      next[1] = temp;
      return next;
    });
  }, [activeSlotBId]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // Wheel zoom handler con punto focal exacto en la posición del cursor / lápiz óptico
  const handleSlotWheel = useCallback(
    (e: React.WheelEvent, slotId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.18 : 0.84;

      const rect = e.currentTarget.getBoundingClientRect();
      const mouseRelX = e.clientX - (rect.left + rect.width / 2);
      const mouseRelY = e.clientY - (rect.top + rect.height / 2);

      setSlots((prev) =>
        prev.map((s) => {
          if (!syncZoom && s.id !== slotId) return s;
          const oldZoom = s.zoom;
          const nextZoom = Math.max(0.5, Math.min(10.0, oldZoom * factor));

          if (nextZoom <= 1.02) {
            return { ...s, zoom: 1, pan: { x: 0, y: 0 } };
          }

          const ratio = nextZoom / oldZoom;
          // Fórmula de zoom focal: P_new = M_rel - ratio * (M_rel - P_old)
          const newPanX = mouseRelX - ratio * (mouseRelX - s.pan.x);
          const newPanY = mouseRelY - ratio * (mouseRelY - s.pan.y);

          return {
            ...s,
            zoom: Number(nextZoom.toFixed(2)),
            pan: {
              x: Math.round(newPanX),
              y: Math.round(newPanY),
            },
          };
        }),
      );
    },
    [syncZoom],
  );

  // Pan start con soporte para ratón, lápiz de tableta gráfica (Huion/Wacom/XP-Pen) y gestos táctiles
  const handlePanStart = (e: React.PointerEvent, slotId: string) => {
    if (e.button !== 0 && e.buttons !== 1) return;
    const currentSlot = slots.find((s) => s.id === slotId);
    if (!currentSlot || currentSlot.zoom <= 1) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    setDraggingSlotId(slotId);
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    const pans: Record<string, { x: number; y: number }> = {};
    slots.forEach((s) => {
      pans[s.id] = { ...s.pan };
    });
    initialPansRef.current = pans;
  };

  // Listener global continuo de movimiento de puntero (tableta gráfica y mouse sin interrupciones)
  useEffect(() => {
    if (!draggingSlotId) return;

    const onPointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - dragStartRef.current.x;
      const dy = ev.clientY - dragStartRef.current.y;

      setSlots((prev) =>
        prev.map((s) => {
          if (!syncZoom && s.id !== draggingSlotId) return s;
          const initial = initialPansRef.current[s.id] || { x: 0, y: 0 };
          return {
            ...s,
            pan: {
              x: initial.x + dx,
              y: initial.y + dy,
            },
          };
        }),
      );
    };

    const onPointerUp = () => {
      setDraggingSlotId(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [draggingSlotId, syncZoom]);

  // Curtain slider drag handlers con soporte universal PointerEvent
  const handleCurtainMove = useCallback((clientX: number) => {
    if (!curtainRef.current) return;
    const rect = curtainRef.current.getBoundingClientRect();
    const pos = ((clientX - rect.left) / rect.width) * 100;
    setCurtainPosition(Math.max(0, Math.min(100, pos)));
  }, []);

  const handleCurtainPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingCurtainRef.current = true;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    const onPointerMove = (ev: PointerEvent) => {
      if (isDraggingCurtainRef.current) {
        handleCurtainMove(ev.clientX);
      }
    };
    const onPointerUp = () => {
      isDraggingCurtainRef.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  // Slot replacement / addition
  const handleSelectSlotImage = (item: VisualLibraryItem) => {
    if (selectorTargetSlotId) {
      const exists = slots.some((s) => s.id === selectorTargetSlotId);
      if (exists) {
        setSlots((prev) =>
          prev.map((s) => (s.id === selectorTargetSlotId ? { ...s, item, zoom: 1, pan: { x: 0, y: 0 } } : s)),
        );
      } else {
        const newSlot: ComparisonImageSlot = {
          id: selectorTargetSlotId,
          item,
          zoom: 1,
          pan: { x: 0, y: 0 },
        };
        setSlots((prev) => [...prev, newSlot]);
      }
      if (selectorTargetSlotId === "slot-0") setActiveSlotAId("slot-0");
      if (selectorTargetSlotId === "slot-1") setActiveSlotBId("slot-1");
      setSelectorTargetSlotId(null);
    } else if (isAddingNewSlot || slots.length < 2) {
      if (slots.length >= 6) return;
      const newSlotId = slots.length === 0 ? "slot-0" : `slot-${Date.now()}`;
      const newSlot: ComparisonImageSlot = {
        id: newSlotId,
        item,
        zoom: 1,
        pan: { x: 0, y: 0 },
      };
      setSlots((prev) => [...prev, newSlot]);
      setIsAddingNewSlot(false);

      if (slots.length >= 2 && (mode === "split" || mode === "curtain")) {
        setMode("grid");
      }
      if (slots.length === 0) {
        setActiveSlotAId(newSlotId);
      } else {
        setActiveSlotBId(newSlotId);
      }
    }
  };

  const handleAssignImagePath = (filePath: string, targetSlotId?: string) => {
    const item = createVisualItemFromPath(filePath);
    if (targetSlotId) {
      setSlots((prev) => {
        const exists = prev.some((s) => s.id === targetSlotId);
        if (exists) {
          return prev.map((s) => (s.id === targetSlotId ? { ...s, item, zoom: 1, pan: { x: 0, y: 0 } } : s));
        }
        return [...prev, { id: targetSlotId, item, zoom: 1, pan: { x: 0, y: 0 } }];
      });
      if (targetSlotId === "slot-0") setActiveSlotAId("slot-0");
      if (targetSlotId === "slot-1") setActiveSlotBId("slot-1");
    } else if (slots.length === 0) {
      const newSlot: ComparisonImageSlot = { id: "slot-0", item, zoom: 1, pan: { x: 0, y: 0 } };
      setSlots([newSlot]);
      setActiveSlotAId("slot-0");
    } else if (slots.length === 1) {
      const newSlotId = `slot-${Date.now()}`;
      const newSlot: ComparisonImageSlot = { id: newSlotId, item, zoom: 1, pan: { x: 0, y: 0 } };
      setSlots((prev) => [...prev, newSlot]);
      setActiveSlotBId(newSlotId);
    } else {
      if (slots.length >= 6) return;
      const newSlotId = `slot-${Date.now()}`;
      const newSlot: ComparisonImageSlot = { id: newSlotId, item, zoom: 1, pan: { x: 0, y: 0 } };
      setSlots((prev) => [...prev, newSlot]);
      if (mode === "split" || mode === "curtain") {
        setMode("grid");
      }
      setActiveSlotBId(newSlotId);
    }
  };

  // Asignación por lotes para cuando el usuario arrastra 2 o más fotos a la vez
  const handleAssignMultipleImagePaths = useCallback((filePaths: string[], targetZone?: "slot-a" | "slot-b" | null) => {
    const validPaths = filePaths.filter(isImagePath);
    if (validPaths.length === 0) return;

    setSlots((prev) => {
      // 1. Si el comparador está completamente vacío:
      if (prev.length === 0) {
        if (validPaths.length === 1) {
          const slot0: ComparisonImageSlot = {
            id: "slot-0",
            item: createVisualItemFromPath(validPaths[0]),
            zoom: 1,
            pan: { x: 0, y: 0 },
          };
          setActiveSlotAId("slot-0");
          return [slot0];
        }

        // Si se traen 2 o más imágenes: una al Slot A y otra al Slot B (Lado a Lado)
        const slotAItem: ComparisonImageSlot = {
          id: "slot-0",
          item: createVisualItemFromPath(validPaths[0]),
          zoom: 1,
          pan: { x: 0, y: 0 },
        };
        const slotBItem: ComparisonImageSlot = {
          id: "slot-1",
          item: createVisualItemFromPath(validPaths[1]),
          zoom: 1,
          pan: { x: 0, y: 0 },
        };

        const extraSlots: ComparisonImageSlot[] = validPaths.slice(2, 6).map((p, idx) => ({
          id: `slot-extra-${Date.now()}-${idx}`,
          item: createVisualItemFromPath(p),
          zoom: 1,
          pan: { x: 0, y: 0 },
        }));

        setActiveSlotAId("slot-0");
        setActiveSlotBId("slot-1");
        if (validPaths.length > 2) {
          setMode("grid");
        } else {
          setMode("split");
        }
        return [slotAItem, slotBItem, ...extraSlots];
      }

      // 2. Si ya hay 1 sola imagen en la comparativa:
      if (prev.length === 1) {
        if (targetZone === "slot-a") {
          const updatedSlotA: ComparisonImageSlot = {
            ...prev[0],
            item: createVisualItemFromPath(validPaths[0]),
            zoom: 1,
            pan: { x: 0, y: 0 },
          };
          if (validPaths.length > 1) {
            const slotBItem: ComparisonImageSlot = {
              id: "slot-1",
              item: createVisualItemFromPath(validPaths[1]),
              zoom: 1,
              pan: { x: 0, y: 0 },
            };
            setActiveSlotBId("slot-1");
            return [updatedSlotA, slotBItem];
          }
          return [updatedSlotA];
        }

        // Si soltó en Slot B o en el lienzo general:
        const slotBItem: ComparisonImageSlot = {
          id: "slot-1",
          item: createVisualItemFromPath(validPaths[0]),
          zoom: 1,
          pan: { x: 0, y: 0 },
        };
        setActiveSlotBId("slot-1");

        const extraSlots: ComparisonImageSlot[] = validPaths.slice(1, 6 - 1).map((p, idx) => ({
          id: `slot-extra-${Date.now()}-${idx}`,
          item: createVisualItemFromPath(p),
          zoom: 1,
          pan: { x: 0, y: 0 },
        }));

        if (validPaths.length > 1) {
          setMode("grid");
        }
        return [...prev, slotBItem, ...extraSlots];
      }

      // 3. Si ya hay 2 o más imágenes:
      if (targetZone === "slot-a") {
        const slotAId = prev[0]?.id ?? "slot-0";
        const updated = prev.map((s) =>
          s.id === slotAId
            ? { ...s, item: createVisualItemFromPath(validPaths[0]), zoom: 1, pan: { x: 0, y: 0 } }
            : s,
        );
        if (validPaths.length > 1 && prev.length > 1) {
          const slotBId = prev[1]?.id ?? "slot-1";
          return updated.map((s) =>
            s.id === slotBId
              ? { ...s, item: createVisualItemFromPath(validPaths[1]), zoom: 1, pan: { x: 0, y: 0 } }
              : s,
          );
        }
        return updated;
      }

      if (targetZone === "slot-b") {
        const slotBId = prev.length > 1 ? prev[1].id : "slot-1";
        return prev.map((s) =>
          s.id === slotBId
            ? { ...s, item: createVisualItemFromPath(validPaths[0]), zoom: 1, pan: { x: 0, y: 0 } }
            : s,
        );
      }

      // Soltado general / añadir imágenes (hasta 6)
      const currentCount = prev.length;
      const canAdd = Math.max(0, 6 - currentCount);
      const toAdd = validPaths.slice(0, canAdd);
      if (toAdd.length === 0) return prev;

      const newSlots: ComparisonImageSlot[] = toAdd.map((p, idx) => ({
        id: `slot-${Date.now()}-${idx}`,
        item: createVisualItemFromPath(p),
        zoom: 1,
        pan: { x: 0, y: 0 },
      }));

      setMode("grid");
      return [...prev, ...newSlots];
    });
  }, []);

  const handlePickExplorerForSlotA = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: "Imágenes", extensions: SUPPORTED_IMAGE_EXTENSIONS }],
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        handleAssignMultipleImagePaths(paths, "slot-a");
      }
    } catch {}
  };

  const handlePickExplorerForSlotB = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: "Imágenes", extensions: SUPPORTED_IMAGE_EXTENSIONS }],
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        handleAssignMultipleImagePaths(paths, "slot-b");
      }
    } catch {}
  };

  const handleRemoveSlot = (slotId: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== slotId));

    if (activeSlotAId === slotId) {
      const remaining = slots.filter((s) => s.id !== slotId && s.id !== activeSlotBId);
      if (remaining[0]) setActiveSlotAId(remaining[0].id);
    }
    if (activeSlotBId === slotId) {
      const remaining = slots.filter((s) => s.id !== slotId && s.id !== activeSlotAId);
      if (remaining[0]) setActiveSlotBId(remaining[0].id);
    }
  };

  const slotA = slots.find((s) => s.id === activeSlotAId) || slots[0] || undefined;
  const slotB =
    slots.find((s) => s.id === activeSlotBId && s.id !== slotA?.id) ||
    slots.find((s) => s.id !== slotA?.id) ||
    undefined;

  // Refs reactivos para listeners de soltado nativo
  const isAddingNewSlotRef = useRef(isAddingNewSlot);
  isAddingNewSlotRef.current = isAddingNewSlot;
  const selectorTargetSlotIdRef = useRef(selectorTargetSlotId);
  selectorTargetSlotIdRef.current = selectorTargetSlotId;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const slotARef = useRef(slotA);
  slotARef.current = slotA;
  const slotBRef = useRef(slotB);
  slotBRef.current = slotB;

  // Escucha nativa de Drag & Drop (WebView2 nativo de Tauri v2 y bus prisma://)
  useEffect(() => {
    const unlistens: UnlistenFn[] = [];
    let isCancelled = false;

    const handleDropPaths = (paths?: string[]) => {
      setIsNativeDragging(false);
      const zone = hoveredNativeDropZoneRef.current;
      setHoveredNativeDropZone(null);
      hoveredNativeDropZoneRef.current = null;

      if (!paths || paths.length === 0) return;
      const validPaths = paths.filter(isImagePath);
      if (validPaths.length === 0) return;

      if (isAddingNewSlotRef.current) {
        handleAssignMultipleImagePaths(validPaths);
        setIsAddingNewSlot(false);
        return;
      }
      if (selectorTargetSlotIdRef.current) {
        handleAssignImagePath(validPaths[0], selectorTargetSlotIdRef.current);
        if (validPaths.length > 1) {
          handleAssignMultipleImagePaths(validPaths.slice(1));
        }
        setSelectorTargetSlotId(null);
        return;
      }

      handleAssignMultipleImagePaths(validPaths, zone as "slot-a" | "slot-b" | null);
    };

    const handleUpdateDropPosition = (position?: { x: number; y: number }) => {
      setIsNativeDragging(true);
      if (position) {
        const dpr = window.devicePixelRatio || 1;
        const clientX = position.x / dpr;
        const clientY = position.y / dpr;
        const el = document.elementFromPoint(clientX, clientY);

        if (el) {
          const dropTarget = el.closest("[data-drop-zone]");
          if (dropTarget) {
            const zone = dropTarget.getAttribute("data-drop-zone");
            setHoveredNativeDropZone(zone);
            hoveredNativeDropZoneRef.current = zone;
            return;
          }
        }

        const midX = window.innerWidth / 2;
        const zone = clientX < midX ? "slot-a" : "slot-b";
        setHoveredNativeDropZone(zone);
        hoveredNativeDropZoneRef.current = zone;
      }
    };

    // 1. Integración directa con WebView2 (archivos arrastrados desde el Explorador de Windows)
    try {
      const webview = getCurrentWebview();
      webview.onDragDropEvent((event) => {
        if (isCancelled) return;
        if (event.payload.type === "enter" || event.payload.type === "over") {
          handleUpdateDropPosition(event.payload.position);
        } else if (event.payload.type === "drop") {
          handleDropPaths(event.payload.paths);
        } else if (event.payload.type === "leave") {
          setIsNativeDragging(false);
          setHoveredNativeDropZone(null);
          hoveredNativeDropZoneRef.current = null;
        }
      }).then((u) => {
        if (isCancelled) u();
        else unlistens.push(u);
      }).catch(() => {});
    } catch {}

    // 2. Bus interno prisma://
    listen<{ paths?: string[]; position?: { x: number; y: number } }>("prisma://native-drag-drop", (event) => {
      if (!isCancelled) handleDropPaths(event.payload?.paths);
    }).then((u) => (isCancelled ? u() : unlistens.push(u))).catch(() => {});

    listen("prisma://native-drag-enter", () => {
      if (!isCancelled) setIsNativeDragging(true);
    }).then((u) => (isCancelled ? u() : unlistens.push(u))).catch(() => {});

    listen("prisma://native-drag-leave", () => {
      if (!isCancelled) {
        setIsNativeDragging(false);
        setHoveredNativeDropZone(null);
        hoveredNativeDropZoneRef.current = null;
      }
    }).then((u) => (isCancelled ? u() : unlistens.push(u))).catch(() => {});

    listen<{ position?: { x: number; y: number } }>("prisma://native-drag-over", (event) => {
      if (!isCancelled) handleUpdateDropPosition(event.payload?.position);
    }).then((u) => (isCancelled ? u() : unlistens.push(u))).catch(() => {});

    return () => {
      isCancelled = true;
      unlistens.forEach((u) => u());
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectorTargetSlotId || isAddingNewSlot) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "1") {
        setMode("split");
      } else if (e.key === "2") {
        if (slots.length >= 2) setMode("curtain");
      } else if (e.key === "3") {
        setMode("grid");
      } else if (e.key === "4") {
        setMode("flick");
      } else if (e.key.toLowerCase() === "s" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleSwapPrimary();
      } else if (e.key === " " && mode === "flick") {
        e.preventDefault();
        setActiveFlickIndex((prev) => (prev + 1) % slots.length);
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleResetZoom();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectorTargetSlotId, isAddingNewSlot, mode, slots.length, onClose, handleSwapPrimary, toggleFullscreen, handleResetZoom]);

  return (
    <div
      ref={containerRef}
      className={`img-compare-modal-root ${isFullscreen ? "is-fullscreen" : ""} ${embedded ? "is-embedded" : ""}`}
    >
      {/* Top Action Bar */}
      <header className="img-compare-top-bar" onClick={(e) => e.stopPropagation()}>
        <div className="img-compare-top-left">
          <button
            type="button"
            className="img-compare-btn is-icon"
            onClick={onClose}
            title={embedded ? "Volver al Inicio" : "Volver al visor (Esc)"}
          >
            <Icon name="arrow-left" />
          </button>
          <div className="img-compare-badge-title">
            <Icon name="compare" />
            <span>Comparador ({slots.length} foto{slots.length === 1 ? "" : "s"})</span>
          </div>

          {/* Mode Switcher */}
          <div className="img-compare-mode-pills">
            <button
              type="button"
              className={`img-compare-pill ${mode === "split" ? "is-active" : ""}`}
              onClick={() => setMode("split")}
              title="Lado a lado (1)"
            >
              <Icon name="columns" />
              <span>Lado a lado</span>
            </button>
            <button
              type="button"
              className={`img-compare-pill ${mode === "curtain" ? "is-active" : ""}`}
              onClick={() => {
                if (slots.length < 2) {
                  setIsAddingNewSlot(true);
                  return;
                }
                setMode("curtain");
              }}
              title={slots.length < 2 ? "Añade una segunda foto para usar cortinilla (2)" : "Cortinilla interactiva antes/después (2)"}
            >
              <Icon name="split" />
              <span>Cortinilla</span>
            </button>
            <button
              type="button"
              className={`img-compare-pill ${mode === "grid" ? "is-active" : ""}`}
              onClick={() => setMode("grid")}
              title="Cuadrícula multi-imagen (3)"
            >
              <Icon name="grid" />
              <span>Cuadrícula</span>
            </button>
            <button
              type="button"
              className={`img-compare-pill ${mode === "flick" ? "is-active" : ""}`}
              onClick={() => {
                if (slots.length < 2) {
                  setIsAddingNewSlot(true);
                  return;
                }
                setMode("flick");
              }}
              title={slots.length < 2 ? "Añade una segunda foto para alternar A/B (4)" : "Alternar rápido A/B (4)"}
            >
              <Icon name="sparkles" />
              <span>Alternar A/B</span>
            </button>
          </div>
        </div>

        <div className="img-compare-top-right">
          {mode === "split" && (
            <button
              type="button"
              className="img-compare-btn"
              onClick={() =>
                setSplitOrientation((prev) =>
                  prev === "horizontal" ? "vertical" : "horizontal",
                )
              }
              title="Alternar orientación vertical / horizontal"
            >
              <Icon name="aspect-ratio" />
              <span>{splitOrientation === "horizontal" ? "Vertical" : "Horizontal"}</span>
            </button>
          )}

          <button
            type="button"
            className={`img-compare-btn ${syncZoom ? "is-active" : ""}`}
            onClick={() => setSyncZoom((prev) => !prev)}
            title={syncZoom ? "Zoom y desplazamiento sincronizado activo" : "Activar zoom sincronizado"}
          >
            <Icon name="link" />
            <span>Sincronizar Zoom</span>
          </button>

          <button
            type="button"
            className="img-compare-btn"
            onClick={handleSwapPrimary}
            title="Intercambiar fotos A ↔ B (S)"
          >
            <Icon name="shuffle" />
            <span>Intercambiar</span>
          </button>

          <button
            type="button"
            className="img-compare-btn"
            onClick={handleResetZoom}
            title="Restablecer zoom normal (R)"
          >
            <Icon name="fit-screen" />
            <span>100%</span>
          </button>

          {slots.length < 6 && (
            <button
              type="button"
              className="img-compare-btn is-accent"
              onClick={() => setIsAddingNewSlot(true)}
              title="Añadir otra imagen a la comparativa (hasta 6 imágenes)"
            >
              <Icon name="plus" />
              <span>Añadir foto</span>
            </button>
          )}

          <button
            type="button"
            className="img-compare-btn is-icon"
            onClick={toggleFullscreen}
            title="Pantalla completa (F)"
          >
            <Icon name={isFullscreen ? "fullscreen-exit" : "fullscreen"} />
          </button>

          <button
            type="button"
            className="img-compare-btn is-icon"
            onClick={onClose}
            title="Cerrar comparativa (Esc)"
          >
            <Icon name="close" />
          </button>
        </div>
      </header>

      {/* Main Stage */}
      <main className="img-compare-stage">
        {/* ── MODE 1: SPLIT (Side-by-Side) ── */}
        {mode === "split" && (
          <div className={`img-compare-split-view is-${splitOrientation}`}>
            {/* Panel A */}
            {slotA ? (
              <div
                className={`img-compare-viewport ${hoveredNativeDropZone === "slot-a" ? "is-drag-over" : ""}`}
                data-drop-zone="slot-a"
                onWheel={(e) => handleSlotWheel(e, slotA.id)}
                onPointerDown={(e) => handlePanStart(e, slotA.id)}
                style={{ cursor: slotA.zoom > 1 ? (draggingSlotId ? "grabbing" : "grab") : "default" }}
              >
                <div className="img-compare-slot-header">
                  <span className="img-compare-slot-tag is-a">Imagen A (Base)</span>
                  <span className="img-compare-slot-title" title={slotA.item.path}>
                    {slotA.item.title}
                  </span>
                  {slotA.width && slotA.height && (
                    <span className="img-compare-dims-pill">
                      {slotA.width} × {slotA.height} px
                    </span>
                  )}
                  <button
                    type="button"
                    className="img-compare-slot-change-btn"
                    onClick={() => setSelectorTargetSlotId(slotA.id)}
                    title="Cambiar imagen A"
                  >
                    <Icon name="edit" />
                    <span>Cambiar</span>
                  </button>
                  {slots.length > 1 && (
                    <button
                      type="button"
                      className="img-compare-slot-remove-btn"
                      onClick={() => handleRemoveSlot(slotA.id)}
                      title="Quitar imagen A"
                    >
                      <Icon name="close" />
                    </button>
                  )}
                </div>

                <div
                  className="img-compare-layer"
                  style={{
                    transform: `translate(${slotA.pan.x}px, ${slotA.pan.y}px) scale(${slotA.zoom})`,
                    transition: draggingSlotId ? "none" : "transform 0.1s ease-out",
                  }}
                >
                  <img
                    src={toSafeAssetUrl(slotA.item.path)}
                    alt={slotA.item.title}
                    draggable={false}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth && !slotA.width) {
                        setSlots((prev) =>
                          prev.map((s) =>
                            s.id === slotA.id
                              ? { ...s, width: img.naturalWidth, height: img.naturalHeight }
                              : s,
                          ),
                        );
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              <ImageComparisonEmptySlot
                dropZone="slot-a"
                tagLabel="Imagen A (Base)"
                onPickLibrary={() => setIsAddingNewSlot(true)}
                onPickExplorer={handlePickExplorerForSlotA}
                onDropFile={(path) => handleAssignMultipleImagePaths([path], "slot-a")}
                onDropFiles={(paths) => handleAssignMultipleImagePaths(paths, "slot-a")}
                isNativeDragOver={hoveredNativeDropZone === "slot-a" || isNativeDragging}
              />
            )}

            <div className="img-compare-split-divider" />

            {/* Panel B */}
            {slotB ? (
              <div
                className={`img-compare-viewport ${hoveredNativeDropZone === "slot-b" ? "is-drag-over" : ""}`}
                data-drop-zone="slot-b"
                onWheel={(e) => handleSlotWheel(e, slotB.id)}
                onPointerDown={(e) => handlePanStart(e, slotB.id)}
                style={{ cursor: slotB.zoom > 1 ? (draggingSlotId ? "grabbing" : "grab") : "default" }}
              >
                <div className="img-compare-slot-header">
                  <span className="img-compare-slot-tag is-b">Imagen B</span>
                  <span className="img-compare-slot-title" title={slotB.item.path}>
                    {slotB.item.title}
                  </span>
                  {slotB.width && slotB.height && (
                    <span className="img-compare-dims-pill">
                      {slotB.width} × {slotB.height} px
                    </span>
                  )}
                  <button
                    type="button"
                    className="img-compare-slot-change-btn"
                    onClick={() => setSelectorTargetSlotId(slotB.id)}
                    title="Cambiar imagen B"
                  >
                    <Icon name="edit" />
                    <span>Cambiar</span>
                  </button>
                  {slots.length > 1 && (
                    <button
                      type="button"
                      className="img-compare-slot-remove-btn"
                      onClick={() => handleRemoveSlot(slotB.id)}
                      title="Quitar imagen B"
                    >
                      <Icon name="close" />
                    </button>
                  )}
                </div>

                <div
                  className="img-compare-layer"
                  style={{
                    transform: `translate(${slotB.pan.x}px, ${slotB.pan.y}px) scale(${slotB.zoom})`,
                    transition: draggingSlotId ? "none" : "transform 0.1s ease-out",
                  }}
                >
                  <img
                    src={toSafeAssetUrl(slotB.item.path)}
                    alt={slotB.item.title}
                    draggable={false}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth && !slotB.width) {
                        setSlots((prev) =>
                          prev.map((s) =>
                            s.id === slotB.id
                              ? { ...s, width: img.naturalWidth, height: img.naturalHeight }
                              : s,
                          ),
                        );
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              <ImageComparisonEmptySlot
                dropZone="slot-b"
                tagLabel="Imagen B (A Comparar)"
                onPickLibrary={() => setIsAddingNewSlot(true)}
                onPickExplorer={handlePickExplorerForSlotB}
                onDropFile={(path) => handleAssignMultipleImagePaths([path], "slot-b")}
                onDropFiles={(paths) => handleAssignMultipleImagePaths(paths, "slot-b")}
                isNativeDragOver={hoveredNativeDropZone === "slot-b" || isNativeDragging}
              />
            )}
          </div>
        )}

        {/* ── MODE 2: CURTAIN (Before / After Slider) ── */}
        {mode === "curtain" && (
          <ImageComparisonCurtain
            slotA={slotA}
            slotB={slotB}
            curtainRef={curtainRef}
            curtainPosition={curtainPosition}
            draggingSlotId={draggingSlotId}
            handleSlotWheel={handleSlotWheel}
            handlePanStart={handlePanStart}
            handleCurtainPointerDown={handleCurtainPointerDown}
            onBackToSplit={() => setMode("split")}
          />
        )}

        {/* ── MODE 3: GRID (2 to 6 Images) ── */}
        {mode === "grid" && (
          slots.length === 0 ? (
            <div className="img-compare-empty-curtain-notice">
              <Icon name="grid" />
              <h3>No hay imágenes en la comparativa</h3>
              <p>Añade imágenes de tu biblioteca o cárgalas en el modo Lado a lado.</p>
              <button
                type="button"
                className="img-compare-btn is-accent"
                onClick={() => setMode("split")}
              >
                <Icon name="columns" />
                <span>Ir a Lado a lado</span>
              </button>
            </div>
          ) : (
            <div className={`img-compare-grid-view count-${slots.length}`}>
              {slots.map((slot, index) => (
                <div
                  key={slot.id}
                  className="img-compare-grid-cell"
                  onWheel={(e) => handleSlotWheel(e, slot.id)}
                  onPointerDown={(e) => handlePanStart(e, slot.id)}
                  style={{ cursor: slot.zoom > 1 ? (draggingSlotId ? "grabbing" : "grab") : "default" }}
                >
                  <div className="img-compare-slot-header">
                    <span className={`img-compare-slot-tag is-idx-${index % 4}`}>
                      Foto #{index + 1}
                    </span>
                    <span className="img-compare-slot-title" title={slot.item.path}>
                      {slot.item.title}
                    </span>
                    <button
                      type="button"
                      className="img-compare-slot-change-btn"
                      onClick={() => setSelectorTargetSlotId(slot.id)}
                      title="Cambiar imagen"
                    >
                      <Icon name="edit" />
                    </button>
                    {slots.length > 2 && (
                      <button
                        type="button"
                        className="img-compare-slot-remove-btn"
                        onClick={() => handleRemoveSlot(slot.id)}
                        title="Quitar de comparativa"
                      >
                        <Icon name="close" />
                      </button>
                    )}
                  </div>

                  <div
                    className="img-compare-layer"
                    style={{
                      transform: `translate(${slot.pan.x}px, ${slot.pan.y}px) scale(${slot.zoom})`,
                      transition: draggingSlotId ? "none" : "transform 0.1s ease-out",
                    }}
                  >
                    <img
                      src={toSafeAssetUrl(slot.item.path)}
                      alt={slot.item.title}
                      draggable={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── MODE 4: FLICK (Instant A/B Toggle) ── */}
        {mode === "flick" && (
          slots.length < 2 ? (
            <div className="img-compare-empty-curtain-notice">
              <Icon name="sparkles" />
              <h3>Se requieren al menos 2 fotos para Alternar A/B</h3>
              <p>Carga una segunda foto para alternar instantáneamente entre ellas con un clic o espacio.</p>
              <button
                type="button"
                className="img-compare-btn is-accent"
                onClick={() => setMode("split")}
              >
                <Icon name="columns" />
                <span>Volver a Lado a lado</span>
              </button>
            </div>
          ) : (
            <div
              className="img-compare-flick-view"
              onClick={() => setActiveFlickIndex((prev) => (prev + 1) % slots.length)}
              onWheel={(e) => handleSlotWheel(e, slots[activeFlickIndex].id)}
              onPointerDown={(e) => handlePanStart(e, slots[activeFlickIndex].id)}
            >
              <div className="img-compare-flick-header">
                <div className="img-compare-flick-badge">
                  <span className={`img-compare-slot-tag is-idx-${activeFlickIndex % 4}`}>
                    Foto #{activeFlickIndex + 1}
                  </span>
                  <span className="img-compare-slot-title" title={slots[activeFlickIndex].item.path}>
                    {slots[activeFlickIndex].item.title}
                  </span>
                  {slots[activeFlickIndex].width && slots[activeFlickIndex].height && (
                    <span className="img-compare-dims-pill">
                      {slots[activeFlickIndex].width} × {slots[activeFlickIndex].height} px
                    </span>
                  )}
                  <span className="img-compare-flick-hint">
                    (Haz clic o pulsa Espacio para alternar)
                  </span>
                </div>
              </div>

              <div
                className="img-compare-layer"
                style={{
                  transform: `translate(${slots[activeFlickIndex].pan.x}px, ${slots[activeFlickIndex].pan.y}px) scale(${slots[activeFlickIndex].zoom})`,
                  transition: draggingSlotId ? "none" : "transform 0.1s ease-out",
                }}
              >
                <img
                  key={slots[activeFlickIndex].id}
                  src={toSafeAssetUrl(slots[activeFlickIndex].item.path)}
                  alt={slots[activeFlickIndex].item.title}
                  draggable={false}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    const activeSlot = slots[activeFlickIndex];
                    if (img.naturalWidth && !activeSlot.width) {
                      setSlots((prev) =>
                        prev.map((s) =>
                          s.id === activeSlot.id
                            ? { ...s, width: img.naturalWidth, height: img.naturalHeight }
                            : s,
                        ),
                      );
                    }
                  }}
                />
              </div>
            </div>
          )
        )}

        {/* Barra Flotante de Slots (Filmstrip de Comparativa) */}
        <ImageComparisonFilmstrip
          slots={slots}
          slotA={slotA}
          slotB={slotB}
          mode={mode}
          activeFlickIndex={activeFlickIndex}
          showFilmstrip={showFilmstrip}
          setShowFilmstrip={setShowFilmstrip}
          setActiveSlotAId={setActiveSlotAId}
          setActiveSlotBId={setActiveSlotBId}
          setActiveFlickIndex={setActiveFlickIndex}
          handleSwapPrimary={handleSwapPrimary}
          setSelectorTargetSlotId={setSelectorTargetSlotId}
          handleRemoveSlot={handleRemoveSlot}
          setIsAddingNewSlot={setIsAddingNewSlot}
        />
      </main>

      {/* Image Selector Dialog (Biblioteca con Miniaturas) */}
      {(selectorTargetSlotId || isAddingNewSlot) && (
        <ImageComparisonSelector
          currentItems={slots.map((s) => s.item)}
          availableItems={itemsList.length > 0 ? itemsList : (initialItem ? [initialItem] : [])}
          onSelect={handleSelectSlotImage}
          onClose={() => { setSelectorTargetSlotId(null); setIsAddingNewSlot(false); }}
          title={isAddingNewSlot ? "Seleccionar de la biblioteca" : `Cambiar foto #${slots.findIndex((s) => s.id === selectorTargetSlotId) + 1}`}
          subtitle={isAddingNewSlot && slots.length >= 2 ? "Al añadir se cambiará a vista de cuadrícula para ver todas las fotos a la vez" : undefined}
        />
      )}
    </div>
  );
}
