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
    volume: 80,
    isMuted: false,
  });

  // Tema del sistema o sincronizado con Prisma
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("prisma_theme");
    if (saved === "light") return "light";
    if (saved === "dark") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const [isHovered, setIsHovered] = useState(false);
  const [showZonePicker, setShowZonePicker] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincronizar tema con documentElement
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", theme === "dark");

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "prisma_theme" && e.newValue) {
        const next =
          e.newValue === "dark" ||
          (e.newValue === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
            ? "dark"
            : "light";
        setTheme(next);
      }
    };
    window.addEventListener("storage", handleStorage);

    const unlistenTheme = listen<string>("prisma://theme-changed", (event) => {
      const mode = event.payload;
      const isDark =
        mode === "dark" ||
        (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      setTheme(isDark ? "dark" : "light");
    });

    return () => {
      window.removeEventListener("storage", handleStorage);
      unlistenTheme.then((fn) => fn());
    };
  }, [theme]);

  // Reiniciar o cancelar temporizador de ocultamiento automático (3 segundos por defecto)
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

  // Actualizar tamaño y posición en Rust según el contenido renderizado (340px ancho)
  const updateWindowGeometry = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = 356;
    const height = Math.max(76, Math.ceil(rect.height) + 16);

    void invoke("flyout_set_position", {
      zone: settings.zone,
      width,
      height,
    }).catch(() => {});
  }, [settings.zone]);

  const handleSelectZone = (newZone: FlyoutZone) => {
    const updated = saveFlyoutSettings({ zone: newZone });
    setSettings(updated);
    setShowZonePicker(false);
    void invoke("flyout_set_position", { zone: newZone }).catch(() => {});
    resetHideTimer();
  };

  // Inicializar volumen del sistema al montar
  useEffect(() => {
    void invoke<{ volume: number; isMuted: boolean }>("flyout_get_system_volume")
      .then((data) => {
        if (data && typeof data.volume === "number") {
          setMediaState((prev) => ({
            ...prev,
            volume: data.volume,
            isMuted: data.isMuted,
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Escuchar sincronización de estado desde la ventana principal de Prisma y eventos de sistema
  useEffect(() => {
    let unlistenSync: (() => void) | undefined;
    let unlistenVol: (() => void) | undefined;
    let unlistenSysVol: (() => void) | undefined;

    void listen<FlyoutSyncState>("prisma://flyout-state-sync", (event) => {
      setMediaState((prev) => ({
        ...prev,
        ...event.payload,
      }));
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

    // Evento disparado directamente al pulsar teclas de volumen en el teclado
    void listen<{ volume: number; isMuted: boolean }>(
      "prisma://system-volume-changed",
      (event) => {
        setMediaState((prev) => ({
          ...prev,
          volume: event.payload.volume,
          isMuted: event.payload.isMuted,
        }));
        resetHideTimer();
      }
    ).then((fn) => {
      unlistenSysVol = fn;
    });

    return () => {
      if (unlistenSync) unlistenSync();
      if (unlistenVol) unlistenVol();
      if (unlistenSysVol) unlistenSysVol();
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  // Reajustar dimensiones al cambiar de pista o estado
  useEffect(() => {
    const timer = window.setTimeout(() => {
      updateWindowGeometry();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [mediaState.title, mediaState.isPlaying, updateWindowGeometry]);

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

    // Sincronizar en Windows y en el reproductor interno
    void invoke("flyout_set_system_volume", { volume: clamped, muted: false }).catch(() => {});
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
    void invoke("flyout_set_system_volume", {
      volume: mediaState.volume,
      muted: nextMuted,
    }).catch(() => {});
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
  const hasActiveMedia =
    Boolean(mediaState.title && mediaState.title !== "Prisma") || mediaState.isPlaying;

  return (
    <div
      className="prisma-flyout-wrapper"
      data-theme={theme}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* ── 1. Cápsula de Volumen (Superior, estilo Fluent/Windows 11) ── */}
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
              style={{ "--vol-pct": `${effectiveVol}%` } as React.CSSProperties}
              type="range"
              value={effectiveVol}
            />
          </div>

          <span className="flyout-vol-percent">{effectiveVol}</span>

          <div className="flyout-top-actions" style={{ position: "relative" }}>
            {/* Botón Selector de Posición Rápido */}
            <button
              className={`flyout-icon-btn ${showZonePicker ? "is-active" : ""}`}
              onClick={() => setShowZonePicker((p) => !p)}
              title="Cambiar posición en pantalla (6 cuadrantes)"
              type="button"
            >
              <Icon name="grid" style={{ width: 14, height: 14 }} />
            </button>

            {/* Popover con las 6 zonas de pantalla */}
            {showZonePicker && (
              <div className="flyout-zone-popover">
                <button
                  className={`flyout-zone-btn ${settings.zone === "top-left" ? "is-active" : ""}`}
                  onClick={() => handleSelectZone("top-left")}
                  title="Arriba Izquierda"
                  type="button"
                >
                  ↖️
                </button>
                <button
                  className={`flyout-zone-btn ${settings.zone === "top-center" ? "is-active" : ""}`}
                  onClick={() => handleSelectZone("top-center")}
                  title="Arriba Centro"
                  type="button"
                >
                  ⬆️
                </button>
                <button
                  className={`flyout-zone-btn ${settings.zone === "top-right" ? "is-active" : ""}`}
                  onClick={() => handleSelectZone("top-right")}
                  title="Arriba Derecha"
                  type="button"
                >
                  ↗️
                </button>
                <button
                  className={`flyout-zone-btn ${settings.zone === "bottom-left" ? "is-active" : ""}`}
                  onClick={() => handleSelectZone("bottom-left")}
                  title="Abajo Izquierda (Predeterminado)"
                  type="button"
                >
                  ↙️
                </button>
                <button
                  className={`flyout-zone-btn ${settings.zone === "bottom-center" ? "is-active" : ""}`}
                  onClick={() => handleSelectZone("bottom-center")}
                  title="Abajo Centro"
                  type="button"
                >
                  ⬇️
                </button>
                <button
                  className={`flyout-zone-btn ${settings.zone === "bottom-right" ? "is-active" : ""}`}
                  onClick={() => handleSelectZone("bottom-right")}
                  title="Abajo Derecha"
                  type="button"
                >
                  ↘️
                </button>
              </div>
            )}

            {/* Botón Pin de Escritorio */}
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
          </div>
        </div>

        {/* ── 2. Tarjeta de Medios (Inferior, solo si hay medio activo) ── */}
        {hasActiveMedia && (
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

              {/* Metadatos (Alto Contraste y 100% Legibles) */}
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

              {/* Acciones de Badge & Cerrar */}
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
        )}
      </div>
    </div>
  );
}
