import { useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import type { CaptureMode } from "../model/types";
import { screenCaptureClient } from "../services/screenCaptureClient";
import { useCaptureShortcut } from "../useCaptureShortcut";
import "./screen-capture.css";

interface ScreenCaptureViewProps {
  onStartCapture?: (mode: CaptureMode) => void;
}

export function ScreenCaptureView({ onStartCapture }: ScreenCaptureViewProps) {
  const [selectedMode, setSelectedMode] = useState<CaptureMode>("window");
  const [isLaunching, setIsLaunching] = useState(false);
  const {
    status: shortcutStatus,
    isUpdating: isUpdatingShortcut,
    configure: configureShortcut,
  } = useCaptureShortcut();

  const shortcutLabel = shortcutStatus?.shortcut || "Shift+PrintScreen";
  const shortcutIsActive = Boolean(shortcutStatus?.isRegistered);
  const shortcutBadge = shortcutStatus?.error
    ? shortcutIsActive ? "Atajo alternativo activo" : "Atajo no disponible"
    : shortcutIsActive ? "Atajo Activo" : "Atajo inactivo";

  const handleStart = async (mode: CaptureMode = selectedMode) => {
    setIsLaunching(true);
    try {
      if (onStartCapture) {
        onStartCapture(mode);
      } else {
        await screenCaptureClient.startCapture(mode);
      }
    } catch (err) {
      console.error("Error al iniciar captura de pantalla:", err);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="screen-capture-view">
      {/* ── Encabezado Principal ── */}
      <section className="capture-hero">
        <div className="capture-hero-icon">
          <Icon name="camera" width={32} height={32} />
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
            Captura instantánea de ventanas, áreas y monitores con contorno de alta precisión,
            anotaciones vectoriales, copia directa a memoria sin tocar disco y guardado PNG opcional.
          </p>
        </div>
      </section>

      {/* ── Zona de Lanzamiento y Modos ── */}
      <section className="capture-launch-section">
        <div className="capture-actions-row">
          <button
            type="button"
            className="capture-btn-primary"
            onClick={() => void handleStart(selectedMode)}
            disabled={isLaunching}
          >
            <Icon name="camera" width={18} height={18} />
            <span>Iniciar Captura</span>
            <span className="capture-shortcut-pill">
              {shortcutLabel}
            </span>
          </button>

          <div className="capture-mode-selector" role="radiogroup" aria-label="Modo de captura">
            <button
              type="button"
              className={`capture-mode-tab ${selectedMode === "window" ? "is-active" : ""}`}
              onClick={() => setSelectedMode("window")}
              title="Detecta automáticamente ventanas y áreas bajo el cursor (Predeterminado)"
            >
              <Icon name="columns" width={16} height={16} />
              <span>Ventana</span>
            </button>
            <button
              type="button"
              className={`capture-mode-tab ${selectedMode === "rect" ? "is-active" : ""}`}
              onClick={() => setSelectedMode("rect")}
              title="Arrastra para seleccionar un área personalizada con tiradores"
            >
              <Icon name="crop" width={16} height={16} />
              <span>Rectángulo</span>
            </button>
            <button
              type="button"
              className={`capture-mode-tab ${selectedMode === "freeform" ? "is-active" : ""}`}
              onClick={() => setSelectedMode("freeform")}
              title="Dibuja un lazo a mano alzada para capturar cualquier forma personalizada"
            >
              <Icon name="lasso" width={16} height={16} />
              <span>Lazo Libre</span>
            </button>
            <button
              type="button"
              className={`capture-mode-tab ${selectedMode === "fullscreen" ? "is-active" : ""}`}
              onClick={() => setSelectedMode("fullscreen")}
              title="Captura el monitor completo bajo el cursor"
            >
              <Icon name="fullscreen" width={16} height={16} />
              <span>Pantalla Completa</span>
            </button>
          </div>
        </div>

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
            <Icon name="copy" width={20} height={20} />
            <span>Memoria Pura (Sin Basura)</span>
          </div>
          <p>
            Copiar al portapapeles (Ctrl+C) transfiere el PNG directamente a memoria sin generar archivos temporales,
            miniaturas ni historial en disco. Se pega al instante en cualquier aplicación.
          </p>
        </div>

        <div className="capture-guide-card">
          <div className="capture-guide-header">
            <Icon name="edit" width={20} height={20} />
            <span>Editor y Anotaciones</span>
          </div>
          <p>
            Ventana propia con lápiz, resaltador, texto y flechas. El archivo PNG solo se escribe en disco
            cuando eliges explícitamente «Guardar como…» (Ctrl+S).
          </p>
        </div>
      </section>
    </div>
  );
}
