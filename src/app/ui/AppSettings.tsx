import { useLayoutEffect, useState } from "react";
import { LibrarySources } from "./LibrarySources";
import { ModularLibrariesPanel } from "./ModularLibrariesPanel";
import { ToolsSettingsPanel } from "./ToolsSettingsPanel";
import { SynapseSettingsPanel } from "./SynapseSettingsPanel";
import { AuroraSettingsPanel } from "./AuroraSettingsPanel";
import type { useMusicLibrary } from "../../features/music_library/useMusicLibrary";
import type { useVisualLibrary } from "../../features/visual_library/useVisualLibrary";
import type { ThemeMode, AccentColorId, BackgroundVariantId } from "../useTheme";
import { ACCENT_COLORS, getBackgroundVariants } from "../useTheme";
import {
  useSystemSettings,
  type QuickLookShortcutMode,
  type SidebarDensity,
} from "../useSystemSettings";
import { ProgressBarSettingsPanel } from "./ProgressBarSettingsPanel";
import { ShortcutsSettingsPanel } from "./ShortcutsSettingsPanel";
import { Icon } from "../../shared/ui/Icon";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  getFlyoutSettings,
  saveFlyoutSettings,
  type FlyoutSettings,
  type FlyoutZone,
} from "../../features/playback/services/flyoutSettings";
import "./app-settings.css";

const FLYOUT_ZONES: Array<{ id: FlyoutZone; label: string; desc: string; icon: string; cornerClass: string }> = [
  { id: "top-left", label: "Arriba Izq", desc: "OSD", icon: "↖️", cornerClass: "pos-top-left" },
  { id: "top-center", label: "Arriba Centro", desc: "Island", icon: "⬆️", cornerClass: "pos-top-center" },
  { id: "top-right", label: "Arriba Der", desc: "Notif", icon: "↗️", cornerClass: "pos-top-right" },
  { id: "bottom-left", label: "Abajo Izq", desc: "Fluent", icon: "↙️", cornerClass: "pos-bottom-left" },
  { id: "bottom-center", label: "Abajo Centro", desc: "Win 11", icon: "⬇️", cornerClass: "pos-bottom-center" },
  { id: "bottom-right", label: "Abajo Der", desc: "Reloj", icon: "↘️", cornerClass: "pos-bottom-right" },
];

interface AppSettingsProps {
  music: ReturnType<typeof useMusicLibrary>;
  images: ReturnType<typeof useVisualLibrary>;
  videos: ReturnType<typeof useVisualLibrary>;
  onPlay: (path: string) => void;
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  onThemeChange: (mode: ThemeMode) => void;
  accentColor?: AccentColorId;
  onAccentColorChange?: (accent: AccentColorId) => void;
  backgroundVariant?: BackgroundVariantId;
  lightBackgroundVariant?: BackgroundVariantId;
  darkBackgroundVariant?: BackgroundVariantId;
  onBackgroundVariantChange?: (variant: BackgroundVariantId) => void;
  dynamicMusicTheme?: boolean;
  onDynamicMusicThemeChange?: (enabled: boolean) => void;
  isMusicPaletteActive?: boolean;
}

type SettingsTab = "general" | "libraries" | "folders" | "tools" | "progress" | "synapse" | "shortcuts" | "aurora";

const THEMES: { mode: ThemeMode; label: string; desc: string; previewClass: string }[] = [
  { mode: "light", label: "Claro", desc: "Luminoso", previewClass: "light-preview" },
  { mode: "dark", label: "Oscuro", desc: "Oscuro", previewClass: "dark-preview" },
  { mode: "system", label: "Automático", desc: "Sistema", previewClass: "system-preview" },
];

const SIDEBAR_DENSITY_OPTIONS: {
  id: SidebarDensity;
  label: string;
  badge: string;
}[] = [
  { id: "compact", label: "Compacta", badge: "34px" },
  { id: "standard", label: "Estándar", badge: "38px" },
  { id: "intermediate", label: "Intermedia", badge: "42px" },
  { id: "comfortable", label: "Cómoda", badge: "46px" },
];

