import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Icon } from "../../shared/ui/Icon";
import "./send-to-supergallery-modal.css";

export interface SynapseDiscoveredDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  port: number;
  os: string;
  targetApp: string;
  capabilities: string[];
  lastSeenMs: number;
}

interface UploadProgressEvent {
  fileName: string;
  sentBytes: number;
  totalBytes: number;
  progress: number;
}

export interface SendToSuperGalleryModalProps {
  filePath: string | null;
  fileTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SendToSuperGalleryModal({
  filePath,
  fileTitle,
  isOpen,
  onClose,
}: SendToSuperGalleryModalProps) {
  const [devices, setDevices] = useState<SynapseDiscoveredDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<SynapseDiscoveredDevice | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDevices([]);
      setSelectedDevice(null);
      setIsSending(false);
      setProgress(0);
      setStatusMessage(null);
      setErrorMessage(null);
      return;
    }

    const fetchDevices = () => {
      invoke<SynapseDiscoveredDevice[]>("synapse_get_discovered_devices")
        .then((devs) => {
          setDevices(devs);
          if (!selectedDevice && devs.length > 0) {
            // Preseleccionar dispositivo móvil / Super Gallery
            const mobile = devs.find((d) => d.targetApp === "supergallery" || d.deviceType === "mobile") || devs[0];
            setSelectedDevice(mobile);
          }
        })
        .catch(() => {});
    };

    fetchDevices();
    const interval = setInterval(fetchDevices, 1500);

    const unlistenProgress = listen<UploadProgressEvent>("prisma://upload-progress", (event) => {
      if (event.payload) {
        setProgress(Math.round(event.payload.progress * 100));
      }
    });

    return () => {
      clearInterval(interval);
      unlistenProgress.then((fn) => fn());
    };
  }, [isOpen, selectedDevice]);

  if (!isOpen || !filePath) return null;

  const fileName = fileTitle || filePath.replace(/.*[/\\]/, "");

  const handleSend = async () => {
    if (!selectedDevice || isSending) return;

    setIsSending(true);
    setProgress(0);
    setErrorMessage(null);
    setStatusMessage("Conectando con el dispositivo móvil...");

    try {
      const result = await invoke<string>("synapse_send_file_to_device", {
        targetIp: selectedDevice.ipAddress,
        targetPort: selectedDevice.port,
        filePath,
      });

      setStatusMessage(result || "¡Archivo enviado con éxito a Super Gallery!");
      setProgress(100);

      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err) {
      setErrorMessage(String(err));
      setIsSending(false);
    }
  };

  const mobileDevices = devices.filter(
    (d) => d.targetApp === "supergallery" || d.deviceType === "mobile"
  );
  const otherDevices = devices.filter(
    (d) => d.targetApp !== "supergallery" && d.deviceType !== "mobile"
  );

  return (
    <div className="send-modal-backdrop" onClick={!isSending ? onClose : undefined}>
      <div
        className="send-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-modal-title"
      >
        <header className="send-modal-header">
          <div className="send-modal-icon-badge">
            <Icon name="smartphone" />
          </div>
          <div>
            <h3 id="send-modal-title">Enviar a Super Galería (Móvil)</h3>
            <p className="send-modal-file-name" title={filePath}>
              {fileName}
            </p>
          </div>
          {!isSending ? (
            <button
              className="send-modal-close-btn"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <Icon name="x" />
            </button>
          ) : null}
        </header>

        <div className="send-modal-body">
          <label className="send-modal-section-label">
            Dispositivos móviles descubiertos en Wi-Fi:
          </label>

          {devices.length === 0 ? (
            <div className="send-modal-empty">
              <div className="send-modal-spinner" />
              <p>Buscando dispositivos móviles con Super Galería abierta en la red local…</p>
              <span className="send-modal-hint">
                Asegúrate de que tu teléfono esté conectado a la misma red Wi-Fi y con Super Galería abierta.
              </span>
            </div>
          ) : (
            <div className="send-device-list">
              {[...mobileDevices, ...otherDevices].map((device) => {
                const isSelected = selectedDevice?.deviceId === device.deviceId;
                const isSuperGallery = device.targetApp === "supergallery" || device.deviceType === "mobile";

                return (
                  <button
                    key={device.deviceId}
                    type="button"
                    className={`send-device-item ${isSelected ? "is-selected" : ""} ${isSuperGallery ? "is-supergallery" : ""}`}
                    onClick={() => !isSending && setSelectedDevice(device)}
                    disabled={isSending}
                  >
                    <div className="send-device-icon">
                      <Icon name={isSuperGallery ? "smartphone" : "disc"} />
                    </div>
                    <div className="send-device-info">
                      <strong>{device.deviceName}</strong>
                      <span>
                        IP: {device.ipAddress} • {isSuperGallery ? "Super Galería Android" : device.os}
                      </span>
                    </div>
                    {isSelected ? (
                      <div className="send-device-check">
                        <Icon name="check" />
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {isSending || statusMessage || errorMessage ? (
            <div className="send-modal-status-box">
              {isSending ? (
                <>
                  <div className="send-progress-bar-wrap">
                    <div
                      className="send-progress-bar-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="send-progress-info">
                    <span>{statusMessage || "Transfiriendo archivo…"}</span>
                    <strong>{progress}%</strong>
                  </div>
                </>
              ) : errorMessage ? (
                <div className="send-status-error">
                  <Icon name="close" />
                  <span>{errorMessage}</span>
                </div>
              ) : statusMessage ? (
                <div className="send-status-success">
                  <Icon name="check" />
                  <span>{statusMessage}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="send-modal-footer">
          <button
            type="button"
            className="send-btn-secondary"
            onClick={onClose}
            disabled={isSending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="send-btn-primary"
            onClick={handleSend}
            disabled={!selectedDevice || isSending}
          >
            <Icon name="smartphone" />
            <span>{isSending ? "Enviando…" : "Enviar al Teléfono"}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
