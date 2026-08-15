import { useState } from "react";
import { LibrarySources } from "./LibrarySources";
import type { useMusicLibrary } from "../../features/music_library/useMusicLibrary";
import type { useVisualLibrary } from "../../features/visual_library/useVisualLibrary";
import type { ThemeMode } from "../useTheme";
import { useSystemSettings, type QuickLookShortcutMode } from "../useSystemSettings";
import { Icon } from "../../shared/ui/Icon";
import { useScrollRestoration } from "../../shared/useScrollRestoration";
import "./app-settings.css";

interface AppSettingsProps {
  music: ReturnType<typeof useMusicLibrary>;
  images: ReturnType<typeof useVisualLibrary>;
  videos: ReturnType<typeof useVisualLibrary>;
  onPlay: (path: string) => void;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

type SettingsTab = "general" | "shortcuts";

const THEMES: { mode: ThemeMode; label: string; desc: string; previewClass: string }[] = [
  { mode: "light", label: "Claro", desc: "Interfaz luminosa", previewClass: "light-preview" },
  { mode: "dark", label: "Oscuro", desc: "Interfaz oscura", previewClass: "dark-preview" },
  { mode: "system", label: "Automático", desc: "Sigue al sistema", previewClass: "system-preview" },
];

const SHORTCUTS: { id: QuickLookShortcutMode; label: string; keyBadge: string; desc: string }[] = [
  { id: "space", label: "Espacio", keyBadge: "Espacio", desc: "Estilo nativo / macOS" },
  { id: "ctrl_space", label: "Ctrl + Espacio", keyBadge: "Ctrl + Espacio", desc: "Combinación segura" },
  { id: "alt_space", label: "Alt + Espacio", keyBadge: "Alt + Espacio", desc: "Atajo secundario alternativo" },
  { id: "shift_space", label: "Shift + Espacio", keyBadge: "Shift + Espacio", desc: "Atajo rápido con Shift" },
];

export function AppSettings({ music, images, videos, onPlay, theme, onThemeChange }: AppSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  useScrollRestoration(`view:settings:${activeTab}`);
  const {
    quickLookShortcut,
    autostart,
    minimizeToTray,
    confirmDeletion,
    setQuickLookShortcut,
    setAutostart,
    setMinimizeToTray,
    setConfirmDeletion,
  } = useSystemSettings();

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
            className={activeTab === "shortcuts" ? "is-active" : ""}
            onClick={() => setActiveTab("shortcuts")}
          >
            <Icon name="keyboard" />
            <span>Atajos de Teclado</span>
          </button>
        </div>
      </div>

      <div className="settings-tab-content">
        {activeTab === "general" ? (
          <div className="settings-panel">
            <div className="settings-cards-grid">
            {/* ── Quick Look (Previsualización Rápida) ── */}
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

            {/* ── Eliminación de archivos ── */}
            <div className="settings-card">
              <h3>Eliminar archivos</h3>
              <p>
                Controla si Prisma pide confirmación antes de enviar una canción, imagen o vídeo a la papelera de reciclaje.
              </p>

              <div className="system-toggles-list">
                <div className="system-toggle-item">
                  <div className="system-toggle-info">
                    <strong>Pedir confirmación al eliminar</strong>
                    <p>Con la confirmación activada, la tecla Supr o la opción Eliminar piden confirmación antes de borrar. Desactívala para eliminar directamente a la papelera sin preguntar.</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={confirmDeletion}
                      onChange={(e) => setConfirmDeletion(e.target.checked)}
                      aria-label="Pedir confirmación al eliminar"
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </div>

            {/* ── Theme picker ── */}
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

            {/* ── Library sources ── */}
            </div>
            <LibrarySources images={images} music={music} onPlay={onPlay} videos={videos} />
          </div>
        ) : (
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
                            : quickLookShortcut === "ctrl_space"
                            ? "Ctrl + Espacio"
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
      </div>
    </section>
  );
}
