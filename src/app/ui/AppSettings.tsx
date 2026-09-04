import { useEffect, useLayoutEffect, useState } from "react";
import { LibrarySources } from "./LibrarySources";
import { ModularLibrariesPanel } from "./ModularLibrariesPanel";
import { SynapseSettingsPanel } from "./SynapseSettingsPanel";
import type { useMusicLibrary } from "../../features/music_library/useMusicLibrary";
import type { useVisualLibrary } from "../../features/visual_library/useVisualLibrary";
import type { ThemeMode, AccentColorId } from "../useTheme";
import { ACCENT_COLORS } from "../useTheme";
import {
  useSystemSettings,
  type QuickLookShortcutMode,
  type ProgressBarStyle,
  type SidebarDensity,
} from "../useSystemSettings";
import { ProgressBarSettingsPanel } from "./ProgressBarSettingsPanel";
import { Icon } from "../../shared/ui/Icon";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { getDefaultPicturesDir } from "../../shared/mediaOperations";
import "./app-settings.css";

interface AppSettingsProps {
  music: ReturnType<typeof useMusicLibrary>;
  images: ReturnType<typeof useVisualLibrary>;
  videos: ReturnType<typeof useVisualLibrary>;
  onPlay: (path: string) => void;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  accentColor?: AccentColorId;
  onAccentColorChange?: (accent: AccentColorId) => void;
  dynamicMusicTheme?: boolean;
  onDynamicMusicThemeChange?: (enabled: boolean) => void;
  isMusicPaletteActive?: boolean;
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

const SHORTCUTS: { id: QuickLookShortcutMode; label: string; keyBadge: string; desc: string }[] = [
  { id: "space", label: "Espacio", keyBadge: "Espacio", desc: "Estilo nativo / macOS (Predeterminado)" },
  { id: "alt_space", label: "Alt + Espacio", keyBadge: "Alt + Espacio", desc: "Atajo secundario alternativo" },
  { id: "shift_space", label: "Shift + Espacio", keyBadge: "Shift + Espacio", desc: "Atajo rápido con Shift" },
];

export function AppSettings({
  music,
  images,
  videos,
  onPlay,
  theme,
  onThemeChange,
  accentColor = "purple",
  onAccentColorChange,
  dynamicMusicTheme = true,
  onDynamicMusicThemeChange,
  isMusicPaletteActive = false,
}: AppSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");

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
    auroraWallpapersEnabled,
    auroraServerUrl,
    videoSnapshotFolder,
    videoSnapshotFormat,
    setQuickLookShortcut,
    setAutostart,
    setMinimizeToTray,
    setConfirmDeletion,
    setProgressBarStyle,
    setSidebarDensity,
    setAuroraOnlineServicesEnabled,
    setAuroraWallpapersEnabled,
    setAuroraServerUrl,
    setVideoSnapshotFolder,
    setVideoSnapshotFormat,
  } = useSystemSettings();

  const [defaultPicturesDir, setDefaultPicturesDir] = useState<string>("");

  useEffect(() => {
    void getDefaultPicturesDir()
      .then((dir) => {
        if (dir) setDefaultPicturesDir(dir);
      })
      .catch(() => {});
  }, []);

