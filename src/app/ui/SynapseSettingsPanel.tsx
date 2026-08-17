import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../shared/ui/Icon";
import lunaFetchLogo from "../../assets/icons/luna-fetch.png";
import galleryDlLogo from "../../assets/icons/gallery-dl.png";
import superGalleryLogo from "../../assets/icons/super-gallery.png";
import lyraflowLogo from "../../assets/icons/lyraflow.png";
import elyTesiaLogo from "../../assets/icons/ely-tesia.png";
import "./synapse-settings.css";

interface SynapseStatus {
  beaconActive: boolean;
  serverActive: boolean;
  port: number;
  beaconPort: number;
  deviceName: string;
  downloadsDir: string;
}

interface EcosystemApp {
  id: string;
  name: string;
  category: string;
  statusBadge: "active" | "coming_soon";
  statusText: string;
  iconPath: string;
  description: string;
  repoUrl: string;
  downloadLabel: string;
  canLaunch: boolean;
  launchCommand?: string;
}

const ECOSYSTEM_APPS: EcosystemApp[] = [
  {
    id: "luna-fetch",
    name: "Luna Fetch",
    category: "Descargas · Audio & Vídeo",
    statusBadge: "active",
    statusText: "Sinergia Activa",
    iconPath: lunaFetchLogo,
    description: "Gestor y analizador de descargas multimedia de alta fidelidad conectado directamente con Prisma.",
    repoUrl: "https://github.com/biglexj/Luna---Fetch/releases",
    downloadLabel: "Releases",
    canLaunch: true,
    launchCommand: "launch_luna_fetch",
  },
  {
    id: "gallery-dl",
    name: "Gallery-DL GUI",
    category: "Descargas · Galerías",
    statusBadge: "active",
    statusText: "Sinergia Activa",
    iconPath: galleryDlLogo,
    description: "Descargador masivo de álbumes, perfiles de artistas y colecciones (+100 sitios de arte).",
    repoUrl: "https://github.com/biglexj/Gallery-DL-GUI/releases",
    downloadLabel: "Releases",
    canLaunch: true,
    launchCommand: "launch_gallery_dl",
  },
  {
    id: "super-gallery",
    name: "Super Gallery",
    category: "Móvil · Android LAN",
    statusBadge: "coming_soon",
    statusText: "Próximamente",
    iconPath: superGalleryLogo,
    description: "Galería móvil inteligente con visor fluido y recepción directa LAN sin cables en Prisma.",
    repoUrl: "https://www.biglexj.com/desarrollo/lienzo-gallery",
    downloadLabel: "Descargar APK",
    canLaunch: false,
  },
  {
    id: "lyraflow",
    name: "LyraFlow",
    category: "IA Local · Transcripción",
    statusBadge: "coming_soon",
    statusText: "Próximamente",
    iconPath: lyraflowLogo,
    description: "Asistente inteligente de transcripción, subtítulos y análisis de voz con modelos locales.",
    repoUrl: "https://github.com/biglexj/LyraFlow/releases",
    downloadLabel: "Descargar",
    canLaunch: false,
  },
  {
    id: "ely-tesia",
    name: "Ely-Tesia",
    category: "Música · Reproductor MIDI",
    statusBadge: "coming_soon",
    statusText: "Próximamente",
    iconPath: elyTesiaLogo,
    description: "Lector y sintetizador MIDI multi-instancia de alta precisión para compositores y creadores.",
    repoUrl: "https://github.com/biglexj/Ely-Tesia/releases",
    downloadLabel: "Descargar",
    canLaunch: false,
  },
];

