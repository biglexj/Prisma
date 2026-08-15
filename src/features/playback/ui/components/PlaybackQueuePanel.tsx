import { useEffect, useRef, useState } from "react";
import type { PlaybackQueueState } from "../../usePlaybackQueue";
import { Icon } from "../../../../shared/ui/Icon";
import { MusicArtwork } from "../../../music_library/ui/MusicArtwork";
import { cleanPath } from "../../../../shared/mediaTree";
import { playlistsSaveFromItems } from "../../../collections/tauri/client";
import "./playback-queue.css";

interface PlaybackQueuePanelProps {
  queueState: PlaybackQueueState;
  onSelectTrack: (index: number) => void;
  onSwitchQueue?: (queueId: string) => void;
}

export function PlaybackQueuePanel({
  queueState,
  onSelectTrack,
  onSwitchQueue,
}: PlaybackQueuePanelProps) {
  const {
    queues,
    activeQueueId,
    activeQueue,
    repeatMode,
    shuffleMode,
    jumpToNextQueue,
    loopQueues,
    toggleRepeat,
    toggleShuffle,
    toggleJumpToNextQueue,
    toggleLoopQueues,
    shuffleActiveQueue,
    rewindActiveQueue,
    switchQueue,
    addQueue,
    saveActiveQueueAs,
    duplicateQueue,
    renameQueue,
    removeQueue,
    moveQueue,
    reorder,
    remove,
    clear,
    clearQueue,
    clearAllQueues,
  } = queueState;

  const [isManaging, setIsManaging] = useState(false);
  const [newQueueName, setNewQueueName] = useState("");
  const [editingQueueId, setEditingQueueId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isSavingActive, setIsSavingActive] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");

  const activeRowRef = useRef<HTMLDivElement | null>(null);
  const totalItems = activeQueue.items.length;
  const QUEUE_WINDOW_SIZE = 80;
  const currentIdx = activeQueue.currentIndex ?? 0;
  const windowStart = totalItems > QUEUE_WINDOW_SIZE
    ? Math.max(0, Math.min(currentIdx - 20, totalItems - QUEUE_WINDOW_SIZE))
    : 0;
  const windowEnd = totalItems > QUEUE_WINDOW_SIZE
    ? Math.min(totalItems, windowStart + QUEUE_WINDOW_SIZE)
    : totalItems;
  const visibleQueueItems = activeQueue.items.slice(windowStart, windowEnd);

  // Auto-scroll a la canción activa en la cola al cargar o cambiar
  useEffect(() => {
    if (activeRowRef.current && !isManaging) {
      activeRowRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeQueue.currentIndex, isManaging]);

  const handleQueueChange = (qId: string) => {
    if (onSwitchQueue) {
      onSwitchQueue(qId);
    } else {
      switchQueue(qId);
    }
  };

  const handleCreateQueue = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newQueueName.trim();
    if (!trimmed) return;
    const newId = addQueue(trimmed);
    setNewQueueName("");
    handleQueueChange(newId);
    setIsManaging(false);
  };

  const handleSaveActiveAs = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = saveAsName.trim();
    if (!trimmed) return;
    const newId = saveActiveQueueAs(trimmed);
    setSaveAsName("");
    setIsSavingActive(false);
    handleQueueChange(newId);
  };

  const handleExportM3U = async () => {
    if (activeQueue.items.length === 0) return;
    const defaultName = activeQueue.name;
    const name = window.prompt("Nombre para guardar la lista de reproducción M3U:", defaultName);
    if (!name || !name.trim()) return;
    try {
      const playlistItems = activeQueue.items.map((it) => ({
        path: it.path,
        title: it.artist ? `${it.artist} - ${it.title}` : it.title,
        durationSecs: it.durationSeconds ?? 0,
      }));
      await playlistsSaveFromItems(name.trim(), playlistItems);
      alert(`✅ Cola guardada exitosamente como "${name.trim()}.m3u" en Colecciones.`);
    } catch (err) {
      console.error("Error guardando lista M3U:", err);
    }
  };

  const startEditing = (qId: string, currentName: string) => {
    setEditingQueueId(qId);
    setEditingName(currentName);
  };

  const saveEditing = (qId: string) => {
    const trimmed = editingName.trim();
    if (trimmed) {
      renameQueue(qId, trimmed);
    }
    setEditingQueueId(null);
  };

  return (
    <div className="playback-queue-panel">
      {/* ── 1. Barra de Pestañas / Chips de Colas ── */}
      <div className="queue-tabs-bar" role="tablist" aria-label="Colas de reproducción">
        <div className="queue-tabs-scroll">
          {queues.map((q) => {
            const isActive = q.id === activeQueueId;
            return (
              <button
                key={q.id}
                role="tab"
                aria-selected={isActive}
                className={`queue-tab-chip ${isActive ? "is-active" : ""}`}
                onClick={() => handleQueueChange(q.id)}
                title={`Cambiar a ${q.name} (${q.items.length} canciones)`}
              >
                <span className="queue-tab-name">{q.name}</span>
                <span className="queue-tab-badge">{q.items.length}</span>
              </button>
            );
          })}
        </div>

        <button
          className={`queue-manage-toggle-btn ${isManaging ? "is-active" : ""}`}
          onClick={() => {
            setIsManaging(!isManaging);
            setIsSavingActive(false);
          }}
          title={isManaging ? "Volver a la lista de reproducción" : "Administrar todas las colas"}
        >
          <Icon name={isManaging ? "queue" : "folder"} />
          <span>{isManaging ? "Ver Lista" : "Gestionar"}</span>
        </button>
      </div>

      {/* ── 2. Modo Gestión de Colas (Crear, Renombrar, Duplicar, Borrar) ── */}
      {isManaging ? (
        <div className="queue-management-stage">
          <header className="queue-manage-header">
            <h4>Administrador de Colas</h4>
            <p>Organiza, renombra, duplica o crea nuevas listas de reproducción.</p>
          </header>

          <form className="queue-new-form" onSubmit={handleCreateQueue}>
            <input
              type="text"
              placeholder="Nombre de nueva cola (ej: J-Pop Hits)..."
              value={newQueueName}
              onChange={(e) => setNewQueueName(e.target.value)}
            />
            <button type="submit" className="queue-create-btn" disabled={!newQueueName.trim()}>
              <Icon name="plus" /> Crear
            </button>
          </form>

          <div className="queue-manage-list">
            {queues.map((q, index) => {
              const isActive = q.id === activeQueueId;
              const isDefault = q.id === "default_queue";
              const isEditing = editingQueueId === q.id;

              return (
                <div key={q.id} className={`queue-manage-item ${isActive ? "is-active" : ""}`}>
                  <div className="queue-manage-item-info">
                    {isEditing ? (
                      <div className="queue-inline-edit">
                        <input
                          type="text"
                          value={editingName}
                          autoFocus
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEditing(q.id);
                            if (e.key === "Escape") setEditingQueueId(null);
                          }}
                        />
                        <button className="queue-save-name-btn" onClick={() => saveEditing(q.id)}>
                          Guardar
                        </button>
                      </div>
                    ) : (
                      <div className="queue-manage-name-row">
                        <strong className="queue-manage-title">{q.name}</strong>
                        <button
                          className="queue-edit-name-btn"
                          onClick={() => startEditing(q.id, q.name)}
                          title="Renombrar cola"
                        >
                          ✎
                        </button>
                      </div>
                    )}
                    <span className="queue-manage-count">
                      {q.items.length} {q.items.length === 1 ? "canción" : "canciones"}
                      {isActive ? " · (Cola activa)" : ""}
                    </span>
                  </div>

                  <div className="queue-manage-item-actions">
                    {queues.length > 1 ? (
                      <div className="queue-reorder-controls">
                        <button
                          className="queue-icon-btn"
                          disabled={index === 0}
                          onClick={() => moveQueue(index, index - 1)}
                          title="Mover cola hacia arriba"
                        >
                          ↑
                        </button>
                        <button
                          className="queue-icon-btn"
                          disabled={index === queues.length - 1}
                          onClick={() => moveQueue(index, index + 1)}
                          title="Mover cola hacia abajo"
                        >
                          ↓
                        </button>
                      </div>
                    ) : null}

                    {!isActive ? (
                      <button
                        className="queue-manage-play-btn"
                        onClick={() => {
                          handleQueueChange(q.id);
                          setIsManaging(false);
                        }}
                        title="Reproducir esta cola"
                      >
                        <Icon name="play" /> Reproducir
                      </button>
                    ) : null}

                    {q.items.length > 0 ? (
                      <button
                        className="queue-icon-btn"
                        onClick={() => clearQueue(q.id)}
                        title="Limpiar canciones de esta cola"
                      >
                        🧹
                      </button>
                    ) : null}

                    <button
                      className="queue-icon-btn"
                      onClick={() => duplicateQueue(q.id)}
                      title="Duplicar cola"
                    >
                      ⎘
                    </button>

                    {!isDefault ? (
                      <button
                        className="queue-icon-btn is-delete"
                        onClick={() => removeQueue(q.id)}
                        title="Eliminar esta cola"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {queues.length > 1 || queues.some((q) => q.items.length > 0) ? (
            <div className="queue-manage-footer">
              <button
                className="queue-clear-all-btn"
                onClick={() => {
                  if (window.confirm("¿Deseas restablecer y vaciar todas las colas?")) {
                    clearAllQueues();
                  }
                }}
                title="Elimina todas las colas adicionales y vacía la cola predeterminada"
              >
                Limpiar y restablecer todas las colas
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        /* ── 3. Vista Normal de Cola Activa y Canciones ── */
        <>
          <header className="queue-header">
            <div className="queue-title-group">
              <h3>{activeQueue.name}</h3>
              <span className="queue-meta">
                {totalItems === 0
                  ? "Cola vacía"
                  : `${totalItems} ${totalItems === 1 ? "canción" : "canciones"} • Posición ${
                      totalItems > 0 ? activeQueue.currentIndex + 1 : 0
                    } de ${totalItems}`}
              </span>
            </div>

            <div className="queue-header-actions">
              {/* Botón Aleatorio / Mezclar */}
              <button
                className={`queue-action-btn ${shuffleMode ? "is-active" : ""}`}
                onClick={() => {
                  if (!shuffleMode) {
                    toggleShuffle();
                  } else {
                    shuffleActiveQueue();
                  }
                }}
                title={shuffleMode ? "Re-mezclar cola restante" : "Activar modo aleatorio"}
              >
                <Icon name="shuffle" />
                <span>{shuffleMode ? "Mezclar" : "Aleatorio"}</span>
              </button>

              {/* Botón Repetición */}
              <button
                className={`queue-action-btn ${repeatMode !== "off" ? "is-active" : ""}`}
                onClick={toggleRepeat}
                title={`Modo de repetición: ${
                  repeatMode === "all" ? "Repetir todo" : repeatMode === "one" ? "Repetir 1" : "Desactivado"
                }`}
              >
                <Icon name="repeat" />
                <span>
                  {repeatMode === "all" ? "Todo" : repeatMode === "one" ? "Pista 1" : "Repetir"}
                </span>
              </button>

              {/* Botón Rebobinar */}
              {totalItems > 1 ? (
                <button
                  className="queue-action-btn"
                  onClick={rewindActiveQueue}
                  title="Rebobinar cola: sitúa la pista actual al inicio"
                >
                  <span>Rebobinar</span>
                </button>
              ) : null}

              {/* Saltar a siguiente cola (A -> B -> C) */}
              {queues.length > 1 ? (
                <button
                  className={`queue-action-btn ${jumpToNextQueue ? "is-active" : ""}`}
                  onClick={toggleJumpToNextQueue}
                  title={
                    jumpToNextQueue
                      ? "Salto a siguiente cola activo: al terminar esta cola, pasa a la siguiente (A → B → C)"
                      : "Activar salto secuencial a la siguiente cola"
                  }
                >
                  <span>Salto cola</span>
                </button>
              ) : null}

              {/* Bucle entre colas (C -> A) */}
              {queues.length > 1 ? (
                <button
                  className={`queue-action-btn ${loopQueues ? "is-active" : ""}`}
                  onClick={toggleLoopQueues}
                  title={
                    loopQueues
                      ? "Bucle de colas activo: al terminar la última cola, vuelve cíclicamente a la primera (C → A)"
                      : "Activar bucle cíclico entre colas"
                  }
                >
                  <span>Bucle colas</span>
                </button>
              ) : null}

              {/* Guardar cola como lista M3U permanente */}
              {totalItems > 0 ? (
                <button
                  className="queue-action-btn"
                  onClick={handleExportM3U}
                  title="Guardar y exportar esta cola como archivo .m3u compatible con VLC en Colecciones"
                >
                  <Icon name="list-music" />
                  <span>Guardar como M3U</span>
                </button>
              ) : null}

              {/* Guardar cola como lista en memoria */}
              {totalItems > 0 && !isSavingActive ? (
                <button
                  className="queue-action-btn"
                  onClick={() => {
                    setSaveAsName(`${activeQueue.name} (Guardada)`);
                    setIsSavingActive(true);
                  }}
                  title="Guardar copia de esta cola en el administrador"
                >
                  <span>Duplicar</span>
                </button>
              ) : null}

              {/* Limpiar / Vaciar canciones de la cola */}
              {totalItems > 0 ? (
                <button
                  className="queue-action-btn is-clear"
                  onClick={clear}
                  title="Vaciar las canciones de esta cola"
                >
                  <span>Limpiar</span>
                </button>
              ) : null}

              {/* Eliminar cola completa si no es la cola por defecto */}
              {activeQueueId !== "default_queue" ? (
                <button
                  className="queue-action-btn is-delete-queue"
                  onClick={() => removeQueue(activeQueueId)}
                  title="Eliminar esta lista de reproducción por completo"
                >
                  <span>Eliminar cola</span>
                </button>
              ) : null}
            </div>
          </header>

          {isSavingActive ? (
            <form className="queue-save-active-bar" onSubmit={handleSaveActiveAs}>
              <input
                type="text"
                placeholder="Nombre para guardar esta cola..."
                value={saveAsName}
                autoFocus
                onChange={(e) => setSaveAsName(e.target.value)}
              />
              <button type="submit" className="queue-create-btn" disabled={!saveAsName.trim()}>
                Guardar
              </button>
              <button
                type="button"
                className="queue-cancel-btn"
                onClick={() => setIsSavingActive(false)}
              >
                Cancelar
              </button>
            </form>
          ) : null}

          {/* ── 4. Lista de Canciones en Cola (Ventana Optimizada) ── */}
          {totalItems === 0 ? (
            <div className="queue-empty-state">
              <Icon name="queue" />
              <p>No hay canciones en la cola activa.</p>
              <span>Selecciona pistas, álbumes o carpetas en tu biblioteca para reproducir.</span>
            </div>
          ) : (
            <div className="queue-list" role="list">
              {windowStart > 0 ? (
                <div className="queue-window-notice">
                  <span>+{windowStart} canciones anteriores</span>
                </div>
              ) : null}

              {visibleQueueItems.map((item, sliceIdx) => {
                const index = windowStart + sliceIdx;
                const isPlaying = index === activeQueue.currentIndex;
                const fileName = item.path.split(/[/\\]/).pop() ?? item.title;
                const subLabel = item.artist ?? cleanPath(item.folder) ?? fileName;

                return (
                  <div
                    key={`${item.id || item.path}_${index}`}
                    ref={isPlaying ? activeRowRef : null}
                    className={`queue-item-row ${isPlaying ? "is-active" : ""}`}
                    onClick={() => onSelectTrack(index)}
                    role="listitem"
                  >
                    <div className="queue-item-info">
                      <span className="queue-item-index">
                        {isPlaying ? (
                          <span className="queue-playing-indicator">▶</span>
                        ) : (
                          index + 1
                        )}
                      </span>

                      <div className="queue-item-artwork">
                        <MusicArtwork alt={item.title} className="queue-thumb-img" path={item.path} />
                      </div>

                      <div className="queue-item-text">
                        <span className="queue-item-title" title={item.title}>
                          {item.title}
                        </span>
                        <span className="queue-item-sub" title={subLabel}>
                          {subLabel}
                        </span>
                      </div>
                    </div>

                    <div
                      className="queue-item-controls"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {index > 0 ? (
                        <button
                          className="queue-icon-btn"
                          onClick={() => reorder(index, index - 1)}
                          title="Subir posición"
                        >
                          ▲
                        </button>
                      ) : null}
                      {index < totalItems - 1 ? (
                        <button
                          className="queue-icon-btn"
                          onClick={() => reorder(index, index + 1)}
                          title="Bajar posición"
                        >
                          ▼
                        </button>
                      ) : null}
                      <button
                        className="queue-icon-btn is-delete"
                        onClick={() => remove(index)}
                        title="Quitar de la cola"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}

              {windowEnd < totalItems ? (
                <div className="queue-window-notice">
                  <span>+{totalItems - windowEnd} canciones más en cola</span>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
