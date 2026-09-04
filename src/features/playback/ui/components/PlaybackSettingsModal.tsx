import { useEffect, useState } from "react";
import { Icon } from "../../../../shared/ui/Icon";
import type { PlaybackQueueState } from "../../usePlaybackQueue";
import "./playback-settings-modal.css";

interface PlaybackSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  queueState: PlaybackQueueState;
}

type TabType = "sencillo" | "avanzadas";

export function PlaybackSettingsModal({
  isOpen,
  onClose,
  queueState,
}: PlaybackSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("sencillo");

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSequentialActive =
    queueState.repeatMode === "off" &&
    !queueState.stopOnSongEnd &&
    !queueState.pauseOnSongEnd;
  const isRepeatAllActive = queueState.repeatMode === "all";
  const isRepeatOneActive = queueState.repeatMode === "one";

  return (
    <div
      className="playback-settings-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="playback-settings-title"
    >
      <div
        className="playback-settings-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="playback-settings-title" className="playback-settings-title">
          Configuración de reproducción
        </h2>

        {/* Pestañas de navegación */}
        <div className="playback-settings-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "sencillo"}
            className={`playback-settings-tab ${activeTab === "sencillo" ? "is-active" : ""}`}
            onClick={() => setActiveTab("sencillo")}
          >
            Sencillo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "avanzadas"}
            className={`playback-settings-tab ${activeTab === "avanzadas" ? "is-active" : ""}`}
            onClick={() => setActiveTab("avanzadas")}
          >
            Avanzadas
          </button>
        </div>

        <div className="playback-settings-content">
          {activeTab === "sencillo" ? (
            <div className="playback-settings-group" role="radiogroup" aria-label="Modo sencillo">
              <button
                type="button"
                role="radio"
                aria-checked={isSequentialActive}
                className={`playback-option-row ${isSequentialActive ? "is-selected" : ""}`}
                onClick={() => {
                  queueState.setRepeatMode("off");
                  queueState.setSongEndMode("next");
                }}
              >
                <span className="playback-custom-radio">
                  {isSequentialActive && <span className="playback-radio-dot" />}
                </span>
                <span className="playback-option-icon">
                  <Icon name="arrow-right" />
                </span>
                <span className="playback-option-label">
                  Reproducir siguiente canción
                </span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={isRepeatAllActive}
                className={`playback-option-row ${isRepeatAllActive ? "is-selected" : ""}`}
                onClick={() => {
                  queueState.setRepeatMode("all");
                  queueState.setSongEndMode("next");
                }}
              >
                <span className="playback-custom-radio">
                  {isRepeatAllActive && <span className="playback-radio-dot" />}
                </span>
                <span className="playback-option-icon">
                  <Icon name="repeat" />
                </span>
                <span className="playback-option-label">
                  Repetir la misma cola
                </span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={isRepeatOneActive}
                className={`playback-option-row ${isRepeatOneActive ? "is-selected" : ""}`}
                onClick={() => {
                  queueState.setRepeatMode("one");
                  queueState.setSongEndMode("next");
                }}
              >
                <span className="playback-custom-radio">
                  {isRepeatOneActive && <span className="playback-radio-dot" />}
                </span>
                <span className="playback-option-icon">
                  <Icon name="repeat-one" />
                </span>
                <span className="playback-option-label">
                  Repetir la misma canción
                </span>
              </button>
            </div>
          ) : (
            <div className="playback-advanced-sections">
              {/* Sección 1: Cuando la canción termine... */}
              <div className="playback-advanced-section">
                <h3 className="playback-section-title">
                  Cuando la canción termine...
                </h3>
                <div className="playback-settings-group" role="radiogroup">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={queueState.stopOnSongEnd}
                    className={`playback-option-row ${queueState.stopOnSongEnd ? "is-selected" : ""}`}
                    onClick={() => queueState.setSongEndMode("stop")}
                  >
                    <span className="playback-custom-radio">
                      {queueState.stopOnSongEnd && (
                        <span className="playback-radio-dot" />
                      )}
                    </span>
                    <span className="playback-option-label">
                      Detener el reproductor ahí
                    </span>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={queueState.pauseOnSongEnd}
                    className={`playback-option-row ${queueState.pauseOnSongEnd ? "is-selected" : ""}`}
                    onClick={() => queueState.setSongEndMode("pause")}
                  >
                    <span className="playback-custom-radio">
                      {queueState.pauseOnSongEnd && (
                        <span className="playback-radio-dot" />
                      )}
                    </span>
                    <span className="playback-option-label">
                      Cargar la siguiente canción y pausar
                    </span>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={
                      !queueState.stopOnSongEnd && !queueState.pauseOnSongEnd
                    }
                    className={`playback-option-row ${
                      !queueState.stopOnSongEnd && !queueState.pauseOnSongEnd
                        ? "is-selected"
                        : ""
                    }`}
                    onClick={() => queueState.setSongEndMode("next")}
                  >
                    <span className="playback-custom-radio">
                      {!queueState.stopOnSongEnd &&
                        !queueState.pauseOnSongEnd && (
                          <span className="playback-radio-dot" />
                        )}
                    </span>
                    <span className="playback-option-label">
                      Reproducir siguiente canción
                    </span>
                  </button>
                </div>
              </div>

              {/* Sección 2: Cuando la cola termine... */}
              <div className="playback-advanced-section">
                <h3 className="playback-section-title">
                  Cuando la cola termine...
                </h3>
                <div className="playback-settings-group">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={queueState.jumpToNextQueue}
                    className={`playback-option-row ${queueState.jumpToNextQueue ? "is-selected" : ""}`}
                    onClick={() => {
                      const nextVal = !queueState.jumpToNextQueue;
                      queueState.setJumpToNextQueue(nextVal);
                      if (!nextVal) {
                        queueState.setLoopQueues(false);
                      }
                    }}
                  >
                    <span
                      className={`playback-custom-checkbox ${queueState.jumpToNextQueue ? "is-checked" : ""}`}
                    >
                      {queueState.jumpToNextQueue && <Icon name="check" />}
                    </span>
                    <span className="playback-option-label">
                      Saltar a la siguiente cola
                    </span>
                  </button>

                  {queueState.jumpToNextQueue && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={queueState.loopQueues}
                      className={`playback-option-row is-nested ${queueState.loopQueues ? "is-selected" : ""}`}
                      onClick={() =>
                        queueState.setLoopQueues(!queueState.loopQueues)
                      }
                    >
                      <span
                        className={`playback-custom-checkbox ${queueState.loopQueues ? "is-checked" : ""}`}
                      >
                        {queueState.loopQueues && <Icon name="check" />}
                      </span>
                      <span className="playback-option-label">
                        Saltar a la primera cola y viceversa
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Botón de confirmación */}
        <div className="playback-settings-footer">
          <button
            type="button"
            className="playback-settings-accept-btn"
            onClick={onClose}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