  const handleSelectSnapshotFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Seleccionar carpeta para capturas de vídeo y assets",
        defaultPath: videoSnapshotFolder || defaultPicturesDir || undefined,
      });
      if (typeof selected === "string" && selected.trim()) {
        setVideoSnapshotFolder(selected.trim());
      }
    } catch (err) {
      console.error("Error al seleccionar carpeta de capturas:", err);
    }
  };

  const handleOpenSnapshotFolder = () => {
    const target = videoSnapshotFolder || defaultPicturesDir;
    if (target) {
      void invoke("show_in_file_manager", { path: target }).catch(() => {});
    }
  };

  const handleResetSnapshotFolder = () => {
    setVideoSnapshotFolder("");
  };



  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testFeedback, setTestFeedback] = useState<string>("");

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestFeedback("Comprobando conexión con el servidor...");
    const cleanUrl = auroraServerUrl.trim().replace(/\/$/, "");
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      await fetch(`${cleanUrl}/api/v1/wallpapers?limit=1`, {
        signal: controller.signal,
      }).catch(async () => {
        return await fetch(cleanUrl, { signal: controller.signal, mode: "no-cors" });
      });

      clearTimeout(timeoutId);
      const elapsed = Math.round(performance.now() - startTime);
      setTestStatus("success");
      setTestFeedback(`¡Conexión establecida exitosamente! (${elapsed}ms) · Endpoint activo`);
    } catch {
      setTestStatus("error");
      setTestFeedback(`No se pudo conectar a "${cleanUrl}". Verifica que el servidor local (ej. Astro) esté en ejecución.`);
    }
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
            <div className="settings-columns">
              {/* ── Columna 1: Quick Look, Papelera de reciclaje, Densidad de Barra Lateral ── */}
              <div className="settings-column">
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

                {/* ── Capturas de Vídeo y Assets ── */}
                <div className="settings-card">
                  <div className="settings-card-header-row">
                    <div>
                      <h3>Capturas de Vídeo y Assets</h3>
                      <p>
                        Configura el directorio donde se guardan los fotogramas capturados (snapshots) del visor de vídeos al presionar <kbd className="shortcut-kbd-pill">Shift + S</kbd> o el botón de cámara.
                      </p>
                    </div>
                  </div>

                  <div className="snapshot-folder-config-box">
                    <div className="snapshot-folder-path-display">
                      <div className="snapshot-folder-header-row">
                        <span className="snapshot-folder-label">Carpeta de destino</span>
                        <span className={`snapshot-folder-badge ${videoSnapshotFolder ? "is-custom" : "is-default"}`}>
                          {videoSnapshotFolder ? "Personalizada" : "Predeterminada (Imágenes)"}
                        </span>
                      </div>
                      <div className="snapshot-folder-path-text" title={videoSnapshotFolder || defaultPicturesDir}>
                        <Icon name="folder" />
                        <span>{videoSnapshotFolder || defaultPicturesDir || "Carpeta Imágenes del sistema"}</span>
                      </div>
                    </div>

                    <div className="snapshot-folder-actions-row">
                      <button
                        type="button"
                        className="snapshot-action-btn primary"
                        onClick={handleSelectSnapshotFolder}
                      >
                        <Icon name="folder-open" />
                        <span>Cambiar carpeta...</span>
                      </button>
                      <button
                        type="button"
                        className="snapshot-action-btn secondary"
                        onClick={handleOpenSnapshotFolder}
                        title="Abrir carpeta en el Explorador de Windows"
                      >
                        <Icon name="external-link" />
                        <span>Abrir carpeta</span>
                      </button>
                      {videoSnapshotFolder ? (
                        <button
                          type="button"
                          className="snapshot-action-btn tertiary"
                          onClick={handleResetSnapshotFolder}
                          title="Restablecer a la carpeta de Imágenes predeterminada"
                        >
                          <Icon name="undo" />
                          <span>Restablecer</span>
                        </button>
                      ) : null}
                    </div>

                    <div className="settings-section-divider" />

                    <h4 className="settings-subheading" style={{ marginTop: 12 }}>Formato de Imagen</h4>
                    <div className="snapshot-format-options">
                      <button
                        type="button"
                        className={`snapshot-format-chip ${videoSnapshotFormat === "png" ? "is-selected" : ""}`}
                        onClick={() => setVideoSnapshotFormat("png")}
                      >
                        <Icon name={videoSnapshotFormat === "png" ? "check" : "camera"} />
                        <div className="snapshot-format-info">
                          <strong>PNG</strong>
                          <small>Máxima calidad sin pérdidas (Estilo VLC)</small>
                        </div>
                      </button>
                      <button
                        type="button"
                        className={`snapshot-format-chip ${videoSnapshotFormat === "webp" ? "is-selected" : ""}`}
                        onClick={() => setVideoSnapshotFormat("webp")}
                      >
                        <Icon name={videoSnapshotFormat === "webp" ? "check" : "sparkles"} />
                        <div className="snapshot-format-info">
                          <strong>WebP</strong>
                          <small>Ultra compacto y moderno (Alta fidelidad)</small>
                        </div>
                      </button>
                      <button
                        type="button"
                        className={`snapshot-format-chip ${videoSnapshotFormat === "jpeg" ? "is-selected" : ""}`}
                        onClick={() => setVideoSnapshotFormat("jpeg")}
                      >
                        <Icon name={videoSnapshotFormat === "jpeg" ? "check" : "image"} />
                        <div className="snapshot-format-info">
                          <strong>JPEG</strong>
                          <small>Archivo ligero y universal</small>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Columna 2: Sistema y Segundo Plano, Apariencia ── */}
              <div className="settings-column">
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

                {/* ── Apariencia / Tema & Acentos ── */}
                <div className="settings-card">
                  <h3>Apariencia</h3>
                  <p>Personaliza el estilo visual, los colores de énfasis y la adaptación dinámica de Prisma.</p>

                  {/* Modo Claro / Oscuro */}
                  <h4 className="settings-subheading">Modo de Interfaz</h4>
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

                  <div className="settings-section-divider" />

                  {/* Colores de Énfasis */}
                  <h4 className="settings-subheading">Color de Énfasis Principal</h4>
                  <div className="accent-options-grid">
                    {ACCENT_COLORS.map(({ id, label, colorHex, badge }) => (
                      <button
                        key={id}
                        className={`accent-card${accentColor === id ? " is-selected" : ""}`}
                        onClick={() => onAccentColorChange?.(id)}
                        aria-pressed={accentColor === id}
                        type="button"
                      >
                        {badge ? <span className="accent-badge">{badge}</span> : null}
                        <span className="accent-swatch" style={{ backgroundColor: colorHex }}>
                          {accentColor === id ? <Icon name="check" /> : null}
                        </span>
                        <strong>{label}</strong>
                      </button>
                    ))}
                  </div>

                  <div className="settings-section-divider" />

                  {/* Tema reactivo a la música en reproducción */}
                  <div className="settings-option-row">
                    <div className="settings-option-info">
                      <div className="settings-option-title-row">
                        <strong>Tema reactivo a la música en reproducción</strong>
                        {isMusicPaletteActive ? (
                          <span className="settings-option-live-badge">
                            <span className="pulse-dot" />
                            En vivo · Paleta activa
                          </span>
                        ) : null}
                      </div>
                      <p>
                        Extrae dinámicamente los tonos dominantes de la carátula activa y los aplica globalmente a toda la interfaz mientras escuchas música.
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
          <ProgressBarSettingsPanel
            progressBarStyle={progressBarStyle}
            onProgressBarStyleChange={setProgressBarStyle}
          />
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
              <p>Consulta los atajos rápidos de teclado para controlar la reproducción de vídeos, visor de imágenes y música con máxima agilidad.</p>

              <div className="shortcuts-reference-grid">
                {/* Categoría: Reproductor de Vídeo */}
                <div className="shortcuts-category-card">
                  <h4>
                    <Icon name="video" />
                    <span>Vídeo y Reproducción</span>
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
                      <span className="shortcut-row-label">Vídeo anterior / siguiente</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">P</kbd>
                        <kbd className="shortcut-kbd-pill">N</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Cola de proyección (Abrir / Cerrar)</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Q</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Tomar captura de fotograma (Snapshot)</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Shift + S</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Avanzar 1 fotograma (Frame forward)</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">F</kbd>
                        <kbd className="shortcut-kbd-pill">E</kbd>
                        <kbd className="shortcut-kbd-pill">.</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Retroceder 1 fotograma (Frame backward)</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Shift + F</kbd>
                        <kbd className="shortcut-kbd-pill">Shift + E</kbd>
                        <kbd className="shortcut-kbd-pill">,</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Pantalla completa</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">F11</kbd>
                        <kbd className="shortcut-kbd-pill">Alt + Enter</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Barajar cola (One-shot)</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">S</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Añadir / Quitar de favoritos</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">D</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Mover vídeo a la papelera</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Supr</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Categoría: Reproductor de Música */}
                <div className="shortcuts-category-card">
                  <h4>
                    <Icon name="music" />
                    <span>Música y Pistas</span>
                  </h4>
                  <div className="shortcuts-list">
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Reproducir / Pausar</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Espacio</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Retroceder / Avanzar 5 seg.</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">←</kbd>
                        <kbd className="shortcut-kbd-pill">→</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Pista anterior / siguiente</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">P</kbd>
                        <kbd className="shortcut-kbd-pill">N</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Alternar panel de Letras</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">L</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Cola de reproducción</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Q</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Silenciar / Restaurar</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">M</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Categoría: Audio y Pistas */}
                <div className="shortcuts-category-card">
                  <h4>
                    <Icon name="volume" />
                    <span>Audio y Canales</span>
                  </h4>
                  <div className="shortcuts-list">
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Alternar pista (Multi-audio)</span>
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

                {/* Categoría: Visor de Imágenes */}
                <div className="shortcuts-category-card">
                  <h4>
                    <Icon name="image" />
                    <span>Visor de Imágenes</span>
                  </h4>
                  <div className="shortcuts-list">
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Imagen anterior / siguiente</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">←</kbd>
                        <kbd className="shortcut-kbd-pill">→</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Acercar / Alejar zoom</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Ctrl +</kbd>
                        <kbd className="shortcut-kbd-pill">Ctrl -</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Restablecer escala normal</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">R</kbd>
                        <kbd className="shortcut-kbd-pill">Ctrl + 0</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Presentación automática</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Espacio</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Información y Metadatos EXIF</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">I</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Editor de Imagen</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">E</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Comparador de Fotos</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">C</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Renombrar archivo</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">F2</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Mover a la papelera</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Supr</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Cerrar visor</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Esc</kbd>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Categoría: Edición y Comparador */}
                <div className="shortcuts-category-card">
                  <h4>
                    <Icon name="sliders" />
                    <span>Edición y Comparador</span>
                  </h4>
                  <div className="shortcuts-list">
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Deshacer trazo (Doodle)</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Ctrl + Z</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Guardar cambios editados</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Ctrl + S</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Modos comparador (1 a 4)</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">1</kbd>
                        <kbd className="shortcut-kbd-pill">2</kbd>
                        <kbd className="shortcut-kbd-pill">3</kbd>
                        <kbd className="shortcut-kbd-pill">4</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Intercambiar foto primaria</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">S</kbd>
                      </div>
                    </div>
                    <div className="shortcut-row">
                      <span className="shortcut-row-label">Salir de herramienta</span>
                      <div className="shortcut-row-keys">
                        <kbd className="shortcut-kbd-pill">Esc</kbd>
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
          <div className="settings-panel aurora-settings-panel">
            {/* ── Banner Principal con Switch Maestro ── */}
            <div className="settings-card aurora-hero-card">
              <div className="settings-card-header-row">
                <div className="aurora-hero-text">
                  <div className="aurora-hero-title-row">
                    <div className="aurora-hero-icon">
                      <Icon name="sparkles" />
                    </div>
                    <div>
                      <h3>Servicios Online del Ecosistema Aurora</h3>
                      <p>
                        Habilita la integración en la nube con Aurora para explorar el catálogo de Wallpapers en alta fidelidad, sincronización de favoritos y biblioteca musical.
                      </p>
                    </div>
                  </div>
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
              <div className="aurora-columns-layout">
                {/* ── Columna Izquierda: Servidor de Aurora Cloud ── */}
                <div className="aurora-col">
                  <div className="settings-card aurora-server-card">
                    <div className="aurora-card-header">
                      <Icon name="server" />
                      <div>
                        <h3>Servidor de Aurora Cloud</h3>
                        <p>Selecciona el entorno de Aurora para la consulta de catálogos y sincronización:</p>
                      </div>
                    </div>

                    <div className="aurora-server-options">
                      {/* Opción 1: Servidor Oficial */}
                      <div
                        className={`aurora-env-card ${auroraServerUrl === "https://www.biglexj.com" ? "is-selected" : ""}`}
                        onClick={() => {
                          setAuroraServerUrl("https://www.biglexj.com");
                          setTestStatus("idle");
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="aurora-env-radio">
                          <span className={`aurora-radio-dot ${auroraServerUrl === "https://www.biglexj.com" ? "is-active" : ""}`} />
                        </div>
                        <div className="aurora-env-info">
                          <div className="aurora-env-title">
                            <span className="aurora-status-pill is-prod">🟢 Oficial</span>
                            <strong>Servidor Oficial de Producción</strong>
                          </div>
                          <span className="aurora-env-url">https://www.biglexj.com</span>
                        </div>
                      </div>

                      {/* Opción 2: Servidor Personalizado / LAN / Astro */}
                      <div
                        className={`aurora-env-card is-custom ${auroraServerUrl !== "https://www.biglexj.com" ? "is-selected" : ""}`}
                        onClick={() => {
                          if (auroraServerUrl === "https://www.biglexj.com") {
                            setAuroraServerUrl("http://localhost:4321");
                          }
                          setTestStatus("idle");
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="aurora-env-radio">
                          <span className={`aurora-radio-dot ${auroraServerUrl !== "https://www.biglexj.com" ? "is-active" : ""}`} />
                        </div>
                        <div className="aurora-env-info" style={{ flex: 1 }}>
                          <div className="aurora-env-title">
                            <span className="aurora-status-pill is-dev">🔵 Personalizado</span>
                            <strong>Servidor Local / LAN (Astro)</strong>
                          </div>
                          <span className="aurora-env-url">Para desarrollo y pruebas locales con Astro o Node</span>

                          {auroraServerUrl !== "https://www.biglexj.com" && (
                            <div className="aurora-input-group" onClick={(e) => e.stopPropagation()}>
                              <div className="aurora-input-box">
                                <span className="aurora-input-icon">
                                  <Icon name="globe" />
                                </span>
                                <input
                                  type="text"
                                  className="aurora-server-input"
                                  value={auroraServerUrl}
                                  onChange={(e) => {
                                    setAuroraServerUrl(e.target.value);
                                    setTestStatus("idle");
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleTestConnection();
                                  }}
                                  placeholder="http://localhost:4321"
                                  spellCheck={false}
                                />
                                <button
                                  type="button"
                                  className={`aurora-test-btn ${testStatus === "testing" ? "is-loading" : ""}`}
                                  onClick={handleTestConnection}
                                  title="Probar conexión con este servidor"
                                >
                                  <Icon name={testStatus === "success" ? "check" : "refresh"} />
                                  <span>{testStatus === "testing" ? "Probando..." : "Probar"}</span>
                                </button>
                              </div>

                              {/* Preajustes Rápidos */}
                              <div className="aurora-chips-row">
                                <span className="aurora-chips-label">Atajos:</span>
                                <button
                                  type="button"
                                  className="aurora-chip"
                                  onClick={() => {
                                    setAuroraServerUrl("http://localhost:4321");
                                    setTestStatus("idle");
                                  }}
                                >
                                  localhost:4321 (Astro)
                                </button>
                                <button
                                  type="button"
                                  className="aurora-chip"
                                  onClick={() => {
                                    setAuroraServerUrl("http://localhost:3000");
                                    setTestStatus("idle");
                                  }}
                                >
                                  localhost:3000
                                </button>
                                <button
                                  type="button"
                                  className="aurora-chip"
                                  onClick={() => {
                                    setAuroraServerUrl("http://127.0.0.1:4321");
                                    setTestStatus("idle");
                                  }}
                                >
                                  127.0.0.1:4321
                                </button>
                              </div>

                              {/* Estado y Feedback del Test */}
                              {testStatus !== "idle" && (
                                <div className={`aurora-test-feedback is-${testStatus}`}>
                                  <Icon name={testStatus === "success" ? "check" : testStatus === "error" ? "close" : "refresh"} />
                                  <span>{testFeedback}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Columna Derecha: Catálogos y Servicios Nube ── */}
                <div className="aurora-col">
                  {/* Catálogo Wallpapers Aurora */}
                  <div className="settings-card">
                    <div className="settings-card-header-row">
                      <div>
                        <h3>Catálogo de Wallpapers Aurora</h3>
                        <p>
                          Descarga y aplica wallpapers en resolución 4K directamente desde el repositorio del blog Aurora integrado en Prisma.
                        </p>
                      </div>
                      <label className="toggle-switch" title={auroraWallpapersEnabled ? "Desactivar Wallpapers" : "Activar Wallpapers"}>
                        <input
                          type="checkbox"
                          checked={auroraWallpapersEnabled}
                          onChange={(e) => setAuroraWallpapersEnabled(e.target.checked)}
                          aria-label="Activar o desactivar Catálogo de Wallpapers Aurora"
                        />
                        <span className="toggle-slider" />
                      </label>
                    </div>
                  </div>

                  {/* Suite Musical de Aurora Cloud (Música, Instrumentales, Karaokes) */}
                  <div className="settings-card aurora-music-suite-card">
                    <div className="settings-card-header-row">
                      <div className="aurora-music-suite-title-row">
                        <Icon name="music" />
                        <div>
                          <h3>Servicios Musicales de Aurora Cloud</h3>
                          <p>
                            Ecosistema de streaming en la nube con acceso a pistas completas, versiones instrumentales y karaokes sincronizados.
                          </p>
                        </div>
                      </div>
                      <span className="aurora-upcoming-badge">
                        Próximamente
                      </span>
                    </div>

                    <div className="aurora-music-services-list">
                      {/* 1. Explorar Música */}
                      <div className="aurora-music-service-item">
                        <div className="aurora-music-service-icon is-music">
                          <Icon name="disc" />
                        </div>
                        <div className="aurora-music-service-info">
                          <strong>Explorar Música</strong>
                          <p>Streaming en alta fidelidad de discografía oficial, álbumes y lanzamientos exclusivos.</p>
                        </div>
                        <span className="aurora-service-tag">Audio HD</span>
                      </div>

                      {/* 2. Pistas Instrumentales */}
                      <div className="aurora-music-service-item">
                        <div className="aurora-music-service-icon is-instrumental">
                          <Icon name="sliders" />
                        </div>
                        <div className="aurora-music-service-info">
                          <strong>Instrumentales (Off-Vocal)</strong>
                          <p>Versiones instrumentales limpias y pistas de acompañamiento para práctica y creación.</p>
                        </div>
                        <span className="aurora-service-tag">Off-Vocal</span>
                      </div>

                      {/* 3. Karaokes */}
                      <div className="aurora-music-service-item">
                        <div className="aurora-music-service-icon is-karaoke">
                          <Icon name="mic" />
                        </div>
                        <div className="aurora-music-service-info">
                          <strong>Karaokes & Letras Dinámicas</strong>
                          <p>Pistas preparadas para cantar con letras sincronizadas en tiempo real estrofa por estrofa.</p>
                        </div>
                        <span className="aurora-service-tag">LRC / Sing</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
