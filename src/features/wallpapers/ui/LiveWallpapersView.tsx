import { useEffect, useState, useCallback, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../shared/ui/Icon";
import { VideoThumbnail } from "../../visual_library/ui/VideoThumbnail";
import { toSafeAssetUrl } from "../../../shared/mediaTree";
import {
  liveWallpapersApi,
  selectVisibleMedia,
  mediaCountLabel,
  mediaKindLabel,
  mediaNoun,
  mediaNounPlural,
  audioToggleApplies,
  type WallpaperStateSnapshot,
  type WallpaperMode,
  type WallpaperFit,
  type WallpaperMediaItem,
  type MediaKindMode,
} from "../services/liveWallpapersApi";
import "./live-wallpapers.css";
import { CompositionControls, type CompositionCategory } from "./CompositionControls";

/** Duraciones ofrecidas para una imagen estática, en segundos. */
const IMAGE_DURATION_OPTIONS = [10, 20, 30, 60];
type WallpaperTab = "video" | "image" | CompositionCategory;
const WALLPAPER_TABS: {id: WallpaperTab; label: string}[] = [
  {id:"video",label:"Vídeos"}, {id:"image",label:"Imágenes"}, {id:"ambient",label:"Ambiente"},
  {id:"dynamic",label:"Dinámicos"}, {id:"scene",label:"Escenarios 3D"},
  {id:"particles",label:"Partículas"}, {id:"parallax",label:"Parallax"},
];

function formatDisplayPath(rawPath: string): string {
  return rawPath.replace(/^\\\\\?\\/, "");
}

function cleanMediaTitle(fileName: string): string {
  return fileName.replace(/\.[a-zA-Z0-9]+$/, "");
}

function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop();
  return ext && ext !== fileName ? ext.toUpperCase() : "";
}

