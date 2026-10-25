import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  liveWallpapersApi,
  type WallpaperStateSnapshot,
} from "../../wallpapers/services/liveWallpapersApi";
import { VideoThumbnail } from "../../visual_library/ui/VideoThumbnail";
import { Icon } from "../../../shared/ui/Icon";
import "./home-wallpaper-widget.css";

export interface HomeWallpaperWidgetProps {
  onOpenLiveWallpapers?: () => void;
}

export function HomeWallpaperWidget({ onOpenLiveWallpapers }: HomeWallpaperWidgetProps) {
  const [snapshot, setSnapshot] = useState<WallpaperStateSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshState = useCallback(async () => {
    try {
      const snap = await liveWallpapersApi.getState();
      setSnapshot(snap);
    } catch (err) {
      console.warn("[HomeWallpaperWidget] Error al leer estado de fondo vivo:", err);
    }
  }, []);

  useEffect(() => {
    refreshState();

    let unlisten: (() => void) | undefined;
    listen("prisma://wallpaper-state-changed", () => {
      refreshState();
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [refreshState]);

  const handleTogglePower = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (snapshot?.isActive) {
        const snap = await liveWallpapersApi.stop();
        setSnapshot(snap);
      } else {
        const snap = await liveWallpapersApi.start();
        setSnapshot(snap);
      }
    } catch (err) {
      console.error("[HomeWallpaperWidget] Error al alternar encendido:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePause = async () => {
    if (loading || !snapshot?.isActive) return;
    setLoading(true);
    try {
      if (snapshot.isPaused) {
        const snap = await liveWallpapersApi.resume();
        setSnapshot(snap);
      } else {
        const snap = await liveWallpapersApi.pause();
        setSnapshot(snap);
      }
    } catch (err) {
      console.error("[HomeWallpaperWidget] Error al alternar pausa:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const snap = await liveWallpapersApi.next();
      setSnapshot(snap);
    } catch (err) {
      console.error("[HomeWallpaperWidget] Error al avanzar fondo:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrev = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const snap = await liveWallpapersApi.prev();
      setSnapshot(snap);
    } catch (err) {
      console.error("[HomeWallpaperWidget] Error al retroceder fondo:", err);
    } finally {
      setLoading(false);
    }
  };

  const isActive = Boolean(snapshot?.isActive);
  const isPaused = Boolean(snapshot?.isPaused);
  const hasVideos = (snapshot?.totalVideos ?? 0) > 0;
  const currentPath = snapshot?.currentVideo;

  const videoName = currentPath
    ? currentPath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") || "Fondo de escritorio"
    : "Sin reproducción";

  const folderName = snapshot?.currentFolder || "Fondos vivos Prisma";

  return (
    <div
      className={`home-wallpaper-widget ${isActive ? "is-active" : "is-idle"} ${
        isPaused ? "is-paused" : ""
      }`}
      aria-label="Control de Fondos Vivos"
    >
      <div className="home-wallpaper-header">
        <div className="home-wallpaper-badge">
          <Icon name="sparkles" width={14} height={14} />
          <span>FONDOS VIVOS</span>
        </div>
        <div className="home-wallpaper-status-pill">
          {isActive ? (
            isPaused ? (
              <span className="pill-paused">En pausa</span>
            ) : (
              <span className="pill-active">
                <i className="pill-indicator-dot" /> En escritorio
              </span>
            )
          ) : (
            <span className="pill-idle">Apagado</span>
          )}
        </div>
      </div>

      <div className="home-wallpaper-body">
        <div
          className="home-wallpaper-preview"
          onClick={onOpenLiveWallpapers}
          role="button"
          tabIndex={0}
          title="Abrir galería de fondos vivos"
        >
          {currentPath ? (
            <VideoThumbnail
              path={currentPath}
              title={videoName}
              className="home-wallpaper-thumbnail"
              fit="cover"
            />
          ) : (
            <div className="home-wallpaper-placeholder">
              <Icon name="sparkles" width={22} height={22} />
            </div>
          )}
        </div>
        <div className="home-wallpaper-info">
          <strong title={videoName}>{videoName}</strong>
          <span title={folderName}>
            {isActive
              ? folderName
              : hasVideos
              ? `${snapshot?.totalVideos} vídeos disponibles`
              : "Añade una carpeta de vídeos"}
          </span>
        </div>
      </div>

      <div className="home-wallpaper-controls" aria-label="Controles de fondo vivo">
        {/* Retroceder */}
        <button
          type="button"
          aria-label="Fondo anterior"
          title="Fondo anterior"
          onClick={handlePrev}
          disabled={loading || !isActive || (snapshot?.totalVideos ?? 0) <= 1}
        >
          <Icon name="chevron-left" width={19} height={19} />
        </button>

        {/* Pausar / Reanudar */}
        <button
          type="button"
          className="home-wallpaper-toggle"
          aria-label={isPaused ? "Reanudar fondo vivo" : "Pausar fondo vivo"}
          title={isPaused ? "Reanudar fondo vivo" : "Pausar fondo vivo"}
          onClick={handleTogglePause}
          disabled={loading || !isActive}
        >
          <Icon name={isPaused ? "play" : "pause"} width={20} height={20} />
        </button>

        {/* Avanzar */}
        <button
          type="button"
          aria-label="Fondo siguiente"
          title="Fondo siguiente"
          onClick={handleNext}
          disabled={loading || !isActive || (snapshot?.totalVideos ?? 0) <= 1}
        >
          <Icon name="chevron-right" width={19} height={19} />
        </button>

        {/* Encender / Apagar */}
        <button
          type="button"
          className={`home-wallpaper-power ${isActive ? "is-active" : ""}`}
          aria-label={isActive ? "Apagar fondo vivo" : "Encender fondo vivo"}
          title={isActive ? "Apagar fondo vivo" : "Encender fondo vivo"}
          onClick={handleTogglePower}
          disabled={loading || (!isActive && !hasVideos)}
        >
          <Icon name={isActive ? "close" : "sparkles"} width={17} height={17} />
        </button>

        {/* Abrir galería completa */}
        {onOpenLiveWallpapers ? (
          <button
            type="button"
            className="home-wallpaper-open-btn"
            aria-label="Abrir galería de fondos"
            title="Abrir galería de fondos"
            onClick={onOpenLiveWallpapers}
          >
            <Icon name="expand" width={16} height={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
