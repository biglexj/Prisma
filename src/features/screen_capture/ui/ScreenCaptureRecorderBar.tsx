import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
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

/**
 * Barra flotante de control de la grabación.
 *
 * Vive en su propia ventana siempre encima porque el overlay de selección debe
 * ocultarse durante la captura: si siguiera visible, aparecería en el vídeo.
 * Se coloca fuera de la región grabada para no contaminar la imagen.
 */
export function ScreenCaptureRecorderBar() {
  const [recording, setRecording] = useState<RecordingInfo | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isStopping, setIsStopping] = useState(false);

  useEffect(() => {
    const unlistenPromise = listen<RecordingInfo>(RECORDING_STATE_EVENT, ({ payload }) => {
      if (payload?.status === "recording") {
        setRecording(payload);
      } else {
        setRecording(null);
      }
    });

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
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [recording]);

  const handleStop = useCallback(async () => {
    setIsStopping(true);
    try {
      await screenCaptureClient.stopRecording();
    } catch (err) {
      console.error("Error al detener la grabación:", err);
    } finally {
      setIsStopping(false);
      setRecording(null);
      void getCurrentWindow().hide();
    }
  }, []);

  const handleTogglePause = useCallback(async () => {
    try {
      await screenCaptureClient.togglePause();
    } catch (err) {
      console.error("Error al pausar la grabación:", err);
    }
  }, []);

  if (!recording) return null;

  const isPaused = Boolean(recording.paused);

  return (
    <div className="recorder-bar" role="toolbar" aria-label="Control de grabación">
      <span className="recorder-bar-dot" aria-hidden="true" />
      <div className="recorder-bar-body">
        <strong className="recorder-bar-time">
          {isPaused ? "En pausa" : formatElapsed(elapsedMs)}
        </strong>
        <span className="recorder-bar-meta">
          {recording.width}×{recording.height} · {recording.fps} fps
        </span>
      </div>
      <button
        type="button"
        className="recorder-bar-pause"
        onClick={() => void handleTogglePause()}
        title={isPaused ? "Reanudar la grabación" : "Pausar la grabación"}
      >
        <Icon name={isPaused ? "play" : "pause"} width={14} height={14} />
        <span>{isPaused ? "Reanudar" : "Pausar"}</span>
      </button>
      <button
        type="button"
        className="recorder-bar-stop"
        onClick={() => void handleStop()}
        disabled={isStopping}
        title="Detener la grabación"
      >
        <span className="recorder-bar-stop-dot" aria-hidden="true" />
        <span>{isStopping ? "Cerrando…" : "Detener"}</span>
      </button>
    </div>
  );
}
