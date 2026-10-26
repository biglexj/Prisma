import { useEffect, useState } from "react";
import type { ProgressBarStyle } from "../useSystemSettings";
import { MediaProgressBar } from "../../shared/ui/MediaProgressBar";
import { Icon } from "../../shared/ui/Icon";

export const PROGRESS_BAR_OPTIONS: { id: ProgressBarStyle; label: string; desc: string; previewClass: string }[] = [
  {
    id: "wavy",
    label: "Ondulada (Predeterminada)",
    desc: "Animación de onda en reproducción activa (Material 3 Expressive)",
    previewClass: "wavy-preview",
  },
  {
    id: "classic",
    label: "Clásica",
    desc: "Línea continua recta tradicional con control deslizante suave",
    previewClass: "classic-preview",
  },
  {
    id: "prism",
    label: "Haz Prismático",
    desc: "Dispersión espectral iridiscente y reflejos de luz óptica",
    previewClass: "prism-preview",
  },
  {
    id: "soundwave",
    label: "Espectro SoundWave",
    desc: "Micro-barras de audio verticales con modulación armónica",
    previewClass: "soundwave-preview",
  },
  {
    id: "fluid",
    label: "Mercurio Líquido",
    desc: "Metagota fluida elástica con deformación dinámica al arrastrar",
    previewClass: "fluid-preview",
  },
  {
    id: "helix",
    label: "Doble Hélice",
    desc: "Hélice cuántica dual entrelazada en contrafase tridimensional",
    previewClass: "helix-preview",
  },
  {
    id: "neon_pulse",
    label: "Pulso Bio-Sensor (ECG)",
    desc: "Trazado de electrocardiograma electro-luminiscente con brillo neón",
    previewClass: "neon-pulse-preview",
  },
  {
    id: "particles",
    label: "Estela Cósmica",
    desc: "Núcleo estelar emisor de micro-partículas vivas flotantes",
    previewClass: "particles-preview",
  },
  {
    id: "vinyl_tape",
    label: "Cinta Analógica & Vinilo",
    desc: "Textura de cinta magnética y microsurcos con cabezal de aluminio",
    previewClass: "vinyl-tape-preview",
  },
  {
    id: "elastic_string",
    label: "Cuerda Elástica",
    desc: "Cuerda tensada que vibra con oscilación armónica al interactuar",
    previewClass: "elastic-string-preview",
  },
  {
    id: "binary",
    label: "Matriz Binaria",
    desc: "Dígitos 0/1 que se descifran justo antes del cabezal de lectura",
    previewClass: "binary-preview",
  },
  {
    id: "pacman",
    label: "Laberinto Pac-Man",
    desc: "El personaje devora la pista punto a punto hasta la píldora final",
    previewClass: "pacman-preview",
  },
  {
    id: "glitch",
    label: "Ciber-Glitch",
    desc: "Canales cian y magenta desfasados con artefactos de bloque",
    previewClass: "glitch-preview",
  },
  {
    id: "fire",
    label: "Fuego Cinético",
    desc: "Llama viva que sube desde la cabeza de reproducción",
    previewClass: "fire-preview",
  },
  {
    id: "tesla",
    label: "Rayo Tesla",
    desc: "Descarga eléctrica bifurcada que salta hacia el cabezal",
    previewClass: "tesla-preview",
  },
  {
    id: "laser",
    label: "Sable Láser",
    desc: "Hoja incandescente con empuñadura metálica y zumbido en la punta",
    previewClass: "laser-preview",
  },
];

interface ProgressBarSettingsPanelProps {
  progressBarStyle: ProgressBarStyle;
  onProgressBarStyleChange: (style: ProgressBarStyle) => void;
}

