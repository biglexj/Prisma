import { useEffect, useLayoutEffect, useState } from "react";
import { LibrarySources } from "./LibrarySources";
import { ModularLibrariesPanel } from "./ModularLibrariesPanel";
import { SynapseSettingsPanel } from "./SynapseSettingsPanel";
import type { useMusicLibrary } from "../../features/music_library/useMusicLibrary";
import type { useVisualLibrary } from "../../features/visual_library/useVisualLibrary";
import type { ThemeMode } from "../useTheme";
import {
  useSystemSettings,
  type QuickLookShortcutMode,
  type ProgressBarStyle,
  type SidebarDensity,
} from "../useSystemSettings";
import { MediaProgressBar } from "../../shared/ui/MediaProgressBar";
import { Icon } from "../../shared/ui/Icon";
import "./app-settings.css";

interface AppSettingsProps {
  music: ReturnType<typeof useMusicLibrary>;
  images: ReturnType<typeof useVisualLibrary>;
  videos: ReturnType<typeof useVisualLibrary>;
  onPlay: (path: string) => void;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

type SettingsTab = "general" | "folders" | "libraries" | "progress" | "synapse" | "shortcuts" | "aurora";

const THEMES: { mode: ThemeMode; label: string; desc: string; previewClass: string }[] = [
  { mode: "light", label: "Claro", desc: "Interfaz luminosa", previewClass: "light-preview" },
  { mode: "dark", label: "Oscuro", desc: "Interfaz oscura", previewClass: "dark-preview" },
  { mode: "system", label: "Automático", desc: "Sigue al sistema", previewClass: "system-preview" },
];

const SIDEBAR_DENSITY_OPTIONS: {
  id: SidebarDensity;
  label: string;
  badge: string;
  desc: string;
}[] = [
  {
    id: "compact",
    label: "Compacta",
    badge: "34px · Ultra delgada",
    desc: "Aprovechamiento vertical máximo. Ideal para tener todas tus bibliotecas y colecciones activas en pantalla sin scroll.",
  },
  {
    id: "standard",
    label: "Estándar",
    badge: "38px · Fina y limpia",
    desc: "Diseño refinado de Material 3 con proporciones delgadas y navegación ágil.",
  },
  {
    id: "intermediate",
    label: "Intermedia",
    badge: "42px · Equilibrada",
    desc: "Punto medio armónico con altura de 42px que combina ligereza y comodidad visual.",
  },
  {
    id: "comfortable",
    label: "Cómoda",
    badge: "46px · Espaciosa",
    desc: "Separación generosa y área de toque amplia recomendada para pantallas táctiles o paneles 4K.",
  },
];

const PROGRESS_BAR_OPTIONS: { id: ProgressBarStyle; label: string; desc: string; previewClass: string }[] = [
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
];

const SHORTCUTS: { id: QuickLookShortcutMode; label: string; keyBadge: string; desc: string }[] = [
  { id: "space", label: "Espacio", keyBadge: "Espacio", desc: "Estilo nativo / macOS (Predeterminado)" },
  { id: "alt_space", label: "Alt + Espacio", keyBadge: "Alt + Espacio", desc: "Atajo secundario alternativo" },
  { id: "shift_space", label: "Shift + Espacio", keyBadge: "Shift + Espacio", desc: "Atajo rápido con Shift" },
];

export function AppSettings({ music, images, videos, onPlay, theme, onThemeChange }: AppSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [demoPlaying, setDemoPlaying] = useState(true);
  const [demoPosition, setDemoPosition] = useState(72);

  // En Configuración siempre se inicia desde arriba y no se recuerda el scroll
  useLayoutEffect(() => {
    const container = document.querySelector(".studio-content") as HTMLElement | null;
    if (container) {
      container.scrollTop = 0;
    }
  }, [activeTab]);
  const {
    quickLookShortcut,
    autostart,
    minimizeToTray,
    confirmDeletion,
    progressBarStyle,
    sidebarDensity,
    auroraOnlineServicesEnabled,
    auroraServerUrl,
    setQuickLookShortcut,
    setAutostart,
    setMinimizeToTray,
    setConfirmDeletion,
    setProgressBarStyle,
    setSidebarDensity,
    setAuroraOnlineServicesEnabled,
    setAuroraServerUrl,
  } = useSystemSettings();

  // Animación del temporizador de demostración en vivo
  useEffect(() => {
    if (!demoPlaying || activeTab !== "progress") return;
    const timer = setInterval(() => {
      setDemoPosition((prev) => (prev >= 240 ? 0 : prev + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [demoPlaying, activeTab]);

  const isQuickLookActive = quickLookShortcut !== "disabled";

  return (
    <section className="app-settings-page">
      <div className="settings-page-header">
        <div className="settings-tab-nav">
          <button
            className={activeTab === "general" ? "is-active" : ""}
            onClick={() => setActiveTab("general")}
          >
            <Icon name="settings" />
            <span>General y Sistema</span>
          </button>
          <button
            className={activeTab === "libraries" ? "is-active" : ""}
            onClick={() => setActiveTab("libraries")}
          >
            <Icon name="layers" />
            <span>Bibliotecas</span>
          </button>
          <button
            className={activeTab === "folders" ? "is-active" : ""}
            onClick={() => setActiveTab("folders")}
          >
            <Icon name="folder-open" />
            <span>Carpetas de Biblioteca</span>
          </button>
          <button
            className={activeTab === "progress" ? "is-active" : ""}
            onClick={() => setActiveTab("progress")}
          >
            <Icon name="sliders" />
            <span>Barra de Progreso</span>
          </button>
          <button
            className={activeTab === "synapse" ? "is-active" : ""}
            onClick={() => setActiveTab("synapse")}
          >
            <Icon name="synapse" />
            <span>Aurora Synapse</span>
          </button>
          <button
            className={activeTab === "aurora" ? "is-active" : ""}
            onClick={() => setActiveTab("aurora")}
          >
            <Icon name="sparkles" />
            <span>Servicios Online</span>
          </button>
          <button
            className={activeTab === "shortcuts" ? "is-active" : ""}
            onClick={() => setActiveTab("shortcuts")}
          >
            <Icon name="keyboard" />
            <span>Atajos de Teclado</span>
          </button>
        </div>
      </div>

      <div className="settings-tab-content">
        {/* ══════════════════════════════════════════════════════════════════════════
            PESTAÑA 1: GENERAL Y SISTEMA
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "general" && (
          <div className="settings-panel">
            <div className="settings-cards-grid">
              {/* ── Quick Look ── */}
              <div className="settings-card">
                <div className="settings-card-header-row">
                  <div>
                    <h3>Previsualización Rápida (Quick Look)</h3>
                    <p>
                      Previsualiza al instante cualquier archivo de música, imagen o vídeo seleccionado en el Explorador de Windows o el Escritorio sin abrir la aplicación completa.
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={isQuickLookActive}
                      onChange={(e) => setQuickLookShortcut(e.target.checked ? "space" : "disabled")}
                      aria-label="Activar Quick Look"
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                {isQuickLookActive && (
                  <div className="quicklook-config-section">
                    <h4 className="settings-subheading">Atajo de Teclado para Quick Look</h4>
                    <div className="shortcut-options-grid">
                      {SHORTCUTS.map(({ id, label, keyBadge, desc }) => (
                        <button
                          key={id}
                          className={`shortcut-card${quickLookShortcut === id ? " is-selected" : ""}`}
                          onClick={() => setQuickLookShortcut(id)}
                          aria-pressed={quickLookShortcut === id}
                        >
                          <kbd className="shortcut-kbd">{keyBadge}</kbd>
                          <strong>{label}</strong>
                          <small>{desc}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Sistema y Segundo Plano ── */}
              <div className="settings-card">
                <h3>Sistema y Segundo Plano</h3>
                <p>Controla cómo se comporta Prisma al iniciar sesión y al cerrar la ventana principal.</p>

                <div className="system-toggles-list">
                  <div className="system-toggle-item">
                    <div className="system-toggle-info">
                      <strong>Iniciar con Windows (Autorun)</strong>
                      <p>Arranca Prisma automáticamente en segundo plano al encender el equipo para que Quick Look esté siempre disponible.</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={autostart}
                        onChange={(e) => setAutostart(e.target.checked)}
                        aria-label="Iniciar con Windows"
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>

                  <div className="system-toggle-item">
                    <div className="system-toggle-info">
                      <strong>Minimizar a la bandeja al cerrar</strong>
                      <p>Al hacer clic en ✕, Prisma se oculta en el área de notificación (System Tray) para continuar activo en segundo plano sin ocupar espacio en la barra de tareas.</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={minimizeToTray}
                        onChange={(e) => setMinimizeToTray(e.target.checked)}
                        aria-label="Minimizar a la bandeja al cerrar"
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
              </div>

              {/* ── Papelera de reciclaje ── */}
              <div className="settings-card">
                <h3>Papelera de reciclaje</h3>
                <p>
                  Controla si Prisma solicita confirmación antes de enviar una pista musical, imagen o vídeo a la papelera de reciclaje del sistema.
                </p>

                <div className="system-toggles-list">
                  <div className="system-toggle-item">
                    <div className="system-toggle-info">
                      <strong>Pedir confirmación antes de mover a la papelera</strong>
                      <p>Con la confirmación activada, la tecla Supr o la opción «Mover a la papelera» muestran un diálogo de confirmación. Al desactivarla, los archivos se envían directamente a la papelera del sistema sin preguntar.</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={confirmDeletion}
                        onChange={(e) => setConfirmDeletion(e.target.checked)}
                        aria-label="Pedir confirmación antes de mover a la papelera"
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
              </div>

              {/* ── Apariencia / Tema ── */}
              <div className="settings-card">
                <h3>Apariencia</h3>
                <p>Elige cómo luce Prisma. El modo automático respeta la preferencia de tu sistema operativo.</p>
                <div className="theme-options-grid">
                  {THEMES.map(({ mode, label, desc, previewClass }) => (
                    <button
                      key={mode}
                      className={`theme-card${theme === mode ? " is-selected" : ""}`}
                      onClick={() => onThemeChange(mode)}
                      aria-pressed={theme === mode}
                    >
                      <div className={`theme-preview ${previewClass}`} />
                      <strong>{label}</strong>
                      <small>{desc}</small>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Densidad de la Barra Lateral ── */}
              <div className="settings-card">
                <h3>Densidad de la Barra Lateral</h3>
                <p>
                  Ajusta la altura y el grosor de los elementos de navegación para optimizar el espacio vertical según tu pantalla y bibliotecas activas.
                </p>
                <div className="density-options-grid">
                  {SIDEBAR_DENSITY_OPTIONS.map(({ id, label, badge, desc }) => (
                    <button
                      key={id}
                      className={`density-card${sidebarDensity === id ? " is-selected" : ""}`}
                      onClick={() => setSidebarDensity(id)}
                      aria-pressed={sidebarDensity === id}
                      type="button"
                    >
                      <div className={`density-preview density-preview-${id}`}>
                        <div className="density-preview-bar bar-1" />
                        <div className="density-preview-bar bar-2" />
                        <div className="density-preview-bar bar-3" />
                      </div>
                      <div className="density-card-info">
                        <div className="density-card-header">
                          <strong>{label}</strong>
                          <span className="density-badge">{badge}</span>
                        </div>
                        <small>{desc}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            PESTAÑA 2: BIBLIOTECAS MODULARES PERSONALIZABLES
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "libraries" && (
          <div className="settings-panel">
            <ModularLibrariesPanel />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            PESTAÑA 3: CARPETAS DE BIBLIOTECA
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "folders" && (
          <div className="settings-panel">
            <LibrarySources images={images} music={music} onPlay={onPlay} videos={videos} />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            PESTAÑA 4: BARRA DE PROGRESO (Suite de 10 Estilos Interactivos)
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "progress" && (
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

            {/* Catálogo de los 10 Estilos */}
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
                    onClick={() => setProgressBarStyle(id)}
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
                            {[4, 8, 14, 6, 12, 16, 9, 15, 11, 7, 13, 15, 8].map((h, i) => (
                              <rect
                                key={i}
                                x={i * 7}
                                y={10 - h / 2}
                                width="3.5"
                                height={h}
                                rx="1.75"
                                fill="var(--primary)"
                              />
                            ))}
                            {[6, 8, 5, 7, 6, 9, 5, 8, 6, 7].map((h, i) => (
                              <rect
                                key={`in-${i}`}
                                x={98 + i * 6}
                                y={10 - h / 2}
                                width="3"
                                height={h}
                                rx="1.5"
                                fill="var(--outline-variant)"
                              />
                            ))}
                            <rect x="91" y="1" width="4" height="18" rx="2" fill="#ffffff" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.4))" />
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
                              stroke="color-mix(in srgb, var(--primary) 65%, #ffffff)"
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
                            <line x1="0" y1="10" x2="95" y2="10" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round" />
                            <line x1="95" y1="10" x2="160" y2="10" stroke="var(--outline-variant)" strokeWidth="3" strokeLinecap="round" />
                            <circle cx="35" cy="7" r="1.5" fill="var(--primary)" opacity="0.6" />
                            <circle cx="55" cy="13" r="2" fill="var(--primary)" opacity="0.8" />
                            <circle cx="75" cy="6" r="1.8" fill="var(--primary)" opacity="0.9" />
                            <circle cx="85" cy="12" r="2.2" fill="#ffffff" />
                            <circle cx="95" cy="10" r="5.5" fill="#ffffff" filter="drop-shadow(0 0 5px var(--primary))" />
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
                    </div>
                    <strong>{label}</strong>
                    <small>{desc}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            PESTAÑA 4: AURORA SYNAPSE
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "synapse" && (
          <div className="settings-panel">
            <SynapseSettingsPanel />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            PESTAÑA 5: ATAJOS DE TECLADO
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "shortcuts" && (
          <div className="settings-panel">
            <div className="settings-card">
              <h3>Referencia de Atajos de Teclado</h3>
              <p>Consulta los atajos rápidos de teclado para controlar la reproducción de vídeos y música con máxima agilidad.</p>

              <div className="shortcuts-reference-grid">
                {/* Categoría: Reproducción */}
                <div className="shortcuts-category-card">
                  <h4>
                    <Icon name="play" />
                    <span>Reproducción y Tiempo</span>
                  </h4>
                  <div className="shortcuts-list">
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Reproducir / Pausar</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Espacio</kbd>
                        <kbd className="shortcut-kbd-pill">K</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Retroceder 10 segundos</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">←</kbd>
                        <kbd className="shortcut-kbd-pill">J</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Avanzar 10 segundos</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">→</kbd>
                        <kbd className="shortcut-kbd-pill">L</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Vídeo anterior</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">P</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Vídeo siguiente</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">N</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Barajar cola (One-shot)</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">S</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Categoría: Audio y Pistas */}
                <div className="shortcuts-category-card">
                  <h4>
                    <Icon name="volume" />
                    <span>Audio y Pistas</span>
                  </h4>
                  <div className="shortcuts-list">
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Alternar pista de audio</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">B</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Silenciar / Restaurar (Mute)</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">M</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Subir volumen (+5%)</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">↑</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Bajar volumen (-5%)</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">↓</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Categoría: Subtítulos y Pantalla */}
                <div className="shortcuts-category-card">
                  <h4>
                    <Icon name="subtitles" />
                    <span>Subtítulos y Pantalla</span>
                  </h4>
                  <div className="shortcuts-list">
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Activar / Alternar subtítulos</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">V</kbd>
                        <kbd className="shortcut-kbd-pill">C</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Pantalla completa</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">F</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Salir / Volver a la galería</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Esc</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Previsualización (Quick Look)</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">
                          {quickLookShortcut === "space"
                            ? "Espacio"
                            : quickLookShortcut === "alt_space"
                            ? "Alt + Espacio"
                            : quickLookShortcut === "shift_space"
                            ? "Shift + Espacio"
                            : "Desactivado"}
                        </kbd>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            PESTAÑA 7: SERVICIOS ONLINE (ECOSISTEMA AURORA)
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "aurora" && (
          <div className="settings-panel">
            <div className="settings-cards-grid">
              {/* ── Switch Principal ── */}
              <div className="settings-card">
                <div className="settings-card-header-row">
                  <div>
                    <h3>Servicios Online del Ecosistema Aurora</h3>
                    <p>
                      Habilita la integración en la nube con Aurora para explorar el catálogo de Wallpapers en alta fidelidad, sincronización de favoritos y biblioteca musical.
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={auroraOnlineServicesEnabled}
                      onChange={(e) => setAuroraOnlineServicesEnabled(e.target.checked)}
                      aria-label="Habilitar Servicios Online de Aurora"
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              {auroraOnlineServicesEnabled && (
                <>
                  {/* ── Servidor de Aurora ── */}
                  <div className="settings-card">
                    <h4 className="settings-subheading">Servidor de Aurora Cloud</h4>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "16px" }}>
                      Selecciona el entorno de Aurora para la consulta de catálogos y sincronización en la nube:
                    </p>

                    <div style={{ display: "grid", gap: "10px" }}>
                      <label
                        className={`density-option-card ${auroraServerUrl === "https://www.biglexj.com" ? "is-selected" : ""}`}
                        onClick={() => setAuroraServerUrl("https://www.biglexj.com")}
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          type="radio"
                          name="aurora-server"
                          checked={auroraServerUrl === "https://www.biglexj.com"}
                          onChange={() => setAuroraServerUrl("https://www.biglexj.com")}
                        />
                        <div>
                          <strong>🟢 Servidor Oficial</strong>
                          <p style={{ margin: "2px 0 0", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                            https://www.biglexj.com
                          </p>
                        </div>
                      </label>

                      <label
                        className={`density-option-card ${auroraServerUrl !== "https://www.biglexj.com" ? "is-selected" : ""}`}
                        onClick={() => {
                          if (auroraServerUrl === "https://www.biglexj.com") {
                            setAuroraServerUrl("http://localhost:4321");
                          }
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <input
                          type="radio"
                          name="aurora-server"
                          checked={auroraServerUrl !== "https://www.biglexj.com"}
                          onChange={() => {}}
                        />
                        <div style={{ flex: 1 }}>
                          <strong>🔵 Servidor Personalizado / LAN</strong>
                          <p style={{ margin: "2px 0 0", color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                            Para pruebas en red local con Astro (ej. http://localhost:4321)
                          </p>
                          {auroraServerUrl !== "https://www.biglexj.com" && (
                            <input
                              type="text"
                              className="settings-input"
                              value={auroraServerUrl}
                              onChange={(e) => setAuroraServerUrl(e.target.value)}
                              placeholder="http://localhost:4321"
                              style={{ marginTop: "8px", width: "100%" }}
                            />
                          )}
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* ── Música Online ── */}
                  <div className="settings-card">
                    <div className="settings-card-header-row">
                      <div>
                        <h3>Música Online (Aurora Cloud Music)</h3>
                        <p>
                          Streaming musical en alta fidelidad y sincronización de listas personales. (Próximamente disponible para usuarios autenticados).
                        </p>
                      </div>
                      <span style={{ background: "rgba(99, 102, 241, 0.2)", color: "#818cf8", padding: "4px 10px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: "bold" }}>
                        Próximamente
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
