import { useEffect, useMemo, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../shared/ui/Icon";
import { EcosystemAppCard } from "../../shared/ui/EcosystemAppCard";
import {
  ECOSYSTEM_APPS,
  ECOSYSTEM_KIND_FILTERS,
  resolveEcosystemStatus,
  type EcosystemApp,
  type EcosystemAppState,
  type EcosystemKind,
} from "../../shared/ecosystemApps";
import "./synapse-settings.css";

interface SynapseSettingsPanelProps {
  /** Controles de la barra superior Synapse: van en la tercera columna. */
  topbarColumn?: ReactNode;
}

interface SynapseStatus {
  beaconActive: boolean;
  serverActive: boolean;
  port: number;
  beaconPort: number;
  deviceName: string;
  downloadsDir: string;
}

export function SynapseSettingsPanel({ topbarColumn }: SynapseSettingsPanelProps) {
  const [status, setStatus] = useState<SynapseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDir, setSavingDir] = useState(false);
  const [launchingAppId, setLaunchingAppId] = useState<string | null>(null);
  const [appStates, setAppStates] = useState<Record<string, EcosystemAppState>>({});
  const [kindFilter, setKindFilter] = useState<EcosystemKind | "all">("all");

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
    void invoke<EcosystemAppState[]>("ecosystem_apps_state")
      .then((list) => {
        setAppStates(Object.fromEntries(list.map((item) => [item.id, item])));
      })
      .catch((err) => console.error("Error al detectar apps del ecosistema:", err));
  }, []);

  const visibleApps = useMemo(
    () => ECOSYSTEM_APPS.filter((app) => kindFilter === "all" || app.kind === kindFilter),
    [kindFilter],
  );

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
    const appState = appStates[app.id];
    if (!appState?.installed) {
      void invoke("open_external_url", { url: app.linkUrl });
      return;
    }

    setLaunchingAppId(app.id);
    try {
      const launched = await invoke<boolean>("ecosystem_app_launch", { id: app.id });
      if (!launched) {
        void invoke("open_external_url", { url: app.linkUrl });
      }
    } catch {
      void invoke("open_external_url", { url: app.linkUrl });
    } finally {
      setLaunchingAppId(null);
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
      {/* ── Cuadrícula de 3 columnas al estilo M3 de Prisma ── */}
      <div className="settings-cards-grid is-three">
        {/* ── Tarjeta 1: Estado del Nodo LAN ── */}
        <div className="settings-card">
          <div className="settings-card-header-row">
            <div>
              <h3>Presencia y Conectividad LAN</h3>
              <p>
                Tu ecosistema, siempre presente en la red local.
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
                Donde llegan tus fotos, vídeos y audios desde el móvil o el ecosistema.
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

        {/* ── Columna 3: Barra superior Synapse (bóveda flotante) ── */}
        {topbarColumn ? <div className="synapse-column-stack">{topbarColumn}</div> : null}
      </div>

      {/* ── Tarjeta 4: Ecosistema de Aplicaciones Vinculadas ── */}
      <div className="settings-card">
        <div className="settings-card-header-row">
          <div>
            <h3>Ecosistema de Aplicaciones Vinculadas</h3>
            <p>
              Todo el ecosistema biglexj, con lo que tienes instalado a la vista.
            </p>
          </div>
          <div className="eco-filter-row">
            {ECOSYSTEM_KIND_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={`eco-filter-chip ${kindFilter === filter.id ? "is-active" : ""}`}
                onClick={() => setKindFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="eco-grid">
          {visibleApps.map((app) => {
            const appState = appStates[app.id];
            const appStatus = resolveEcosystemStatus(app, appState);

            return (
              <EcosystemAppCard
                key={app.id}
                app={app}
                state={appState}
                status={appStatus}
                busy={launchingAppId === app.id}
                onPrimary={(target) => void handleLaunchApp(target)}
                onSecondary={(target) => void invoke("open_external_url", { url: target.linkUrl })}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