export function SynapseSettingsPanel() {
  const [status, setStatus] = useState<SynapseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDir, setSavingDir] = useState(false);
  const [launchingAppId, setLaunchingAppId] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await invoke<SynapseStatus>("synapse_get_status");
      setStatus(data);
    } catch (err) {
      console.error("Error al obtener estado de Synapse:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  const handleChangeFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Seleccionar carpeta para medios recibidos por Synapse",
        defaultPath: status?.downloadsDir,
      });

      if (selected && typeof selected === "string") {
        setSavingDir(true);
        const updated = await invoke<string>("synapse_set_downloads_dir", { newDir: selected });
        setStatus((prev) => (prev ? { ...prev, downloadsDir: updated } : null));
      }
    } catch (err) {
      console.error("Error al cambiar carpeta de descargas de Synapse:", err);
    } finally {
      setSavingDir(false);
    }
  };

  const handleOpenFolder = async () => {
    if (!status?.downloadsDir) return;
    try {
      await invoke("open_in_file_manager", { path: status.downloadsDir });
    } catch (err) {
      console.error("Error al abrir carpeta en el explorador:", err);
    }
  };

  const handleLaunchApp = async (app: EcosystemApp) => {
    if (app.canLaunch && app.launchCommand) {
      setLaunchingAppId(app.id);
      try {
        const launched = await invoke<boolean>(app.launchCommand, { url: null });
        if (!launched) {
          void invoke("open_external_url", { url: app.repoUrl });
        }
      } catch {
        void invoke("open_external_url", { url: app.repoUrl });
      } finally {
        setLaunchingAppId(null);
      }
    } else {
      void invoke("open_external_url", { url: app.repoUrl });
    }
  };

  if (loading) {
    return (
      <div className="settings-panel">
        <p style={{ color: "var(--on-surface-variant)", fontSize: "0.85rem" }}>
          Cargando configuración de Aurora Synapse…
        </p>
      </div>
    );
  }

  return (
    <div className="synapse-settings-panel">
      {/* ── Cuadrícula de 2 columnas al estilo M3 de Prisma ── */}
      <div className="settings-cards-grid">
        {/* ── Tarjeta 1: Estado del Nodo LAN ── */}
        <div className="settings-card">
          <div className="settings-card-header-row">
            <div>
              <h3>Presencia y Conectividad LAN</h3>
              <p>
                Emisión de presencia Zero-Config y microservidor de continuidad multimedia para la red local.
              </p>
            </div>
            <div className="synapse-status-pill">
              <span className="synapse-status-dot" />
              <span>Activo</span>
            </div>
          </div>

          <div className="synapse-info-list">
            <div className="synapse-info-item">
              <span className="info-label">Nombre del Equipo</span>
              <span className="info-value">{status?.deviceName ?? "PC-Biglex"}</span>
            </div>
            <div className="synapse-info-item">
              <span className="info-label">Receptor Multimedia (HTTP/TCP)</span>
              <span className="info-value">Puerto {status?.port ?? 49288}</span>
            </div>
            <div className="synapse-info-item">
              <span className="info-label">Emisión de Baliza (UDP Beacon)</span>
              <span className="info-value">Puerto {status?.beaconPort ?? 49289}</span>
            </div>
            <div className="synapse-info-item">
              <span className="info-label">Protocolo Deep Link</span>
              <span className="info-value">prisma://open</span>
            </div>
          </div>
        </div>

        {/* ── Tarjeta 2: Carpeta de Guardado Inalámbrico ── */}
        <div className="settings-card">
          <div className="settings-card-header-row">
            <div>
              <h3>Carpeta de Archivos Recibidos</h3>
              <p>
                Destino en tu equipo para fotos, vídeos y audios transferidos desde la app móvil u otras aplicaciones del ecosistema.
              </p>
            </div>
          </div>

          <div className="synapse-folder-box">
            <div className="synapse-path-display" title={status?.downloadsDir}>
              <Icon name="folder-open" />
              <span>{status?.downloadsDir ?? "Downloads/Prisma"}</span>
            </div>

            <div className="synapse-action-buttons">
              <button
                type="button"
                className="filled-button"
                onClick={handleChangeFolder}
                disabled={savingDir}
              >
                <Icon name="folder" />
                <span>{savingDir ? "Guardando…" : "Cambiar carpeta…"}</span>
              </button>
              <button
                type="button"
                className="tonal-button"
                onClick={handleOpenFolder}
                title="Abrir carpeta en el Explorador de Windows"
              >
                <Icon name="external-link" />
                <span>Abrir en Explorador</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tarjeta 3: Sinergia del Ecosistema Aurora ── */}
      <div className="settings-card">
        <div className="settings-card-header-row">
          <div>
            <h3>Ecosistema de Aplicaciones Vinculadas</h3>
            <p>
              Aurora Synapse conecta instantáneamente las aplicaciones del ecosistema biglexj. Si una app no está instalada, puedes abrir directamente su repositorio o enlace de descarga.
            </p>
          </div>
        </div>

        <div className="synapse-ecosystem-grid">
          {ECOSYSTEM_APPS.map((app) => (
            <div key={app.id} className="synapse-eco-card">
              <div className="eco-card-header">
                <div className="eco-app-icon-wrap">
                  <img src={app.iconPath} alt={app.name} />
                </div>
                <div className="eco-app-titles">
                  <strong>{app.name}</strong>
                  <div className="eco-badges-row">
                    <span className="eco-badge">{app.category}</span>
                    <span className={`eco-status-pill is-${app.statusBadge}`}>
                      {app.statusText}
                    </span>
                  </div>
                </div>
              </div>

              <p>{app.description}</p>

              <div className="eco-card-actions">
                {app.canLaunch && (
                  <button
                    type="button"
                    className="eco-btn filled"
                    onClick={() => void handleLaunchApp(app)}
                    disabled={launchingAppId === app.id}
                  >
                    <Icon name="external-link" />
                    <span>Abrir App</span>
                  </button>
                )}
                <button
                  type="button"
                  className="eco-btn outline"
                  onClick={() => void invoke("open_external_url", { url: app.repoUrl })}
                  title="Abrir enlace oficial de descarga o ficha de desarrollo"
                >
                  <Icon name="download" />
                  <span>{app.downloadLabel}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
