import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { CAPTURE_FORMATS } from "../../../shared/captureFormat";
import { getDefaultCaptureFolders, type DefaultCaptureFolders } from "../../../shared/captureFolders";
import { Icon } from "../../../shared/ui/Icon";
import { useSystemSettings } from "../../../app/useSystemSettings";
import type { CaptureIntent } from "../model/types";
import {
  RECORDING_CONTAINER_OPTIONS,
  type RecordingPreferences,
} from "../model/recordingSettings";

interface CaptureSaveSettingsProps {
  /** Intención actual: decide si se ofrecen formatos de imagen o de vídeo. */
  kind: CaptureIntent;
  /** Preferencias de grabación, para el contenedor del vídeo. */
  recordingPreferences: RecordingPreferences;
  onRecordingPreferencesChange: (preferences: RecordingPreferences) => void;
}

function CaptureFolder({ label, folder, fallback, placeholder = "Carpeta Imágenes", onChange }: {
  label: string; folder: string; fallback: string; placeholder?: string; onChange: (folder: string) => void;
}) {
  const [error, setError] = useState("");
  const choose = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: label,
        defaultPath: folder || fallback || undefined });
      if (typeof selected === "string" && selected.trim()) onChange(selected.trim());
      setError("");
    } catch { setError("No se pudo seleccionar la carpeta."); }
  };
  return <div className="capture-folder-setting">
    <div className="snapshot-folder-path-display">
      <div className="snapshot-folder-header-row">
        <span className="snapshot-folder-label">{label}</span>
        <span className={`snapshot-folder-badge ${folder ? "is-custom" : "is-default"}`}>
          {folder ? "Personalizada" : "Predeterminada"}
        </span>
      </div>
      <div className="snapshot-folder-path-text" title={folder || fallback}>
        <Icon name="folder" /><span>{folder || fallback || placeholder}</span>
      </div>
    </div>
    <div className="snapshot-folder-actions-row">
      <button type="button" className="snapshot-action-btn primary" onClick={() => void choose()}><Icon name="folder-open" />Cambiar...</button>
      <button type="button" className="snapshot-action-btn secondary" disabled={!folder && !fallback}
        onClick={() => void invoke("show_in_file_manager", { path: folder || fallback }).catch(() => setError("No se pudo abrir la carpeta."))}><Icon name="external-link" />Abrir</button>
      {folder && <button type="button" className="snapshot-action-btn tertiary" onClick={() => onChange("")}><Icon name="undo" />Restablecer</button>}
    </div>
    {error && <p role="alert">{error}</p>}
  </div>;
}

export function CaptureSaveSettings({
  kind,
  recordingPreferences,
  onRecordingPreferencesChange,
}: CaptureSaveSettingsProps) {
  const { captureFormat, setCaptureFormat, videoSnapshotFolder, setVideoSnapshotFolder,
    screenCaptureFolder, setScreenCaptureFolder, screenRecordingFolder, setScreenRecordingFolder } = useSystemSettings();
  const [folders, setFolders] = useState<DefaultCaptureFolders>({ images: "", videos: "" });
  const [folderError, setFolderError] = useState("");
  const isVideo = kind === "video";
  useEffect(() => {
    let active = true;
    void getDefaultCaptureFolders().then(value => { if (active) setFolders(value); })
      .catch(() => { if (active) setFolderError("No se pudieron preparar las carpetas predeterminadas."); });
    return () => { active = false; };
  }, []);
  return <section className="settings-card capture-card capture-save-card">
    {isVideo ? (
      <div className="capture-format-setting">
        <h3>Guardado de grabaciones</h3>
        <p>Contenedor del vídeo grabado: todos usan H.264 con audio AAC.</p>
        <div className="snapshot-format-options capture-format-options">
          {RECORDING_CONTAINER_OPTIONS.map(({ id, label, description }) => <button key={id} type="button"
            className={`snapshot-format-chip ${recordingPreferences.container === id ? "is-selected" : ""}`}
            aria-pressed={recordingPreferences.container === id}
            onClick={() => onRecordingPreferencesChange({ ...recordingPreferences, container: id })}
            title={description}>
            <span className="snapshot-format-info"><strong>{label}</strong><small>{description}</small></span>
          </button>)}
        </div>
      </div>
    ) : (
      <div className="capture-format-setting">
      <h3>Guardado de capturas</h3>
      <p>Formato de las capturas de pantalla y de los fotogramas de vídeo.</p>
      <div className="snapshot-format-options capture-format-options">
        {CAPTURE_FORMATS.map(({ id, label, description }) => <button key={id} type="button"
          className={`snapshot-format-chip ${captureFormat === id ? "is-selected" : ""}`}
          aria-pressed={captureFormat === id} onClick={() => setCaptureFormat(id)} title={description}>
          <span className="snapshot-format-info"><strong>{label}</strong><small>{description}</small></span>
        </button>)}
      </div>
      {captureFormat === "elx" && <p>ELX es experimental: RGB sin pérdidas. La transparencia se guarda sobre blanco.</p>}
      </div>
    )}
    <div className="capture-save-folders">
      {isVideo ? (
        <CaptureFolder label="Grabaciones" placeholder={"Vídeos\\Prisma"} folder={screenRecordingFolder}
          fallback={folders.videos} onChange={setScreenRecordingFolder} />
      ) : (
        <CaptureFolder label="Pantalla · Ctrl + S" placeholder={"Imágenes\\Prisma"} folder={screenCaptureFolder}
          fallback={folders.images} onChange={setScreenCaptureFolder} />
      )}
      <CaptureFolder label="Fotogramas de vídeo" folder={videoSnapshotFolder}
        fallback={folders.images} placeholder={"Imágenes\\Prisma"} onChange={setVideoSnapshotFolder} />
    </div>
    {folderError && <p role="alert">{folderError}</p>}
  </section>;
}