const SHORTCUTS: { id: QuickLookShortcutMode; label: string; keyBadge: string }[] = [
  { id: "space", label: "Espacio", keyBadge: "Espacio" },
  { id: "alt_space", label: "Alt + Espacio", keyBadge: "Alt + Espacio" },
  { id: "shift_space", label: "Shift + Espacio", keyBadge: "Shift + Espacio" },
];

export function AppSettings({
  music,
  images,
  videos,
  onPlay,
  theme,
  resolvedTheme,
  onThemeChange,
  accentColor = "purple",
  onAccentColorChange,
  backgroundVariant = "prisma",
  lightBackgroundVariant = backgroundVariant,
  darkBackgroundVariant = backgroundVariant,
  onBackgroundVariantChange,
  dynamicMusicTheme = true,
  onDynamicMusicThemeChange,
  isMusicPaletteActive = false,
}: AppSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const backgroundOptions = getBackgroundVariants(resolvedTheme);
  const lightPreview = getBackgroundVariants("light").find(option => option.id === lightBackgroundVariant)!.colorHex;
  const darkPreview = getBackgroundVariants("dark").find(option => option.id === darkBackgroundVariant)!.colorHex;

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
    auroraWallpapersEnabled,
    auroraServerUrl,
    setQuickLookShortcut,
    setAutostart,
    setMinimizeToTray,
    setConfirmDeletion,
    setProgressBarStyle,
    setSidebarDensity,
    setAuroraOnlineServicesEnabled,
    setAuroraWallpapersEnabled,
    setAuroraServerUrl,
    systemDropZoneEnabled,
    systemDropZoneFolder,
    setSystemDropZoneEnabled,
    setSystemDropZoneFolder,
  } = useSystemSettings();

  const [flyoutSettings, setFlyoutSettingsState] = useState<FlyoutSettings>(() => getFlyoutSettings());

  const handleUpdateFlyout = (patch: Partial<FlyoutSettings>) => {
    const updated = saveFlyoutSettings(patch);
    setFlyoutSettingsState(updated);
    if (patch.zone) {
      void invoke("flyout_set_position", { zone: patch.zone }).catch(() => {});
    }
  };

  const handleTestFlyout = () => {
    void invoke("flyout_show", { zone: flyoutSettings.zone }).catch(() => {});
  };

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
            className={activeTab === "tools" ? "is-active" : ""}
            onClick={() => setActiveTab("tools")}
          >
            <Icon name="tool" />
            <span>Herramientas</span>
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
            <span>Synapse</span>
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
            PESTAÑA 1: GENERAL Y SISTEMA (Distribuida armónicamente en 3 Columnas)
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "general" && (
          <div className="settings-panel">
            <div className="settings-columns">
              {/* ── Columna 1: Sistema y Segundo Plano, Quick Look, Densidad, Papelera ── */}
              <div className="settings-column">
                {/* Sistema y Segundo Plano (Autorun + Minimizar) */}
                <div className="settings-card">
                  <h3>Sistema y Segundo Plano</h3>
                  <p>Comportamiento de Prisma al iniciar sesión y cerrar la ventana.</p>

                  <div className="system-toggles-list">
                    <div className="system-toggle-item">
                      <div className="system-toggle-info">
                        <strong>Iniciar con Windows (Autorun)</strong>
                        <p>Arrancar en segundo plano para tener Quick Look siempre listo.</p>
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
                        <p>Ocultar en el System Tray al cerrar la ventana (✕) sin detener la app.</p>
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

                {/* Previsualización Rápida (Quick Look) */}
                <div className="settings-card">
                  <div className="settings-card-header-row">
                    <div>
                      <h3>Previsualización Rápida</h3>
                      <p>
                        Vista previa inmediata en el Explorador o Escritorio sin abrir Prisma completo.
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
                      <h4 className="settings-subheading">Atajo para Quick Look</h4>
                      <div className="shortcut-options-grid">
                        {SHORTCUTS.map(({ id, label, keyBadge }) => (
                          <button
                            key={id}
                            className={`shortcut-card${quickLookShortcut === id ? " is-selected" : ""}`}
                            onClick={() => setQuickLookShortcut(id)}
                            aria-pressed={quickLookShortcut === id}
                            title={`Atajo: ${label}`}
                            type="button"
                          >
                            <kbd className="shortcut-kbd">{keyBadge}</kbd>
                            <strong>{label}</strong>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Densidad de la Barra Lateral */}
                <div className="settings-card">
                  <h3>Densidad de la Barra Lateral</h3>
                  <p>Ajusta el grosor y espacio de la navegación según tu pantalla.</p>
                  <div className="density-options-grid">
                    {SIDEBAR_DENSITY_OPTIONS.map(({ id, label, badge }) => (
                      <button
                        key={id}
                        className={`density-card${sidebarDensity === id ? " is-selected" : ""}`}
                        onClick={() => setSidebarDensity(id)}
                        aria-pressed={sidebarDensity === id}
                        type="button"
                        title={`${label} · ${badge}`}
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
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Papelera de reciclaje */}
                <div className="settings-card">
                  <div className="settings-card-header-row">
                    <div>
                      <h3>Papelera de reciclaje</h3>
                      <p style={{ margin: 0 }}>
                        Pedir confirmación antes de mover archivos a la papelera del sistema al pulsar Supr o eliminar.
                      </p>
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

              {/* ── Columna 2: Apariencia ── */}
              <div className="settings-column">
                {/* Apariencia */}
                <div className="settings-card">
                  <h3>Apariencia</h3>
                  <p>Estilo visual, colores de énfasis y adaptación de Prisma.</p>

                  {/* Modo Claro / Oscuro */}
                  <h4 className="settings-subheading" style={{ margin: "4px 0 8px" }}>Modo de Interfaz</h4>
                  <div className="theme-options-grid">
                    {THEMES.map(({ mode, label, desc, previewClass }) => {
                      const previewStyle = {
                        background: mode === "system"
                          ? `linear-gradient(135deg, ${darkPreview} 50%, ${lightPreview} 50%)`
                          : mode === "dark" ? darkPreview : lightPreview,
                      };

                      return (
                        <button
                          key={mode}
                          className={`theme-card${theme === mode ? " is-selected" : ""}`}
                          onClick={() => onThemeChange(mode)}
                          aria-pressed={theme === mode}
                          title={`${label} · ${desc}`}
                          type="button"
                        >
                          <div className={`theme-preview ${previewClass}`} style={previewStyle} />
                          <strong>{label}</strong>
                        </button>
                      );
                    })}
                  </div>

                  <div className="settings-section-divider" style={{ margin: "14px 0 10px" }} />

                  {/* Colores de Énfasis */}
                  <h4 className="settings-subheading" style={{ margin: "4px 0 8px" }}>Color de Énfasis Principal</h4>
                  <div className="accent-options-grid">
                    {ACCENT_COLORS.map(({ id, label, colorHex }) => (
                      <button
                        key={id}
                        className={`accent-card${accentColor === id ? " is-selected" : ""}`}
                        onClick={() => onAccentColorChange?.(id)}
                        aria-pressed={accentColor === id}
                        type="button"
                      >
                        <span className="accent-swatch" style={{ backgroundColor: colorHex }}>
                          {accentColor === id ? <Icon name="check" /> : null}
                        </span>
                        <strong>{label}</strong>
                      </button>
                    ))}
                  </div>

                  {/* Tema reactivo a la música */}
                  <div className="settings-option-row" style={{ marginTop: "10px" }}>
                    <div className="settings-option-info">
                      <div className="settings-option-title-row">
                        <strong>Tema reactivo a la música</strong>
                        {isMusicPaletteActive ? (
                          <span className="settings-option-live-badge">
                            <span className="pulse-dot" />
                            En vivo
                          </span>
                        ) : null}
                      </div>
                      <p>
                        Aplica los tonos dominantes de la carátula activa globalmente.
                      </p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={dynamicMusicTheme}
                        onChange={(e) => onDynamicMusicThemeChange?.(e.target.checked)}
                        aria-label="Tema reactivo a la música en reproducción"
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>

                  <div className="settings-section-divider" style={{ margin: "14px 0 10px" }} />

                  {/* Variantes de Fondo */}
                  <h4 className="settings-subheading" style={{ margin: "4px 0 8px" }}>Variante de Fondo · {resolvedTheme === "dark" ? "Oscuro" : "Claro"}</h4>
                  <div className="bg-variant-options-grid">
                    {backgroundOptions.map(({ id, label, desc, colorHex }) => (
                      <button
                        key={id}
                        className={`bg-variant-card${backgroundVariant === id ? " is-selected" : ""}`}
                        style={{ backgroundColor: colorHex, color: resolvedTheme === "dark" ? "#fafafa" : "#202020" }}
                        onClick={() => onBackgroundVariantChange?.(id)}
                        aria-pressed={backgroundVariant === id}
                        type="button"
                        title={`${label} · ${desc}`}
                      >
                        <div className="bg-variant-info">
                          <strong>{label}</strong>
                        </div>
                      </button>
                    ))}
                  </div>

                </div>

              </div>

              {/* ── Columna 3: Flyout de Escritorio ── */}
              <div className="settings-column">
                {/* Flyout de Escritorio */}
                <div className="settings-card">
                  <div className="settings-card-header-row">
                    <div>
                      <h3>Flyout de Escritorio</h3>
                      <p>Widget flotante para control multimedia y volumen global.</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={flyoutSettings.enabled}
                        onChange={(e) => handleUpdateFlyout({ enabled: e.target.checked })}
                        aria-label="Activar Flyout de Escritorio"
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>

                  {flyoutSettings.enabled && (
                    <div className="flyout-config-section" style={{ marginTop: 12 }}>
                      <h4 className="settings-subheading">Posición en Pantalla (6 Cuadrantes)</h4>
                      <div className="flyout-quadrant-grid">
                        {FLYOUT_ZONES.map(({ id, label, desc, icon, cornerClass }) => {
                          const isBottom = id.startsWith("bottom");
                          return (
                            <button
                              key={id}
                              className={`flyout-zone-card ${cornerClass}${flyoutSettings.zone === id ? " is-selected" : ""}`}
                              onClick={() => handleUpdateFlyout({ zone: id })}
                              type="button"
                              title={`${label} (${desc})`}
                            >
                              {!isBottom ? (
                                <>
                                  <div className="flyout-zone-header">
                                    <span className="flyout-zone-icon">{icon}</span>
                                  </div>
                                  <div className="flyout-zone-text">
                                    <strong className="flyout-zone-label">{label}</strong>
                                    <small className="flyout-zone-desc">{desc}</small>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flyout-zone-text">
                                    <strong className="flyout-zone-label">{label}</strong>
                                    <small className="flyout-zone-desc">{desc}</small>
                                  </div>
                                  <div className="flyout-zone-header">
                                    <span className="flyout-zone-icon">{icon}</span>
                                  </div>
                                </>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="system-toggles-list" style={{ marginTop: 12 }}>
                        <div className="system-toggle-item">
                          <div className="system-toggle-info">
                            <strong>Indicador de reproducción</strong>
                            <p>Barras animadas durante la reproducción.</p>
                          </div>
                          <label className="toggle-switch">
                            <input
                              type="checkbox"
                              checked={flyoutSettings.showSpectrum}
                              onChange={(e) => handleUpdateFlyout({ showSpectrum: e.target.checked })}
                              aria-label="Indicador de reproducción"
                            />
                            <span className="toggle-slider" />
                          </label>
                        </div>

                        <div className="system-toggle-item">
                          <div className="system-toggle-info">
                            <strong>Duración en Pantalla</strong>
                            <p>Tiempo antes de ocultarse.</p>
                          </div>
                          <div className="flyout-duration-chips">
                            {[1000, 1500, 2000, 3000, 5000].map((ms) => (
                              <button
                                key={ms}
                                type="button"
                                className={`snapshot-format-chip ${flyoutSettings.durationMs === ms ? "is-selected" : ""}`}
                                onClick={() => handleUpdateFlyout({ durationMs: ms })}
                              >
                                {ms / 1000}s
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                        <button
                          type="button"
                          className="snapshot-action-btn primary"
                          onClick={handleTestFlyout}
                        >
                          <Icon name="play" />
                          <span>Probar Flyout en pantalla</span>
                        </button>
                      </div>
                    </div>
                  )}
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
            PESTAÑA 4: HERRAMIENTAS MODULARES
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "tools" && (
          <div className="settings-panel">
            <ToolsSettingsPanel />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            PESTAÑA 5: BARRA DE PROGRESO
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "progress" && (
          <ProgressBarSettingsPanel
            progressBarStyle={progressBarStyle}
            onProgressBarStyleChange={setProgressBarStyle}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            PESTAÑA 6: SYNAPSE (LAN + BARRA SUPERIOR)
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "synapse" && (
          <div className="settings-panel">
            <SynapseSettingsPanel
              topbarColumn={
                <>
                  <div className="settings-card">
                    <div className="settings-card-header-row">
                      <div>
                        <h3>Barra superior Synapse</h3>
                        <p>Arrastra cualquier archivo y queda listo para compartir al instante.</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={systemDropZoneEnabled}
                          onChange={(e) => setSystemDropZoneEnabled(e.target.checked)}
                          aria-label="Mostrar la barra superior Synapse"
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>

                    <div className="system-toggle-item">
                      <div className="system-toggle-info">
                        <strong>Visible en la pantalla</strong>
                        <p>
                          {systemDropZoneEnabled
                            ? "Tus archivos, siempre a un arrastre de distancia."
                            : "Los archivos arrastrados se guardan en las bibliotecas según la vista activa."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="settings-card">
                    <div className="settings-card-header-row">
                      <div>
                        <h3>Carpeta de destino</h3>
                        <p>Donde se copian los archivos que guardas desde la barra.</p>
                      </div>
                    </div>

                    <div className="snapshot-folder-path-display">
                      <div className="snapshot-folder-header-row">
                        <span className="snapshot-folder-label">Carpeta de las copias</span>
                        <span className={`snapshot-folder-badge ${systemDropZoneFolder ? "is-custom" : "is-default"}`}>
                          {systemDropZoneFolder ? "Personalizada" : "Predeterminada"}
                        </span>
                      </div>
                      <div
                        className="snapshot-folder-path-text"
                        title={systemDropZoneFolder || "Descargas\\Prisma"}
                      >
                        <Icon name="folder" />
                        <span>{systemDropZoneFolder || "Descargas\\Prisma"}</span>
                      </div>
                    </div>

                    <div className="snapshot-folder-actions-row synapse-folder-actions">
                      <button
                        type="button"
                        className="snapshot-action-btn primary"
                        onClick={async () => {
                          try {
                            const selected = await open({
                              directory: true,
                              multiple: false,
                              title: "Seleccionar carpeta para los archivos de la barra superior Synapse",
                              defaultPath: systemDropZoneFolder || undefined,
                            });
                            if (typeof selected === "string" && selected.trim()) {
                              setSystemDropZoneFolder(selected.trim());
                            }
                          } catch (err) {
                            console.error("Error al seleccionar carpeta de la barra superior:", err);
                          }
                        }}
                      >
                        <Icon name="folder-open" />
                        <span>Cambiar...</span>
                      </button>
                      <button
                        type="button"
                        className="snapshot-action-btn secondary"
                        onClick={() => {
                          const target = systemDropZoneFolder || "Descargas\\Prisma";
                          void invoke("show_in_file_manager", { path: target }).catch(() => {});
                        }}
                        title="Abrir carpeta en el Explorador de Windows"
                      >
                        <Icon name="external-link" />
                        <span>Abrir</span>
                      </button>
                      {systemDropZoneFolder ? (
                        <button
                          type="button"
                          className="snapshot-action-btn tertiary"
                          onClick={() => setSystemDropZoneFolder("")}
                          title="Restablecer a la carpeta predeterminada"
                        >
                          <Icon name="undo" />
                          <span>Restablecer</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </>
              }
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            PESTAÑA 7: SERVICIOS ONLINE (ECOSISTEMA AURORA)
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "aurora" && (
          <AuroraSettingsPanel
            auroraOnlineServicesEnabled={auroraOnlineServicesEnabled}
            setAuroraOnlineServicesEnabled={setAuroraOnlineServicesEnabled}
            auroraWallpapersEnabled={auroraWallpapersEnabled}
            setAuroraWallpapersEnabled={setAuroraWallpapersEnabled}
            auroraServerUrl={auroraServerUrl}
            setAuroraServerUrl={setAuroraServerUrl}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════════════
            PESTAÑA 8: ATAJOS DE TECLADO
        ══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "shortcuts" && (
          <div className="settings-panel">
            <ShortcutsSettingsPanel quickLookShortcut={quickLookShortcut} />
          </div>
        )}
      </div>
    </section>
  );
}