export function LiveWallpapersView() {
  const [state, setState] = useState<WallpaperStateSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [tab, setTab] = useState<WallpaperTab | null>(null);

  const refreshState = useCallback(async () => {
    try {
      const snap = await liveWallpapersApi.getState();
      setState(snap);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshState();
    const interval = setInterval(() => {
      void refreshState();
    }, 1500);
    return () => clearInterval(interval);
  }, [refreshState]);

  const handleStart = async () => {
    try {
      const snap = showScenes
        ? await liveWallpapersApi.setCompositorEnabled(true)
        : await liveWallpapersApi.start();
      setState(snap);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const handlePlayVideo = async (path: string) => {
    try {
      const snap = await liveWallpapersApi.playFile(path);
      setState(snap);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const handlePause = async () => {
    try {
      const snap = await liveWallpapersApi.pause();
      setState(snap);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleResume = async () => {
    try {
      const snap = await liveWallpapersApi.resume();
      setState(snap);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleNext = async () => {
    try {
      const snap = await liveWallpapersApi.next();
      setState(snap);
    } catch (err) {
      setError(String(err));
    }
  };

  const handlePrev = async () => {
    try {
      const snap = await liveWallpapersApi.prev();
      setState(snap);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleStop = async () => {
    try {
      const snap = await liveWallpapersApi.stop();
      setState(snap);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleAddFolder = async () => {
    setIsAdding(true);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Seleccionar carpeta con vídeos para Fondos Vivos",
      });

      if (selected && typeof selected === "string") {
        await liveWallpapersApi.addFolder(selected);
        await refreshState();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleFolder = async (id: string, enabled: boolean) => {
    try {
      const snap = await liveWallpapersApi.toggleFolder(id, enabled);
      setState(snap);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleRemoveFolder = async (id: string) => {
    try {
      const snap = await liveWallpapersApi.removeFolder(id);
      setState(snap);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleToggleFolderHidden = async (id: string, hidden: boolean) => {
    try {
      const snap = await liveWallpapersApi.setFolderHidden(id, hidden);
      setState(snap);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleToggleMediaHidden = async (path: string, hidden: boolean) => {
    try {
      const snap = await liveWallpapersApi.setMediaHidden(path, hidden);
      setState(snap);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  };

  /**
   * Cambia el tipo de medio de la cola. El backend aplica el modo aunque no
   * haya medios elegibles (en ese caso detiene el fondo y avisa), así que
   * después de un error hay que releer el estado para no mostrar el modo viejo.
   */
  const handleSetMediaKindMode = async (mode: MediaKindMode) => {
    try {
      setTab(mode === "image" ? "image" : "video");
      const snap = await liveWallpapersApi.setMediaKindMode(mode);
      setState(snap);
      setError(null);
    } catch (err) {
      setError(String(err));
      await refreshState();
    }
  };

  const handleSetImageDuration = async (seconds: number) => {
    try {
      const snap = await liveWallpapersApi.setImageDuration(seconds);
      setState(snap);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleRefreshSources = async () => {
    try {
      const snap = await liveWallpapersApi.refreshSources();
      setState(snap);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSetMode = async (mode: WallpaperMode) => {
    try {
      const snap = await liveWallpapersApi.setMode(mode);
      setState(snap);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSetFit = async (fit: WallpaperFit) => {
    try {
      const snap = await liveWallpapersApi.setFit(fit);
      setState(snap);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleSetAudioEnabled = async (enabled: boolean) => {
    try {
      const snap = await liveWallpapersApi.setAudioEnabled(enabled);
      setState(snap);
    } catch (err) {
      setError(String(err));
    }
  };

  const isActive = state?.isActive ?? false;
  const isPaused = state?.isPaused ?? false;
  const sources = state?.settings.sources ?? [];
  const currentMode = state?.settings.mode ?? "sequential";
  const currentFit = state?.settings.fit ?? "cover";
  const audioEnabled = state?.settings.audioEnabled ?? false;
  const kindMode = state?.settings.mediaKindMode ?? "video";
  const imageDuration = state?.settings.imageDurationSec ?? 20;
  const compositorEnabled = state?.compositorEnabled ?? false;
  const activeTab = tab ?? (compositorEnabled ? "ambient" : kindMode === "image" ? "image" : "video");
  const showScenes = activeTab !== "video" && activeTab !== "image";
  const selectTab = (next: WallpaperTab) => {
    setTab(next);
    if ((next === "video" || next === "image") && next !== kindMode) void handleSetMediaKindMode(next);
  };
  const totalMedia = state?.totalMedia ?? 0;
  const currentMediaPath = state?.currentMedia ? formatDisplayPath(state.currentMedia) : null;
  const allMedia = state?.media ?? [];

  const hiddenMediaCount = useMemo(
    () => allMedia.filter((item) => item.hidden).length,
    [allMedia]
  );

  // El medio que está en pantalla: sirve para saber si tiene audio y para
  // marcar la tarjeta correspondiente en la cuadrícula.
  const currentMediaItem: WallpaperMediaItem | null = useMemo(() => {
    if (!currentMediaPath) return null;
    return (
      allMedia.find(
        (item) =>
          formatDisplayPath(item.path) === currentMediaPath ||
          currentMediaPath.endsWith(item.name)
      ) ?? null
    );
  }, [allMedia, currentMediaPath]);

  // Los medios ocultados no se muestran ni se reproducen; solo se listan
  // en gris cuando el usuario activa el interruptor "Mostrar ocultos".
  const filteredMedia = useMemo(
    () => selectVisibleMedia(allMedia, { showHidden, query: searchQuery }),
    [allMedia, showHidden, searchQuery]
  );

  const listedCount = showHidden
    ? allMedia.length
    : allMedia.filter((item) => !item.hidden).length;

  const soundApplies = audioToggleApplies(kindMode, currentMediaItem?.kind ?? null);
  const soundTitle = soundApplies
    ? audioEnabled
      ? "Quitar el sonido del fondo. La música de Prisma sigue sonando igual."
      : "Activar el sonido del fondo. No afecta a la música de Prisma."
    : "Las imágenes no tienen audio: este control solo aplica a vídeos.";

  return (
    <div className="live-wallpapers-view">
      {/* ── Header ── */}
      <header className="live-wallpapers-header">
        <div className="live-wallpapers-title-group">
          <div className="live-wallpapers-icon-badge">
            <Icon name="sparkles" width={22} height={22} />
          </div>
          <div>
            <div className="live-wallpapers-title-line">
              <h1 className="live-wallpapers-title">Fondos Vivos</h1>
              <span className="live-wallpapers-badge">Windows</span>
            </div>
            <p className="live-wallpapers-subtitle">
              Vídeos, imágenes y fondos 3D en tu escritorio detrás de los iconos
            </p>
          </div>
        </div>

        <div className="live-wallpapers-status-pill">
          {isActive ? (
            isPaused ? (
              <span className="status-badge is-paused">
                <span className="status-dot" /> En Pausa
              </span>
            ) : (
              <span className="status-badge is-active">
                <span className="status-dot" /> Activo en Escritorio
              </span>
            )
          ) : (
            <span className="status-badge is-stopped">
              <span className="status-dot" /> Detenido
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="live-wallpapers-error-banner" role="alert">
          <Icon name="close" width={18} height={18} />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar error">
            <Icon name="close" width={14} height={14} />
          </button>
        </div>
      )}

      {/* ── Control Hero Card ── */}
      <section className="live-wallpapers-control-card">
        {/* Categorías de fondo. Los escenarios tienen su propio espacio. */}
        <div className="control-media-kind-row">
          <div className="control-segmented-block">
            <span className="segmented-label">Tipo</span>
            <div className="segmented-control wallpaper-category-tabs" role="tablist" aria-label="Categorías de fondos" onKeyDown={event=>{
              const index=WALLPAPER_TABS.findIndex(item=>item.id===activeTab);
              const next=event.key==="ArrowRight" ? (index+1)%WALLPAPER_TABS.length : event.key==="ArrowLeft" ? (index+WALLPAPER_TABS.length-1)%WALLPAPER_TABS.length
                : event.key==="Home" ? 0 : event.key==="End" ? WALLPAPER_TABS.length-1 : -1;
              if(next<0)return;
              event.preventDefault();selectTab(WALLPAPER_TABS[next].id);
              document.getElementById(`wallpaper-tab-${WALLPAPER_TABS[next].id}`)?.focus();
            }}>
              {WALLPAPER_TABS.map(item=><button key={item.id} type="button" role="tab"
                id={`wallpaper-tab-${item.id}`} aria-controls="wallpaper-category-panel"
                aria-selected={activeTab===item.id} tabIndex={activeTab===item.id?0:-1}
                className={`segmented-item ${activeTab===item.id ? "is-selected" : ""}`}
                onClick={()=>selectTab(item.id)}>{item.label}</button>)}
            </div>
          </div>

          {!showScenes && kindMode !== "video" && (
            <div className="control-segmented-block">
              <span className="segmented-label">Duración</span>
              <div
                className="segmented-control"
                role="group"
                aria-label="Segundos que una imagen permanece en pantalla"
              >
                {IMAGE_DURATION_OPTIONS.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    className={`segmented-item ${imageDuration === seconds ? "is-selected" : ""}`}
                    onClick={() => handleSetImageDuration(seconds)}
                    title={`La imagen permanece ${seconds} segundos en pantalla`}
                  >
                    <span>{seconds} s</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="control-card-main">
          <div className="control-transport-group">
            {!isActive || isPaused ? (
              <button
                type="button"
                className="live-btn-primary"
                onClick={isActive ? handleResume : handleStart}
                disabled={!showScenes && totalMedia === 0 && !isActive}
                title={isActive ? "Reanudar reproducción de fondo" : "Activar fondo en el escritorio"}
              >
                <Icon name="play" width={18} height={18} />
                <span>{isActive ? "Reanudar" : "Activar fondo"}</span>
              </button>
            ) : (
              <button
                type="button"
                className="live-btn-primary is-pause"
                onClick={handlePause}
                title="Pausar fondo de escritorio"
              >
                <Icon name="pause" width={18} height={18} />
                <span>Pausar</span>
              </button>
            )}

            <button
              type="button"
              className="live-btn-secondary"
              onClick={handlePrev}
              disabled={!state?.baseActive || totalMedia <= 1}
              title="Volver al medio anterior"
            >
              <Icon name="arrow-left" width={16} height={16} />
              <span>Anterior</span>
            </button>

            <button
              type="button"
              className="live-btn-secondary"
              onClick={handleNext}
              disabled={!state?.baseActive || totalMedia <= 1}
              title="Avanzar al siguiente medio sin cortes"
            >
              <Icon name="arrow-right" width={16} height={16} />
              <span>Siguiente</span>
            </button>

            {isActive && (
              <button
                type="button"
                className="live-btn-danger"
                onClick={handleStop}
                title="Detener fondo y liberar recursos"
              >
                <Icon name="close" width={16} height={16} />
                <span>Detener</span>
              </button>
            )}
          </div>

          {!showScenes && <div className="control-options-group">
            <div className="control-segmented-block">
              <span className="segmented-label">Modo</span>
              <div className="segmented-control" role="group" aria-label="Modo de reproducción">
                <button
                  type="button"
                  className={`segmented-item ${currentMode === "sequential" ? "is-selected" : ""}`}
                  onClick={() => handleSetMode("sequential")}
                >
                  <Icon name="repeat" width={14} height={14} />
                  <span>En orden</span>
                </button>
                <button
                  type="button"
                  className={`segmented-item ${currentMode === "shuffle" ? "is-selected" : ""}`}
                  onClick={() => handleSetMode("shuffle")}
                >
                  <Icon name="shuffle" width={14} height={14} />
                  <span>Aleatorio</span>
                </button>
              </div>
            </div>

            <div className="control-segmented-block">
              <span className="segmented-label">Encuadre</span>
              <div className="segmented-control" role="group" aria-label="Encuadre de vídeo">
                <button
                  type="button"
                  className={`segmented-item ${currentFit === "cover" ? "is-selected" : ""}`}
                  onClick={() => handleSetFit("cover")}
                >
                  <Icon name="crop" width={14} height={14} />
                  <span>Cubrir</span>
                </button>
                <button
                  type="button"
                  className={`segmented-item ${currentFit === "contain" ? "is-selected" : ""}`}
                  onClick={() => handleSetFit("contain")}
                >
                  <Icon name="fit-screen" width={14} height={14} />
                  <span>Ajustar</span>
                </button>
              </div>
            </div>

            <div className="control-segmented-block">
              <span className="segmented-label">Sonido</span>
              <button
                type="button"
                className={`sound-toggle ${audioEnabled ? "is-on" : ""} ${
                  soundApplies ? "" : "is-disabled"
                }`}
                onClick={() => handleSetAudioEnabled(!audioEnabled)}
                aria-pressed={audioEnabled}
                disabled={!soundApplies}
                title={soundTitle}
              >
                <Icon name={audioEnabled ? "volume" : "volume-mute"} width={14} height={14} />
                <span>{audioEnabled ? "Encendido" : "Apagado"}</span>
              </button>
            </div>


          </div>}
        </div>


        {/* Now Playing Strip */}
        {isActive && state?.currentMedia && (
          <div className="live-now-playing-strip">
            <div className="now-playing-indicator">
              <span className="pulse-dot" />
              <strong>Reproduciendo ahora:</strong>
            </div>
            <div className="now-playing-details">
              <span className="now-playing-name">
                {state.currentMedia.split(/[/\\]/).pop()}
              </span>
              {state.currentFolder && (
                <span className="now-playing-folder">
                  de {state.currentFolder.split(/[/\\]/).pop()}
                </span>
              )}
            </div>
            <span className="now-playing-queue-count">
              {mediaCountLabel(kindMode, totalMedia)} en cola activa
            </span>
          </div>
        )}
      </section>

      <div id="wallpaper-category-panel" role="tabpanel" aria-labelledby={`wallpaper-tab-${activeTab}`} className="wallpaper-category-panel">
      {!showScenes && state?.baseActive && <button type="button" className="live-btn-secondary" onClick={async()=>{
        try { setState(await liveWallpapersApi.stopBase()); } catch(reason) { setError(String(reason)); }
      }}>Quitar vídeo o imagen y conservar efectos</button>}
      {!showScenes && !state?.baseActive && compositorEnabled && totalMedia > 0 && <button type="button" className="live-btn-secondary" onClick={async()=>{
        try { setState(await liveWallpapersApi.start()); } catch(reason) { setError(String(reason)); }
      }}>Añadir {kindMode === "image" ? "imágenes" : "vídeos"} al fondo actual</button>}
      {activeTab !== "video" && activeTab !== "image" && <CompositionControls enabled={compositorEnabled} category={activeTab} />}

      {!showScenes && <>
      {/* ── Upper Section: Carpetas en Fila Delgada (hasta 5 por fila) ── */}
      <section className="live-folders-compact-section">
        <div className="compact-folders-header">
          <div className="compact-header-left">
            <span className="compact-section-title">Carpetas de origen ({sources.length})</span>
            <span className="compact-section-sub">Hasta 5 por fila</span>
          </div>
          <div className="compact-header-actions">
            <button
              type="button"
              className="compact-action-btn"
              onClick={handleRefreshSources}
              title="Actualizar recuento de todas las carpetas"
            >
              <Icon name="refresh" width={13} height={13} />
              <span>Actualizar</span>
            </button>
            <button
              type="button"
              className="compact-action-btn is-accent"
              onClick={handleAddFolder}
              disabled={isAdding}
              title="Añadir una nueva carpeta"
            >
              <Icon name="plus" width={13} height={13} />
              <span>Añadir carpeta</span>
            </button>
          </div>
        </div>

        {sources.length === 0 ? (
          <div className="compact-empty-folders">
            <span>No hay carpetas configuradas. Pulsa en <strong>Añadir carpeta</strong> para comenzar.</span>
          </div>
        ) : (
          <div className="compact-folders-grid">
            {sources.map((source, index) => (
              <div
                key={source.id}
                className={`compact-folder-chip ${source.enabled ? "is-enabled" : "is-disabled"} ${
                  !source.available ? "is-unavailable" : ""
                } ${source.hidden ? "is-hidden" : ""}`}
                title={`${formatDisplayPath(source.path)} (${source.mediaCount} medios)`}
              >
                <span className="chip-letter">{String.fromCharCode(65 + (index % 26))}</span>
                <span className="chip-name">{source.name}</span>
                <span className="chip-count">({source.mediaCount})</span>
                <label className="chip-toggle-switch" title={source.enabled ? "Desactivar" : "Activar"}>
                  <input
                    type="checkbox"
                    checked={source.enabled}
                    onChange={(e) => handleToggleFolder(source.id, e.target.checked)}
                  />
                  <span className="chip-toggle-slider" />
                </label>
                <button
                  type="button"
                  className="chip-eye-btn"
                  onClick={() => handleToggleFolderHidden(source.id, !source.hidden)}
                  title={
                    source.hidden
                      ? "Mostrar esta carpeta y sus medios"
                      : "Ocultar esta carpeta y sus medios"
                  }
                  aria-label={source.hidden ? "Mostrar carpeta" : "Ocultar carpeta"}
                  aria-pressed={source.hidden}
                >
                  <Icon name={source.hidden ? "eye-slash" : "eye"} width={13} height={13} />
                </button>
                <button
                  type="button"
                  className="chip-remove-btn"
                  onClick={() => handleRemoveFolder(source.id)}
                  title="Quitar carpeta"
                >
                  <Icon name="trash" width={12} height={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Main Section: Lista de Vídeos ── */}
      <section className="live-videos-list-section">
        <div className="videos-list-header">
          <div className="videos-header-title-block">
            <h2 className="videos-list-title">
              {mediaKindLabel(kindMode) === "Combinado"
                ? "Medios disponibles"
                : `${mediaKindLabel(kindMode)} disponibles`}{" "}
              ({listedCount})
            </h2>
            <p className="videos-list-subtitle">
              Haz clic en cualquier {mediaNoun(kindMode)} para reproducirlo de inmediato en tu
              fondo de pantalla
              {hiddenMediaCount > 0 && (
                <> · {hiddenMediaCount} oculto{hiddenMediaCount !== 1 ? "s" : ""}</>
              )}
            </p>
          </div>

          <div className="videos-search-box">
            <Icon name="search" width={15} height={15} />
            <input
              type="text"
              placeholder={`Buscar en la lista de ${mediaNounPlural(kindMode)}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery("")}
                title="Limpiar búsqueda"
              >
                <Icon name="close" width={13} height={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            className={`videos-visibility-toggle ${showHidden ? "is-active" : ""}`}
            onClick={() => setShowHidden((value) => !value)}
            title={
              showHidden
                ? "Dejar de mostrar los medios ocultados"
                : "Mostrar los medios ocultados en gris"
            }
            aria-pressed={showHidden}
          >
            <Icon name={showHidden ? "eye" : "eye-slash"} width={15} height={15} />
            <span>{showHidden ? "Ocultos visibles" : "Mostrar ocultos"}</span>
            {hiddenMediaCount > 0 && (
              <span className="videos-visibility-count">{hiddenMediaCount}</span>
            )}
          </button>
        </div>

        {allMedia.length === 0 ? (
          <div className="videos-empty-state">
            <div className="empty-icon-circle">
              <Icon name="video" width={32} height={32} />
            </div>
            <h3 className="empty-title">No hay {mediaNounPlural(kindMode)} disponibles</h3>
            <p className="empty-desc">
              Las carpetas activas no contienen medios compatibles (.mp4, .webm, .mkv, .jpg,
              .png) o están desactivadas.
            </p>
          </div>
        ) : filteredMedia.length === 0 ? (
          <div className="videos-empty-state">
            <p className="empty-desc">
              {searchQuery
                ? `No se encontraron ${mediaNounPlural(kindMode)} que coincidan con “${searchQuery}”.`
                : `Todos los ${mediaNounPlural(kindMode)} están ocultos. Activa “Mostrar ocultos” para verlos en gris.`}
            </p>
          </div>
        ) : (
          <div className="live-videos-grid">
            {filteredMedia.map((item, idx) => {
              const isCurrent =
                isActive &&
                currentMediaPath !== null &&
                (formatDisplayPath(item.path) === currentMediaPath ||
                  currentMediaPath.endsWith(item.name));

              return (
                <div
                  key={`${item.folderId}_${item.path}_${idx}`}
                  className={`live-video-card ${isCurrent ? "is-currently-playing" : ""} ${
                    item.hidden ? "is-hidden" : ""
                  } ${item.kind === "image" ? "is-image" : ""}`}
                  onClick={() => {
                    if (item.hidden) return;
                    void handlePlayVideo(item.path);
                  }}
                  title={
                    item.hidden
                      ? `"${item.name}" está oculto y no se reproduce`
                      : `Reproducir "${item.name}" en el fondo de pantalla`
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (!item.hidden) {
                        void handlePlayVideo(item.path);
                      }
                    }
                  }}
                >
                  <div className="live-video-card-frame">
                    {item.kind === "image" ? (
                      <img
                        className="live-video-card-thumb"
                        src={toSafeAssetUrl(item.path)}
                        alt={item.name}
                        loading="lazy"
                      />
                    ) : (
                      <VideoThumbnail
                        className="live-video-card-thumb"
                        path={item.path}
                        title={item.name}
                      />
                    )}
                    <div className="live-video-card-overlay">
                      <span className="live-card-play-btn" title="Reproducir en fondo de pantalla">
                        <Icon
                          name={item.hidden ? "eye-slash" : isCurrent ? "volume" : "play"}
                          width={18}
                          height={18}
                        />
                      </span>
                    </div>
                    <span className="live-video-card-format">
                      {getFileExtension(item.name) || (item.kind === "image" ? "IMG" : "VÍDEO")}
                    </span>
                    <button
                      type="button"
                      className="live-video-card-eye"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleToggleMediaHidden(item.path, !item.hidden);
                      }}
                      title={
                        item.hidden
                          ? "Mostrar este medio y volver a la cola"
                          : "Ocultar este medio y sacarlo de la cola"
                      }
                      aria-label={item.hidden ? "Mostrar medio" : "Ocultar medio"}
                      aria-pressed={item.hidden}
                    >
                      <Icon
                        name={item.hidden ? "eye-slash" : "eye"}
                        width={14}
                        height={14}
                      />
                    </button>
                    {item.hidden && (
                      <span className="live-video-card-hidden-badge">Oculto</span>
                    )}
                    {isCurrent && (
                      <span className="live-video-card-active-badge">
                        <span className="pulse-dot" />
                        <span>En pantalla</span>
                      </span>
                    )}
                  </div>
                  <div className="live-video-card-info">
                    <strong className="live-video-card-title" title={item.name}>
                      {cleanMediaTitle(item.name)}
                    </strong>
                    <span className="live-video-card-folder" title={item.folderName}>
                      <Icon name="folder" width={11} height={11} />
                      <span>{item.folderName}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      </>}
      </div>
    </div>
  );
}
