import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../shared/ui/Icon";
import { usePlaylists } from "../usePlaylists";
import type { PlaylistItem, PlaylistMeta } from "../model/types";
import type { MusicQueueItem } from "../../playback/model/queue";
import type { VisualLibraryItem } from "../../visual_library/model/types";
import { parseTrackInfo } from "../../music_library/model/trackInfo";
import { MusicArtwork } from "../../music_library/ui/MusicArtwork";
import { playlistsRead } from "../tauri/client";
import { useScrollRestoration } from "../../../shared/useScrollRestoration";
import "./collections.css";

interface PlaylistsViewProps {
  onPlayQueue?: (items: MusicQueueItem[], startIndex?: number, name?: string) => void;
  onPlayMusic?: (path: string) => void;
  onPlayVideo?: (path: string, sessionItems?: VisualLibraryItem[]) => void;
}

type PlaylistFilter = "all" | "music" | "video" | "hidden";

export function PlaylistsView({ onPlayQueue, onPlayMusic, onPlayVideo }: PlaylistsViewProps) {
  const {
    playlists,
    loading,
    selectedPlaylist,
    selectedItems,
    loadingItems,
    selectPlaylist,
    create,
    importPlaylist,
    deletePlaylist,
    toggleHidden,
    cleanMissingItems,
    removeItem,
    refresh,
  } = usePlaylists();

  const [activeFilter, setActiveFilter] = useState<PlaylistFilter>("all");

  useScrollRestoration(`view:playlists:${selectedPlaylist ? selectedPlaylist.path : `list:${activeFilter}`}`, !loading);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [newPlaylistKind, setNewPlaylistKind] = useState<"music" | "video">("music");
  const [createError, setCreateError] = useState<string | null>(null);
  const [trackFilter, setTrackFilter] = useState("");

  // Conteos por categoría
  const allCount = useMemo(() => playlists.filter((p) => !p.isHidden).length, [playlists]);
  const musicCount = useMemo(
    () => playlists.filter((p) => !p.isHidden && p.mediaKind !== "video").length,
    [playlists]
  );
  const videoCount = useMemo(
    () => playlists.filter((p) => !p.isHidden && p.mediaKind === "video").length,
    [playlists]
  );
  const hiddenCount = useMemo(() => playlists.filter((p) => p.isHidden).length, [playlists]);

  // Listas a mostrar según el filtro activo
  const displayedPlaylists = useMemo(() => {
    if (activeFilter === "hidden") {
      return playlists.filter((p) => p.isHidden);
    }
    const nonHidden = playlists.filter((p) => !p.isHidden);
    if (activeFilter === "music") {
      return nonHidden.filter((p) => p.mediaKind !== "video");
    }
    if (activeFilter === "video") {
      return nonHidden.filter((p) => p.mediaKind === "video");
    }
    return nonHidden;
  }, [playlists, activeFilter]);



  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    try {
      setCreateError(null);
      await create(newPlaylistName.trim(), newPlaylistKind);
      setNewPlaylistName("");
      setIsCreating(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleImportPlaylist = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Listas de reproducción (M3U, M3U8, PLS, XSPF)",
            extensions: ["m3u", "m3u8", "pls", "xspf"],
          },
        ],
        title: "Seleccionar lista de reproducción a importar",
      });

      if (typeof selected === "string") {
        await importPlaylist(selected);
      }
    } catch (err) {
      console.error("Error importando lista:", err);
    }
  };

  const handleDeletePlaylist = async (meta: PlaylistMeta) => {
    const ok = window.confirm(
      `¿Deseas eliminar permanentemente el archivo de lista "${meta.name}"?\n(Los archivos multimedia en tu disco no se borrarán).`
    );
    if (!ok) return;
    try {
      await deletePlaylist(meta.path);
    } catch (err) {
      alert(`Error eliminando lista: ${err}`);
    }
  };

  const handleCleanMissing = async (meta: PlaylistMeta) => {
    const ok = window.confirm(
      `¿Deseas eliminar de la lista "${meta.name}" todas las pistas que ya no existen en disco?`
    );
    if (!ok) return;
    try {
      await cleanMissingItems(meta.path);
    } catch (err) {
      alert(`Error limpiando pistas: ${err}`);
    }
  };

  const handlePlayAll = (playlist: PlaylistMeta, items: PlaylistItem[]) => {
    const availableItems = items.filter((it) => it.isAvailable !== false);
    if (availableItems.length === 0) {
      alert("No hay archivos multimedia disponibles en esta lista.");
      return;
    }

    // Si el primer elemento o la lista es de vídeo, reproducir en VideoPlayer
    if ((playlist.mediaKind === "video" || availableItems[0].isVideo) && onPlayVideo) {
      const visualVideoItems: VisualLibraryItem[] = availableItems
        .filter((it) => it.isVideo)
        .map((it) => ({
          path: it.path,
          title: it.title,
          sourcePath: it.path,
          relativeFolder: playlist.name,
          kind: "video",
          modifiedAtMillis: 0,
          sizeBytes: 0,
        }));
      onPlayVideo(availableItems[0].path, visualVideoItems);
      return;
    }

    const queueItems: MusicQueueItem[] = availableItems.map((it) => {
      const { title, artist } = parseTrackInfo(it.title);
      return {
        id: it.path,
        path: it.path,
        title,
        artist: artist || null,
        durationSeconds: it.durationSecs > 0 ? it.durationSecs : undefined,
      };
    });

    if (onPlayQueue) {
      onPlayQueue(queueItems, 0, playlist.name);
    } else if (onPlayMusic && queueItems[0]) {
      onPlayMusic(queueItems[0].path);
    }
  };

  const handlePlayItem = (items: PlaylistItem[], index: number, playlistName: string) => {
    const item = items[index];
    if (!item) return;

    if (item.isAvailable === false) {
      alert("⚠️ Este archivo no fue encontrado en el disco o fue movido.");
      return;
    }

    if (item.isVideo && onPlayVideo) {
      const visualVideoItems: VisualLibraryItem[] = items
        .filter((it) => it.isVideo && it.isAvailable !== false)
        .map((it) => ({
          path: it.path,
          title: it.title,
          sourcePath: it.path,
          relativeFolder: playlistName,
          kind: "video",
          modifiedAtMillis: 0,
          sizeBytes: 0,
        }));
      onPlayVideo(item.path, visualVideoItems);
      return;
    }

    const validItems = items.filter((it) => it.isAvailable !== false);
    const validIdx = validItems.findIndex((it) => it.path === item.path);

    const queueItems: MusicQueueItem[] = validItems.map((it) => {
      const { title, artist } = parseTrackInfo(it.title);
      return {
        id: it.path,
        path: it.path,
        title,
        artist: artist || null,
        durationSeconds: it.durationSecs > 0 ? it.durationSecs : undefined,
      };
    });

    if (onPlayQueue) {
      onPlayQueue(queueItems, validIdx >= 0 ? validIdx : 0, playlistName);
    } else if (onPlayMusic) {
      onPlayMusic(item.path);
    }
  };

  const formatDuration = (secs: number) => {
    if (secs <= 0) return "--:--";
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins}:${remainder.toString().padStart(2, "0")}`;
  };

  // Determinar si la lista seleccionada tiene archivos faltantes
  const missingCount = useMemo(() => {
    return selectedItems.filter((it) => it.isAvailable === false).length;
  }, [selectedItems]);

  return (
    <section className="collections-view playlists-view">
      <header className="collections-heading">
        <div className="section-heading">
          <span className="preview-kicker">COLECCIONES</span>
          <h1>Listas de reproducción</h1>
          <p>
            Listas estándar M3U, M3U8, PLS y XSPF (VLC) detectadas en todas tus fuentes de música y vídeos.
          </p>
        </div>

        <div className="playlists-header-actions">
          <button className="tonal-button" onClick={() => refresh()} title="Actualizar y reescanear listas">
            <Icon name="refresh" />
          </button>
          <button className="tonal-button" onClick={handleImportPlaylist} title="Importar lista M3U / VLC">
            <Icon name="folder-open" /> Importar lista
          </button>
          <button
            className="filled-button"
            onClick={() => {
              setIsCreating(true);
              setNewPlaylistKind(activeFilter === "video" ? "video" : "music");
              setCreateError(null);
            }}
          >
            <Icon name="plus" /> Nueva lista
          </button>
        </div>
      </header>

      {/* Barra de Filtros: Todas, Música, Vídeos, Ocultas */}
      <div className="playlists-filter-bar">
        <div className="playlists-filter-chips">
          <button
            className={`filter-chip ${activeFilter === "all" ? "is-active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            <span>Todas ({allCount})</span>
          </button>
          <button
            className={`filter-chip ${activeFilter === "music" ? "is-active" : ""}`}
            onClick={() => setActiveFilter("music")}
          >
            <Icon name="music" />
            <span>Música ({musicCount})</span>
          </button>
          <button
            className={`filter-chip ${activeFilter === "video" ? "is-active" : ""}`}
            onClick={() => setActiveFilter("video")}
          >
            <Icon name="video" />
            <span>Vídeos ({videoCount})</span>
          </button>
          {hiddenCount > 0 ? (
            <button
              className={`filter-chip ${activeFilter === "hidden" ? "is-active" : ""}`}
              onClick={() => setActiveFilter("hidden")}
            >
              <Icon name="eye-slash" />
              <span>Ocultas ({hiddenCount})</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Modal para crear playlist */}
      {isCreating ? (
        <div className="playlist-modal-backdrop" onClick={() => setIsCreating(false)}>
          <div className="playlist-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Crear nueva lista de reproducción</h3>
            <p>Selecciona el tipo de lista para guardarla en la carpeta adecuada:</p>
            <form onSubmit={handleCreateSubmit}>
              <div className="playlist-type-selector">
                <button
                  type="button"
                  className={`playlist-type-btn ${newPlaylistKind === "music" ? "is-active" : ""}`}
                  onClick={() => setNewPlaylistKind("music")}
                >
                  <Icon name="music" />
                  <span>🎵 Música</span>
                </button>
                <button
                  type="button"
                  className={`playlist-type-btn ${newPlaylistKind === "video" ? "is-active" : ""}`}
                  onClick={() => setNewPlaylistKind("video")}
                >
                  <Icon name="video" />
                  <span>🎬 Vídeos</span>
                </button>
              </div>

              <input
                type="text"
                placeholder={
                  newPlaylistKind === "video"
                    ? "Nombre de la lista de vídeos (ej. Karaoke 2026, Conciertos)"
                    : "Nombre de la lista de música (ej. Cumbia, Huayno, Favoritos)"
                }
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                autoFocus
              />
              {createError ? <p className="playlist-error-msg">{createError}</p> : null}
              <div className="playlist-modal-actions">
                <button
                  type="button"
                  className="tonal-button"
                  onClick={() => setIsCreating(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="filled-button" disabled={!newPlaylistName.trim()}>
                  Crear lista
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Vista principal de playlists */}
      {loading ? (
        <div className="collections-empty-state">
          <Icon name="refresh" className="spinning-icon" />
          <h2>Cargando listas de reproducción…</h2>
        </div>
      ) : displayedPlaylists.length === 0 ? (
        <div className="collections-empty-state">
          <div className="collections-empty-icon">
            <Icon name={activeFilter === "video" ? "video" : "list-music"} />
          </div>
          <h2>
            {activeFilter === "hidden"
              ? "No hay listas ocultas"
              : activeFilter === "video"
              ? "Sin listas de vídeo"
              : activeFilter === "music"
              ? "Sin listas de música"
              : "Sin listas de reproducción"}
          </h2>
          <p>
            {activeFilter === "hidden"
              ? "No has ocultado ninguna lista de reproducción."
              : activeFilter === "video"
              ? "No se encontraron listas de vídeo en tus carpetas escaneadas. Puedes crear una nueva lista de vídeos."
              : "Crea tu primera lista o coloca archivos .m3u / .m3u8 / .xspf en tus carpetas de música o vídeos para verlos aquí."}
          </p>
          {activeFilter !== "hidden" ? (
            <div className="playlists-empty-actions">
              <button
                className="filled-button"
                onClick={() => {
                  setIsCreating(true);
                  setNewPlaylistKind(activeFilter === "video" ? "video" : "music");
                }}
              >
                <Icon name="plus" /> Crear lista de {activeFilter === "video" ? "vídeos" : "música"}
              </button>
              <button className="tonal-button" onClick={handleImportPlaylist}>
                <Icon name="folder-open" /> Importar lista
              </button>
            </div>
          ) : (
            <button className="tonal-button" onClick={() => setActiveFilter("all")}>
              Volver a todas las listas
            </button>
          )}
        </div>
      ) : (
        <div className="playlists-grid">
          {displayedPlaylists.map((playlist) => {
            const isVideoPlaylist = playlist.mediaKind === "video";
            const hasMissing =
              playlist.validCount !== undefined &&
              playlist.itemCount > 0 &&
              playlist.validCount < playlist.itemCount;

            return (
              <div
                className={`playlist-card ${
                  selectedPlaylist?.path === playlist.path ? "is-selected" : ""
                }`}
                key={playlist.path}
                onClick={() => {
                  if (selectedPlaylist?.path === playlist.path) {
                    selectPlaylist(null);
                  } else {
                    selectPlaylist(playlist);
                  }
                }}
              >
                <div className="playlist-card-cover">
                  <Icon name={isVideoPlaylist ? "video" : "list-music"} />
                  <button
                    className="playlist-quick-play-btn"
                    onClick={async (e) => {
                      e.stopPropagation();
                      selectPlaylist(playlist);
                      const items = await playlistsRead(playlist.path);
                      handlePlayAll(playlist, items);
                    }}
                    title={`Reproducir ${playlist.name}`}
                  >
                    <Icon name="play" />
                  </button>
                </div>

                <div className="playlist-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="icon-button"
                    onClick={() => toggleHidden(playlist.path)}
                    title={playlist.isHidden ? "Desocultar lista" : "Ocultar lista"}
                  >
                    <Icon name={playlist.isHidden ? "eye" : "eye-slash"} />
                  </button>
                  <button
                    className="icon-button remove-btn"
                    onClick={() => handleDeletePlaylist(playlist)}
                    title="Eliminar archivo de lista"
                  >
                    <Icon name="trash" />
                  </button>
                </div>

                <div className="playlist-card-info">
                  <strong title={playlist.name}>{playlist.name}</strong>
                  <span>
                    {playlist.itemCount}{" "}
                    {isVideoPlaylist
                      ? playlist.itemCount === 1
                        ? "vídeo"
                        : "vídeos"
                      : playlist.itemCount === 1
                      ? "canción"
                      : "canciones"}
                  </span>

                  {isVideoPlaylist ? (
                    <span className="playlist-card-badge is-video-badge">🎬 Vídeos</span>
                  ) : null}

                  {hasMissing ? (
                    <span
                      className="playlist-card-badge is-warning"
                      title="Algunos archivos no existen en disco"
                    >
                      ⚠️ {playlist.validCount}/{playlist.itemCount} disponibles
                    </span>
                  ) : null}

                  {playlist.isHidden ? (
                    <span className="playlist-card-badge is-hidden-badge">👁️ Oculta</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Panel Detalle de la Playlist Seleccionada */}
      {selectedPlaylist ? (
        <div className="playlist-detail-panel">
          <div className="playlist-detail-header">
            <div className="playlist-detail-title-group">
              <div className="playlist-detail-icon">
                <Icon name={selectedPlaylist.mediaKind === "video" ? "video" : "list-music"} />
              </div>
              <div>
                <span className="preview-kicker">LISTA DE REPRODUCCIÓN</span>
                <h2>{selectedPlaylist.name}</h2>
                <p>
                  {selectedItems.length}{" "}
                  {selectedPlaylist.mediaKind === "video"
                    ? selectedItems.length === 1
                      ? "vídeo"
                      : "vídeos"
                    : selectedItems.length === 1
                    ? "canción"
                    : "canciones"}{" "}
                  • {selectedPlaylist.mediaKind === "video" ? "Vídeo compatible VLC" : "Audio compatible VLC"}
                </p>
              </div>
            </div>

            <div className="playlist-detail-actions">
              <div className="favorite-search-box playlist-track-search">
                <Icon name="search" />
                <input
                  placeholder="Buscar en lista…"
                  value={trackFilter}
                  onChange={(e) => setTrackFilter(e.target.value)}
                />
              </div>
              <button
                className="filled-button"
                onClick={() => handlePlayAll(selectedPlaylist, selectedItems)}
                disabled={selectedItems.length === 0}
              >
                <Icon name="play" /> Reproducir todo
              </button>
              <button
                className="icon-button"
                onClick={() => selectPlaylist(null)}
                title="Cerrar detalle de lista"
              >
                <Icon name="close" />
              </button>
              <button
                className="icon-button"
                onClick={() => toggleHidden(selectedPlaylist.path)}
                title={selectedPlaylist.isHidden ? "Desocultar lista" : "Ocultar lista"}
              >
                <Icon name={selectedPlaylist.isHidden ? "eye" : "eye-slash"} />
              </button>
              <button
                className="icon-button remove-btn"
                onClick={() => handleDeletePlaylist(selectedPlaylist)}
                title="Eliminar lista de reproducción"
              >
                <Icon name="trash" />
              </button>
            </div>
          </div>

          {/* Banner de alerta de archivos faltantes con botón de limpieza */}
          {missingCount > 0 ? (
            <div className="playlist-health-banner">
              <div className="playlist-health-banner-text">
                <Icon name="trash" />
                <span>
                  Atención: {missingCount} de {selectedItems.length} archivos no fueron encontrados en el disco o cambiaron de ruta.
                </span>
              </div>
              <button
                className="tonal-button is-destructive"
                onClick={() => handleCleanMissing(selectedPlaylist)}
              >
                🪄 Limpiar pistas no encontradas ({missingCount})
              </button>
            </div>
          ) : null}

          {/* Tabla de pistas */}
          {loadingItems ? (
            <div className="playlist-items-loading">
              <Icon name="refresh" className="spinning-icon" />
              <span>Cargando contenido de la lista…</span>
            </div>
          ) : selectedItems.length === 0 ? (
            <p className="playlist-empty-text">
              Esta lista está vacía. Añade canciones o vídeos desde el explorador.
            </p>
          ) : (
            <div className="playlist-items-table">
              <div className="playlist-table-header">
                <span className="col-num">#</span>
                <span className="col-title">Título</span>
                <span className="col-dur">Duración</span>
                <span className="col-actions"></span>
              </div>
              {selectedItems
                .filter((it) => {
                  if (!trackFilter.trim()) return true;
                  return (
                    it.title.toLowerCase().includes(trackFilter.toLowerCase()) ||
                    it.path.toLowerCase().includes(trackFilter.toLowerCase())
                  );
                })
                .map((item, idx) => (
                  <div
                    className={`playlist-table-row ${item.isAvailable === false ? "is-missing" : ""}`}
                    key={`${item.path}-${idx}`}
                    onClick={() => handlePlayItem(selectedItems, idx, selectedPlaylist.name)}
                    title={
                      item.isAvailable === false
                        ? "Archivo no encontrado en disco"
                        : `Reproducir ${item.title}`
                    }
                  >
                    <span className="col-num">{idx + 1}</span>
                    <div className="col-title">
                      <div className="playlist-item-artwork">
                        {item.isVideo ? (
                          <Icon name="video" />
                        ) : (
                          <MusicArtwork path={item.path} alt={item.title} />
                        )}
                      </div>
                      <div className="playlist-item-text">
                        <strong>
                          {item.title}
                          {item.isVideo ? (
                            <span className="playlist-video-tag">Vídeo</span>
                          ) : null}
                          {item.isAvailable === false ? (
                            <span className="playlist-missing-tag">⚠️ No encontrado</span>
                          ) : null}
                        </strong>
                        <small>{item.path}</small>
                      </div>
                    </div>
                    <span className="col-dur">{formatDuration(item.durationSecs)}</span>
                    <div className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="icon-button remove-btn"
                        onClick={() => removeItem(selectedPlaylist.path, item.path)}
                        title="Quitar de la lista"
                      >
                        <Icon name="minus" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