export function ProgressBarSettingsPanel({
  progressBarStyle,
  onProgressBarStyleChange,
}: ProgressBarSettingsPanelProps) {
  const [demoPlaying, setDemoPlaying] = useState(true);
  const [demoPosition, setDemoPosition] = useState(72);

  // Animación del temporizador de demostración en vivo
  useEffect(() => {
    if (!demoPlaying) return;
    const timer = setInterval(() => {
      setDemoPosition((prev) => (prev >= 240 ? 0 : prev + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [demoPlaying]);

  return (
    <div className="settings-panel">
      {/* Tarjeta de Demostración en Vivo */}
      <div className="settings-card progress-demo-card">
        <div className="settings-card-header-row">
          <div>
            <h3>Demostración Interactiva en Vivo</h3>
            <p>Prueba la fluidez, el arrastre táctil y el comportamiento dinámico del estilo seleccionado.</p>
          </div>
          <button
            type="button"
            className="progress-demo-play-btn"
            onClick={() => setDemoPlaying((p) => !p)}
            title={demoPlaying ? "Pausar demostración" : "Reanudar demostración"}
          >
            <Icon name={demoPlaying ? "pause" : "play"} />
            <span>{demoPlaying ? "Pausar" : "Animar"}</span>
          </button>
        </div>

        <div className="progress-live-demo-box">
          <span className="demo-time-label">
            {Math.floor(demoPosition / 60).toString().padStart(2, "0")}:
            {Math.floor(demoPosition % 60).toString().padStart(2, "0")}
          </span>
          <div className="demo-bar-wrapper">
            <MediaProgressBar
              position={demoPosition}
              duration={240}
              isPlaying={demoPlaying}
              onSeek={(pos) => setDemoPosition(pos)}
              styleMode={progressBarStyle}
            />
          </div>
          <span className="demo-time-label">04:00</span>
        </div>
      </div>

      {/* Catálogo de Estilos */}
      <div className="settings-card">
        <h3>Catálogo de Estilos de Reproducción</h3>
        <p>
          Selecciona la apariencia y el motor visual para el control de progreso multimedia en música, vídeos y Quick Look.
        </p>
        <div className="progress-style-grid">
          {PROGRESS_BAR_OPTIONS.map(({ id, label, desc, previewClass }) => (
            <button
              key={id}
              className={`theme-card progress-style-card${progressBarStyle === id ? " is-selected" : ""}`}
              onClick={() => onProgressBarStyleChange(id)}
              aria-pressed={progressBarStyle === id}
            >
              <div className={`progress-style-preview ${previewClass}`}>
                {id === "wavy" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <path
                        d="M0 10 Q 12 3, 25 10 T 50 10 T 75 10 T 95 10"
                        stroke="var(--primary)"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M95 10 L 160 10"
                        stroke="var(--outline-variant)"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                      <rect x="93" y="2" width="4.5" height="16" rx="2.25" fill="#ffffff" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.4))" />
                    </svg>
                  </div>
                )}
                {id === "classic" && (
                  <div className="preview-classic-track">
                    <div className="preview-classic-fill" />
                    <div className="preview-classic-thumb" />
                  </div>
                )}
                {id === "prism" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <defs>
                        <linearGradient id="prism-grad" x1="0" y1="0" x2="95" y2="0" gradientUnits="userSpaceOnUse">
                          <stop offset="0%" stopColor="#ff453a" />
                          <stop offset="25%" stopColor="#ff9f0a" />
                          <stop offset="50%" stopColor="#ffd60a" />
                          <stop offset="75%" stopColor="#30d158" />
                          <stop offset="100%" stopColor="#64d2ff" />
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="10" x2="95" y2="10" stroke="url(#prism-grad)" strokeWidth="4.5" strokeLinecap="round" />
                      <line x1="95" y1="10" x2="160" y2="10" stroke="var(--outline-variant)" strokeWidth="3.5" strokeLinecap="round" />
                      <polygon points="95,2 100,10 95,18 90,10" fill="#ffffff" filter="drop-shadow(0 0 4px rgba(255,255,255,0.8))" />
                    </svg>
                  </div>
                )}
                {id === "soundwave" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      {[10, 14, 8, 12, 16, 9, 13, 7, 11, 15, 9, 12].map((h, i) => (
                        <rect
                          key={i}
                          x={i * 7 + 6}
                          y={10 - h / 2}
                          width="4"
                          height={h}
                          rx="2"
                          fill="var(--primary)"
                        />
                      ))}
                      {[5, 7, 4, 6, 5, 8, 4, 7].map((h, i) => (
                        <rect
                          key={`in-${i}`}
                          x={94 + i * 7}
                          y={10 - h / 2}
                          width="4"
                          height={h}
                          rx="2"
                          fill="var(--outline-variant)"
                        />
                      ))}
                      <rect x="88" y="1" width="4" height="18" rx="2" fill="#ffffff" filter="drop-shadow(0 0 4px var(--primary))" />
                    </svg>
                  </div>
                )}
                {id === "fluid" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <path
                        d="M0 10 C 30 7, 60 13, 85 8 Q 95 10, 95 10"
                        stroke="var(--primary)"
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                      <line x1="95" y1="10" x2="160" y2="10" stroke="var(--outline-variant)" strokeWidth="3" strokeLinecap="round" />
                      <ellipse cx="94" cy="10" rx="7" ry="5.5" fill="#ffffff" filter="drop-shadow(0 1px 3px rgba(0,0,0,0.3))" />
                    </svg>
                  </div>
                )}
                {id === "helix" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <path
                        d="M0 10 Q 15 3, 30 10 T 60 10 T 90 10"
                        stroke="var(--primary)"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <path
                        d="M0 10 Q 15 17, 30 10 T 60 10 T 90 10"
                        stroke="var(--secondary, color-mix(in srgb, var(--primary) 45%, var(--on-surface-variant) 55%))"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <line x1="90" y1="10" x2="160" y2="10" stroke="var(--outline-variant)" strokeWidth="3" strokeLinecap="round" />
                      <circle cx="90" cy="10" r="5" fill="#ffffff" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.4))" />
                    </svg>
                  </div>
                )}
                {id === "neon_pulse" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <path
                        d="M0 10 L 40 10 L 44 6 L 48 14 L 52 2 L 56 18 L 60 10 L 95 10"
                        stroke="#00f0ff"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="drop-shadow(0 0 4px #00f0ff)"
                      />
                      <line x1="95" y1="10" x2="160" y2="10" stroke="var(--outline-variant)" strokeWidth="3" strokeLinecap="round" />
                      <rect x="93" y="2" width="4.5" height="16" rx="2.25" fill="#ffffff" filter="drop-shadow(0 0 6px #00f0ff)" />
                    </svg>
                  </div>
                )}
                {id === "particles" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <rect x="0" y="8" width="160" height="4" rx="2" fill="rgba(30,41,59,0.55)" />
                      <rect x="0" y="8" width="95" height="4" rx="2" fill="var(--primary)" />
                      <circle cx="35" cy="7" r="1.5" fill="#f59e0b" opacity="0.7" />
                      <circle cx="55" cy="13" r="2" fill="#ec4899" opacity="0.8" />
                      <circle cx="74" cy="6" r="1.8" fill="#f59e0b" opacity="0.9" />
                      <circle cx="86" cy="12" r="2" fill="#ffffff" opacity="0.9" />
                      <circle cx="95" cy="10" r="6" fill="#ffffff" filter="drop-shadow(0 0 6px #fef3c7)" />
                    </svg>
                  </div>
                )}
                {id === "vinyl_tape" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <rect x="0" y="6" width="95" height="8" rx="2" fill="var(--primary)" opacity="0.85" />
                      <line x1="0" y1="8" x2="95" y2="8" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
                      <line x1="0" y1="12" x2="95" y2="12" stroke="#000000" strokeWidth="1" opacity="0.3" />
                      <line x1="95" y1="10" x2="160" y2="10" stroke="var(--outline-variant)" strokeWidth="3" strokeLinecap="round" />
                      <rect x="92" y="2" width="6" height="16" rx="1.5" fill="#d0d7de" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.5))" />
                      <circle cx="95" cy="10" r="1.5" fill="#ff3b30" />
                    </svg>
                  </div>
                )}
                {id === "elastic_string" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <path
                        d="M0 10 Q 48 3, 95 10"
                        stroke="var(--primary)"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M0 10 Q 48 17, 95 10"
                        stroke="var(--primary)"
                        strokeWidth="1.5"
                        strokeDasharray="2 2"
                        opacity="0.5"
                      />
                      <line x1="95" y1="10" x2="160" y2="10" stroke="var(--outline-variant)" strokeWidth="3" strokeLinecap="round" />
                      <ellipse cx="95" cy="10" rx="3" ry="7" fill="#ffffff" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.4))" />
                    </svg>
                  </div>
                )}
                {id === "binary" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <rect x="0" y="1" width="160" height="18" rx="4" fill="rgba(17,24,39,0.9)" />
                      <text
                        x="6"
                        y="13.5"
                        fill="#22c55e"
                        fontFamily="ui-monospace, monospace"
                        fontSize="12"
                        fontWeight="700"
                        letterSpacing="1"
                      >
                        10110010
                      </text>
                      <text
                        x="80"
                        y="13.5"
                        fill="rgba(55,65,81,0.95)"
                        fontFamily="ui-monospace, monospace"
                        fontSize="12"
                        fontWeight="700"
                        letterSpacing="1"
                      >
                        01100101
                      </text>
                      <rect x="92" y="1" width="2" height="18" fill="#ffffff" filter="drop-shadow(0 0 4px #22c55e)" />
                    </svg>
                  </div>
                )}
                {id === "pacman" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <rect x="0" y="0" width="160" height="20" fill="rgba(0,0,0,0.9)" />
                      <line x1="0" y1="1.5" x2="160" y2="1.5" stroke="#1d4ed8" strokeWidth="1.5" />
                      <line x1="0" y1="18.5" x2="160" y2="18.5" stroke="#1d4ed8" strokeWidth="1.5" />
                      {[110, 128, 146].map((x) => (
                        <circle key={x} cx={x} cy="10" r="2.5" fill="#fef08a" />
                      ))}
                      <circle cx="152" cy="10" r="4" fill="#fef08a" filter="drop-shadow(0 0 4px #fef08a)" />
                      <path d="M64 10 L 78 3 A 10 10 0 0 1 78 17 Z" fill="#eab308" />
                    </svg>
                  </div>
                )}
                {id === "glitch" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <rect x="0" y="8" width="160" height="4" fill="rgba(55,65,81,0.9)" />
                      <rect x="0" y="8" width="96" height="4" fill="rgba(6,182,212,0.85)" />
                      <rect x="3" y="9" width="96" height="4" fill="rgba(236,72,153,0.8)" />
                      <rect x="0" y="9" width="96" height="2" fill="#ffffff" />
                      <rect x="30" y="4" width="14" height="2" fill="#06b6d4" />
                      <rect x="62" y="14" width="18" height="2" fill="#ec4899" />
                      <rect x="92" y="2" width="8" height="16" fill="#ffffff" />
                    </svg>
                  </div>
                )}
                {id === "fire" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <rect x="0" y="9" width="160" height="2" fill="rgba(69,26,3,0.9)" />
                      <rect x="0" y="8" width="96" height="4" fill="#ef4444" />
                      <rect x="0" y="9" width="96" height="2" fill="#7f1d1d" />
                      <circle cx="92" cy="7" r="3" fill="#f97316" opacity="0.9" />
                      <circle cx="88" cy="4" r="2.2" fill="#facc15" opacity="0.85" />
                      <circle cx="84" cy="2" r="1.6" fill="#ef4444" opacity="0.7" />
                      <circle cx="95" cy="5" r="1.8" fill="#facc15" opacity="0.8" />
                    </svg>
                  </div>
                )}
                {id === "tesla" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <rect x="0" y="9" width="160" height="2" fill="rgba(30,41,59,0.9)" />
                      <polyline
                        points="0,10 14,4 26,13 38,3 50,14 62,6 74,12 86,4 96,10"
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                      <polyline
                        points="0,10 16,8 30,12 46,7 60,13 76,8 90,11 96,10"
                        stroke="#ffffff"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <circle cx="96" cy="10" r="5" fill="#bae6fd" filter="drop-shadow(0 0 5px #0284c7)" />
                    </svg>
                  </div>
                )}
                {id === "laser" && (
                  <div className="preview-wave-track">
                    <svg className="preview-wave-svg" viewBox="0 0 160 20" fill="none">
                      <rect x="0" y="8" width="160" height="4" fill="rgba(17,24,39,0.9)" />
                      <rect x="0" y="5" width="20" height="10" fill="#cbd5e1" />
                      <rect x="5" y="4" width="4" height="12" fill="#475569" />
                      <rect x="15" y="4" width="2" height="12" fill="#475569" />
                      <rect x="20" y="6" width="78" height="8" fill="#ef4444" filter="drop-shadow(0 0 6px #ef4444)" />
                      <rect x="20" y="8" width="78" height="4" fill="#fca5a5" />
                      <rect x="20" y="9" width="76" height="2" fill="#ffffff" />
                      <circle cx="97" cy="10" r="2.5" fill="#ffffff" opacity="0.9" />
                    </svg>
                  </div>
                )}
              </div>
              <strong>{label}</strong>
              <small>{desc}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
