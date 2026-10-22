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

  const shortcutLabel = shortcutStatus?.shortcut || "Shift+PrintScreen";
  const shortcutIsActive = Boolean(shortcutStatus?.isRegistered);
  const shortcutBadge = shortcutStatus?.error
    ? shortcutIsActive ? "Atajo alternativo activo" : "Atajo no disponible"
    : shortcutIsActive ? "Atajo Activo" : "Atajo inactivo";

  const handleKindChange = (kind: CaptureIntent) => {
    setCaptureKind(kind);
  };

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

  return (
    <div className="screen-capture-view">
      {/* ── Encabezado Principal ── */}
      <section className="capture-hero">
        <div className="capture-hero-icon">
          <Icon name={isVideo ? "video" : "camera"} width={32} height={32} />
        </div>
        <div className="capture-hero-text">
          <div className="capture-hero-title-row">
            <h1>Capturador de Pantalla</h1>
            <span className={`capture-badge ${shortcutStatus?.error ? "is-warning" : ""}`}>
              <Icon name={shortcutStatus?.error ? "info" : shortcutIsActive ? "check" : "keyboard"} width={14} height={14} />
              {shortcutBadge}
            </span>
          </div>
          <p>
            {isVideo
              ? "Graba la ventana, el área o la pantalla completa que elijas. El vídeo se codifica en MP4 y se guarda en tu carpeta de capturas."
              : "Captura instantánea de ventanas, áreas y monitores con contorno de alta precisión, anotaciones vectoriales, copia directa a memoria sin tocar disco y guardado PNG opcional."}
          </p>
        </div>
      </section>

      {/* ── Zona de Lanzamiento y Modos ── */}
      <section className="capture-launch-section">
        {/* Switch tipo Recortes: imagen o vídeo. */}
        <div className="capture-kind-row">
          <CaptureKindSwitch value={captureKind} onChange={handleKindChange} disabled={isLaunching} />
          <span className="capture-kind-hint">
            {isVideo
              ? "Elige la zona y pulsa «Iniciar Grabación»."
              : "Captura puntual con anotaciones."}
          </span>
        </div>

        <div className="capture-actions-row">
          <button
            type="button"
            className={`capture-btn-primary ${isVideo ? "is-video" : ""}`}
            onClick={() => void handleStart(selectedMode)}
            disabled={isLaunching}
          >
            <Icon name={isVideo ? "video" : "camera"} width={18} height={18} />
            <span>{isVideo ? "Iniciar Grabación" : "Iniciar Captura"}</span>
            {!isVideo && (
              <span className="capture-shortcut-pill">
                {shortcutLabel}
              </span>
            )}
          </button>

          <div className="capture-mode-selector" role="radiogroup" aria-label="Modo de captura">
            {availableModes.includes("window") && (
              <button
                type="button"
                className={`capture-mode-tab ${selectedMode === "window" ? "is-active" : ""}`}
                onClick={() => setSelectedMode("window")}
                title="Detecta automáticamente ventanas y áreas bajo el cursor (Predeterminado)"
              >
                <Icon name="columns" width={16} height={16} />
                <span>Ventana</span>
              </button>
            )}
            {availableModes.includes("rect") && (
              <button
                type="button"
                className={`capture-mode-tab ${selectedMode === "rect" ? "is-active" : ""}`}
                onClick={() => setSelectedMode("rect")}
                title="Arrastra para seleccionar un área personalizada con tiradores"
              >
                <Icon name="crop" width={16} height={16} />
                <span>Rectángulo</span>
              </button>
            )}
            {availableModes.includes("freeform") && (
              <button
                type="button"
                className={`capture-mode-tab ${selectedMode === "freeform" ? "is-active" : ""}`}
                onClick={() => setSelectedMode("freeform")}
                title="Dibuja un lazo a mano alzada para capturar cualquier forma personalizada"
              >
                <Icon name="lasso" width={16} height={16} />
                <span>Lazo Libre</span>
              </button>
            )}
            {availableModes.includes("fullscreen") && (
              <button
                type="button"
                className={`capture-mode-tab ${selectedMode === "fullscreen" ? "is-active" : ""}`}
                onClick={() => setSelectedMode("fullscreen")}
                title="Captura el monitor completo bajo el cursor"
              >
                <Icon name="fullscreen" width={16} height={16} />
                <span>Pantalla Completa</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Ajustes de grabación ── */}
        {isVideo && (
          <>
            <div className="capture-recording-options">
            <label className="capture-select-field">
              <span className="capture-select-label">Fotogramas</span>
              <select
                className="capture-select"
                value={recordingPreferences.fps}
                onChange={(event) =>
                  handlePreferencesChange({
                    ...recordingPreferences,
                    fps: Number(event.target.value),
                  })
                }
              >
                {RECORDING_FPS_OPTIONS.map((fps) => (
                  <option key={fps} value={fps}>{fps} fps</option>
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

            <label className="capture-select-field capture-checkbox-field">
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
                <span>Grabar lo que suena en el ordenador</span>
              </span>
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
                <option value="auto">Automática (GPU si hay)</option>
                <option value="cpu">CPU (libx264)</option>
                <option value="nvenc">NVIDIA (NVENC)</option>
                <option value="qsv">Intel (QSV)</option>
                <option value="amf">AMD (AMF)</option>
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

            {audioDevices.length === 0 && (
              <span className="capture-recording-note">
                No se detectaron dispositivos de audio: la grabación será muda.
              </span>
            )}
          </div>

          <div className="capture-recording-hint">
            <Icon name="keyboard" width={14} height={14} />
            <span>
              Durante la grabación aparece una barra flotante con el cronómetro. Puedes detenerla
              con <strong>Ctrl+Shift+R</strong> aunque Prisma esté minimizado o en la bandeja.
            </span>
          </div>
          </>
        )}

        {/* ── Estado del Atajo Global ── */}
        <div className={`capture-shortcut-alert ${shortcutStatus?.error ? "is-error" : ""}`}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name={shortcutStatus?.error ? "info" : "keyboard"} width={18} height={18} />
            <span>
              {shortcutStatus?.error ? (
                <>
                  <strong>Conflicto de atajo:</strong> {shortcutStatus.error}
                </>
              ) : shortcutIsActive ? (
                <>
                  El atajo global <strong>{shortcutLabel}</strong> está activo incluso con Prisma minimizado o en bandeja.
                </>
              ) : (
                <>
                  No hay ningún atajo global activo. Actívalo en <strong>Configuración → Capturador de Pantalla</strong>.
                </>
              )}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {shortcutLabel !== "PrintScreen" && (
              <button
                type="button"
                className="capture-pill-btn"
                onClick={() => void configureShortcut(true, "PrintScreen")}
                disabled={isUpdatingShortcut}
                title="Intentar registrar la tecla Impr Pant estándar (si ShareX u otra app no la ocupan)"
              >
                Usar Impr Pant
              </button>
            )}
            {shortcutLabel !== "Shift+PrintScreen" && (
              <button
                type="button"
                className="capture-pill-btn"
                onClick={() => void configureShortcut(true, "Shift+PrintScreen")}
                disabled={isUpdatingShortcut}
                title="Usar la combinación Shift + Impr Pant"
              >
                Usar Mayús + Impr Pant
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Guía Rápida & Principios de Diseño ── */}
      <section className="capture-guide-grid">
        <div className="capture-guide-card">
          <div className="capture-guide-header">
            <Icon name="columns" width={20} height={20} />
            <span>Borde Inteligente</span>
          </div>
          <p>
            Al mover el cursor, un contorno cyan de alto contraste resalta con precisión la ventana visible.
            La rueda del ratón permite alternar entre la ventana completa o subpaneles anidados.
          </p>
        </div>

        <div className="capture-guide-card">
          <div className="capture-guide-header">
            <Icon name={isVideo ? "film" : "copy"} width={20} height={20} />
            <span>{isVideo ? "Vídeo en MP4" : "Memoria Pura (Sin Basura)"}</span>
          </div>
          <p>
            {isVideo
              ? "La grabación se cierra de forma ordenada para que el MP4 quede reproducible, listo para abrirse, compartirse o enviarse a Super Galería."
              : "Copiar al portapapeles (Ctrl+C) transfiere el PNG directamente a memoria sin generar archivos temporales, miniaturas ni historial en disco. Se pega al instante en cualquier aplicación."}
          </p>
        </div>

        <div className="capture-guide-card">
          <div className="capture-guide-header">
            <Icon name={isVideo ? "pulse" : "edit"} width={20} height={20} />
            <span>{isVideo ? "Selección antes de grabar" : "Editor y Anotaciones"}</span>
          </div>
          <p>
            {isVideo
              ? "Eliges la ventana o el área con el mismo contorno inteligente de la imagen. Al confirmar, el overlay se aparta y la grabación comienza sobre lo que hay en pantalla."
              : "Ventana propia con lápiz, resaltador, texto y flechas. El archivo PNG solo se escribe en disco cuando eliges explícitamente «Guardar como…» (Ctrl+S)."}
          </p>
        </div>
      </section>
    </div>
  );
}
