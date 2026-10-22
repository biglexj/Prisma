import { useEffect, useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { CaptureKindSwitch } from "./CaptureKindSwitch";
import type { CaptureIntent, CaptureMode } from "../model/types";
import {
  DEFAULT_RECORDING_PREFERENCES,
  RECORDING_FPS_OPTIONS,
  RECORDING_SIZE_OPTIONS,
  loadRecordingPreferences,
  saveRecordingPreferences,
  type RecordingPreferences,
} from "../model/recordingSettings";
import { screenCaptureClient } from "../services/screenCaptureClient";
import { useCaptureShortcut } from "../useCaptureShortcut";
import "./screen-capture.css";

interface ScreenCaptureViewProps {
  onStartCapture?: (mode: CaptureMode) => void;
}

const LAST_KIND_KEY = "prisma.screen-capture.last-kind";

/** Modos disponibles al grabar: el lazo libre no tiene equivalente en vídeo. */
const VIDEO_MODES: CaptureMode[] = ["rect", "window", "fullscreen"];
const IMAGE_MODES: CaptureMode[] = ["window", "rect", "freeform", "fullscreen"];

const MODE_OPTIONS: { id: CaptureMode; label: string; icon: "columns" | "crop" | "lasso" | "fullscreen" }[] = [
  { id: "window", label: "Ventana", icon: "columns" },
  { id: "rect", label: "Rectángulo", icon: "crop" },
  { id: "freeform", label: "Lazo Libre", icon: "lasso" },
  { id: "fullscreen", label: "Pantalla Completa", icon: "fullscreen" },
];

function loadLastKind(): CaptureIntent {
  try {
    return localStorage.getItem(LAST_KIND_KEY) === "video" ? "video" : "image";
  } catch {
    return "image";
  }
}

export function ScreenCaptureView({ onStartCapture }: ScreenCaptureViewProps) {
  const [captureKind, setCaptureKind] = useState<CaptureIntent>(() => loadLastKind());
  const [selectedMode, setSelectedMode] = useState<CaptureMode>("window");
  const [isLaunching, setIsLaunching] = useState(false);
  const [recordingPreferences, setRecordingPreferences] = useState<RecordingPreferences>(() =>
    loadRecordingPreferences()
  );
  const [audioDevices, setAudioDevices] = useState<string[]>([]);
  const {
    status: shortcutStatus,
    isUpdating: isUpdatingShortcut,
    configure: configureShortcut,
  } = useCaptureShortcut();

  const isVideo = captureKind === "video";
  const availableModes = isVideo ? VIDEO_MODES : IMAGE_MODES;
  const shortcutLabel = shortcutStatus?.shortcut || "Shift+PrintScreen";
  const shortcutIsActive = Boolean(shortcutStatus?.isRegistered);
  const shortcutEnabled = shortcutStatus?.enabled ?? true;

  useEffect(() => {
    try {
      localStorage.setItem(LAST_KIND_KEY, captureKind);
    } catch {
      // Preferencia opcional.
    }
  }, [captureKind]);

  // Al cambiar de intención se vuelve a un modo compatible con ambas.
  useEffect(() => {
    if (!availableModes.includes(selectedMode)) setSelectedMode("window");
  }, [availableModes, selectedMode]);

  // Los dispositivos de audio solo importan cuando se graba con sonido.
  useEffect(() => {
    if (!isVideo) return;
    let cancelled = false;
    void screenCaptureClient
      .listAudioDevices()
      .then((devices) => {
        if (!cancelled) setAudioDevices(devices);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isVideo]);

  const handleStart = async (mode: CaptureMode = selectedMode) => {
    setIsLaunching(true);
    try {
      if (onStartCapture) {
        onStartCapture(mode);
      } else {
        await screenCaptureClient.startCapture(mode, captureKind);
      }
    } catch (err) {
      console.error("Error al iniciar la captura:", err);
    } finally {
      setIsLaunching(false);
    }
  };

  const handlePreferencesChange = (next: RecordingPreferences) => {
    setRecordingPreferences(next);
    saveRecordingPreferences(next);
  };

  const handleShortcutToggle = async (enabled: boolean) => {
    try {
      await configureShortcut(enabled, shortcutLabel);
    } catch (err) {
      console.error("Error al cambiar el atajo global:", err);
    }
  };

  return (
    <div className="screen-capture-view">
      {/* ── Cabecera ── */}
      <section className="capture-topbar">
        <div className="capture-topbar-icon">
          <Icon name={isVideo ? "video" : "camera"} width={26} height={26} />
        </div>
        <h1>Capturador de Pantalla</h1>
        <span className={`capture-badge ${shortcutStatus?.error ? "is-warning" : ""}`}>
          <Icon
            name={shortcutStatus?.error ? "info" : shortcutIsActive ? "check" : "keyboard"}
            width={14}
            height={14}
          />
          {shortcutStatus?.error
            ? "Atajo con conflicto"
            : shortcutIsActive
              ? "Atajo Activo"
              : "Atajo inactivo"}
        </span>
      </section>

      <div className="capture-columns">
        {/* ── Tipo y modo ── */}
        <section className="settings-card capture-card">
          <div className="settings-card-header-row">
            <div>
              <h3>Tipo de captura</h3>
            </div>
          </div>

          <CaptureKindSwitch value={captureKind} onChange={setCaptureKind} disabled={isLaunching} />

          <div className="settings-section-divider" style={{ margin: "14px 0 10px" }} />

          <h3 className="capture-subheading">Modo</h3>
          <div className="capture-option-cards">
            {MODE_OPTIONS.filter((option) => availableModes.includes(option.id)).map((option) => (
              <button
                key={option.id}
                type="button"
                className={`snapshot-format-chip ${selectedMode === option.id ? "is-selected" : ""}`}
                onClick={() => setSelectedMode(option.id)}
                title={option.label}
              >
                <Icon name={option.icon} width={18} height={18} />
                <span className="snapshot-format-info">
                  <strong>{option.label}</strong>
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`capture-btn-primary ${isVideo ? "is-video" : ""}`}
            onClick={() => void handleStart(selectedMode)}
            disabled={isLaunching}
          >
            <Icon name={isVideo ? "video" : "camera"} width={18} height={18} />
            <span>{isVideo ? "Iniciar Grabación" : "Iniciar Captura"}</span>
            {!isVideo && <span className="capture-shortcut-pill">{shortcutLabel}</span>}
          </button>
        </section>

        {/* ── Ajustes de grabación ── */}
        {isVideo && (
          <section className="settings-card capture-card">
            <div className="settings-card-header-row">
              <div>
                <h3>Ajustes de grabación</h3>
              </div>
            </div>

            <div className="capture-fields">
              <label className="capture-select-field">
                <span className="capture-select-label">Fotogramas</span>
                <select
                  className="capture-select"
                  value={recordingPreferences.fps}
                  onChange={(event) =>
                    handlePreferencesChange({ ...recordingPreferences, fps: Number(event.target.value) })
                  }
                >
                  {RECORDING_FPS_OPTIONS.map((fps) => (
                    <option key={fps} value={fps}>{fps} fps</option>
                  ))}
                </select>
              </label>

              <label className="capture-select-field">
                <span className="capture-select-label">Calidad</span>
                <select
                  className="capture-select"
                  value={recordingPreferences.quality}
                  onChange={(event) =>
                    handlePreferencesChange({
                      ...recordingPreferences,
                      quality: event.target.value as RecordingPreferences["quality"],
                    })
                  }
                >
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baja</option>
                </select>
              </label>

              <label className="capture-select-field">
                <span className="capture-select-label">Codificación</span>
                <select
                  className="capture-select"
                  value={recordingPreferences.encoder}
                  onChange={(event) =>
                    handlePreferencesChange({
                      ...recordingPreferences,
                      encoder: event.target.value as RecordingPreferences["encoder"],
                    })
                  }
                >
                  <option value="auto">Automática</option>
                  <option value="cpu">CPU</option>
                  <option value="nvenc">NVIDIA</option>
                  <option value="qsv">Intel</option>
                  <option value="amf">AMD</option>
                </select>
              </label>

              <label className="capture-select-field">
                <span className="capture-select-label">Tamaño</span>
                <select
                  className="capture-select"
                  value={recordingPreferences.maxHeight ?? ""}
                  onChange={(event) =>
                    handlePreferencesChange({
                      ...recordingPreferences,
                      maxHeight: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                >
                  {RECORDING_SIZE_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value ?? ""}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="capture-select-field">
                <span className="capture-select-label">Audio</span>
                <select
                  className="capture-select"
                  value={recordingPreferences.audioDevice ?? ""}
                  onChange={(event) =>
                    handlePreferencesChange({
                      ...recordingPreferences,
                      audioDevice: event.target.value || null,
                    })
                  }
                >
                  <option value="">Sin audio</option>
                  {audioDevices.map((device) => (
                    <option key={device} value={device}>{device}</option>
                  ))}
                </select>
              </label>

              <label className="capture-checkbox-field">
                <span className="capture-select-label">Audio del sistema</span>
                <span className="capture-checkbox">
                  <input
                    type="checkbox"
                    checked={recordingPreferences.systemAudio}
                    onChange={(event) =>
                      handlePreferencesChange({
                        ...recordingPreferences,
                        systemAudio: event.target.checked,
                      })
                    }
                  />
                  <span>Grabar lo que suena</span>
                </span>
              </label>
            </div>
          </section>
        )}

        {/* ── Atajo global ── */}
        <section className="settings-card capture-card">
          <div className="settings-card-header-row">
            <div>
              <h3>Atajo global</h3>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={shortcutEnabled}
                onChange={(event) => void handleShortcutToggle(event.target.checked)}
                disabled={isUpdatingShortcut}
                aria-label="Atajo global de captura"
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="capture-shortcut-chips">
            {["PrintScreen", "Shift+PrintScreen"].map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={`snapshot-format-chip ${shortcutLabel === candidate ? "is-selected" : ""}`}
                onClick={() => void configureShortcut(true, candidate)}
                disabled={isUpdatingShortcut}
                title={`Registrar ${candidate} como atajo global`}
              >
                <Icon name="keyboard" width={18} height={18} />
                <span className="snapshot-format-info">
                  <strong>{candidate}</strong>
                </span>
              </button>
            ))}
          </div>

          <div className="capture-status-line">
            <Icon
              name={shortcutStatus?.error ? "info" : shortcutIsActive ? "check" : "keyboard"}
              width={16}
              height={16}
            />
            <span>
              {shortcutStatus?.error
                ? shortcutStatus.error
                : shortcutIsActive
                  ? `Activo con «${shortcutLabel}». Funciona con Prisma minimizado o en la bandeja.`
                  : "Sin atajo global activo."}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
