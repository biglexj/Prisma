import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  liveWallpapersApi,
  mediaCountLabel,
  mediaNoun,
  mediaNounPlural,
  type WallpaperStateSnapshot,
} from "../../wallpapers/services/liveWallpapersApi";
import { VideoThumbnail } from "../../visual_library/ui/VideoThumbnail";
import { toSafeAssetUrl } from "../../../shared/mediaTree";
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
  const totalMedia = snapshot?.totalMedia ?? 0;
  const hasMedia = totalMedia > 0;
  const currentPath = snapshot?.currentMedia;
  const kindMode = snapshot?.settings.mediaKindMode ?? "video";

  const mediaName = currentPath
    ? currentPath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") || "Fondo de escritorio"
    : isActive
    ? "Reproduciendo fondo"
    : "Fondo vivo apagado";

  // Una imagen estática se muestra con su propio archivo; un vídeo usa la
  // miniatura que extrae el sistema.
  const currentIsImage = currentPath
    ? /\.(jpe?g|png|webp|bmp|gif|tiff?|avif)$/i.test(currentPath)
    : false;

  const folderSubtitle = isActive
    ? snapshot?.currentFolder
      ? `Carpeta: ${snapshot.currentFolder}`
      : "Fondo activo en escritorio"
    : hasMedia
    ? `${mediaCountLabel(kindMode, totalMedia)} configurado${
        totalMedia === 1 ? "" : "s"
      } en tus carpetas`
    : `Sin ${mediaNounPlural(kindMode)} configurados. Añade una carpeta de ${
        mediaNounPlural(kindMode)
      } para comenzar.`;

  return (
    <section
      className={`home-wallpaper-widget ${isActive ? "is-active" : "is-idle"} ${
        isPaused ? "is-paused" : ""
      }`}
      aria-label="Panel de Fondos Vivos Prisma"
    >
      <div className="home-wallpaper-left">
        <div
          className="home-wallpaper-preview"
          onClick={onOpenLiveWallpapers}
          role="button"
          tabIndex={0}
          title="Abrir galería de fondos vivos"
        >
          {currentPath ? (
            currentIsImage ? (
              <img
                className="home-wallpaper-thumbnail"
                src={toSafeAssetUrl(currentPath)}
                alt={mediaName}
              />
            ) : (
              <VideoThumbnail
                path={currentPath}
                title={mediaName}
                className="home-wallpaper-thumbnail"
                fit="cover"
              />
            )
          ) : (
            <div className="home-wallpaper-placeholder">
              <Icon name="sparkles" width={26} height={26} />
            </div>
          )}
          {isActive ? (
            <div className="home-wallpaper-preview-badge">
              <i className="pill-indicator-dot" />
            </div>
          ) : null}
        </div>

        <div className="home-wallpaper-info">
          <div className="home-wallpaper-header-line">
            <span className="home-wallpaper-kicker">
              <Icon name="sparkles" width={13} height={13} />
              FONDOS VIVOS PRISMA
            </span>
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

          <strong className="home-wallpaper-title" title={mediaName}>
            {mediaName}
          </strong>
          <span className="home-wallpaper-subtitle" title={folderSubtitle}>
            {folderSubtitle}
          </span>
        </div>
      </div>

      <div className="home-wallpaper-right">
        <div className="home-wallpaper-controls" aria-label="Controles de fondo vivo">
          {/* Retroceder */}
          <button
            type="button"
            className="home-wallpaper-btn"
            aria-label="Fondo anterior"
            title="Fondo anterior"
            onClick={handlePrev}
            disabled={loading || !isActive || totalMedia <= 1}
          >
            <Icon name="chevron-left" width={20} height={20} />
          </button>

          {/* Pausar / Reanudar */}
          <button
            type="button"
            className="home-wallpaper-btn home-wallpaper-toggle"
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
            className="home-wallpaper-btn"
            aria-label="Fondo siguiente"
            title="Fondo siguiente"
            onClick={handleNext}
            disabled={loading || !isActive || totalMedia <= 1}
          >
            <Icon name="chevron-right" width={20} height={20} />
          </button>

          {/* Encender / Apagar */}
          <button
            type="button"
            className={`home-wallpaper-btn home-wallpaper-power ${isActive ? "is-on" : "is-off"}`}
            aria-label={isActive ? "Apagar fondo vivo" : "Encender fondo vivo"}
            title={isActive ? "Apagar fondo vivo" : "Encender fondo vivo"}
            onClick={handleTogglePower}
            disabled={loading || (!isActive && !hasMedia)}
          >
            <Icon name={isActive ? "close" : "sparkles"} width={18} height={18} />
          </button>
        </div>

        {/* Abrir galería completa */}
        {onOpenLiveWallpapers ? (
          <button
            type="button"
            className="home-wallpaper-open-btn"
            onClick={onOpenLiveWallpapers}
            title="Abrir galería de fondos vivos"
          >
            <span>Ver galería</span>
            <Icon name="chevron-right" width={14} height={14} />
          </button>
        ) : null}
      </div>
    </section>
  );
}
