import { useEffect, useState, useCallback, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../shared/ui/Icon";
import { VideoThumbnail } from "../../visual_library/ui/VideoThumbnail";
import {
  liveWallpapersApi,
  type WallpaperStateSnapshot,
  type WallpaperMode,
  type WallpaperFit,
  type WallpaperVideoItem,
} from "../services/liveWallpapersApi";
import "./live-wallpapers.css";

function formatDisplayPath(rawPath: string): string {
  return rawPath.replace(/^\\\\\?\\/, "");
}

function cleanVideoTitle(fileName: string): string {
  return fileName.replace(/\.[a-zA-Z0-9]+$/, "");
}

function getFileExtension(fileName: string): string {
  const ext = fileName.split(".").pop();
  return ext && ext !== fileName ? ext.toUpperCase() : "VÍDEO";
}

export function LiveWallpapersView() {
  const [state, setState] = useState<WallpaperStateSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
      const snap = await liveWallpapersApi.start();
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

  const isActive = state?.isActive ?? false;
  const isPaused = state?.isPaused ?? false;
  const sources = state?.settings.sources ?? [];
  const currentMode = state?.settings.mode ?? "sequential";
  const currentFit = state?.settings.fit ?? "cover";
  const totalVideos = state?.totalVideos ?? 0;
  const currentVideoPath = state?.currentVideo ? formatDisplayPath(state.currentVideo) : null;
  const allVideos = state?.videos ?? [];

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allVideos;
    return allVideos.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.folderName.toLowerCase().includes(q)
    );
  }, [allVideos, searchQuery]);

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
              Vídeos continuos en tu escritorio detrás de los iconos
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
        <div className="control-card-main">
          <div className="control-transport-group">
            {!isActive || isPaused ? (
              <button
                type="button"
                className="live-btn-primary"
                onClick={isActive ? handleResume : handleStart}
                disabled={totalVideos === 0 && !isActive}
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
              disabled={!isActive || totalVideos <= 1}
              title="Volver al vídeo anterior"
            >
              <Icon name="arrow-left" width={16} height={16} />
              <span>Anterior</span>
            </button>

            <button
              type="button"
              className="live-btn-secondary"
              onClick={handleNext}
              disabled={!isActive || totalVideos <= 1}
              title="Avanzar al siguiente vídeo sin cortes"
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

          <div className="control-options-group">
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
          </div>
        </div>

        {/* Now Playing Strip */}
        {isActive && state?.currentVideo && (
          <div className="live-now-playing-strip">
            <div className="now-playing-indicator">
              <span className="pulse-dot" />
              <strong>Reproduciendo ahora:</strong>
            </div>
            <div className="now-playing-details">
              <span className="now-playing-name">
                {state.currentVideo.split(/[/\\]/).pop()}
              </span>
              {state.currentFolder && (
                <span className="now-playing-folder">
                  de {state.currentFolder.split(/[/\\]/).pop()}
                </span>
              )}
            </div>
            <span className="now-playing-queue-count">
              {totalVideos} vídeo{totalVideos !== 1 ? "s" : ""} en cola activa
            </span>
          </div>
        )}
      </section>

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
                }`}
                title={`${formatDisplayPath(source.path)} (${source.videoCount} vídeos)`}
              >
                <span className="chip-letter">{String.fromCharCode(65 + (index % 26))}</span>
                <span className="chip-name">{source.name}</span>
                <span className="chip-count">({source.videoCount})</span>
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
            <h2 className="videos-list-title">Vídeos disponibles ({allVideos.length})</h2>
            <p className="videos-list-subtitle">
              Haz clic en cualquier vídeo para reproducirlo de inmediato en tu fondo de pantalla
            </p>
          </div>

          <div className="videos-search-box">
            <Icon name="search" width={15} height={15} />
            <input
              type="text"
              placeholder="Buscar en la lista de vídeos..."
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
        </div>

        {allVideos.length === 0 ? (
          <div className="videos-empty-state">
            <div className="empty-icon-circle">
              <Icon name="video" width={32} height={32} />
            </div>
            <h3 className="empty-title">No hay vídeos disponibles</h3>
            <p className="empty-desc">
              Las carpetas activas no contienen vídeos compatibles (.mp4, .webm, .mkv) o están desactivadas.
            </p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="videos-empty-state">
            <p className="empty-desc">No se encontraron vídeos que coincidan con &ldquo;{searchQuery}&rdquo;.</p>
          </div>
        ) : (
          <div className="live-videos-grid">
            {filteredVideos.map((video, idx) => {
              const isCurrent =
                isActive &&
                currentVideoPath !== null &&
                (formatDisplayPath(video.path) === currentVideoPath ||
                  currentVideoPath.endsWith(video.name));

              return (
                <div
                  key={`${video.folderId}_${video.path}_${idx}`}
                  className={`live-video-card ${isCurrent ? "is-currently-playing" : ""}`}
                  onClick={() => handlePlayVideo(video.path)}
                  title={`Reproducir "${video.name}" en el fondo de pantalla`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void handlePlayVideo(video.path);
                    }
                  }}
                >
                  <div className="live-video-card-frame">
                    <VideoThumbnail
                      className="live-video-card-thumb"
                      path={video.path}
                      title={video.name}
                    />
                    <div className="live-video-card-overlay">
                      <span className="live-card-play-btn" title="Reproducir en fondo de pantalla">
                        <Icon name={isCurrent ? "volume" : "play"} width={18} height={18} />
                      </span>
                    </div>
                    <span className="live-video-card-format">
                      {getFileExtension(video.name)}
                    </span>
                    {isCurrent && (
                      <span className="live-video-card-active-badge">
                        <span className="pulse-dot" />
                        <span>En pantalla</span>
                      </span>
                    )}
                  </div>
                  <div className="live-video-card-info">
                    <strong className="live-video-card-title" title={video.name}>
                      {cleanVideoTitle(video.name)}
                    </strong>
                    <span className="live-video-card-folder" title={video.folderName}>
                      <Icon name="folder" width={11} height={11} />
                      <span>{video.folderName}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
