import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { formatTime, mediaTitle } from "../../playback/ui/formatters";
import { Icon } from "../../../shared/ui/Icon";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { ContextMenu } from "../../../shared/ui/ContextMenu";
import { cleanPath, toPlatformPath, toSafeAssetUrl } from "../../../shared/mediaTree";
import type { VisualLibraryItem } from "../model/types";
import { VideoThumbnail } from "./VideoThumbnail";
import { useFavorites } from "../../../shared/useFavorites";
import { useMediaDelete } from "../../../shared/useMediaDelete";
import { MediaProgressBar } from "../../../shared/ui/MediaProgressBar";
import { VideoToolsMenu } from "./components/VideoToolsMenu";
import { useVideoAudioDsp } from "./useVideoAudioDsp";
import { useVideoSnapshot } from "../hooks/useVideoSnapshot";
import { useSystemSettings } from "../../../app/useSystemSettings";
import { ImageComparisonModal } from "../../comparison";
import { VolumeOsd, useVolumeOsd } from "../../../shared/ui/VolumeOsd";
import { SeekOsd, useSeekOsd } from "../../../shared/ui/SeekOsd";
import { handleNativeDragStart, startNativeFileDrag } from "../../../shared/useNativeFileDrag";
import { VideoTechnicalHud } from "./components/VideoTechnicalHud";
import { getClipColorHex } from "../model/davinciColors";
import { useVideoTakes, useVideoTechnicalMetadata } from "../hooks/useVideoTakes";
import type { TakeStatus, ClipColor } from "../model/types";
import "./video-player.css";

interface VideoPlayerProps {
  path: string | null;
  videoItems?: VisualLibraryItem[];
  initialTime?: number;
  onBack: () => void;
  onSelectVideo?: (path: string) => void;
  /** Notifica a App.tsx cuándo entra/sale del modo Picture-in-Picture */
  onPipChange?: (active: boolean, reason?: "restore" | "close") => void;
  /** Notifica si el vídeo está reproduciéndose activamente */
  onPlayingChange?: (isPlaying: boolean) => void;
  confirmDeletion?: boolean;
  onRefresh?: () => void | Promise<void>;
  onOpenEqualizer?: () => void;
  isEqualizerOpen?: boolean;
}

type AudioChannelMode = "stereo" | "mono";

interface AudioTrackInfo {
  index: number;
  id: string;
  label: string;
  language: string;
  enabled: boolean;
}

interface SubtitleTrackInfo {
  index: number;
  id: string;
  label: string;
  language: string;
  path?: string;
  vttContent?: string;
}

interface VideoPlaybackSource {
  playback_path: string;
  is_proxy: boolean;
  original_codec: string;
  codec_display: string;
  width: number;
  height: number;
  duration_secs: number;
}

function pathsEqual(p1?: string | null, p2?: string | null): boolean {
  if (!p1 || !p2) return p1 === p2;
  return p1.replace(/\\/g, "/").toLowerCase() === p2.replace(/\\/g, "/").toLowerCase();
}

