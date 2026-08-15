import { useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { formatTime, mediaTitle } from "../../playback/ui/formatters";
import { Icon } from "../../../shared/ui/Icon";
import { ConfirmDialog } from "../../../shared/ui/ConfirmDialog";
import { ContextMenu } from "../../../shared/ui/ContextMenu";
import { cleanPath, toPlatformPath } from "../../../shared/mediaTree";
import type { VisualLibraryItem } from "../model/types";
import { VideoThumbnail } from "./VideoThumbnail";
import { useFavorites } from "../../../shared/useFavorites";
import { useMediaDelete } from "../../../shared/useMediaDelete";
import "./video-player.css";

interface VideoPlayerProps {
  path: string | null;
  videoItems?: VisualLibraryItem[];
  onBack: () => void;
  onSelectVideo?: (path: string) => void;
  /** Notifica a App.tsx cuándo entra/sale del modo Picture-in-Picture */
  onPipChange?: (active: boolean, reason?: "restore" | "close") => void;
  confirmDeletion?: boolean;
  onRefresh?: () => void | Promise<void>;
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

export function VideoPlayer({
  path,
  videoItems = [],
  onBack,
  onSelectVideo,
  onPipChange,
  confirmDeletion = true,
  onRefresh,
}: VideoPlayerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFastForwarding, setIsFastForwarding] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [prevVolume, setPrevVolume] = useState(80);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showControls, setShowControls] = useState(true);

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

  // Picture-in-Picture State
  const [isPipActive, setIsPipActive] = useState(false);
  const isPipActiveRef = useRef(false);
  isPipActiveRef.current = isPipActive;
  const explicitAppToggleRef = useRef(false);

  const favorites = useFavorites();
  const isFav = path ? favorites.isFavorite(path) : false;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const fastForwardIntervalRef = useRef<number | null>(null);
  const audioMenuRef = useRef<HTMLDivElement | null>(null);
  const subMenuRef = useRef<HTMLDivElement | null>(null);

  const hasMedia = Boolean(path);
  const title = path ? mediaTitle(path) : "Sin vídeo seleccionado";
  const videoSrc = path ? convertFileSrc(toPlatformPath(path)) : "";

  // Sincronizar cola local si cambian los props
  useEffect(() => {
    setLocalVideoItems(videoItems);
  }, [videoItems]);

  // Auto-detect current index in video list
  const currentIndex = localVideoItems.findIndex((item) => item.path === path);
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
        id: "show",
        label: "Mostrar en carpeta",
        icon: "folder-open" as const,
        onSelect: () => {
          void invoke("show_in_file_manager", { path: target.item.path }).catch(() => {});
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

        const audioSrc = convertFileSrc(toPlatformPath(audioFilePath));
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

  // handleBack: pausa el vídeo y sale de PiP antes de notificar a App.tsx
  const handleBack = () => {
    // Pausar inmediatamente para evitar audio residual durante el desmontaje
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
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
    if (repeatMode === "one" && videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play();
      return;
    }
    if (hasNext && onSelectVideo) {
      onSelectVideo(localVideoItems[currentIndex + 1].path);
    } else if (repeatMode === "all" && localVideoItems.length > 0 && onSelectVideo) {
      onSelectVideo(localVideoItems[0].path);
    }
  };

  const handlePrevious = () => {
    if (position > 3 && videoRef.current) {
      videoRef.current.currentTime = 0;
      return;
    }
    if (hasPrevious && onSelectVideo) {
      onSelectVideo(localVideoItems[currentIndex - 1].path);
    } else if (repeatMode === "all" && localVideoItems.length > 0 && onSelectVideo) {
      onSelectVideo(localVideoItems[localVideoItems.length - 1].path);
    }
  };

  const toggleRepeat = () => {
    setRepeatMode((prev) => (prev === "off" ? "all" : prev === "all" ? "one" : "off"));
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

  const handleSeek = (newTime: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = newTime;
    setPosition(newTime);
    if (secondaryAudioRef.current && extractedAudioUrl) {
      secondaryAudioRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (newVolume > 0) {
      setPrevVolume(newVolume);
    }
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
    }
    if (secondaryAudioRef.current) {
      secondaryAudioRef.current.volume = newVolume / 100;
    }
  };

  const toggleMute = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      handleVolumeChange(0);
    } else {
      handleVolumeChange(prevVolume > 0 ? prevVolume : 80);
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
    ignoreNextActivityRef.current = true;
    setShowControls(false);

    if (!document.fullscreenElement) {
      void container.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
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

  const handleUserActivity = () => {
    if (ignoreNextActivityRef.current) {
      ignoreNextActivityRef.current = false;
      return;
    }

    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    if (!paused && !showAudioMenu && !showSubMenu && !showPlaylist) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 2000);
    }
  };

  const handleMouseLeave = () => {
    if (!paused && !showAudioMenu && !showSubMenu && !showPlaylist) {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
      setShowControls(false);
    }
  };

  useEffect(() => {
    if (showAudioMenu || showSubMenu || showPlaylist || paused) {
      setShowControls(true);
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    } else {
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 2000);
    }
  }, [showAudioMenu, showSubMenu, showPlaylist, paused]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(isNowFullscreen);
      ignoreNextActivityRef.current = true;
      setShowControls(false);
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
      if (mediaDelete.pendingDelete) return;

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

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          if (videoRef.current) {
            const nextPos = Math.max(0, videoRef.current.currentTime - 10);
            videoRef.current.currentTime = nextPos;
            setPosition(nextPos);
          }
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          if (videoRef.current) {
            const nextPos = Math.min(duration, videoRef.current.currentTime + 10);
            videoRef.current.currentTime = nextPos;
            setPosition(nextPos);
          }
          break;
        case "arrowup":
          e.preventDefault();
          handleVolumeChange(Math.min(100, volume + 5));
          break;
        case "arrowdown":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 5));
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "b":
          e.preventDefault();
          cycleAudioTrack();
          break;
        case "c":
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
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "s":
          e.preventDefault();
          handleOneShotShuffle();
          break;
        case "d":
          e.preventDefault();
          if (path) {
            const nextFav = favorites.toggleFavorite(path, "video");
            setShuffleToastText(nextFav ? "❤️ Añadido a favoritos" : "🤍 Eliminado de favoritos");
            setTimeout(() => setShuffleToastText(null), 1800);
          }
          break;
        case "escape":
          e.preventDefault();
          if (mediaDelete.menu) {
            mediaDelete.closeMenu();
          } else if (showPlaylist) {
            setShowPlaylist(false);
          } else if (showAudioMenu) {
            setShowAudioMenu(false);
          } else if (showSubMenu) {
            setShowSubMenu(false);
          } else if (isFullscreen) {
            toggleFullscreen();
          } else {
            void handleBack();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
      onContextMenu={handleContextMenu}
      onMouseMove={handleUserActivity}
      onMouseLeave={handleMouseLeave}
    >
      {/* Notificación Toast */}
      {shuffleToastText ? (
        <div className="video-toast-indicator">
          <span>{shuffleToastText}</span>
        </div>
      ) : null}

      {/* Cabecera Flotante */}
      <header className={`video-player-header ${showPlaylist ? "has-sidebar-open" : ""}`}>
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
          <h2 className="video-player-title" title={title}>
            {title}
          </h2>
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
              <button
                className="video-top-btn"
                onClick={() => invoke("open_in_file_manager", { path }).catch(() => {})}
                title="Abrir ubicación en el explorador"
              >
                <Icon name="folder" />
                <span>Ubicación</span>
              </button>
            </>
          ) : null}
        </div>
      </header>

      {/* Escenario de Vídeo */}
      <div className="video-stage-wrapper">
        <div
          className="video-stage"
          onContextMenu={handleContextMenu}
          onDoubleClick={toggleFullscreen}
          onMouseDown={(e) => {
            if (e.button === 0 && e.detail === 1) {
              fastForwardIntervalRef.current = window.setTimeout(startFastForward, 350);
            }
          }}
          onMouseUp={() => {
            if (fastForwardIntervalRef.current) {
              window.clearTimeout(fastForwardIntervalRef.current);
            }
            if (isFastForwarding) {
              stopFastForward();
            }
          }}
        >
          {hasMedia ? (
            <>
              <video
                autoPlay
                className="video-stage-surface"
                onError={() => setVideoError(true)}
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  setDuration(video.duration || 0);
                  setPaused(video.paused);

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
                onPause={() => setPaused(true)}
                onPlay={() => setPaused(false)}
                onTimeUpdate={(e) => {
                  setPosition(e.currentTarget.currentTime || 0);
                }}
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
          ) : (
            <div className="video-empty-stage">
              <Icon name="video" />
              <p>
                {videoError
                  ? "No se pudo cargar el formato del archivo de vídeo."
                  : "Selecciona un vídeo para iniciar la proyección."}
              </p>
            </div>
          )}

          {isFastForwarding ? (
            <div className="video-ffw-indicator">
              <span>⏩ 3.0x Velocidad Rápida</span>
            </div>
          ) : null}
        </div>

        {/* Playlist Lateral Desplegable */}
        {showPlaylist && localVideoItems.length > 0 ? (
          <aside className="video-playlist-sidebar">
            <div className="video-playlist-header">
              <h3>Cola de Proyección ({localVideoItems.length})</h3>
              <button
                aria-label="Cerrar lista"
                className="video-playlist-close"
                onClick={() => setShowPlaylist(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="video-playlist-items">
              {localVideoItems.map((item, idx) => {
                const isSelected = item.path === path;
                return (
                  <div
                    className={`video-playlist-item ${isSelected ? "is-active" : ""}`}
                    key={item.path}
                    onClick={() => onSelectVideo && onSelectVideo(item.path)}
                  >
                    <span className="video-playlist-item-idx">{idx + 1}</span>
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
              })}
            </div>
          </aside>
        ) : null}
      </div>

      {/* Barra de Controles Inferior */}
      <footer className="video-player-footer">
        <label className="preview-progress video-seek-bar">
          <input
            max={Math.max(duration, 1)}
            min={0}
            onChange={(e) => handleSeek(Number(e.target.value))}
            step={0.1}
            type="range"
            value={position}
          />
          <span>{formatTime(position)}</span>
          <span>{formatTime(duration)}</span>
        </label>

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

            {localVideoItems.length > 0 ? (
              <button
                className={`video-icon-btn ${showPlaylist ? "is-active" : ""}`}
                onClick={() => setShowPlaylist(!showPlaylist)}
                title="Cola de reproducción"
              >
                <Icon name="queue" />
              </button>
            ) : null}
          </div>

          {/* Centro: Retroceder, -10s, Play/Pause, +10s, Avanzar */}
          <div className="video-controls-center">
            <button
              aria-label="Anterior"
              className="video-icon-btn"
              disabled={!hasPrevious && repeatMode !== "all"}
              onClick={handlePrevious}
              title="Vídeo anterior (P)"
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
                }
              }}
              title="Retroceder 10 segundos (← / J)"
            >
              <span className="btn-label-icon">-10s</span>
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
              aria-label="Avanzar 10s"
              className="video-icon-btn"
              onClick={() => {
                if (videoRef.current) {
                  const nextPos = Math.min(duration, videoRef.current.currentTime + 10);
                  videoRef.current.currentTime = nextPos;
                  setPosition(nextPos);
                }
              }}
              title="Avanzar 10 segundos (→ / L)"
            >
              <span className="btn-label-icon">+10s</span>
            </button>

            <button
              aria-label="Siguiente"
              className="video-icon-btn"
              disabled={!hasNext && repeatMode !== "all"}
              onClick={handleNext}
              title="Vídeo siguiente (N)"
            >
              <Icon name="chevron-right" />
            </button>
          </div>

          {/* Lado Derecho: Favorito, Volumen, PiP y Pantalla Completa */}
          <div className="video-controls-right">
            <button
              aria-label={isFav ? "Quitar de favoritos" : "Marcar como favorito"}
              className={`video-icon-btn video-fav-btn ${isFav ? "is-favorite is-active" : ""}`}
              disabled={!path}
              onClick={() => {
                if (path) {
                  const nextFav = favorites.toggleFavorite(path, "video");
                  setShuffleToastText(nextFav ? "❤️ Añadido a favoritos" : "🤍 Eliminado de favoritos");
                  setTimeout(() => setShuffleToastText(null), 1800);
                }
              }}
              title={isFav ? "Quitar de favoritos (D)" : "Añadir a favoritos (D)"}
            >
              <Icon name="heart" />
            </button>

            <div className="video-volume-group">
              <button
                aria-label={volume === 0 ? "Activar sonido" : "Silenciar"}
                className="video-icon-btn"
                onClick={toggleMute}
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
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                type="range"
                value={volume}
              />
              <span className="video-volume-value">{volume}%</span>
            </div>

            <button
              aria-label="Picture-in-Picture (Ventana flotante)"
              className={`video-icon-btn ${isPipActive ? "is-active" : ""}`}
              onClick={togglePiP}
              title="Picture-in-Picture (Ventana flotante)"
            >
              <Icon name="pip" />
            </button>

            <button
              aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              className="video-icon-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Salir de pantalla completa (F / Esc)" : "Pantalla completa (F)"}
            >
              <Icon name={isFullscreen ? "fullscreen-exit" : "fullscreen"} />
            </button>
          </div>
        </div>
      </footer>

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
    </section>
  );
}
