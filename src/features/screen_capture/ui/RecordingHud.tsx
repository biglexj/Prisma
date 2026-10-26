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

/** Acciones posteriores al guardado. El control activo vive en la barra nativa. */
export function RecordingHud({ onAddToVideoLibrary }: RecordingHudProps = {}) {

  const [finished, setFinished] = useState<RecordingInfo | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isInLibrary, setIsInLibrary] = useState(false);

  useEffect(() => {
    const unlistenPromise = listen<RecordingInfo>(RECORDING_STATE_EVENT, ({ payload }) => {
      if (!payload) return;
      if (payload.status === "recording") {
        setFinished(null);
        setError(null);
      } else if (payload.status === "finished") {
        setFinished(payload);
      } else {
        setFinished(null);
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
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

  const handleAddToLibrary = useCallback(() => {
    if (!finished?.outputPath || !onAddToVideoLibrary) return;
    const folder = finished.outputPath.replace(/[/\\][^/\\]*$/, "");
    onAddToVideoLibrary(folder);
    setIsInLibrary(true);
  }, [finished, onAddToVideoLibrary]);

  const [isTrimming, setIsTrimming] = useState(false);
  useEffect(() => {
    if (!finished || isTrimming) return;
    const timer = setTimeout(() => setFinished(null), 3000);
    return () => clearTimeout(timer);
  }, [finished, isTrimming]);
  const [trimStart, setTrimStart] = useState("0");
  const [trimEnd, setTrimEnd] = useState("0");

  const handleToggleTrim = useCallback(() => {
    if (!isTrimming && finished) {
      // El recorte va de 0 al final de la grabación.
      setTrimStart("0");
      setTrimEnd(String(Math.max(1, Math.round(finished.elapsedMs / 1000))));
    }
    setIsTrimming((value) => !value);
  }, [finished, isTrimming]);

  const handleTrim = useCallback(async () => {
    if (!finished) return;
    const start = Number(trimStart);
    const end = Number(trimEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      setError("El final del recorte debe ser posterior al inicio");
      return;
    }
    try {
      const path = await screenCaptureClient.trimVideo(finished.outputPath, start, end);
      setFinished({ ...finished, outputPath: path, elapsedMs: Math.round((end - start) * 1000) });
      setIsTrimming(false);
    } catch (err) {
      setError(String(err));
    }
  }, [finished, trimEnd, trimStart]);

  if (!finished && !error) return null;

  return (
    <div className="recording-hud-root">
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
          <button
            type="button"
            className="recording-hud-action"
            onClick={handleToggleTrim}
            title="Recortar el vídeo sin recodificarlo"
          >
            <Icon name="crop" width={16} height={16} />
          </button>
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

      {isTrimming && finished && (
        <div className="recording-hud is-trim" role="group" aria-label="Recortar grabación">
          <span className="recording-hud-done-icon" aria-hidden="true">
            <Icon name="crop" width={16} height={16} />
          </span>
          <div className="recording-hud-body">
            <strong className="recording-hud-title">Recortar sin recodificar</strong>
            <span className="recording-hud-meta">
              El corte cae en el fotograma clave más cercano.
            </span>
            <div className="recording-hud-trim-fields">
              <label>
                <span>Desde (s)</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={trimStart}
                  onChange={(event) => setTrimStart(event.target.value)}
                />
              </label>
              <label>
                <span>Hasta (s)</span>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={trimEnd}
                  onChange={(event) => setTrimEnd(event.target.value)}
                />
              </label>
            </div>
          </div>
          <button type="button" className="recording-hud-stop" onClick={() => void handleTrim()}>
            <span>Recortar</span>
          </button>
          <button
            type="button"
            className="recording-hud-action"
            onClick={() => setIsTrimming(false)}
            aria-label="Cancelar el recorte"
            title="Cancelar"
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
