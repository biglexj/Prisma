import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import {
  getFlyoutSettings,
  saveFlyoutSettings,
  type FlyoutSettings,
  type FlyoutZone,
} from "../services/flyoutSettings";
import { Icon } from "../../../shared/ui/Icon";
import "./flyout-window.css";

export interface FlyoutSyncState {
  isPlaying: boolean;
  title: string;
  artist: string;
  artworkUrl: string | null;
  mediaType: "audio" | "video";
  volume: number;
  isMuted: boolean;
  duration?: number;
  currentTime?: number;
  zone?: FlyoutZone;
}

export function FlyoutWindow() {
  const [settings, setSettings] = useState<FlyoutSettings>(() => getFlyoutSettings());
  const [mediaState, setMediaState] = useState<FlyoutSyncState>({
    isPlaying: false,
    title: "Prisma",
    artist: "Listo para reproducir",
    artworkUrl: null,
    mediaType: "audio",
    volume: 50,
    isMuted: false,
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reiniciar o cancelar temporizador de ocultamiento automático
  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (settings.isPinned || isHovered) {
      return; // No ocultar mientras esté fijado o con el cursor encima
    }

    hideTimerRef.current = window.setTimeout(() => {
      void invoke("flyout_hide").catch(() => {});
    }, settings.durationMs || 3000);
  }, [settings.isPinned, settings.durationMs, isHovered]);

  // Actualizar tamaño de ventana en Rust según el contenido renderizado
  const updateWindowGeometry = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = Math.max(340, Math.ceil(rect.width) + 20);
    const height = Math.max(120, Math.ceil(rect.height) + 20);

    void invoke("flyout_set_position", {
      zone: settings.zone,
      width,
      height,
    }).catch(() => {});
  }, [settings.zone]);

  // Escuchar sincronización de estado desde la ventana principal de Prisma
  useEffect(() => {
    let unlistenSync: (() => void) | undefined;
    let unlistenVol: (() => void) | undefined;

    void listen<FlyoutSyncState>("prisma://flyout-state-sync", (event) => {
      setMediaState((prev) => ({
        ...prev,
        ...event.payload,
      }));
      resetHideTimer();
    }).then((fn) => {
      unlistenSync = fn;
    });

    void listen<number>("prisma://flyout-volume-change", (event) => {
      setMediaState((prev) => ({
        ...prev,
        volume: event.payload,
        isMuted: event.payload === 0,
      }));
      resetHideTimer();
    }).then((fn) => {
      unlistenVol = fn;
    });

    return () => {
      if (unlistenSync) unlistenSync();
      if (unlistenVol) unlistenVol();
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  // Reajustar dimensiones al expandir/colapsar o cambiar hover
  useEffect(() => {
    const timer = window.setTimeout(() => {
      updateWindowGeometry();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [isExpanded, mediaState.title, updateWindowGeometry]);

  // Reaccionar a cambios de hover para el timer
  useEffect(() => {
    if (isHovered) {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    } else {
      resetHideTimer();
    }
  }, [isHovered, resetHideTimer]);

  // Acciones de transporte hacia Prisma
  const handleTogglePlay = () => {
    void emit("prisma://flyout-action", { action: "play-pause" });
    setMediaState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
    resetHideTimer();
  };

  const handleNext = () => {
    void emit("prisma://flyout-action", { action: "next" });
    resetHideTimer();
  };

  const handlePrevious = () => {
    void emit("prisma://flyout-action", { action: "previous" });
    resetHideTimer();
  };

  const handleVolumeChange = (newVal: number) => {
    const clamped = Math.max(0, Math.min(100, newVal));
    setMediaState((prev) => ({
      ...prev,
      volume: clamped,
      isMuted: clamped === 0,
    }));
    void emit("prisma://flyout-action", {
      action: "set-volume",
      value: clamped,
    });
    resetHideTimer();
  };

  const handleToggleMute = () => {
    const nextMuted = !mediaState.isMuted;
    setMediaState((prev) => ({
      ...prev,
      isMuted: nextMuted,
    }));
    void emit("prisma://flyout-action", {
      action: "toggle-mute",
    });
    resetHideTimer();
  };

  const handleTogglePin = () => {
    const nextPinned = !settings.isPinned;
    const updated = saveFlyoutSettings({ isPinned: nextPinned });
    setSettings(updated);
    if (!nextPinned) {
      resetHideTimer();
    }
  };

  const handleClose = () => {
    void invoke("flyout_hide").catch(() => {});
  };

  const effectiveVol = mediaState.isMuted ? 0 : Math.round(mediaState.volume);

  return (
    <div
      className="prisma-flyout-wrapper"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* ── 1. Cápsula de Volumen (Superior) ── */}
        <div className="prisma-flyout-card flyout-volume-capsule">
          <button
            className="flyout-vol-btn"
            onClick={handleToggleMute}
            title={mediaState.isMuted ? "Reactivar sonido (M)" : "Silenciar (M)"}
            type="button"
          >
            <Icon
              name={
                mediaState.isMuted || effectiveVol === 0
                  ? "volume-mute"
                  : effectiveVol < 50
                  ? "volume-1"
                  : "volume"
              }
            />
          </button>

          <div className="flyout-slider-wrap">
            <input
              aria-label="Volumen Maestro"
              className="flyout-slider"
              max="100"
              min="0"
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              type="range"
              value={effectiveVol}
            />
          </div>

          <span className="flyout-vol-percent">{effectiveVol}</span>

          <button
            className={`flyout-expand-btn ${isExpanded ? "is-expanded" : ""}`}
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? "Contraer mezclador" : "Expandir mezclador"}
            type="button"
          >
            <Icon name="chevron-down" />
          </button>
        </div>

        {/* ── Panel Expandible: Mezclador de Volumen ── */}
        {isExpanded && (
          <div className="prisma-flyout-card flyout-mixer-panel">
            <div className="flyout-mixer-row">
              <div className="flyout-mixer-app-icon" title="Prisma Media Engine">
                <Icon name={mediaState.mediaType === "video" ? "video" : "music"} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--flyout-text-main)" }}>
                  Prisma (Reproductor)
                </span>
                <input
                  aria-label="Volumen de Prisma"
                  className="flyout-slider"
                  max="100"
                  min="0"
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  type="range"
                  value={effectiveVol}
                />
              </div>
              <span className="flyout-vol-percent">{effectiveVol}</span>
            </div>
          </div>
        )}

        {/* ── 2. Tarjeta de Medios (Inferior) ── */}
        <div className="prisma-flyout-card flyout-media-capsule">
          <div className="flyout-media-main-row">
            {/* Carátula / Miniatura */}
            <div className="flyout-media-art">
              {mediaState.artworkUrl ? (
                <img
                  alt={mediaState.title}
                  crossOrigin="anonymous"
                  src={mediaState.artworkUrl}
                />
              ) : (
                <Icon
                  name={mediaState.mediaType === "video" ? "film" : "disc"}
                  style={{ width: 28, height: 28, color: "var(--flyout-text-muted)" }}
                />
              )}
            </div>

            {/* Metadatos */}
            <div className="flyout-media-info">
              <span className="flyout-media-title" title={mediaState.title}>
                {mediaState.title}
              </span>
              <span className="flyout-media-artist" title={mediaState.artist}>
                {mediaState.artist}
              </span>
            </div>
          </div>

          {/* Fila de Controles de Transporte y Auxiliares */}
          <div className="flyout-controls-row">
            <div className="flyout-transport-btns">
              <button
                className="flyout-ctrl-btn"
                onClick={handlePrevious}
                title="Pista anterior"
                type="button"
              >
                <svg
                  fill="currentColor"
                  height="16"
                  viewBox="0 0 24 24"
                  width="16"
                >
                  <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                </svg>
              </button>

              <button
                className="flyout-play-btn"
                onClick={handleTogglePlay}
                title={mediaState.isPlaying ? "Pausar" : "Reproducir"}
                type="button"
              >
                {mediaState.isPlaying ? (
                  <svg
                    fill="currentColor"
                    height="20"
                    viewBox="0 0 24 24"
                    width="20"
                  >
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg
                    fill="currentColor"
                    height="20"
                    viewBox="0 0 24 24"
                    width="20"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                className="flyout-ctrl-btn"
                onClick={handleNext}
                title="Siguiente pista"
                type="button"
              >
                <svg
                  fill="currentColor"
                  height="16"
                  viewBox="0 0 24 24"
                  width="16"
                >
                  <path d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>
            </div>

            {/* Visualizador de espectro reactivo (Live Spectrum FX) */}
            {settings.showSpectrum && (
              <div
                className="flyout-spectrum-bars"
                title="Visualizador de audio en vivo"
              >
                <div
                  className={`flyout-spectrum-bar ${
                    mediaState.isPlaying ? "animating-1" : ""
                  }`}
                />
                <div
                  className={`flyout-spectrum-bar ${
                    mediaState.isPlaying ? "animating-2" : ""
                  }`}
                />
                <div
                  className={`flyout-spectrum-bar ${
                    mediaState.isPlaying ? "animating-3" : ""
                  }`}
                />
                <div
                  className={`flyout-spectrum-bar ${
                    mediaState.isPlaying ? "animating-4" : ""
                  }`}
                />
                <div
                  className={`flyout-spectrum-bar ${
                    mediaState.isPlaying ? "animating-5" : ""
                  }`}
                />
              </div>
            )}

            {/* Acciones de Badge & Pin */}
            <div className="flyout-aux-actions">
              <span className="flyout-app-badge">
                <svg
                  className="flyout-badge-icon"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="9" opacity="0.25" />
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                </svg>
                Prisma
              </span>

              <button
                className={`flyout-icon-btn ${settings.isPinned ? "is-active" : ""}`}
                onClick={handleTogglePin}
                title={
                  settings.isPinned
                    ? "Desanclar del escritorio"
                    : "Fijar como Widget persistente en el escritorio"
                }
                type="button"
              >
                <svg
                  fill={settings.isPinned ? "currentColor" : "none"}
                  height="14"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="14"
                >
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                </svg>
              </button>

              <button
                className="flyout-icon-btn"
                onClick={handleClose}
                title="Ocultar flyout"
                type="button"
              >
                <Icon name="close" style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
