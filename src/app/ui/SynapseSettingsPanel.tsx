import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../shared/ui/Icon";
import "./synapse-settings.css";

interface SynapseStatus {
  beaconActive: boolean;
  serverActive: boolean;
  port: number;
  beaconPort: number;
  deviceName: string;
  downloadsDir: string;
}

export function SynapseSettingsPanel() {
  const [status, setStatus] = useState<SynapseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDir, setSavingDir] = useState(false);

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
        <h3>Ecosistema de Aplicaciones Vinculadas</h3>
        <p>
          Aurora Synapse conecta instantáneamente las aplicaciones del ecosistema sin cuentas en la nube ni cables.
        </p>

        <div className="synapse-ecosystem-grid">
          <div className="synapse-eco-card">
            <span className="eco-badge">Móvil (Android)</span>
            <strong>Super Gallery</strong>
            <p>
              Envía fotos/vídeos con <em>«Enviar a PC»</em> o continúa la reproducción de música y vídeos en el segundo exacto (Handoff).
            </p>
          </div>

          <div className="synapse-eco-card">
            <span className="eco-badge">Descargas</span>
            <strong>Luna Fetch</strong>
            <p>
              Abre y reproduce contenidos multimedia descargados directamente en Prisma mediante el enlace de protocolo sin pasos intermedios.
            </p>
          </div>

          <div className="synapse-eco-card">
            <span className="eco-badge">Zero-Config</span>
            <strong>Detección Automática</strong>
            <p>
              Las aplicaciones en la misma red Wi-Fi se reconocen entre sí automáticamente mediante balizas UDP seguras.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
