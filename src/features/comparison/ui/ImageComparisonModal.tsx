import { useState, useRef, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { Icon } from "../../../shared/ui/Icon";
import type { VisualLibraryItem } from "../../visual_library/model/types";
import type { ComparisonMode, ComparisonImageSlot } from "../model/types";
import {
  isVideoPath,
  isAudioPath,
  isSupportedMediaPath,
  getMediaType,
  createVisualItemFromPath,
  SUPPORTED_IMAGE_EXTENSIONS,
  SUPPORTED_VIDEO_EXTENSIONS,
  SUPPORTED_AUDIO_EXTENSIONS,
  SUPPORTED_ALL_MEDIA_EXTENSIONS,
  type ComparisonMediaType,
} from "../model/types";
import { ImageComparisonSelector } from "./ImageComparisonSelector";
import { ImageComparisonEmptySlot } from "./ImageComparisonEmptySlot";
import { ImageComparisonFilmstrip } from "./ImageComparisonFilmstrip";
import { ImageComparisonCurtain } from "./ImageComparisonCurtain";
import { ImageComparisonTopBar } from "./ImageComparisonTopBar";
import { ComparisonMediaLayer } from "./ComparisonMediaLayer";
import { ComparisonVideoTransport } from "./ComparisonVideoTransport";
import { assignDroppedPathsToSlots } from "../model/slotAssignment";
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

  // Estados para vídeo sincronizado y audio inteligente (Hover Audio Focus)
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const [isPlayingVideos, setIsPlayingVideos] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioFocusSlotId, setAudioFocusSlotId] = useState<string | null>(null);

  // Estados de Drag & Drop nativo
  const [isNativeDragging, setIsNativeDragging] = useState(false);
  const [hoveredNativeDropZone, setHoveredNativeDropZone] = useState<string | null>(null);
  const hoveredNativeDropZoneRef = useRef<string | null>(null);
  // Rastrea el último slot sobre el que pasó el ratón (para reemplazar al soltar)
  const lastHoveredZoneRef = useRef<"slot-a" | "slot-b" | null>(null);

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

  const isPlayableItem = (item: VisualLibraryItem) =>
    item.kind === "video" || item.kind === ("audio" as any) || isVideoPath(item.path) || isAudioPath(item.path);

  const getSlotTagLabel = (item: VisualLibraryItem, role: "a" | "b" | number) => {
    const isAud = item.kind === ("audio" as any) || isAudioPath(item.path);
    const isVid = item.kind === "video" || isVideoPath(item.path);
    const prefix = isAud ? "Audio" : isVid ? "Vídeo" : "Foto";
    if (role === "a") return `${prefix} A (Base)`;
    if (role === "b") return `${prefix} B`;
    return `${prefix} #${role}`;
  };

  const isPlayableSlot = (slot: ComparisonImageSlot) => isPlayableItem(slot.item);

  const hasVideos = slots.some(isPlayableSlot);

  // Registrar elementos de vídeo/audio de cada slot
  const registerVideoRef = useCallback((slotId: string, el: HTMLVideoElement | HTMLAudioElement | null) => {
    if (!slotId) return;
    if (el) {
      videoElementsRef.current.set(slotId, el as HTMLVideoElement);
      if (el.duration && !isNaN(el.duration)) {
        setVideoDuration((prev) => Math.max(prev, el.duration));
      }
    } else {
      videoElementsRef.current.delete(slotId);
    }
  }, []);

  // Inicializar foco de audio en el primer elemento con sonido si aún no se ha definido
  useEffect(() => {
    const firstMedia = slots.find(isPlayableSlot);
    if (firstMedia && !audioFocusSlotId) {
      setAudioFocusSlotId(firstMedia.id);
    }
  }, [slots, audioFocusSlotId]);

  // Enrutamiento de audio al pasar el ratón (Hover Audio Focus)
  const handleSlotPointerEnter = useCallback((slotId: string) => {
    setAudioFocusSlotId(slotId);
    videoElementsRef.current.forEach((video, id) => {
      video.muted = id !== slotId;
    });
  }, []);

  // Sincronización de reproducción dual
  const handleTogglePlayVideos = useCallback(() => {
    setIsPlayingVideos((prev) => {
      const next = !prev;
      videoElementsRef.current.forEach((video) => {
        if (next) {
          void video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
      return next;
    });
  }, []);

  const handleSeekVideos = useCallback((time: number) => {
    setVideoCurrentTime(time);
    videoElementsRef.current.forEach((video) => {
      video.currentTime = time;
    });
  }, []);

  const handleRestartVideos = useCallback(() => {
    setVideoCurrentTime(0);
    videoElementsRef.current.forEach((video) => {
      video.currentTime = 0;
      void video.play().catch(() => {});
    });
    setIsPlayingVideos(true);
  }, []);

  const handleChangePlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    videoElementsRef.current.forEach((video) => {
      video.playbackRate = rate;
    });
  }, []);

  // Bucle de sincronización de tiempo durante reproducción
  useEffect(() => {
    if (!isPlayingVideos) return;
    const interval = setInterval(() => {
      const primaryVideo = (audioFocusSlotId && videoElementsRef.current.get(audioFocusSlotId)) ||
        Array.from(videoElementsRef.current.values())[0];
      if (primaryVideo) {
        setVideoCurrentTime(primaryVideo.currentTime);
        if (primaryVideo.duration && !isNaN(primaryVideo.duration)) {
          setVideoDuration(primaryVideo.duration);
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isPlayingVideos, audioFocusSlotId]);

  const handleMediaLoaded = (
    e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement | HTMLAudioElement>,
    slotId: string,
  ) => {
    const el = e.currentTarget;
    let width = 0;
    let height = 0;
    if ("naturalWidth" in el) {
      width = el.naturalWidth;
      height = el.naturalHeight;
    } else if ("videoWidth" in el) {
      width = el.videoWidth;
      height = el.videoHeight;
      if (el.duration && !isNaN(el.duration)) {
        setVideoDuration((prev) => Math.max(prev, el.duration));
      }
    } else if ("duration" in el && typeof el.duration === "number" && !isNaN(el.duration)) {
      setVideoDuration((prev) => Math.max(prev, el.duration));
    }
    if (width > 0) {
      setSlots((prev) =>
        prev.map((s) => (s.id === slotId && !s.width ? { ...s, width, height } : s)),
      );
    }
  };

  const audioFocusSlot = slots.find((s) => s.id === audioFocusSlotId);
  const audioFocusTitle = audioFocusSlot ? audioFocusSlot.item.title : undefined;

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

  const currentMediaType: "any" | ComparisonMediaType =
    slots.length > 0 ? (getMediaType(slots[0].item.path) || "any") : "any";

  const handleAssignImagePath = (filePath: string, targetSlotId?: string) => {
    if (!isSupportedMediaPath(filePath)) return;
    if (slots.length > 0) {
      const baseType = getMediaType(slots[0].item.path);
      if (baseType && getMediaType(filePath) !== baseType) {
        return;
      }
    }
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

  // Asignación por lotes para cuando el usuario arrastra 2 o más fotos/vídeos/audios a la vez
  const handleAssignMultipleImagePaths = useCallback((filePaths: string[], targetZone?: "slot-a" | "slot-b" | null) => {
    setSlots((prev) => {
      const res = assignDroppedPathsToSlots(prev, filePaths, targetZone, lastHoveredZoneRef.current);
      if (res.slotAId) setActiveSlotAId(res.slotAId);
      if (res.slotBId) setActiveSlotBId(res.slotBId);
      if (res.nextMode) setMode(res.nextMode);
      return res.slots;
    });
  }, []);

  const handlePickExplorerForSlotA = async () => {
    try {
      let filters = [
        { name: "Multimedia (Fotos, Vídeos y Música)", extensions: SUPPORTED_ALL_MEDIA_EXTENSIONS },
        { name: "Música / Audios", extensions: SUPPORTED_AUDIO_EXTENSIONS },
        { name: "Imágenes", extensions: SUPPORTED_IMAGE_EXTENSIONS },
        { name: "Vídeos", extensions: SUPPORTED_VIDEO_EXTENSIONS },
      ];
      if (currentMediaType === "image") {
        filters = [{ name: "Imágenes", extensions: SUPPORTED_IMAGE_EXTENSIONS }];
      } else if (currentMediaType === "video") {
        filters = [{ name: "Vídeos", extensions: SUPPORTED_VIDEO_EXTENSIONS }];
      } else if (currentMediaType === "audio") {
        filters = [{ name: "Música / Audios", extensions: SUPPORTED_AUDIO_EXTENSIONS }];
      }

      const selected = await open({
        multiple: true,
        filters,
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        handleAssignMultipleImagePaths(paths, "slot-a");
      }
    } catch {}
  };

  const handlePickExplorerForSlotB = async () => {
    try {
      let filters = [
        { name: "Multimedia (Fotos, Vídeos y Música)", extensions: SUPPORTED_ALL_MEDIA_EXTENSIONS },
        { name: "Música / Audios", extensions: SUPPORTED_AUDIO_EXTENSIONS },
        { name: "Imágenes", extensions: SUPPORTED_IMAGE_EXTENSIONS },
        { name: "Vídeos", extensions: SUPPORTED_VIDEO_EXTENSIONS },
      ];
      if (currentMediaType === "image") {
        filters = [{ name: "Imágenes", extensions: SUPPORTED_IMAGE_EXTENSIONS }];
      } else if (currentMediaType === "video") {
        filters = [{ name: "Vídeos", extensions: SUPPORTED_VIDEO_EXTENSIONS }];
      } else if (currentMediaType === "audio") {
        filters = [{ name: "Música / Audios", extensions: SUPPORTED_AUDIO_EXTENSIONS }];
      }

      const selected = await open({
        multiple: true,
        filters,
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
      const validPaths = paths.filter(isSupportedMediaPath);
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
      } else if (e.key === " ") {
        e.preventDefault();
        if (mode === "flick") {
          setActiveFlickIndex((prev) => (prev + 1) % slots.length);
        } else if (hasVideos) {
          handleTogglePlayVideos();
        }
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
  }, [
    selectorTargetSlotId,
    isAddingNewSlot,
    mode,
    slots.length,
    onClose,
    handleSwapPrimary,
    toggleFullscreen,
    handleResetZoom,
    hasVideos,
    handleTogglePlayVideos,
  ]);

  return (
    <div
      ref={containerRef}
      className={`img-compare-modal-root ${isFullscreen ? "is-fullscreen" : ""} ${embedded ? "is-embedded" : ""}`}
    >
      {/* Top Action Bar */}
      <ImageComparisonTopBar
        mode={mode}
        setMode={setMode}
        splitOrientation={splitOrientation}
        setSplitOrientation={setSplitOrientation}
        syncZoom={syncZoom}
        setSyncZoom={setSyncZoom}
        slotsCount={slots.length}
        hasVideos={hasVideos}
        isFullscreen={isFullscreen}
        toggleFullscreen={toggleFullscreen}
        handleSwapPrimary={handleSwapPrimary}
        handleResetZoom={handleResetZoom}
        setIsAddingNewSlot={setIsAddingNewSlot}
        onClose={onClose}
        embedded={embedded}
      />

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
                onPointerEnter={() => {
                  handleSlotPointerEnter(slotA.id);
                  lastHoveredZoneRef.current = "slot-a";
                }}
                style={{ cursor: slotA.zoom > 1 ? (draggingSlotId ? "grabbing" : "grab") : "default" }}
              >
                <div className="img-compare-slot-header">
                  <span className="img-compare-slot-tag is-a">
                    {getSlotTagLabel(slotA.item, "a")}
                  </span>
                  <span className="img-compare-slot-title" title={slotA.item.path}>
                    {slotA.item.title}
                  </span>
                  {isPlayableItem(slotA.item) && (
                    <span
                      className={`img-compare-audio-badge ${audioFocusSlotId === slotA.id ? "is-active" : ""}`}
                      title={audioFocusSlotId === slotA.id ? "Audio activo (pasa el ratón para cambiar)" : "Silenciado"}
                    >
                      <Icon name={audioFocusSlotId === slotA.id ? "volume" : "volume-mute"} />
                      <span>{audioFocusSlotId === slotA.id ? "Audio" : "Mudo"}</span>
                    </span>
                  )}
                  {slotA.width && slotA.height && (
                    <span className="img-compare-dims-pill">
                      {slotA.width} × {slotA.height} px
                    </span>
                  )}
                  <button
                    type="button"
                    className="img-compare-slot-change-btn"
                    onClick={() => setSelectorTargetSlotId(slotA.id)}
                    title="Cambiar archivo A"
                  >
                    <Icon name="edit" />
                    <span>Cambiar</span>
                  </button>
                  <button
                    type="button"
                    className="img-compare-slot-remove-btn"
                    onClick={() => handleRemoveSlot(slotA.id)}
                    title="Quitar de comparativa"
                  >
                    <Icon name="close" />
                  </button>
                </div>

                <ComparisonMediaLayer
                  slot={slotA}
                  onMediaLoad={handleMediaLoaded}
                  videoRef={(el) => registerVideoRef(slotA.id, el)}
                  isMuted={audioFocusSlotId ? audioFocusSlotId !== slotA.id : false}
                />
              </div>
            ) : (
              <ImageComparisonEmptySlot
                dropZone="slot-a"
                tagLabel="Elemento A (Base)"
                mediaType={currentMediaType}
                subtitle="o elige una fuente para comenzar la comparación"
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
                onPointerEnter={() => {
                  handleSlotPointerEnter(slotB.id);
                  lastHoveredZoneRef.current = "slot-b";
                }}
                style={{ cursor: slotB.zoom > 1 ? (draggingSlotId ? "grabbing" : "grab") : "default" }}
              >
                <div className="img-compare-slot-header">
                  <span className="img-compare-slot-tag is-b">
                    {getSlotTagLabel(slotB.item, "b")}
                  </span>
                  <span className="img-compare-slot-title" title={slotB.item.path}>
                    {slotB.item.title}
                  </span>
                  {isPlayableItem(slotB.item) && (
                    <span
                      className={`img-compare-audio-badge ${audioFocusSlotId === slotB.id ? "is-active" : ""}`}
                      title={audioFocusSlotId === slotB.id ? "Audio activo (pasa el ratón para cambiar)" : "Silenciado"}
                    >
                      <Icon name={audioFocusSlotId === slotB.id ? "volume" : "volume-mute"} />
                      <span>{audioFocusSlotId === slotB.id ? "Audio" : "Mudo"}</span>
                    </span>
                  )}
                  {slotB.width && slotB.height && (
                    <span className="img-compare-dims-pill">
                      {slotB.width} × {slotB.height} px
                    </span>
                  )}
                  <button
                    type="button"
                    className="img-compare-slot-change-btn"
                    onClick={() => setSelectorTargetSlotId(slotB.id)}
                    title="Cambiar archivo B"
                  >
                    <Icon name="edit" />
                    <span>Cambiar</span>
                  </button>
                  <button
                    type="button"
                    className="img-compare-slot-remove-btn"
                    onClick={() => handleRemoveSlot(slotB.id)}
                    title="Quitar de comparativa"
                  >
                    <Icon name="close" />
                  </button>
                </div>

                <ComparisonMediaLayer
                  slot={slotB}
                  onMediaLoad={handleMediaLoaded}
                  videoRef={(el) => registerVideoRef(slotB.id, el)}
                  isMuted={audioFocusSlotId ? audioFocusSlotId !== slotB.id : true}
                />
              </div>
            ) : (
              <ImageComparisonEmptySlot
                dropZone="slot-b"
                tagLabel="Elemento B (A Comparar)"
                mediaType={currentMediaType}
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
            videoRefA={(el) => slotA && registerVideoRef(slotA.id, el)}
            videoRefB={(el) => slotB && registerVideoRef(slotB.id, el)}
            isMutedA={audioFocusSlotId ? audioFocusSlotId !== slotA?.id : false}
            isMutedB={audioFocusSlotId ? audioFocusSlotId !== slotB?.id : true}
          />
        )}

        {/* ── MODE 3: GRID (2 to 6 Items) ── */}
        {mode === "grid" && (
          slots.length === 0 ? (
            <div className="img-compare-empty-curtain-notice">
              <Icon name="grid" />
              <h3>No hay elementos en la comparativa</h3>
              <p>Añade fotos o vídeos de tu biblioteca o cárgalos en el modo Lado a lado.</p>
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
              {slots.map((slot, index) => {
                return (
                  <div
                    key={slot.id}
                    className="img-compare-grid-cell"
                    onWheel={(e) => handleSlotWheel(e, slot.id)}
                    onPointerDown={(e) => handlePanStart(e, slot.id)}
                    onPointerEnter={() => {
                      handleSlotPointerEnter(slot.id);
                      lastHoveredZoneRef.current = index === 0 ? "slot-a" : "slot-b";
                    }}
                    style={{ cursor: slot.zoom > 1 ? (draggingSlotId ? "grabbing" : "grab") : "default" }}
                  >
                    <div className="img-compare-slot-header">
                      <span className={`img-compare-slot-tag is-idx-${index % 4}`}>
                        {getSlotTagLabel(slot.item, index + 1)}
                      </span>
                      <span className="img-compare-slot-title" title={slot.item.path}>
                        {slot.item.title}
                      </span>
                      {isPlayableItem(slot.item) && (
                        <span
                          className={`img-compare-audio-badge ${audioFocusSlotId === slot.id ? "is-active" : ""}`}
                          title={audioFocusSlotId === slot.id ? "Audio activo" : "Silenciado"}
                        >
                          <Icon name={audioFocusSlotId === slot.id ? "volume" : "volume-mute"} />
                          <span>{audioFocusSlotId === slot.id ? "Audio" : "Mudo"}</span>
                        </span>
                      )}
                      <button
                        type="button"
                        className="img-compare-slot-change-btn"
                        onClick={() => setSelectorTargetSlotId(slot.id)}
                        title="Cambiar elemento"
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        type="button"
                        className="img-compare-slot-remove-btn"
                        onClick={() => handleRemoveSlot(slot.id)}
                        title="Quitar de comparativa"
                      >
                        <Icon name="close" />
                      </button>
                    </div>

                    <ComparisonMediaLayer
                      slot={slot}
                      onMediaLoad={handleMediaLoaded}
                      videoRef={(el) => registerVideoRef(slot.id, el)}
                      isMuted={audioFocusSlotId ? audioFocusSlotId !== slot.id : true}
                    />
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── MODE 4: FLICK (Instant A/B Toggle) ── */}
        {mode === "flick" && (
          slots.length < 2 ? (
            <div className="img-compare-empty-curtain-notice">
              <Icon name="sparkles" />
              <h3>Se requieren al menos 2 elementos para Alternar A/B</h3>
              <p>Carga un segundo archivo para alternar instantáneamente entre ellos con un clic o espacio.</p>
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
              onPointerEnter={() => handleSlotPointerEnter(slots[activeFlickIndex].id)}
            >
              <div className="img-compare-flick-header">
                <div className="img-compare-flick-badge">
                  <span className={`img-compare-slot-tag is-idx-${activeFlickIndex % 4}`}>
                    {getSlotTagLabel(slots[activeFlickIndex].item, activeFlickIndex + 1)}
                  </span>
                  <span className="img-compare-slot-title" title={slots[activeFlickIndex].item.path}>
                    {slots[activeFlickIndex].item.title}
                  </span>
                  {isPlayableItem(slots[activeFlickIndex].item) && (
                    <span className="img-compare-audio-badge is-active">
                      <Icon name="volume" />
                      <span>Audio Activo</span>
                    </span>
                  )}
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

              <ComparisonMediaLayer
                key={slots[activeFlickIndex].id}
                slot={slots[activeFlickIndex]}
                onMediaLoad={handleMediaLoaded}
                videoRef={(el) => registerVideoRef(slots[activeFlickIndex].id, el)}
                isMuted={false}
              />
            </div>
          )
        )}

        {/* Barra Flotante de Controles de Vídeo Sincronizado */}
        {hasVideos && (
          <ComparisonVideoTransport
            isPlaying={isPlayingVideos}
            onTogglePlay={handleTogglePlayVideos}
            currentTime={videoCurrentTime}
            duration={videoDuration}
            onSeek={handleSeekVideos}
            onRestart={handleRestartVideos}
            playbackRate={playbackRate}
            onChangePlaybackRate={handleChangePlaybackRate}
            audioFocusTitle={audioFocusTitle}
          />
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
          restrictMediaType={currentMediaType !== "any" ? currentMediaType : undefined}
          onSelect={handleSelectSlotImage}
          onClose={() => { setSelectorTargetSlotId(null); setIsAddingNewSlot(false); }}
          title={
            isAddingNewSlot
              ? currentMediaType === "image"
                ? "Seleccionar foto de la biblioteca"
                : currentMediaType === "video"
                  ? "Seleccionar vídeo de la biblioteca"
                  : currentMediaType === "audio"
                    ? "Seleccionar audio de la biblioteca"
                    : "Seleccionar de la biblioteca"
              : `Cambiar archivo #${slots.findIndex((s) => s.id === selectorTargetSlotId) + 1}`
          }
          subtitle={isAddingNewSlot && slots.length >= 2 ? "Al añadir se cambiará a vista de cuadrícula para ver todos a la vez" : undefined}
        />
      )}
    </div>
  );
}
