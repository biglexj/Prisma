import type { PlaybackQueueState } from "../../usePlaybackQueue";
import { Icon } from "../../../../shared/ui/Icon";
import "./playback-queue.css";

interface PlaybackQueuePanelProps {
  queueState: PlaybackQueueState;
  onSelectTrack: (index: number) => void;
}

export function PlaybackQueuePanel({ queueState, onSelectTrack }: PlaybackQueuePanelProps) {
  const {
    queue,
    repeatMode,
    shuffleMode,
    toggleRepeat,
    toggleShuffle,
    reorder,
    remove,
    clear,
  } = queueState;

  const totalItems = queue.items.length;

  return (
    <div className="playback-queue-panel">
      <header className="queue-header">
        <div className="queue-title-group">
          <h3>{queue.name}</h3>
          <span className="queue-meta">
            {totalItems === 0
              ? "Cola vacía"
              : `${totalItems} ${totalItems === 1 ? "canción" : "canciones"} • Posición ${
                  totalItems > 0 ? queue.currentIndex + 1 : 0
                } de ${totalItems}`}
          </span>
        </div>

        <div className="queue-header-actions">
          <button
            className={`queue-action-btn ${shuffleMode ? "is-active" : ""}`}
            onClick={toggleShuffle}
            title={shuffleMode ? "Desactivar aleatorio" : "Activar aleatorio"}
          >
            <Icon name="shuffle" />
            <span>{shuffleMode ? "Mezclado" : "Aleatorio"}</span>
          </button>

          <button
            className={`queue-action-btn ${repeatMode !== "off" ? "is-active" : ""}`}
            onClick={toggleRepeat}
            title={`Repetición: ${repeatMode}`}
          >
            <Icon name="repeat" />
            <span>
              {repeatMode === "all" ? "Repetir todo" : repeatMode === "one" ? "Repetir 1" : "Repetir"}
            </span>
          </button>

          {totalItems > 0 ? (
            <button className="queue-action-btn" onClick={clear} title="Vaciar toda la cola">
              <span>Vaciar</span>
            </button>
          ) : null}
        </div>
      </header>

      {totalItems === 0 ? (
        <div className="queue-empty-state">
          <Icon name="queue" />
          <p>No hay canciones en la cola activa.</p>
          <span>Selecciona pistas o carpetas en tu biblioteca para reproducir.</span>
        </div>
      ) : (
        <div className="queue-list" role="list">
          {queue.items.map((item, index) => {
            const isPlaying = index === queue.currentIndex;
            const fileName = item.path.split(/[/\\]/).pop() ?? item.title;
            const subLabel = item.artist ?? item.folder ?? fileName;

            return (
              <div
                key={`${item.id}_${index}`}
                className={`queue-item-row ${isPlaying ? "is-active" : ""}`}
                onClick={() => onSelectTrack(index)}
                role="listitem"
              >
                <div className="queue-item-info">
                  <span className="queue-item-index">
                    {isPlaying ? "▶" : index + 1}
                  </span>
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
        </div>
      )}
    </div>
  );
}
