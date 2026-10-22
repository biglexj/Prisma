import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Icon } from "../../../shared/ui/Icon";
import { screenCaptureClient } from "../services/screenCaptureClient";
import type { RecordingInfo } from "../model/types";
import "./screen-capture.css";

const RECORDING_STATE_EVENT = "prisma://recording-state";

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

function fileName(path: string): string {
  return path.replace(/.*[/\\]/, "");
}

interface RecordingHudProps {
  /** Añade la carpeta de la grabación a la biblioteca de Vídeos de Prisma. */
  onAddToVideoLibrary?: (folder: string) => void;
}

/**
 * Indicador flotante de grabación. Vive en la ventana principal, no en el
 * overlay, porque el overlay debe ocultarse durante la captura: si siguiera
 * visible aparecería dentro del vídeo grabado.
 */
export function RecordingHud({ onAddToVideoLibrary }: RecordingHudProps = {}) {
  const [recording, setRecording] = useState<RecordingInfo | null>(null);
  const [finished, setFinished] = useState<RecordingInfo | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInLibrary, setIsInLibrary] = useState(false);

  useEffect(() => {
    const unlistenPromise = listen<RecordingInfo>(RECORDING_STATE_EVENT, ({ payload }) => {
      if (!payload) return;
      if (payload.status === "recording") {
        setRecording(payload);
        setFinished(null);
        setError(null);
      } else if (payload.status === "finished") {
        setRecording(null);
        setFinished(payload);
      } else {
        setRecording(null);
        setFinished(null);
      }
    });

    // Respaldo: la ventana principal puede cargarse con una grabación en curso.
    void screenCaptureClient
      .getRecordingStatus()
      .then((status) => {
        if (status?.status === "recording") setRecording(status);
      })
      .catch(() => undefined);

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const tick = () => setElapsedMs(Math.max(0, Date.now() - recording.startedAtMs));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [recording]);

  const handleStop = useCallback(async () => {
    setIsStopping(true);
    setError(null);
    try {
      const info = await screenCaptureClient.stopRecording();
      setRecording(null);
      setFinished(info);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsStopping(false);
    }
  }, []);

  const handleSendToSuperGallery = useCallback(() => {
    if (!finished?.outputPath) return;
    window.dispatchEvent(
      new CustomEvent("prisma-send-to-supergallery", {
        detail: { path: finished.outputPath, title: fileName(finished.outputPath) },
      })
    );
  }, [finished]);

  const handleReveal = useCallback(() => {
    if (!finished?.outputPath) return;
    void invoke("open_in_file_manager", { path: finished.outputPath });
  }, [finished]);

  const handleTogglePause = useCallback(async () => {
    try {
      await screenCaptureClient.togglePause();
    } catch (err) {
      console.error("Error al pausar la grabación:", err);
    }
  }, []);

  const handleAddToLibrary = useCallback(() => {
    if (!finished?.outputPath || !onAddToVideoLibrary) return;
    const folder = finished.outputPath.replace(/[/\\][^/\\]*$/, "");
    onAddToVideoLibrary(folder);
    setIsInLibrary(true);
  }, [finished, onAddToVideoLibrary]);

  if (!recording && !finished && !error) return null;

  return (
    <div className="recording-hud-root">
      {recording && (
        <div className="recording-hud is-live" role="status" aria-live="polite">
          <span className="recording-hud-dot" aria-hidden="true" />
          <div className="recording-hud-body">
            <strong className="recording-hud-time">
              {recording.paused ? "En pausa" : formatElapsed(elapsedMs)}
            </strong>
            <span className="recording-hud-meta">
              {recording.width}×{recording.height} · {recording.fps} fps
            </span>
          </div>
          <button
            type="button"
            className="recording-hud-action"
            onClick={() => void handleTogglePause()}
            title={recording.paused ? "Reanudar la grabación" : "Pausar la grabación"}
          >
            <Icon name={recording.paused ? "play" : "pause"} width={15} height={15} />
          </button>
          <button
            type="button"
            className="recording-hud-stop"
            onClick={() => void handleStop()}
            disabled={isStopping}
            title="Detener la grabación"
          >
            <span className="recording-hud-stop-dot" aria-hidden="true" />
            <span>{isStopping ? "Cerrando…" : "Detener"}</span>
          </button>
        </div>
      )}

      {finished && (
        <div className="recording-hud is-done" role="status" aria-live="polite">
          <span className="recording-hud-done-icon" aria-hidden="true">
            <Icon name="check" width={16} height={16} />
          </span>
          <div className="recording-hud-body">
            <strong className="recording-hud-title">Grabación guardada</strong>
            <span className="recording-hud-meta" title={finished.outputPath}>
              {fileName(finished.outputPath)} · {formatElapsed(finished.elapsedMs)}
            </span>
          </div>
          {onAddToVideoLibrary && !isInLibrary && (
            <button
              type="button"
              className="recording-hud-action"
              onClick={handleAddToLibrary}
              title="Añadir la carpeta a la biblioteca de Vídeos"
            >
              <Icon name="film" width={16} height={16} />
            </button>
          )}
          <button
            type="button"
            className="recording-hud-action"
            onClick={handleReveal}
            title="Mostrar el vídeo en el Explorador de archivos"
          >
            <Icon name="folder" width={16} height={16} />
          </button>
          <button
            type="button"
            className="recording-hud-action"
            onClick={handleSendToSuperGallery}
            title="Enviar el vídeo a Super Galería"
          >
            <Icon name="smartphone" width={16} height={16} />
          </button>
          <button
            type="button"
            className="recording-hud-action"
            onClick={() => setFinished(null)}
            aria-label="Cerrar aviso"
            title="Cerrar"
          >
            <Icon name="close" width={14} height={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="recording-hud is-error" role="alert">
          <span className="recording-hud-done-icon" aria-hidden="true">
            <Icon name="info" width={16} height={16} />
          </span>
          <div className="recording-hud-body">
            <strong className="recording-hud-title">La grabación falló</strong>
            <span className="recording-hud-meta">{error}</span>
          </div>
          <button
            type="button"
            className="recording-hud-action"
            onClick={() => setError(null)}
            aria-label="Cerrar aviso"
            title="Cerrar"
          >
            <Icon name="close" width={14} height={14} />
          </button>
        </div>
      )}
    </div>
  );
}
