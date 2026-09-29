import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import {
  FLYOUT_SETTINGS_EVENT, getFlyoutSettings, saveFlyoutSettings,
  type FlyoutSettings, type FlyoutZone,
} from "../services/flyoutSettings";
import { createSystemVolumeWriter, type SystemVolumeState } from "../services/systemVolumeWriter";
import { createFlyoutAutoHide } from "../services/flyoutAutoHide";
import { FLYOUT_THEME_EVENT, type FlyoutTheme } from "../services/flyoutTheme";
import { Icon } from "../../../shared/ui/Icon";
import "./flyout-window.css";

export interface FlyoutSyncState {
  isPlaying: boolean;
  title: string;
  artist: string;
  artworkUrl: string | null;
  mediaType: "audio" | "video";
}

function PlaybackIndicator({ active }: { active: boolean }) {
  return (
    <span className={`flyout-playback-indicator${active ? " is-playing" : ""}`}
      role="img" aria-label="Reproduciendo" title="Indicador de reproducción">
      <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
    </span>
  );
}

export function FlyoutWindow() {
  const [settings, setSettings] = useState<FlyoutSettings>(() => getFlyoutSettings());
  const [mediaState, setMediaState] = useState<FlyoutSyncState>({
    isPlaying: false, title: "", artist: "", artworkUrl: null, mediaType: "audio",
  });
  const [systemVolume, setSystemVolume] = useState<SystemVolumeState | null>(null);
  const [volumeError, setVolumeError] = useState(false);
  const [visible, setVisible] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const mode = localStorage.getItem("prisma_theme");
    return mode === "dark" || (mode !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)
      ? "dark" : "light";
  });
  const [showOptions, setShowOptions] = useState(false);
  const [isAtLimit, setIsAtLimit] = useState(false);
  const autoHideRef = useRef<ReturnType<typeof createFlyoutAutoHide> | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const limitPulseTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<ReturnType<typeof createSystemVolumeWriter> | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const resetHideTimer = useCallback(() => {
    autoHideRef.current?.activity();
  }, []);

  const updateWindowGeometry = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    void invoke("flyout_set_position", {
      zone: settings.zone, width: 368, height: Math.ceil(container.getBoundingClientRect().height) + 24,
    }).catch(console.error);
  }, [settings.zone]);

  useEffect(() => {
    let disposed = false;
    let presentationReceived = false;
    const autoHide = createFlyoutAutoHide({
      duration: () => settingsRef.current.durationMs || 1000,
      isHeld: () => settingsRef.current.isPinned || Boolean(containerRef.current?.querySelector(".prisma-flyout-card:hover")),
      hide: () => { void invoke("flyout_hide").catch(console.error); },
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: (timer) => window.clearTimeout(timer),
    });
    autoHideRef.current = autoHide;
    const writer = createSystemVolumeWriter(
      (state) => invoke<SystemVolumeState>("flyout_set_system_volume", { volume: state.volume, muted: state.isMuted }),
      (state) => { setSystemVolume(state); setVolumeError(false); },
      (error) => {
        console.error("No se pudo ajustar el volumen global", error);
        setVolumeError(true);
        void invoke<SystemVolumeState>("flyout_get_system_volume").then((state) => {
          if (!disposed) setSystemVolume(state);
        }).catch(() => {});
      },
    );
    writerRef.current = writer;
    const updateVolume = (state: SystemVolumeState) => {
      if (!disposed && !writer.busy) { setSystemVolume(state); setVolumeError(false); }
    };
    const subscriptions = [
      listen<FlyoutSyncState>("prisma://flyout-state-sync", ({ payload }) => {
        if (disposed) return;
        // Read only media fields; the player cannot overwrite Windows volume.
        setMediaState({ isPlaying: payload.isPlaying, title: payload.title,
          artist: payload.artist, artworkUrl: payload.artworkUrl, mediaType: payload.mediaType });
      }),
      listen<SystemVolumeState>("prisma://system-volume-changed", ({ payload }) => {
        updateVolume(payload);
      }),
      listen("prisma://flyout-shown", () => {
        if (disposed) return;
        presentationReceived = true;
        setVisible(true);
        autoHide.shown();
        void invoke<SystemVolumeState>("flyout_get_system_volume").then(updateVolume).catch(() => { if (!disposed) setVolumeError(true); });
      }),
      listen("prisma://flyout-hidden", () => {
        if (disposed) return;
        presentationReceived = true;
        setVisible(false);
        setShowOptions(false);
        autoHide.hidden();
      }),
      listen<FlyoutSettings>(FLYOUT_SETTINGS_EVENT, ({ payload }) => { if (!disposed) setSettings(payload); }),
      listen<FlyoutTheme>(FLYOUT_THEME_EVENT, ({ payload }) => {
        if (disposed) return;
        setTheme(payload.mode);
        document.documentElement.style.setProperty("--flyout-theme-primary", payload.primary);
        document.documentElement.style.setProperty("--flyout-theme-secondary", payload.secondary);
      }),
      listen<string>("prisma://theme-changed", ({ payload }) => {
        if (disposed) return;
        setTheme(payload === "dark" || (payload === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
          ? "dark" : "light");
      }),
    ];
    void Promise.all(subscriptions).then(() => {
      if (!disposed) void emit("prisma://flyout-request-state");
    });
    void invoke<boolean>("flyout_is_visible").then((value) => {
      if (!disposed && !presentationReceived) {
        setVisible(value);
        if (value) autoHide.shown();
      }
    }).catch(() => {});
    void invoke<SystemVolumeState>("flyout_get_system_volume").then((state) => {
      if (!disposed) updateVolume(state);
    }).catch(() => { if (!disposed) setVolumeError(true); });
    return () => {
      disposed = true;
      autoHide.hidden();
      writer.dispose();
      void Promise.all(subscriptions).then((unlisten) => unlisten.forEach((fn) => fn()));
      if (limitPulseTimerRef.current !== null) window.clearTimeout(limitPulseTimerRef.current);
    };
  }, []);

  const hasActiveMedia = mediaState.isPlaying && Boolean(mediaState.title);
  useEffect(() => { updateWindowGeometry(); }, [hasActiveMedia, showOptions, settings.showSpectrum, updateWindowGeometry]);
  useEffect(() => { resetHideTimer(); }, [settings.isPinned, settings.durationMs, resetHideTimer]);

  const handleSelectZone = (zone: FlyoutZone) => {
    setSettings(saveFlyoutSettings({ zone }));
    setShowOptions(false);
    resetHideTimer();
  };
  const handleTogglePin = () => setSettings(saveFlyoutSettings({ isPinned: !settings.isPinned }));
  const transport = (action: string) => {
    void emit("prisma://flyout-action", { action });
    resetHideTimer();
  };
  const handleTogglePlay = () => transport("play-pause");
  const handleNext = () => transport("next");
  const handlePrevious = () => transport("previous");
  const handleVolumeChange = (newVal: number) => {
    const volume = Math.max(0, Math.min(100, newVal));
    const next = { volume, isMuted: false };
    setSystemVolume(next);
    writerRef.current?.set(next);
    resetHideTimer();
  };
  const handleToggleMute = () => {
    if (!systemVolume) return;
    const next = { ...systemVolume, isMuted: !systemVolume.isMuted };
    setSystemVolume(next);
    writerRef.current?.set(next);
    resetHideTimer();
  };
  const pulseLimit = () => {
    setIsAtLimit(true);
    if (limitPulseTimerRef.current !== null) window.clearTimeout(limitPulseTimerRef.current);
    limitPulseTimerRef.current = window.setTimeout(() => setIsAtLimit(false), 250);
  };
  const effectiveVol = Math.round(systemVolume?.volume ?? 0);


  return (
    <div
      className="prisma-flyout-wrapper"
      data-theme={theme}
      onMouseEnter={resetHideTimer}
      onMouseLeave={resetHideTimer}
    >
      <div ref={containerRef} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* ── 1. Cápsula de Volumen (Superior, estilo Fluent/Windows 11) ── */}
        <div className={`prisma-flyout-card flyout-volume-capsule ${isAtLimit ? "is-at-limit" : ""}`}>
          <button
            className="flyout-vol-btn"
            onClick={handleToggleMute}
            title={systemVolume?.isMuted ? "Reactivar sonido de Windows" : "Silenciar Windows"}
            aria-label={systemVolume?.isMuted ? "Reactivar sonido de Windows" : "Silenciar Windows"}
            disabled={!systemVolume}
            type="button"
          >
            <Icon
              name={
                systemVolume?.isMuted || effectiveVol === 0
                  ? "volume-mute"
                  : effectiveVol < 50
                  ? "volume-1"
                  : "volume"
              }
            />
          </button>

          <div className="flyout-slider-wrap">
            <input
              aria-label="Volumen global de Windows"
              aria-valuetext={`${effectiveVol}%${systemVolume?.isMuted ? ", silenciado" : ""}`}
              disabled={!systemVolume}
              className="flyout-slider"
              max="100"
              min="0"
              step="1"
              onKeyDown={(event) => {
                if ((event.key === "ArrowRight" && effectiveVol === 100) ||
                    (event.key === "ArrowLeft" && effectiveVol === 0)) pulseLimit();
              }}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              style={{ "--vol-pct": `${effectiveVol}%` } as React.CSSProperties}
              type="range"
              value={effectiveVol}
            />
          </div>

          <span className="flyout-vol-percent" title={volumeError ? "No se pudo leer o ajustar el volumen de Windows" : "Volumen de Windows"}>
            {volumeError ? "—" : systemVolume ? effectiveVol : "…"}
          </span>

          <button
            className={`flyout-expand-btn ${showOptions ? "is-open" : ""}`}
            onClick={() => {
              setShowOptions((prev) => !prev);
              resetHideTimer();
            }}
            title={showOptions ? "Ocultar opciones" : "Opciones y posición del flyout"}
            type="button"
          >
            <Icon
              name={showOptions ? "chevron-up" : "chevron-down"}
              style={{ width: 14, height: 14 }}
            />
          </button>
        </div>

        {/* Panel de Opciones Expandible (al pulsar ⌃) */}
        {showOptions && (
          <div className="prisma-flyout-card flyout-options-panel">
            <div className="flyout-options-header">
              <span className="flyout-options-title">Posición en pantalla</span>
              <button
                className={`flyout-pin-btn ${settings.isPinned ? "is-pinned" : ""}`}
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
                  height="13"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="13"
                >
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                </svg>
                <span>{settings.isPinned ? "Fijado" : "Fijar"}</span>
              </button>
            </div>

            <div className="flyout-zones-grid">
              <button
                className={`flyout-zone-cell ${settings.zone === "top-left" ? "is-active" : ""}`}
                onClick={() => handleSelectZone("top-left")}
                type="button"
              >
                ↖ Arriba Izq
              </button>
              <button
                className={`flyout-zone-cell ${settings.zone === "top-center" ? "is-active" : ""}`}
                onClick={() => handleSelectZone("top-center")}
                type="button"
              >
                ↑ Arriba Centro
              </button>
              <button
                className={`flyout-zone-cell ${settings.zone === "top-right" ? "is-active" : ""}`}
                onClick={() => handleSelectZone("top-right")}
                type="button"
              >
                ↗ Arriba Der
              </button>
              <button
                className={`flyout-zone-cell ${settings.zone === "bottom-left" ? "is-active" : ""}`}
                onClick={() => handleSelectZone("bottom-left")}
                type="button"
              >
                ↙ Abajo Izq
              </button>
              <button
                className={`flyout-zone-cell ${settings.zone === "bottom-center" ? "is-active" : ""}`}
                onClick={() => handleSelectZone("bottom-center")}
                type="button"
              >
                ↓ Abajo Centro
              </button>
              <button
                className={`flyout-zone-cell ${settings.zone === "bottom-right" ? "is-active" : ""}`}
                onClick={() => handleSelectZone("bottom-right")}
                type="button"
              >
                ↘ Abajo Der
              </button>
            </div>
          </div>
        )}

        {/* ── 2. Tarjeta de Medios (Inferior, estilo FluentFlyout) ── */}
        {hasActiveMedia && (
          <div className="prisma-flyout-card flyout-media-capsule">
            {/* Carátula / Miniatura a la izquierda */}
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

            {/* Columna derecha con Info y Controles */}
            <div className="flyout-media-body">
              <div className="flyout-media-info">
                <div className="flyout-media-heading">
                  <span className="flyout-media-title" title={mediaState.title}>
                    {mediaState.title}
                  </span>
                  {settings.showSpectrum && <PlaybackIndicator active={visible && hasActiveMedia} />}
                </div>
                <span className="flyout-media-artist" title={mediaState.artist}>
                  {mediaState.artist}
                </span>
              </div>

              {/* Fila de Controles: botones a la izquierda, logo Prisma al final */}
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
                      height="15"
                      viewBox="0 0 24 24"
                      width="15"
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
                        height="18"
                        viewBox="0 0 24 24"
                        width="18"
                      >
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                      </svg>
                    ) : (
                      <svg
                        fill="currentColor"
                        height="18"
                        viewBox="0 0 24 24"
                        width="18"
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
                      height="15"
                      viewBox="0 0 24 24"
                      width="15"
                    >
                      <path d="m6 18 8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                    </svg>
                  </button>
                </div>

                {/* Badge al final a la derecha: logo oficial colorido de Prisma + texto "Prisma" */}
                <div className="flyout-app-badge" title="Prisma">
                  <img
                    alt="Prisma"
                    className="flyout-badge-logo"
                    src="/icon/icon.png"
                  />
                  <span>Prisma</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