export function VideoPlayer({
  path,
  videoItems = [],
  initialTime,
  onBack,
  onSelectVideo,
  onPipChange,
  onPlayingChange,
  confirmDeletion = true,
  onRefresh,
  onOpenEqualizer,
  isEqualizerOpen,
}: VideoPlayerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [prevVolume, setPrevVolume] = useState(80);
  const { osdState: volumeOsd, triggerOsd: showVolumeOsd } = useVolumeOsd(volume, false);
  const { osdState: seekOsd, triggerSeekOsd } = useSeekOsd();
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playlistSearch, setPlaylistSearch] = useState("");
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">(() => {
    try {
      const saved = localStorage.getItem("prisma:video_repeat");
      return saved === "all" || saved === "one" || saved === "off" ? saved : "off";
    } catch {
      return "off";
    }
  });
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showControls, setShowControls] = useState(false);

  // Multi-Audio y Canales (Estéreo / Mono)
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [channelMode, setChannelMode] = useState<AudioChannelMode>("stereo");
  const [audioTracksList, setAudioTracksList] = useState<AudioTrackInfo[]>([]);
  const [selectedTrackIdx, setSelectedTrackIdx] = useState<number>(0);
  // null = aún no cargado; true = API soportada; false = API no soportada
  const [audioApiSupported, setAudioApiSupported] = useState<boolean | null>(null);

  // Subtítulos
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [subtitlesList, setSubtitlesList] = useState<SubtitleTrackInfo[]>([]);
  const [selectedSubIdx, setSelectedSubIdx] = useState<number | null>(null);
  const [activeVttUrl, setActiveVttUrl] = useState<string | null>(null);

  // One-Shot Shuffle State
  const [localVideoItems, setLocalVideoItems] = useState<VisualLibraryItem[]>(videoItems);
  const [shuffleToastText, setShuffleToastText] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // Proxy y compatibilidad de códec nativo
  const [playbackSource, setPlaybackSource] = useState<VideoPlaybackSource | null>(null);
  const [isResolvingSource, setIsResolvingSource] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Ficha Técnica HUD & Marcado de Tomas DaVinci
  const [showTechnicalHud, setShowTechnicalHud] = useState(false);
  const { getMarkerForPath, setTakeMarker } = useVideoTakes();
  const currentMarker = getMarkerForPath(path);
  const currentVideoPathForMeta = playbackSource?.playback_path || path;
  const { metadata: technicalMeta, loading: technicalLoading } = useVideoTechnicalMetadata(currentVideoPathForMeta);

  // Filtrado reactivo de la cola de reproducción
  const filteredVideoItems = useMemo(() => {
    if (!playlistSearch.trim()) return localVideoItems;
    const q = playlistSearch.toLowerCase().trim();
    return localVideoItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.relativeFolder && item.relativeFolder.toLowerCase().includes(q)),
    );
  }, [localVideoItems, playlistSearch]);

  // Picture-in-Picture State
  const [isPipActive, setIsPipActive] = useState(false);
  const isPipActiveRef = useRef(false);
  isPipActiveRef.current = isPipActive;
  const explicitAppToggleRef = useRef(false);

  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);

  const favorites = useFavorites();
  const isFav = path ? favorites.isFavorite(path) : false;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  useVideoAudioDsp(videoRef);

  const { videoSnapshotFolder, videoSnapshotFormat } = useSystemSettings();
  const {
    isCapturing,
    isFlashing,
    snapshotToast,
    takeSnapshot,
    stepFrameForward,
    stepFrameBackward,
    dismissToast,
    openSnapshotInFolder,
  } = useVideoSnapshot({
    videoRef,
    videoPath: path,
    videoTitle: path ? mediaTitle(path) : undefined,
    videoSnapshotFolder,
    videoSnapshotFormat,
    onSeek: (newTime) => setPosition(newTime),
    onPauseStateChange: (isPaused) => setPaused(isPaused),
  });
  const controlsTimeoutRef = useRef<number | null>(null);
  const fastForwardIntervalRef = useRef<number | null>(null);
  const stageMouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const isStageDraggingFileRef = useRef<boolean>(false);
  const audioMenuRef = useRef<HTMLDivElement | null>(null);
  const subMenuRef = useRef<HTMLDivElement | null>(null);
  const isHoveringControlsRef = useRef<boolean>(false);
  const isSwitchingVideoRef = useRef<boolean>(false);
  const controlsSuppressUntilRef = useRef<number>(Date.now() + 600);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const openedAtRef = useRef<number>(Date.now());
  const [videoPillarboxOffset, setVideoPillarboxOffset] = useState<number>(0);

  const updateVideoBounds = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setVideoPillarboxOffset(0);
      return;
    }
    const containerW = window.innerWidth;
    const containerH = window.innerHeight;
    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = containerW / containerH;

    if (videoRatio < containerRatio) {
      // Vídeo más estrecho que la pantalla (ej. vertical 9:16 o 4:3 en monitor 16:9)
      const renderedWidth = containerH * videoRatio;
      const offset = Math.max(0, Math.round((containerW - renderedWidth) / 2));
      setVideoPillarboxOffset(offset);
    } else {
      setVideoPillarboxOffset(0);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("resize", updateVideoBounds);
    return () => window.removeEventListener("resize", updateVideoBounds);
  }, [updateVideoBounds]);

  useEffect(() => {
    window.focus();
    const container = document.getElementById("video-cinema-container");
    container?.focus();
    if (
      document.activeElement instanceof HTMLElement &&
      (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")
    ) {
      document.activeElement.blur();
    }
  }, [path]);

  const hasMedia = Boolean(path);
  const title = path ? mediaTitle(path) : "Sin vídeo seleccionado";
  const effectivePlaybackPath = playbackSource?.playback_path || path;
  const videoSrc = effectivePlaybackPath ? toSafeAssetUrl(effectivePlaybackPath) : "";

  // Reiniciar estado de proxy al cambiar de vídeo para reproducción directa inmediata
  useEffect(() => {
    isSwitchingVideoRef.current = true;
    controlsSuppressUntilRef.current = Date.now() + 600;
    setPlaybackSource(null);
    setIsResolvingSource(false);
    setResolveError(null);
    setVideoError(false);
    const timer = window.setTimeout(() => {
      isSwitchingVideoRef.current = false;
    }, 600);
    return () => window.clearTimeout(timer);
  }, [path]);

  // Sincronizar cola local si cambian los props
  useEffect(() => {
    setLocalVideoItems(videoItems);
  }, [videoItems]);

  // Notificar a App / Ecualizador el estado de reproducción de vídeo
  useEffect(() => {
    const isPlaying = Boolean(path && !paused && !videoError);
    onPlayingChange?.(isPlaying);
    return () => {
      onPlayingChange?.(false);
    };
  }, [path, paused, videoError, onPlayingChange]);

  // Limpieza y reinicio atómico de pistas secundarias al cambiar de vídeo
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = false;
    }
    if (secondaryAudioRef.current) {
      secondaryAudioRef.current.pause();
      secondaryAudioRef.current.src = "";
    }
    setExtractedAudioUrl(null);
    setSelectedTrackIdx(0);
    setPosition(0);
    setVideoError(false);
    setPaused(false);
  }, [path]);

  // Auto-detect current index in video list
  const currentIndex = localVideoItems.findIndex((item) => pathsEqual(item.path, path));
  const hasNext = currentIndex >= 0 && currentIndex < localVideoItems.length - 1;
  const hasPrevious = currentIndex > 0;

  const mediaDelete = useMediaDelete({
    confirmDeletion,
    onRefresh,
    onDeleted: () => {
      if (localVideoItems.length > 1) {
        const nextIdx = (currentIndex + 1) % localVideoItems.length;
        const nextVideo = localVideoItems[nextIdx];
        if (nextVideo && nextVideo.path !== path) {
          onSelectVideo?.(nextVideo.path);
        } else {
          onBack();
        }
      } else {
        onBack();
      }
    },
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!path) return;
    mediaDelete.openMenu(e, {
      path,
      title,
      kind: "video",
    });
  };

  const currentVideoItem = useMemo<VisualLibraryItem | null>(() => {
    if (!path) return null;
    const found = localVideoItems.find((it) => it.path === path);
    if (found) return found;
    return {
      path,
      title,
      sourcePath: path,
      relativeFolder: "",
      kind: "video",
      modifiedAtMillis: Date.now(),
      sizeBytes: 0,
    };
  }, [path, title, localVideoItems]);

  const handleOpenComparison = () => {
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
      setPaused(true);
    }
    setIsComparing(true);
  };

  const buildContextMenuItems = () => {
    const target = mediaDelete.menu;
    if (!target) return [];
    const isFavoriteItem = favorites.isFavorite(target.item.path);
    return [
      {
        id: "favorite",
        label: isFavoriteItem ? "Quitar de favoritos" : "Añadir a favoritos",
        icon: "heart" as const,
        onSelect: () => {
          const nextFav = favorites.toggleFavorite(target.item.path, "video");
          setShuffleToastText(nextFav ? "❤️ Añadido a favoritos" : "🤍 Eliminado de favoritos");
          setTimeout(() => setShuffleToastText(null), 1800);
        },
      },
      {
        id: "compare",
        label: "Comparar con otro vídeo",
        icon: "compare" as const,
        onSelect: handleOpenComparison,
      },
      {
        id: "snapshot",
        label: "Capturar fotograma (Shift+S)",
        icon: "camera" as const,
        onSelect: () => void takeSnapshot(),
      },
      {
        id: "show",
        label: "Mostrar en carpeta",
        icon: "folder-open" as const,
        onSelect: () => {
          void invoke("show_in_file_manager", { path: target.item.path }).catch(() => {});
        },
      },
      {
        id: "send-to-mobile",
        label: "Enviar a Super Galería (Móvil)",
        icon: "smartphone" as const,
        onSelect: () => {
          window.dispatchEvent(
            new CustomEvent("prisma-send-to-supergallery", {
              detail: { path: target.item.path, title: target.item.title },
            })
          );
        },
      },
      {
        id: "delete",
        label: "Mover a la papelera",
        icon: "trash" as const,
        danger: true,
        onSelect: () => mediaDelete.requestDelete(target.item),
      },
    ];
  };

  // Audio secundario sincronizado para pistas múltiples
  const secondaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const [extractedAudioUrl, setExtractedAudioUrl] = useState<string | null>(null);

  // ── Selección de Pistas de Audio ──
  const selectAudioTrack = async (trackIndex: number) => {
    setSelectedTrackIdx(trackIndex);

    // 1. Intentar cambiar vía audioTracks HTML5 nativo si existe
    const video = videoRef.current as unknown as { audioTracks?: AudioTrackInfo[] };
    if (video && video.audioTracks && video.audioTracks.length > 0) {
      for (let i = 0; i < video.audioTracks.length; i++) {
        video.audioTracks[i].enabled = i === trackIndex;
      }
      return;
    }

    // 2. Si el video tiene pista 0 (predeterminada del archivo de video)
    if (trackIndex === 0) {
      if (secondaryAudioRef.current) {
        secondaryAudioRef.current.pause();
        secondaryAudioRef.current.src = "";
      }
      if (videoRef.current) {
        videoRef.current.muted = false;
      }
      setExtractedAudioUrl(null);
      return;
    }

    // 3. Pista 1 o superior en WebView2: extraer pista con ffmpeg y sincronizar
    if (path) {
      try {
        setShuffleToastText("⏳ Cambiando de pista...");
        const audioFilePath = await invoke<string>("video_extract_audio_track", {
          path,
          trackIndex,
        });

        const audioSrc = toSafeAssetUrl(audioFilePath);
        setExtractedAudioUrl(audioSrc);

        if (videoRef.current) {
          videoRef.current.muted = true; // Silenciar el video original para que suene la pista 2
          const currentPos = videoRef.current.currentTime;
          const isPaused = videoRef.current.paused;

          if (secondaryAudioRef.current) {
            secondaryAudioRef.current.src = audioSrc;
            secondaryAudioRef.current.currentTime = currentPos;
            secondaryAudioRef.current.volume = volume / 100;
            if (!isPaused) {
              secondaryAudioRef.current.play().catch(() => {});
            }
          }
        }
        setShuffleToastText(`🔊 Pista ${trackIndex + 1} activa`);
        setTimeout(() => setShuffleToastText(null), 1800);
      } catch (err) {
        console.error("Error al extraer pista de audio:", err);
        setShuffleToastText("❌ Error al cambiar pista");
        setTimeout(() => setShuffleToastText(null), 1800);
      }
    }
  };

  // ── Alternar Pista de Audio con tecla B ──
  const cycleAudioTrack = () => {
    if (audioTracksList.length <= 1) {
      setShuffleToastText("🔊 Sin pistas adicionales");
      setTimeout(() => setShuffleToastText(null), 1800);
      return;
    }
    const nextIdx = (selectedTrackIdx + 1) % audioTracksList.length;
    void selectAudioTrack(nextIdx);
  };

  // ── Conmutar Canales (Estéreo / Mono) ──
  const applyChannelMode = (mode: AudioChannelMode) => {
    setChannelMode(mode);
  };

  // ── Cargar Subtítulos Disponibles ──
  useEffect(() => {
    if (!path) {
      setSubtitlesList([]);
      setSelectedSubIdx(null);
      return;
    }

    let isMounted = true;
    invoke<Array<{ label: string; path: string; format: string; language: string | null }>>(
      "video_get_subtitles",
      { videoPath: path }
    )
      .then((subs) => {
        if (!isMounted) return;
        const list: SubtitleTrackInfo[] = subs.map((s, idx) => ({
          index: idx,
          id: s.path,
          label: s.label || `Subtítulo ${idx + 1}`,
          language: s.language || "",
          path: s.path,
        }));
        setSubtitlesList(list);
      })
      .catch((e) => console.warn("Error buscando subtítulos:", e));

    return () => {
      isMounted = false;
    };
  }, [path]);

  // ── Cargar Pistas de Audio Reales desde Backend (ffprobe) ──
  useEffect(() => {
    if (!path) {
      setAudioTracksList([]);
      setSelectedTrackIdx(0);
      return;
    }

    let isMounted = true;
    invoke<Array<{ index: number; label: string; language: string | null; codec: string | null; channels: number | null }>>(
      "video_get_audio_tracks",
      { path }
    )
      .then((tracks) => {
        if (!isMounted || !tracks || tracks.length === 0) return;
        const list: AudioTrackInfo[] = tracks.map((t) => ({
          index: t.index,
          id: String(t.index),
          label: t.label || `Pista ${t.index + 1}`,
          language: t.language || "",
          enabled: t.index === 0,
        }));
        setAudioTracksList(list);
        setAudioApiSupported(true);
        setSelectedTrackIdx(0);
      })
      .catch((err) => {
        console.warn("ffprobe no pudo inspeccionar pistas de audio o no está disponible:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [path]);

  // ── Seleccionar Subtítulo ──
  const selectSubtitle = async (subIdx: number | null) => {
    setSelectedSubIdx(subIdx);
    if (activeVttUrl) {
      URL.revokeObjectURL(activeVttUrl);
      setActiveVttUrl(null);
    }

    if (subIdx === null) {
      // Desactivar subtítulos
      const video = videoRef.current;
      if (video && video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].mode = "disabled";
        }
      }
      return;
    }

    const sub = subtitlesList[subIdx];
    if (!sub || !sub.path) return;

    try {
      const vttContent = await invoke<string>("video_read_subtitle_vtt", {
        subtitlePath: sub.path,
      });
      const blob = new Blob([vttContent], { type: "text/vtt" });
      const url = URL.createObjectURL(blob);
      setActiveVttUrl(url);

      setTimeout(() => {
        const video = videoRef.current;
        if (video && video.textTracks && video.textTracks.length > 0) {
          for (let i = 0; i < video.textTracks.length; i++) {
            video.textTracks[i].mode = "showing";
          }
        }
      }, 50);
    } catch (e) {
      console.error("Error activando subtítulos:", e);
    }
  };

  // ── Alternar Subtítulos con tecla V o C ──
  const cycleSubtitle = () => {
    if (subtitlesList.length === 0) {
      setShuffleToastText("💬 Sin subtítulos disponibles");
      setTimeout(() => setShuffleToastText(null), 1800);
      return;
    }

    if (selectedSubIdx === null) {
      void selectSubtitle(0);
      setShuffleToastText(`💬 Subtítulo 1: ${subtitlesList[0]?.label}`);
    } else if (selectedSubIdx + 1 < subtitlesList.length) {
      const next = selectedSubIdx + 1;
      void selectSubtitle(next);
      setShuffleToastText(`💬 Subtítulo ${next + 1}: ${subtitlesList[next]?.label}`);
    } else {
      void selectSubtitle(null);
      setShuffleToastText("💬 Subtítulos desactivados");
    }
    setTimeout(() => setShuffleToastText(null), 1800);
  };

  // ── One-Shot Shuffle ──
  const handleOneShotShuffle = () => {
    if (localVideoItems.length <= 1) return;

    const current = localVideoItems.find((it) => it.path === path) || localVideoItems[0];
    const others = localVideoItems.filter((it) => it.path !== current.path);

    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }

    const shuffled = [current, ...others];
    setLocalVideoItems(shuffled);

    setShuffleToastText(`🔀 Cola barajada (${shuffled.length} vídeos en orden aleatorio único)`);
    setTimeout(() => setShuffleToastText(null), 2400);
  };

  // ── Picture-in-Picture ──
  const requestPiPWithBoundedDimensions = async (video: HTMLVideoElement) => {
    const vw = video.videoWidth || 16;
    const vh = video.videoHeight || 9;
    const hadWidth = video.style.width;
    const hadHeight = video.style.height;

    // Calcular tamaño objetivo con base acotada (~440px máximo para la dimensión mayor)
    // para evitar ventanas desorbitadas en vídeos verticales (9:16) o resoluciones 4K
    const MAX_PIP_DIMENSION = 440;
    let targetWidth: number;
    let targetHeight: number;

    if (vw >= vh) {
      // Horizontal (16:9, etc.): ancho máximo 440px, altura proporcional (~248px)
      targetWidth = MAX_PIP_DIMENSION;
      targetHeight = Math.max(160, Math.round(MAX_PIP_DIMENSION * (vh / vw)));
    } else {
      // Vertical (9:16, Shorts, Reels): altura máxima 440px, ancho proporcional (~248px)
      targetHeight = MAX_PIP_DIMENSION;
      targetWidth = Math.max(160, Math.round(MAX_PIP_DIMENSION * (vw / vh)));
    }

    video.style.width = `${targetWidth}px`;
    video.style.height = `${targetHeight}px`;

    try {
      await video.requestPictureInPicture();
    } finally {
      // Restaurar estilos para que el reproductor vuelva a su layout fluido
      video.style.width = hadWidth;
      video.style.height = hadHeight;
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        explicitAppToggleRef.current = true;
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await requestPiPWithBoundedDimensions(video);
      }
    } catch (err) {
      console.error("Error activando Picture-in-Picture:", err);
    }
  };

  // handleBack: pausa el vídeo y sale de PiP y fullscreen antes de notificar a App.tsx
  const handleBack = () => {
    // Pausar inmediatamente para evitar audio residual durante el desmontaje
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    if (document.pictureInPictureElement) {
      explicitAppToggleRef.current = true;
      void document.exitPictureInPicture().catch(() => {});
    }
    onBack();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onEnter = () => {
      setIsPipActive(true);
      // Notificar a App.tsx para que muestre la vista de origen (galería)
      onPipChange?.(true);

      // Sincronizar el icono de Prisma en la ventana flotante nativa de PiP en Windows
      void invoke("visual_library_sync_pip_icon").catch(() => {});
    };

    const onLeave = () => {
      setIsPipActive(false);

      if (explicitAppToggleRef.current) {
        explicitAppToggleRef.current = false;
        onPipChange?.(false, "restore");
        return;
      }

      const wasPlaying = !video.paused;

      // Dejamos un breve intervalo para que Chromium aplique el estado de pausa automático si fue la '✕'
      window.setTimeout(() => {
        const isPausedNow = video.paused;
        if (wasPlaying && isPausedNow) {
          // El navegador pausó el vídeo: el usuario pulsó la '✕' (Cerrar PiP y morir ahí)
          onPipChange?.(false, "close");
        } else if (!isPausedNow) {
          // El vídeo sigue reproduciéndose: el usuario pulsó 'Volver a la pestaña'
          onPipChange?.(false, "restore");
        } else {
          // Estaba previamente en pausa: se asume cierre
          onPipChange?.(false, "close");
        }
      }, 50);
    };

    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);

    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, [path, onPipChange]);

  // Cerrar popovers al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target as Node)) {
        setShowAudioMenu(false);
      }
      if (subMenuRef.current && !subMenuRef.current.contains(e.target as Node)) {
        setShowSubMenu(false);
      }
    };
    if (showAudioMenu || showSubMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAudioMenu, showSubMenu]);

  const handleNext = () => {
    isSwitchingVideoRef.current = true;
    controlsSuppressUntilRef.current = Date.now() + 1500;
    if (repeatMode === "one" && videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play().catch(() => {});
      return;
    }
    if (localVideoItems.length > 0 && onSelectVideo) {
      const validIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = (validIndex + 1) % localVideoItems.length;
      onSelectVideo(localVideoItems[nextIndex].path);
    }
  };

  const handlePrevious = (forceTrackChange = false) => {
    isSwitchingVideoRef.current = true;
    controlsSuppressUntilRef.current = Date.now() + 1500;
    if (!forceTrackChange && position > 3 && videoRef.current) {
      videoRef.current.currentTime = 0;
      return;
    }
    if (localVideoItems.length > 0 && onSelectVideo) {
      const validIndex = currentIndex >= 0 ? currentIndex : 0;
      const prevIndex = (validIndex - 1 + localVideoItems.length) % localVideoItems.length;
      onSelectVideo(localVideoItems[prevIndex].path);
    }
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => {
      const next = prev === "off" ? "all" : prev === "all" ? "one" : "off";
      try {
        localStorage.setItem("prisma:video_repeat", next);
      } catch {}
      return next;
    });
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      void videoRef.current.play();
      if (secondaryAudioRef.current && extractedAudioUrl) {
        secondaryAudioRef.current.currentTime = videoRef.current.currentTime;
        void secondaryAudioRef.current.play().catch(() => {});
      }
    } else {
      videoRef.current.pause();
      if (secondaryAudioRef.current) {
        secondaryAudioRef.current.pause();
      }
    }
  };

  // ── Sincronización nativa con Windows System Media Transport Controls (SMTC) de Prisma ──
  // 1. Limpiar cualquier remanente de MediaSession en Chromium WebView2
  useEffect(() => {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = "none";
      } catch {}
    }
  }, []);

  // 2. Suscripción a eventos de hardware / flyout de volumen de Windows ("prisma://smtc-action")
  const handleNextRef = useRef(handleNext);
  handleNextRef.current = handleNext;
  const handlePreviousRef = useRef(handlePrevious);
  handlePreviousRef.current = handlePrevious;

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isMounted = true;

    void listen<string>("prisma://smtc-action", (event) => {
      if (!isMounted) return;
      const action = event.payload;
      switch (action) {
        case "play":
          if (videoRef.current && videoRef.current.paused) {
            void videoRef.current.play().catch(() => {});
          }
          break;
        case "pause":
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
          }
          break;
        case "next":
          handleNextRef.current();
          break;
        case "previous":
          handlePreviousRef.current(true);
          break;
      }
    }).then((fn) => {
      if (isMounted) unlisten = fn;
      else fn();
    });

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, []);

  // 3. Sincronización de metadatos y miniatura de vídeo con SMTC nativo de Rust
  useEffect(() => {
    if (!path) {
      void invoke("smtc_clear").catch(() => {});
      return;
    }

    const videoName = title || path.split(/[/\\]/).pop() || "Prisma Vídeo";
    void invoke("smtc_update_metadata", {
      title: videoName,
      artist: "Prisma Vídeos",
      album: "Vídeos",
      sourcePath: path,
      mediaType: "video",
    }).catch(() => {});
  }, [path, title]);

  // 4. Sincronización del estado de reproducción (Playing / Paused) con SMTC nativo
  useEffect(() => {
    if (!path) return;
    void invoke("smtc_update_playback", {
      isPlaying: !paused,
    }).catch(() => {});
  }, [path, paused]);

  // 5. Sincronización de línea de tiempo con SMTC nativo (limitado a 1Hz)
  const lastReportedPos = useRef<number>(-1);
  useEffect(() => {
    if (!path || duration <= 0) return;
    const pos = Math.floor(position);
    if (pos !== lastReportedPos.current) {
      lastReportedPos.current = pos;
      void invoke("smtc_update_timeline", {
        positionSecs: position,
        durationSecs: duration,
      }).catch(() => {});
    }
  }, [path, duration, position]);

  // 6. Limpieza al desmontar el reproductor de vídeo
  useEffect(() => {
    return () => {
      void invoke("smtc_clear").catch(() => {});
    };
  }, []);

  const handleSeek = (newTime: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = newTime;
    setPosition(newTime);
    if (secondaryAudioRef.current && extractedAudioUrl) {
      secondaryAudioRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (newVolume: number, fromHotkey = false) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newVolume)));
    if (clamped > 0) {
      setPrevVolume(clamped);
      if (videoRef.current && videoRef.current.muted) {
        videoRef.current.muted = false;
      }
    }
    setVolume(clamped);
    if (videoRef.current) {
      videoRef.current.volume = clamped / 100;
    }
    if (secondaryAudioRef.current) {
      secondaryAudioRef.current.volume = clamped / 100;
    }
    if (fromHotkey) {
      showVolumeOsd(clamped, clamped === 0);
    }
  };

  const toggleMute = (fromHotkey: boolean | React.MouseEvent = false) => {
    const isHotkey = typeof fromHotkey === "boolean" ? fromHotkey : false;
    if (volume > 0) {
      setPrevVolume(volume);
      handleVolumeChange(0, isHotkey);
    } else {
      const restored = prevVolume > 0 ? prevVolume : 80;
      handleVolumeChange(restored, isHotkey);
    }
  };

  const cyclePlaybackSpeed = () => {
    const speeds = [1, 1.25, 1.5, 1.75, 2, 0.5, 0.75];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
    if (secondaryAudioRef.current) {
      secondaryAudioRef.current.playbackRate = nextSpeed;
    }
  };

  const ignoreNextActivityRef = useRef<boolean>(false);

  const toggleFullscreen = () => {
    const container = document.getElementById("video-cinema-container");
    if (!container) return;

    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }

    if (!document.fullscreenElement) {
      ignoreNextActivityRef.current = true;
      setShowControls(false);
      void container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
      setShowControls(true);
    }
  };

  const startFastForward = () => {
    if (!videoRef.current) return;
    setIsFastForwarding(true);
    videoRef.current.playbackRate = 3.0;
  };

  const stopFastForward = () => {
    if (!videoRef.current) return;
    setIsFastForwarding(false);
    videoRef.current.playbackRate = playbackSpeed;
  };

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    const hasActiveOverlay =
      isHoveringControlsRef.current ||
      (paused && !isSwitchingVideoRef.current) ||
      showAudioMenu ||
      showSubMenu ||
      showPlaylist ||
      isToolsMenuOpen ||
      isComparing ||
      Boolean(mediaDelete.menu) ||
      Boolean(mediaDelete.pendingDelete);

    if (!hasActiveOverlay) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        if (!hasActiveOverlay) {
          setShowControls(false);
          controlsSuppressUntilRef.current = Date.now() + 450;
        }
      }, 3000);
    }
  }, [
    paused,
    showAudioMenu,
    showSubMenu,
    showPlaylist,
    isToolsMenuOpen,
    isComparing,
    mediaDelete.menu,
    mediaDelete.pendingDelete,
  ]);

  const handleUserActivity = useCallback(
    (e?: MouseEvent | PointerEvent | React.MouseEvent) => {
      if (ignoreNextActivityRef.current) {
        ignoreNextActivityRef.current = false;
        return;
      }

      if (Date.now() < controlsSuppressUntilRef.current) return;
      if (Date.now() - openedAtRef.current < 450) {
        if (e && "clientX" in e) {
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        }
        return;
      }

      if (e && "clientX" in e) {
        const currentX = e.clientX;
        const currentY = e.clientY;

        if (!lastMousePosRef.current) {
          lastMousePosRef.current = { x: currentX, y: currentY };
          return;
        }

        const dx = currentX - lastMousePosRef.current.x;
        const dy = currentY - lastMousePosRef.current.y;
        const distSq = dx * dx + dy * dy;

        // Requiere al menos 3px de movimiento acumulado real (distSq >= 9)
        if (distSq < 9) {
          return;
        }

        lastMousePosRef.current = { x: currentX, y: currentY };
      }

      setShowControls(true);
      resetControlsTimeout();
    },
    [resetControlsTimeout]
  );

  const handleMouseLeave = useCallback(() => {
    const hasActiveOverlay =
      isHoveringControlsRef.current ||
      (paused && !isSwitchingVideoRef.current) ||
      showAudioMenu ||
      showSubMenu ||
      showPlaylist ||
      isToolsMenuOpen ||
      isComparing ||
      Boolean(mediaDelete.menu) ||
      Boolean(mediaDelete.pendingDelete);

    if (!hasActiveOverlay) {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = window.setTimeout(() => {
        if (!hasActiveOverlay) {
          setShowControls(false);
          controlsSuppressUntilRef.current = Date.now() + 450;
        }
      }, 1000);
    }
  }, [
    paused,
    showAudioMenu,
    showSubMenu,
    showPlaylist,
    isToolsMenuOpen,
    isComparing,
    mediaDelete.menu,
    mediaDelete.pendingDelete,
  ]);

  const handleWheel = (e: React.WheelEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest(".video-playlist-drawer, .video-audio-menu, .video-sub-menu, .video-tools-menu")) {
      return;
    }

    if (Math.abs(e.deltaY) > 0) {
      e.stopPropagation();
      const step = 5;
      const delta = e.deltaY < 0 ? step : -step;
      const nextVol = Math.max(0, Math.min(100, volume + delta));
      handleVolumeChange(nextVol, true);
    }
  };

  // Listener global de actividad del mouse en la ventana
  useEffect(() => {
    const onActivity = (e: MouseEvent) => {
      handleUserActivity(e);
    };

    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("pointermove", onActivity, { passive: true });
    return () => {
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("pointermove", onActivity);
    };
  }, [handleUserActivity]);

  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (
      showAudioMenu ||
      showSubMenu ||
      showPlaylist ||
      (paused && !isSwitchingVideoRef.current) ||
      isToolsMenuOpen ||
      isComparing ||
      mediaDelete.menu ||
      mediaDelete.pendingDelete
    ) {
      setShowControls(true);
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    } else {
      resetControlsTimeout();
    }
  }, [
    showAudioMenu,
    showSubMenu,
    showPlaylist,
    paused,
    isToolsMenuOpen,
    isComparing,
    mediaDelete.menu,
    mediaDelete.pendingDelete,
    resetControlsTimeout,
  ]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(isNowFullscreen);
      if (!isNowFullscreen) {
        setShowControls(true);
      } else {
        ignoreNextActivityRef.current = true;
        setShowControls(false);
      }
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
      if (fastForwardIntervalRef.current) window.clearInterval(fastForwardIntervalRef.current);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (mediaDelete.pendingDelete || isComparing) return;

      if (
        e.key === "Delete" ||
        e.key === "Del" ||
        e.key === "Supr" ||
        e.code === "Delete"
      ) {
        if (path) {
          e.preventDefault();
          mediaDelete.requestDelete({
            path,
            title,
            kind: "video",
          });
          return;
        }
      }

      // Pantalla completa (F / F11 / Alt + Enter)
      if (e.key.toLowerCase() === "f" || e.key === "F11" || (e.altKey && e.key === "Enter")) {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // Atajo de captura de fotograma (estilo VLC Shift + S)
      if (e.shiftKey && (e.key === "S" || e.key === "s")) {
        e.preventDefault();
        void takeSnapshot();
        return;
      }

      // Navegación fotograma a fotograma:
      // Tecla E (avanzar) / Shift + E (retroceder) (estilo VLC) y universal (, / .)
      if (e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (e.shiftKey) {
          stepFrameBackward();
        } else {
          stepFrameForward();
        }
        return;
      }

      // Compatibilidad universal con teclas coma (,) y punto (.)
      if (e.key === ",") {
        e.preventDefault();
        stepFrameBackward();
        return;
      }
      if (e.key === ".") {
        e.preventDefault();
        stepFrameForward();
        return;
      }

      // Atajo dedicado para enviar a segundo plano ("escuchar de fondo sin pausar"):
      // H, Shift + H, Ctrl + H o Shift + B
      if (
        (e.shiftKey && (e.key.toLowerCase() === "b" || e.key.toLowerCase() === "h")) ||
        (e.ctrlKey && e.key.toLowerCase() === "h") ||
        (e.key.toLowerCase() === "h" && !e.ctrlKey && !e.altKey && !e.metaKey)
      ) {
        e.preventDefault();
        void invoke("window_hide_to_background", { pauseVideo: false });
        return;
      }

      // Atajo para cerrar / minimizar ventana pausando vídeo (Ctrl + W)
      if (e.ctrlKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        void invoke("window_hide_to_background", { pauseVideo: true });
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
        case "f7":
        case "mediaplaypause":
          e.preventDefault();
          togglePlay();
          break;
        case "f8":
        case "mediatracknext":
          e.preventDefault();
          handleNext();
          break;
        case "f6":
        case "mediatrackprevious":
          e.preventDefault();
          handlePrevious(true);
          break;
        case "mediastop":
          e.preventDefault();
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
          }
          break;
        case "arrowleft":
          e.preventDefault();
          if (e.shiftKey) {
            if (videoRef.current) {
              const nextPos = Math.max(0, videoRef.current.currentTime - 10);
              videoRef.current.currentTime = nextPos;
              setPosition(nextPos);
              triggerSeekOsd("backward", 10);
            }
          } else {
            handlePrevious(true);
          }
          break;
        case "j":
          e.preventDefault();
          if (videoRef.current) {
            const nextPos = Math.max(0, videoRef.current.currentTime - 10);
            videoRef.current.currentTime = nextPos;
            setPosition(nextPos);
            triggerSeekOsd("backward", 10);
          }
          break;
        case "arrowright":
          e.preventDefault();
          if (e.shiftKey) {
            if (videoRef.current) {
              const nextPos = Math.min(duration, videoRef.current.currentTime + 10);
              videoRef.current.currentTime = nextPos;
              setPosition(nextPos);
              triggerSeekOsd("forward", 10);
            }
          } else {
            handleNext();
          }
          break;
        case "l":
          e.preventDefault();
          if (videoRef.current) {
            const nextPos = Math.min(duration, videoRef.current.currentTime + 10);
            videoRef.current.currentTime = nextPos;
            setPosition(nextPos);
            triggerSeekOsd("forward", 10);
          }
          break;
        case "arrowup":
        case "+":
        case "=":
        case "add":
          e.preventDefault();
          handleVolumeChange(Math.min(100, volume + 5), true);
          break;
        case "arrowdown":
        case "-":
        case "_":
        case "subtract":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 5), true);
          break;
        case "m":
          e.preventDefault();
          toggleMute(true);
          break;
        case "b":
          e.preventDefault();
          cycleAudioTrack();
          break;
        case "u":
          e.preventDefault();
          void togglePiP();
          break;
        case "c":
          e.preventDefault();
          handleOpenComparison();
          break;
        case "v":
          e.preventDefault();
          cycleSubtitle();
          break;
        case "n":
          e.preventDefault();
          handleNext();
          break;
        case "p":
          e.preventDefault();
          handlePrevious();
          break;
        case "s":
          e.preventDefault();
          handleOneShotShuffle();
          break;
        case "q":
          e.preventDefault();
          setShowPlaylist((prev) => !prev);
          break;
        case "d":
          e.preventDefault();
          if (path) {
            const nextFav = favorites.toggleFavorite(path, "video");
            setShuffleToastText(nextFav ? "❤️ Añadido a favoritos" : "🤍 Eliminado de favoritos");
            setTimeout(() => setShuffleToastText(null), 1800);
          }
          break;
        case "1":
          e.preventDefault();
          if (path) {
            const nextStatus: TakeStatus = currentMarker?.status === "good_take" ? "pending" : "good_take";
            void setTakeMarker(path, nextStatus, currentMarker?.clip_color);
            setShuffleToastText(nextStatus === "good_take" ? "🟢 Marcado: Buena Toma" : "⚪ Marca desmarcada");
            setTimeout(() => setShuffleToastText(null), 1800);
          }
          break;
        case "2":
          e.preventDefault();
          if (path) {
            const nextStatus: TakeStatus = currentMarker?.status === "reject" ? "pending" : "reject";
            void setTakeMarker(path, nextStatus, currentMarker?.clip_color);
            setShuffleToastText(nextStatus === "reject" ? "🔴 Marcado: Descarte" : "⚪ Marca desmarcada");
            setTimeout(() => setShuffleToastText(null), 1800);
          }
          break;
        case "3":
          e.preventDefault();
          if (path) {
            const nextStatus: TakeStatus = currentMarker?.status === "b_roll" ? "pending" : "b_roll";
            void setTakeMarker(path, nextStatus, currentMarker?.clip_color);
            setShuffleToastText(nextStatus === "b_roll" ? "🟠 Marcado: B-Roll" : "⚪ Marca desmarcada");
            setTimeout(() => setShuffleToastText(null), 1800);
          }
          break;
        case "0":
          e.preventDefault();
          if (path) {
            void setTakeMarker(path, "pending", currentMarker?.clip_color);
            setShuffleToastText("⚪ Marca de toma restablecida");
            setTimeout(() => setShuffleToastText(null), 1800);
          }
          break;
        case "i":
          e.preventDefault();
          setShowTechnicalHud((prev) => !prev);
          break;
        case "escape":
          e.preventDefault();
          if (mediaDelete.menu) {
            mediaDelete.closeMenu();
          } else if (isEqualizerOpen) {
            onOpenEqualizer?.();
          } else if (showPlaylist) {
            setShowPlaylist(false);
          } else if (showAudioMenu) {
            setShowAudioMenu(false);
          } else if (showSubMenu) {
            setShowSubMenu(false);
          } else if (document.fullscreenElement || isFullscreen) {
            if (document.fullscreenElement) {
              void document.exitFullscreen().catch(() => {});
            }
            setIsFullscreen(false);
            setShowControls(true);
          } else {
            void handleBack();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Integración de Control Remoto LAN de Synapse (Super Gallery)
    const onRemoteTogglePlay = () => togglePlay();
    const onRemoteNext = () => handleNext();
    const onRemotePrev = () => handlePrevious();
    const onRemoteSeek = (ev: Event) => {
      const customEv = ev as CustomEvent<{ delta: number }>;
      const delta = customEv.detail?.delta || 0;
      if (videoRef.current) {
        const nextPos = Math.max(0, Math.min(duration, videoRef.current.currentTime + delta));
        videoRef.current.currentTime = nextPos;
        setPosition(nextPos);
        if (delta !== 0) {
          triggerSeekOsd(delta > 0 ? "forward" : "backward", Math.abs(delta));
        }
      }
    };
    const onRemoteVolume = (ev: Event) => {
      const customEv = ev as CustomEvent<{ delta: number }>;
      const delta = customEv.detail?.delta || 0;
      setVolume((prevVol) => {
        const next = Math.max(0, Math.min(100, prevVol + delta));
        if (next > 0) {
          setPrevVolume(next);
        }
        if (videoRef.current) {
          videoRef.current.volume = next / 100;
        }
        if (secondaryAudioRef.current) {
          secondaryAudioRef.current.volume = next / 100;
        }
        showVolumeOsd(next, next === 0);
        return next;
      });
    };
    const onRemoteMute = () => {
      setVolume((currVol) => {
        if (currVol > 0) {
          setPrevVolume(currVol);
          if (videoRef.current) videoRef.current.volume = 0;
          if (secondaryAudioRef.current) secondaryAudioRef.current.volume = 0;
          showVolumeOsd(0, true);
          return 0;
        } else {
          const restored = prevVolume > 0 ? prevVolume : 80;
          if (videoRef.current) videoRef.current.volume = restored / 100;
          if (secondaryAudioRef.current) secondaryAudioRef.current.volume = restored / 100;
          showVolumeOsd(restored, false);
          return restored;
        }
      });
    };
    const onRemoteSubtitles = () => cycleSubtitle();
    const onRemoteAudioTrack = () => cycleAudioTrack();
    const onRemoteShuffle = () => handleOneShotShuffle();
    const onRemoteFullscreen = () => toggleFullscreen();
    const onGlobalVideoPause = () => {
      if (document.pictureInPictureElement || isPipActiveRef.current) {
        return;
      }
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      setPaused(true);
    };

    window.addEventListener("prisma-video-toggle-play", onRemoteTogglePlay);
    window.addEventListener("prisma-video-next", onRemoteNext);
    window.addEventListener("prisma-video-prev", onRemotePrev);
    window.addEventListener("prisma-video-seek", onRemoteSeek);
    window.addEventListener("prisma-video-volume", onRemoteVolume);
    window.addEventListener("prisma-video-mute", onRemoteMute);
    window.addEventListener("prisma-video-toggle-subtitles", onRemoteSubtitles);
    window.addEventListener("prisma-video-toggle-audio-track", onRemoteAudioTrack);
    window.addEventListener("prisma-video-shuffle", onRemoteShuffle);
    window.addEventListener("prisma-video-fullscreen", onRemoteFullscreen);
    window.addEventListener("prisma-video-pause", onGlobalVideoPause);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("prisma-video-toggle-play", onRemoteTogglePlay);
      window.removeEventListener("prisma-video-next", onRemoteNext);
      window.removeEventListener("prisma-video-prev", onRemotePrev);
      window.removeEventListener("prisma-video-seek", onRemoteSeek);
      window.removeEventListener("prisma-video-volume", onRemoteVolume);
      window.removeEventListener("prisma-video-mute", onRemoteMute);
      window.removeEventListener("prisma-video-toggle-subtitles", onRemoteSubtitles);
      window.removeEventListener("prisma-video-toggle-audio-track", onRemoteAudioTrack);
      window.removeEventListener("prisma-video-shuffle", onRemoteShuffle);
      window.removeEventListener("prisma-video-fullscreen", onRemoteFullscreen);
      window.removeEventListener("prisma-video-pause", onGlobalVideoPause);
    };
  }, [
    hasMedia,
    paused,
    duration,
    volume,
    prevVolume,
    showPlaylist,
    showAudioMenu,
    showSubMenu,
    isFullscreen,
    audioTracksList,
    selectedTrackIdx,
    subtitlesList,
    selectedSubIdx,
    path,
    title,
    mediaDelete.pendingDelete,
    mediaDelete.menu,
    mediaDelete.requestDelete,
    mediaDelete.closeMenu,
    onBack,
    handleNext,
    handlePrevious,
  ]);

  return (
    <section
      className={`video-player-screen ${!showControls ? "controls-hidden" : ""} ${
        isFullscreen ? "is-fullscreen-mode" : ""
      }`}
      id="video-cinema-container"
      tabIndex={-1}
      style={{ "--video-pillarbox-offset": `${videoPillarboxOffset}px` } as React.CSSProperties}
      onContextMenu={handleContextMenu}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    >
      {/* Notificación Toast */}
      {shuffleToastText ? (
        <div className="video-toast-indicator">
          <span>{shuffleToastText}</span>
        </div>
      ) : null}

      {/* Cabecera Flotante */}
      <header
        className="video-player-header"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          isHoveringControlsRef.current = true;
          if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
        }}
        onMouseLeave={() => {
          isHoveringControlsRef.current = false;
          resetControlsTimeout();
        }}
      >
        <div className="video-header-left">
          <button
            aria-label="Volver a la galería"
            className="video-top-btn is-icon-only"
            onClick={() => void handleBack()}
            title="Volver (Esc)"
          >
            <Icon name="arrow-left" />
          </button>
          {currentIndex >= 0 && localVideoItems.length > 0 ? (
            <span className="video-pill-badge">
              Vídeo {currentIndex + 1} de {localVideoItems.length}
            </span>
          ) : null}
        </div>

        <div className="video-header-center">
          <h2
            className="video-player-title"
            draggable={Boolean(path)}
            onDragStart={(e) => {
              if (path) {
                handleNativeDragStart(e, path);
              }
            }}
            style={{ cursor: path ? "grab" : "default" }}
            title={path ? `${title} · Arrastrar hacia apps externas (DaVinci Resolve, Premiere, Explorer)` : title}
          >
            {title}
          </h2>
          {path ? (
            <button
              type="button"
              className="video-drag-handle-pill"
              draggable={true}
              onDragStart={(e) => handleNativeDragStart(e, path)}
              title="Mantén presionado y arrastra hacia DaVinci Resolve, Premiere, Explorer, etc."
            >
              <Icon name="film" />
              <span>Arrastrar archivo</span>
            </button>
          ) : null}
          {playbackSource?.is_proxy ? (
            <span
              className="video-pill-badge is-proxy"
              title={`Reproducción fluida por proxy de alta calidad · Códec original: ${playbackSource.codec_display}`}
            >
              ⚡ {playbackSource.codec_display}
            </span>
          ) : null}
          {currentMarker?.status && currentMarker.status !== "pending" ? (
            <span
              className={`video-pill-badge take-badge-${currentMarker.status}`}
              style={
                currentMarker.clip_color && currentMarker.clip_color !== "none"
                  ? { borderColor: getClipColorHex(currentMarker.clip_color) || undefined }
                  : undefined
              }
              title={`Toma clasificada: ${
                currentMarker.status === "good_take"
                  ? "Buena Toma"
                  : currentMarker.status === "reject"
                  ? "Descarte"
                  : "B-Roll"
              } (Pulse 0 para desmarcar)`}
            >
              {currentMarker.status === "good_take"
                ? "🟢 Buena Toma"
                : currentMarker.status === "reject"
                ? "🔴 Descarte"
                : "🟠 B-Roll"}
            </span>
          ) : null}
        </div>

        <div className="video-header-right">
          {path ? (
            <>
              <button
                aria-label={favorites.isFavorite(path) ? "Quitar de favoritos" : "Añadir a favoritos"}
                className={`video-top-btn is-icon-only ${favorites.isFavorite(path) ? "is-active" : ""}`}
                onClick={() => {
                  const nextFav = favorites.toggleFavorite(path, "video");
                  setShuffleToastText(nextFav ? "❤️ Añadido a favoritos" : "🤍 Eliminado de favoritos");
                  setTimeout(() => setShuffleToastText(null), 1800);
                }}
                title={favorites.isFavorite(path) ? "Quitar de favoritos" : "Añadir a favoritos"}
              >
                <Icon name="heart" />
              </button>
              {onOpenEqualizer && (
                <button
                  aria-label="Abrir Ecualizador & Procesador DSP de Audio"
                  className="video-top-btn is-icon-only"
                  onClick={() => {
                    if (document.fullscreenElement) {
                      void document.exitFullscreen().catch(() => {});
                    }
                    onOpenEqualizer();
                  }}
                  title="Abrir Ecualizador & Procesador DSP de Audio"
                >
                  <Icon name="equalizer" />
                </button>
              )}
              <button
                aria-label="Mover a la papelera (Supr)"
                className="video-top-btn is-icon-only"
                onClick={() => {
                  mediaDelete.requestDelete({
                    path,
                    title,
                    kind: "video",
                  });
                }}
                title="Mover a la papelera (Supr)"
              >
                <Icon name="trash" />
              </button>
              <VideoToolsMenu
                onConvert={() => {
                  window.dispatchEvent(
                    new CustomEvent("prisma-open-converter", {
                      detail: { path, mode: "video" },
                    })
                  );
                }}
                onCompare={handleOpenComparison}
                onShowInFolder={() => {
                  void invoke("show_in_file_manager", { path: cleanPath(path) }).catch((err) => {
                    console.error("Error al mostrar en explorador:", err);
                  });
                }}
                onSendToMobile={() => {
                  window.dispatchEvent(
                    new CustomEvent("prisma-send-to-supergallery", {
                      detail: { path, title },
                    })
                  );
                }}
                onCapture={() => void takeSnapshot()}
                onOpenChange={(isOpen) => setIsToolsMenuOpen(isOpen)}
                marker={currentMarker}
                onSelectStatus={(status) => {
                  if (path) {
                    void setTakeMarker(path, status, currentMarker?.clip_color);
                    setShuffleToastText(
                      status === "good_take"
                        ? "🟢 Marcado: Buena Toma"
                        : status === "reject"
                        ? "🔴 Marcado: Descarte"
                        : status === "b_roll"
                        ? "🟠 Marcado: B-Roll"
                        : "⚪ Marca desmarcada"
                    );
                    setTimeout(() => setShuffleToastText(null), 1800);
                  }
                }}
                onSelectColor={(color) => {
                  if (path) void setTakeMarker(path, currentMarker?.status || "pending", color);
                }}
                onToggleHud={() => setShowTechnicalHud((prev) => !prev)}
                hudVisible={showTechnicalHud}
              />
            </>
          ) : null}
        </div>
      </header>

      {/* Escenario de Vídeo */}
      <div className="video-stage-wrapper">
        {/* Ficha Técnica HUD flotante (activable con atajo I o desde Herramientas) */}
        <div
          className={`video-technical-hud-container ${!showControls ? "is-controls-hidden" : ""}`}
          style={{
            opacity: showTechnicalHud ? 1 : 0,
            transform: showTechnicalHud ? "translateY(0)" : "translateY(-10px)",
            pointerEvents: showTechnicalHud ? "auto" : "none",
          }}
        >
          <VideoTechnicalHud
            metadata={technicalMeta}
            loading={technicalLoading}
            visible={showTechnicalHud}
            onClose={() => setShowTechnicalHud(false)}
          />
        </div>

        <div
          className="video-stage"
          onContextMenu={handleContextMenu}
          onDoubleClick={toggleFullscreen}
          onClick={(event) => {
            if (isFastForwarding || isStageDraggingFileRef.current) return;
            if (event.detail === 1) {
              if (showControls) {
                setShowControls(false);
                if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
                controlsSuppressUntilRef.current = Date.now() + 450;
                if ("clientX" in event) {
                  lastMousePosRef.current = { x: event.clientX, y: event.clientY };
                }
              } else {
                setShowControls(true);
                resetControlsTimeout();
              }
            }
          }}
          onMouseDown={(e) => {
            if (e.button === 0 && e.detail === 1) {
              stageMouseDownPosRef.current = { x: e.clientX, y: e.clientY };
              isStageDraggingFileRef.current = false;
              fastForwardIntervalRef.current = window.setTimeout(startFastForward, 350);
            }
          }}
          onMouseMove={(e) => {
            if (stageMouseDownPosRef.current && e.buttons === 1 && path && !isStageDraggingFileRef.current) {
              const dx = e.clientX - stageMouseDownPosRef.current.x;
              const dy = e.clientY - stageMouseDownPosRef.current.y;
              if (Math.hypot(dx, dy) > 10) {
                isStageDraggingFileRef.current = true;
                if (fastForwardIntervalRef.current) {
                  window.clearTimeout(fastForwardIntervalRef.current);
                  fastForwardIntervalRef.current = null;
                }
                if (isFastForwarding) {
                  stopFastForward();
                }
                void startNativeFileDrag(path, { previewElement: document.querySelector(".video-stage-surface") });
              }
            }
          }}
          onMouseUp={() => {
            stageMouseDownPosRef.current = null;
            setTimeout(() => {
              isStageDraggingFileRef.current = false;
            }, 120);
            if (fastForwardIntervalRef.current) {
              window.clearTimeout(fastForwardIntervalRef.current);
              fastForwardIntervalRef.current = null;
            }
            if (isFastForwarding) {
              stopFastForward();
            }
          }}
        >
          {hasMedia ? (
            isResolvingSource ? (
              <div className="video-empty-stage is-loading">
                <div className="video-loading-spinner" />
                <h3>Optimizando vídeo de alta fidelidad</h3>
                <p>Generando copia de visualización fluida para {path?.split(/[\\/]/).pop()}...</p>
                <span className="video-loading-subtext">Códec profesional detectado</span>
              </div>
            ) : videoError ? (
              <div className="video-empty-stage is-error">
                <Icon name="info" />
                <h3>No se pudo proyectar este vídeo</h3>
                <p>
                  {resolveError ||
                    (playbackSource?.original_codec
                      ? `El códec ${playbackSource.codec_display} (${playbackSource.original_codec}) requiere un decodificador externo.`
                      : "El formato o contenedor no es compatible con el motor de proyección directa.")}
                </p>
                <div className="video-error-actions">
                  <button
                    className="video-action-btn"
                    onClick={() => {
                      if (path) void invoke("open_path_with_default_app", { path: cleanPath(path) });
                    }}
                    type="button"
                  >
                    <Icon name="external-link" />
                    <span>Abrir en reproductor del sistema</span>
                  </button>
                  <button
                    className="video-action-btn"
                    onClick={() => {
                      if (path) {
                        window.dispatchEvent(
                          new CustomEvent("prisma-open-converter", {
                            detail: { path, mode: "video" },
                          })
                        );
                      }
                    }}
                    type="button"
                  >
                    <Icon name="refresh" />
                    <span>Convertir en Prisma Convert</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video
                  autoPlay
                  className="video-stage-surface"
                  onError={(e) => {
                    const err = e.currentTarget.error;
                    // Si el reproductor web directo falla (ej. códec profesional CineForm / ProRes / RLE no reproducible directamente),
                    // solicitar resolución de proxy de alta fidelidad como respaldo automático y transparente
                    if (path && !playbackSource && !isResolvingSource) {
                      setIsResolvingSource(true);
                      setVideoError(false);
                      setResolveError(null);
                      invoke<VideoPlaybackSource>("video_get_playback_source", { path })
                        .then((src) => {
                          if (src.is_proxy && src.playback_path !== path) {
                            setPlaybackSource(src);
                            setIsResolvingSource(false);
                            setVideoError(false);
                          } else {
                            setIsResolvingSource(false);
                            const msg = src.codec_display
                              ? `El códec ${src.codec_display} (${src.original_codec}) requiere un decodificador externo.`
                              : "El formato o códec no es compatible con el reproductor.";
                            setResolveError(msg);
                            setVideoError(true);
                          }
                        })
                        .catch(() => {
                          setIsResolvingSource(false);
                          setResolveError("No se pudo proyectar este vídeo.");
                          setVideoError(true);
                        });
                      return;
                    }

                    let msg = "No se pudo decodificar el vídeo.";
                    if (err?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
                      msg = playbackSource?.codec_display
                        ? `El códec ${playbackSource.codec_display} (${playbackSource.original_codec}) no es compatible directamente con el visor web.`
                        : "El formato o códec no es compatible con el reproductor.";
                    }
                    setResolveError(msg);
                    setVideoError(true);
                  }}
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    video.muted = false;
                    setDuration(video.duration || 0);
                    setPaused(false);
                    updateVideoBounds();
                    if (initialTime && initialTime > 0) {
                      video.currentTime = initialTime;
                      setPosition(initialTime);
                    }
                    void video.play().catch(() => {});

                    // Si PiP estaba activo (ej. reemplazo de vídeo desde la galería), solicitar PiP de inmediato
                    if (isPipActiveRef.current && document.pictureInPictureEnabled) {
                      void requestPiPWithBoundedDimensions(video).catch(() => {});
                    }

                    // Si el elemento HTML5 soporta nativamente audioTracks y tiene datos, sincronizarlos
                    const rawTracks = (video as unknown as { audioTracks?: { length: number; [i: number]: AudioTrackInfo } }).audioTracks;
                    if (rawTracks && rawTracks.length > 0) {
                      const list: AudioTrackInfo[] = [];
                      for (let i = 0; i < rawTracks.length; i++) {
                        list.push({
                          index: i,
                          id: rawTracks[i].id || String(i),
                          label: rawTracks[i].label || `Pista ${i + 1}`,
                          language: rawTracks[i].language || "",
                          enabled: rawTracks[i].enabled,
                        });
                      }
                      setAudioTracksList(list);
                      const active = list.findIndex((t) => t.enabled);
                      if (active >= 0) setSelectedTrackIdx(active);
                    }
                  }}
                  onEnded={() => {
                    isSwitchingVideoRef.current = true;
                    controlsSuppressUntilRef.current = Date.now() + 1500;
                    handleNext();
                  }}
                  onPause={(e) => {
                    const v = e.currentTarget;
                    if (v.ended || (v.duration > 0 && v.currentTime >= v.duration - 0.35)) {
                      isSwitchingVideoRef.current = true;
                      controlsSuppressUntilRef.current = Date.now() + 1500;
                      return;
                    }
                    setPaused(true);
                  }}
                  onPlay={() => {
                    setPaused(false);
                    isSwitchingVideoRef.current = false;
                  }}
                  onTimeUpdate={(e) => {
                    const v = e.currentTarget;
                    if (v.duration > 0 && v.currentTime >= v.duration - 0.3) {
                      isSwitchingVideoRef.current = true;
                    }
                    setPosition(v.currentTime || 0);
                  }}
                  crossOrigin="anonymous"
                  playsInline
                  ref={videoRef}
                  src={videoSrc}
                >
                  {activeVttUrl ? (
                    <track
                      default
                      kind="subtitles"
                      label={subtitlesList[selectedSubIdx ?? 0]?.label || "Subtítulo"}
                      src={activeVttUrl}
                      srcLang={subtitlesList[selectedSubIdx ?? 0]?.language || "es"}
                    />
                  ) : null}
                </video>
                {/* Audio secundario sincronizado cuando se selecciona Pista 2 o superior */}
                <audio
                  ref={secondaryAudioRef}
                  style={{ display: "none" }}
                />
              </>
            )
          ) : (
            <div className="video-empty-stage">
              <Icon name="video" />
              <p>Selecciona un vídeo para iniciar la proyección.</p>
            </div>
          )}

          {isFastForwarding ? (
            <div className="video-ffw-indicator">
              <span>⏩ 3.0x Velocidad Rápida</span>
            </div>
          ) : null}

          {/* Destello de obturador de cámara (shutter flash) */}
          {isFlashing ? <div className="video-snapshot-flash" aria-hidden="true" /> : null}

          {/* Notificación Toast flotante de captura con miniatura */}
          {snapshotToast && snapshotToast.visible ? (
            <div
              className={`video-snapshot-toast ${snapshotToast.isError ? "is-error" : ""} ${!showControls ? "controls-hidden" : ""}`}
              role="status"
              aria-live="polite"
            >
              {snapshotToast.thumbUrl ? (
                <img
                  src={snapshotToast.thumbUrl}
                  alt="Miniatura del fotograma capturado"
                  className="video-snapshot-toast-thumb"
                />
              ) : (
                <div className="video-snapshot-toast-icon-error">
                  <Icon name="close" />
                </div>
              )}
              <div className="video-snapshot-toast-body">
                <div className="video-snapshot-toast-title">
                  <Icon name={snapshotToast.isError ? "info" : "camera"} />
                  <span>
                    {snapshotToast.isError
                      ? "Error de captura"
                      : `Fotograma capturado (${snapshotToast.timestampStr})`}
                  </span>
                </div>
                <span className="video-snapshot-toast-filename" title={snapshotToast.fileName}>
                  {snapshotToast.isError
                    ? snapshotToast.errorMessage || snapshotToast.fileName
                    : snapshotToast.fileName}
                </span>
              </div>
              <div className="video-snapshot-toast-actions">
                {!snapshotToast.isError ? (
                  <button
                    className="video-snapshot-toast-btn"
                    onClick={() => openSnapshotInFolder(snapshotToast.savedPath)}
                    title="Mostrar en el Explorador de Windows"
                  >
                    <Icon name="folder-open" />
                    <span>Mostrar</span>
                  </button>
                ) : null}
                <button
                  className="video-snapshot-toast-close"
                  onClick={dismissToast}
                  title="Cerrar notificación"
                >
                  <Icon name="close" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Barra de Controles Inferior */}
      <footer
        className="video-player-footer"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={() => {
          isHoveringControlsRef.current = true;
          if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
        }}
        onMouseLeave={() => {
          isHoveringControlsRef.current = false;
          resetControlsTimeout();
        }}
      >
        <div className="preview-progress video-seek-bar">
          <MediaProgressBar
            position={position}
            duration={duration}
            isPlaying={!paused}
            disabled={duration <= 0}
            onSeek={handleSeek}
            ariaLabel="Posición de vídeo"
          />
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="video-controls-row">
          {/* Lado Izquierdo: Velocidad, Bucle, Shuffle, Audio, Subtítulos y Cola */}
          <div className="video-controls-left">
            <button
              className="video-icon-btn video-speed-btn"
              onClick={cyclePlaybackSpeed}
              title="Velocidad de reproducción"
            >
              <span className="btn-speed-label">{playbackSpeed}x</span>
            </button>

            <button
              className={`video-icon-btn ${repeatMode !== "off" ? "is-active" : ""}`}
              onClick={toggleRepeat}
              title={`Bucle: ${
                repeatMode === "off"
                  ? "Desactivada"
                  : repeatMode === "all"
                  ? "Toda la lista"
                  : "Este vídeo"
              }`}
            >
              <Icon name="repeat" />
              {repeatMode === "one" ? <span className="repeat-badge">1</span> : null}
            </button>

            <button
              className="video-icon-btn"
              onClick={handleOneShotShuffle}
              title="Barajar cola aleatoriamente (S)"
            >
              <Icon name="shuffle" />
            </button>


            {/* Ancla Popover de Subtítulos */}
            <div className="video-popover-anchor" ref={subMenuRef}>
              <button
                className={`video-icon-btn ${showSubMenu || selectedSubIdx !== null ? "is-active" : ""}`}
                onClick={() => {
                  setShowSubMenu(!showSubMenu);
                  setShowAudioMenu(false);
                }}
                title="Subtítulos (CC / V)"
              >
                <Icon name="subtitles" />
              </button>

              {showSubMenu ? (
                <div className="video-subtitles-popover">
                  <p className="video-audio-popover-title">Subtítulos ({subtitlesList.length})</p>
                  <button
                    className={`video-audio-option ${selectedSubIdx === null ? "is-active" : ""}`}
                    onClick={() => selectSubtitle(null)}
                  >
                    <Icon name="close" />
                    <span>Desactivados</span>
                  </button>
                  {subtitlesList.map((sub) => (
                    <button
                      className={`video-audio-option ${selectedSubIdx === sub.index ? "is-active" : ""}`}
                      key={sub.index}
                      onClick={() => selectSubtitle(sub.index)}
                    >
                      <Icon name="subtitles" />
                      <span>{sub.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              aria-label="Capturar fotograma"
              className={`video-icon-btn video-snapshot-btn ${isCapturing ? "is-active" : ""}`}
              disabled={!hasMedia || isCapturing}
              onClick={() => void takeSnapshot()}
              title="Capturar fotograma (Shift+S)"
            >
              <Icon name="camera" />
            </button>
          </div>

          {/* Centro: Retroceder, -10s, Play/Pause, +10s, Avanzar */}
          <div className="video-controls-center">
            <button
              aria-label="Anterior"
              className="video-icon-btn"
              disabled={localVideoItems.length <= 1}
              onClick={() => handlePrevious(true)}
              title="Vídeo anterior (Shift+← / P)"
            >
              <Icon name="chevron-left" />
            </button>

            <button
              aria-label="Retroceder 10s"
              className="video-icon-btn"
              onClick={() => {
                if (videoRef.current) {
                  const nextPos = Math.max(0, videoRef.current.currentTime - 10);
                  videoRef.current.currentTime = nextPos;
                  setPosition(nextPos);
                  triggerSeekOsd("backward", 10);
                }
              }}
              title="Retroceder 10 segundos (← / J)"
            >
              <span className="btn-label-icon">-10s</span>
            </button>

            <button
              aria-label="Retroceder 1 fotograma"
              className="video-icon-btn video-step-btn"
              disabled={!hasMedia}
              onClick={stepFrameBackward}
              title="Retroceder 1 fotograma (Shift+E / ,)"
            >
              <span className="btn-label-icon">-1f</span>
            </button>

            <button
              className="video-play-btn"
              disabled={!hasMedia}
              onClick={togglePlay}
            >
              <Icon name={paused ? "play" : "pause"} />
              <span>{paused ? "Reproducir" : "Pausar"}</span>
            </button>

            <button
              aria-label="Avanzar 1 fotograma"
              className="video-icon-btn video-step-btn"
              disabled={!hasMedia}
              onClick={stepFrameForward}
              title="Avanzar 1 fotograma (E / .)"
            >
              <span className="btn-label-icon">+1f</span>
            </button>

            <button
              aria-label="Avanzar 10s"
              className="video-icon-btn"
              onClick={() => {
                if (videoRef.current) {
                  const nextPos = Math.min(duration, videoRef.current.currentTime + 10);
                  videoRef.current.currentTime = nextPos;
                  setPosition(nextPos);
                  triggerSeekOsd("forward", 10);
                }
              }}
              title="Avanzar 10 segundos (→ / L)"
            >
              <span className="btn-label-icon">+10s</span>
            </button>

            <button
              aria-label="Siguiente"
              className="video-icon-btn"
              disabled={localVideoItems.length <= 1}
              onClick={handleNext}
              title="Vídeo siguiente (Shift+→ / N)"
            >
              <Icon name="chevron-right" />
            </button>
          </div>

          {/* Lado Derecho: Volumen, PiP y Pantalla Completa */}
          <div className="video-controls-right">
            <div className="video-volume-group">
              <button
                aria-label={volume === 0 ? "Activar sonido" : "Silenciar"}
                className="video-icon-btn"
                onClick={() => toggleMute(true)}
                title={volume === 0 ? "Activar sonido (M)" : "Silenciar (M)"}
              >
                <Icon
                  name={
                    volume === 0
                      ? "volume-mute"
                      : volume <= 50
                      ? "volume-1"
                      : "volume"
                  }
                />
              </button>
              <input
                className="video-volume-slider"
                max={100}
                min={0}
                onChange={(e) => handleVolumeChange(Number(e.target.value), true)}
                onMouseUp={(e) => e.currentTarget.blur()}
                onPointerUp={(e) => e.currentTarget.blur()}
                type="range"
                value={volume}
              />
              <span className="video-volume-value">{volume}%</span>
            </div>

            {/* Ancla Popover de Audio y Canales */}
            <div className="video-popover-anchor" ref={audioMenuRef}>
              <button
                className={`video-icon-btn ${showAudioMenu || selectedTrackIdx > 0 || channelMode === "mono" ? "is-active" : ""}`}
                onClick={() => {
                  setShowAudioMenu(!showAudioMenu);
                  setShowSubMenu(false);
                }}
                title="Pistas de audio y canales (B)"
              >
                <Icon name="disc" />
              </button>

              {showAudioMenu ? (
                <div className="video-audio-popover">
                  {audioTracksList.length > 0 ? (
                    // API soportada y hay 2+ pistas reales detectadas
                    <>
                      <p className="video-audio-popover-title">Pistas de audio ({audioTracksList.length})</p>
                      {audioTracksList.map((track) => (
                        <button
                          className={`video-audio-option ${selectedTrackIdx === track.index ? "is-active" : ""}`}
                          key={track.index}
                          onClick={() => selectAudioTrack(track.index)}
                        >
                          <Icon name="volume" />
                          <span>{track.label || `Pista ${track.index + 1}`}</span>
                        </button>
                      ))}
                    </>
                  ) : audioApiSupported === false || audioApiSupported === null ? (
                    // API no soportada por el browser (WebView2): asumir que existe la pista principal
                    <>
                      <p className="video-audio-popover-title">Pistas de audio</p>
                      <button
                        className="video-audio-option is-active"
                        onClick={() => selectAudioTrack(0)}
                      >
                        <Icon name="volume" />
                        <span>Pista 1</span>
                      </button>
                    </>
                  ) : (
                    // API soportada pero 0 pistas: el vídeo no tiene audio
                    <>
                      <p className="video-audio-popover-title">Pistas de audio</p>
                      <p className="video-audio-popover-empty">Sin pistas</p>
                    </>
                  )}

                  <p className="video-audio-popover-title" style={{ marginTop: 8 }}>Canales de salida</p>
                  <button
                    className={`video-audio-option ${channelMode === "stereo" ? "is-active" : ""}`}
                    onClick={() => applyChannelMode("stereo")}
                  >
                    <Icon name="disc" />
                    <span>Estéreo</span>
                  </button>
                  <button
                    className={`video-audio-option ${channelMode === "mono" ? "is-active" : ""}`}
                    onClick={() => applyChannelMode("mono")}
                  >
                    <Icon name="volume" />
                    <span>Mono</span>
                  </button>
                </div>
              ) : null}
            </div>

            {localVideoItems.length > 0 ? (
              <button
                className={`video-icon-btn ${showPlaylist ? "is-active" : ""}`}
                onClick={() => setShowPlaylist(!showPlaylist)}
                title="Cola de reproducción (Q)"
              >
                <Icon name="queue" />
              </button>
            ) : null}

            <button
              aria-label="Picture-in-Picture (Ventana flotante) (U)"
              className={`video-icon-btn ${isPipActive ? "is-active" : ""}`}
              onClick={togglePiP}
              title="Picture-in-Picture (Ventana flotante) (U)"
            >
              <Icon name="pip" />
            </button>
          </div>
        </div>
      </footer>

      {/* Playlist Lateral Desplegable (Cola de Proyección) */}
      {showPlaylist && localVideoItems.length > 0 ? (
        <aside className="video-playlist-sidebar">
          <div className="video-playlist-header">
            <div className="video-playlist-title-wrap">
              <h3>Cola de Proyección</h3>
              <span className="video-playlist-badge">
                {filteredVideoItems.length !== localVideoItems.length
                  ? `${filteredVideoItems.length} de ${localVideoItems.length}`
                  : `${localVideoItems.length} ${localVideoItems.length === 1 ? "vídeo" : "vídeos"}`}
              </span>
            </div>
            <button
              aria-label="Cerrar lista (Q / Esc)"
              className="video-playlist-close"
              onClick={() => setShowPlaylist(false)}
              title="Cerrar cola (Q / Esc)"
            >
              <Icon name="close" />
            </button>
          </div>

          {/* Buscador reactivo de vídeos en la cola */}
          <div className="video-playlist-search-bar">
            <Icon name="search" />
            <input
              type="text"
              placeholder="Buscar en la cola de vídeos..."
              value={playlistSearch}
              onChange={(e) => setPlaylistSearch(e.target.value)}
              className="video-playlist-search-input"
            />
            {playlistSearch ? (
              <button
                type="button"
                className="video-playlist-search-clear"
                onClick={() => setPlaylistSearch("")}
                title="Limpiar búsqueda"
              >
                <Icon name="close" />
              </button>
            ) : null}
          </div>

          <div className="video-playlist-items">
            {filteredVideoItems.length === 0 ? (
              <div className="video-playlist-empty">
                <Icon name="search" />
                <p>No se encontraron vídeos que coincidan con &quot;{playlistSearch}&quot;</p>
              </div>
            ) : (
              filteredVideoItems.map((item) => {
                const originalIdx = localVideoItems.findIndex((it) => it.path === item.path);
                const isSelected = item.path === path;
                return (
                  <div
                    className={`video-playlist-item ${isSelected ? "is-active" : ""}`}
                    key={item.path}
                    onClick={() => onSelectVideo && onSelectVideo(item.path)}
                  >
                    <span className="video-playlist-item-idx">
                      {originalIdx >= 0 ? originalIdx + 1 : 1}
                    </span>
                    <div className="video-playlist-thumb-wrap">
                      <VideoThumbnail className="video-playlist-thumb" path={item.path} title={item.title} />
                      {isSelected ? (
                        <div className="video-playlist-playing-badge">
                          <Icon name="play" />
                        </div>
                      ) : null}
                    </div>
                    <div className="video-playlist-item-info">
                      <strong title={item.title}>{item.title}</strong>
                      <small>{cleanPath(item.relativeFolder)}</small>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      ) : null}

      {mediaDelete.menu ? (
        <ContextMenu
          items={buildContextMenuItems()}
          onClose={mediaDelete.closeMenu}
          x={mediaDelete.menu.x}
          y={mediaDelete.menu.y}
        />
      ) : null}

      {mediaDelete.pendingDelete ? (
        <ConfirmDialog
          cancelLabel="Cancelar"
          confirmLabel="Mover a la papelera"
          danger
          message={
            <span>
              Se enviará <strong>{mediaDelete.pendingDelete.title}</strong> a la papelera de
              reciclaje del sistema.
            </span>
          }
          onCancel={mediaDelete.cancelDelete}
          onConfirm={mediaDelete.confirmDelete}
          title="Mover vídeo a la papelera"
        />
      ) : null}

      {isComparing && currentVideoItem ? (
        <ImageComparisonModal
          initialItem={currentVideoItem}
          itemsList={localVideoItems}
          onClose={() => setIsComparing(false)}
        />
      ) : null}

      {/* Indicador flotante OSD de volumen: visible tanto con controles activos como ocultos */}
      <VolumeOsd
        isMuted={volumeOsd.isMuted}
        visible={volumeOsd.visible}
        volume={volumeOsd.volume}
      />

      {/* Indicador flotante OSD de avance / retroceso: micro-rebote direccional en costados */}
      <SeekOsd
        direction={seekOsd.direction}
        revision={seekOsd.revision}
        seconds={seekOsd.seconds}
        visible={seekOsd.visible}
      />
    </section>
  );
}
