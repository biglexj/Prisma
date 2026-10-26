import { useCallback, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
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

/**
 * Barra flotante de control de la grabación.
 *
 * Vive en su propia ventana siempre encima porque el overlay de selección debe
 * ocultarse durante la captura: si siguiera visible, aparecería en el vídeo.
 * Se centra abajo en el monitor de grabación y se excluye de la captura nativa.
 */
export function ScreenCaptureRecorderBar() {
  const [recording, setRecording] = useState<RecordingInfo | null>(null);
  const [finished, setFinished] = useState<RecordingInfo | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isStopping, setIsStopping] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [error, setError] = useState("");
  const [revealCycle, setRevealCycle] = useState(0);
  const [isPointerOver, setIsPointerOver] = useState(false);

  const handleHide = useCallback(() => {
    void getCurrentWindow().hide().catch(() => setError("No se pudo ocultar la barra."));
  }, []);

  useEffect(() => {
    const unlisten = listen("prisma://recording-controls-shown", () => setRevealCycle((value) => value + 1));
    return () => { void unlisten.then((stop) => stop()); };
  }, []);

  const recordingStartedAt = recording?.startedAtMs;
  useEffect(() => {
    if (recordingStartedAt === undefined || isPointerOver) return;
    const timer = setTimeout(handleHide, 5000);
    return () => clearTimeout(timer);
  }, [recordingStartedAt, revealCycle, handleHide, isPointerOver]);

  useEffect(() => {
    const unlistenPromise = listen<RecordingInfo>(RECORDING_STATE_EVENT, ({ payload }) => {
      if (payload?.status === "recording") {
        setRecording(payload);
        setFinished(null);
        setError("");
      } else if (payload?.status === "finished" && payload.outputPath) {
        setRecording(null);
        setFinished(payload);
        setError("");
      } else {
        setRecording(null);
        setFinished(null);
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
    setError("");
    try {
      const info = await screenCaptureClient.stopRecording();
      setRecording(null);
      setFinished(info);
    } catch (err) {
      console.error("Error al detener la grabación:", err);
      setError("No se pudo detener. Reintenta.");
    } finally {
      setIsStopping(false);
    }
  }, []);

  useEffect(() => {
    if (!finished || isPointerOver) return;
    const timer = setTimeout(() => {
      setFinished(null);
      void getCurrentWindow().hide().catch(() => undefined);
    }, 3000);
    return () => clearTimeout(timer);
  }, [finished, isPointerOver]);

  const handleTogglePause = useCallback(async () => {
    setIsPausing(true);
    setError("");
    try {
      await screenCaptureClient.togglePause();
    } catch (err) {
      console.error("Error al pausar la grabación:", err);
      setError("No se pudo cambiar la pausa.");
    } finally {
      setIsPausing(false);
    }
  }, []);

  if (!recording && !finished) return null;

  if (finished) return <div className="recorder-bar is-finished" role="status" aria-live="polite"
    onPointerEnter={() => setIsPointerOver(true)}
    onPointerLeave={() => setIsPointerOver(false)}
    onPointerDown={(event) => {
      if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
      void getCurrentWindow().startDragging().catch(() => setError("No se pudo mover la barra."));
    }}>
    <span className="recorder-bar-done" aria-hidden="true"><Icon name="check" width={20} height={20} /></span>
    <div className="recorder-bar-body">
      <strong className="recorder-bar-saved-title">Grabación guardada</strong>
      <span className={`recorder-bar-meta ${error ? "is-error" : ""}`}>
        {error || finished.outputPath.replace(/.*[/\\]/, "")}
      </span>
    </div>
    <button type="button" className="recorder-bar-pause" aria-label="Mostrar grabación en su carpeta"
      onClick={() => { void invoke("show_in_file_manager", { path: finished.outputPath }).catch(() => setError("No se pudo abrir la carpeta.")); }}>
      <Icon name="folder" width={18} height={18} />
    </button>
    <button type="button" className="recorder-bar-pause" aria-label="Cerrar aviso de grabación"
      onClick={() => { setFinished(null); void getCurrentWindow().hide(); }}>
      <Icon name="close" width={18} height={18} />
    </button>
  </div>;

  if (!recording) return null;

  const isPaused = Boolean(recording.paused);

  return (
    <div className={`recorder-bar ${isPaused ? "is-paused" : ""}`} role="toolbar" aria-label="Control de grabación"
      onPointerEnter={() => setIsPointerOver(true)}
      onPointerLeave={() => setIsPointerOver(false)}
      onPointerDown={(event) => {
        if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
        void getCurrentWindow().startDragging().catch(() => setError("No se pudo mover la barra."));
      }}>
      <span className="recorder-bar-grip" title="Arrastra para mover la barra" aria-hidden="true">
        <svg width="12" height="20" viewBox="0 0 12 20" fill="currentColor">
          {[5, 10, 15].flatMap((y) => [3, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" />))}
        </svg>
      </span>
      <span className="recorder-bar-dot" aria-hidden="true" />
      <div className="recorder-bar-body">
        <strong className="recorder-bar-time">
          {formatElapsed(elapsedMs)}
        </strong>
      <span className={`recorder-bar-meta recorder-bar-status ${error ? "is-error" : ""}`} role="status" title={error || undefined}>
        {error || (isStopping ? "Guardando…" : isPaused ? "En pausa" : "Grabando")}
      </span>
      </div>
      <button
        type="button"
        className="recorder-bar-pause"
        disabled={isStopping || isPausing}
        aria-label={isPaused ? "Reanudar la grabación" : "Pausar la grabación"}
        onClick={() => void handleTogglePause()}
        title={isPaused ? "Reanudar la grabación" : "Pausar la grabación"}
      >
        <Icon name={isPaused ? "play" : "pause"} width={18} height={18} />
      </button>
      <button
        type="button"
        className="recorder-bar-stop"
        onClick={() => void handleStop()}
        disabled={isStopping}
        aria-label={isStopping ? "Guardando grabación" : "Detener la grabación"}
        title="Detener y guardar grabación (Ctrl+S)"
      >
        <span className="recorder-bar-stop-dot" aria-hidden="true" />
        <span>{isStopping ? "Guardando…" : "Detener"}</span>
      </button>
      <button type="button" className="recorder-bar-hide" aria-label="Ocultar controles de grabación"
        title="Ocultar; Ctrl+S detiene y guarda. También disponible en la bandeja."
        onClick={handleHide}>
        <Icon name="eye-slash" width={16} height={16} />
      </button>
    </div>
  );
}
