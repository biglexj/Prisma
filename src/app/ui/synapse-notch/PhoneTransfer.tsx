import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Icon } from "../../../shared/ui/Icon";
import { MediaProgressBar } from "../../../shared/ui/MediaProgressBar";
import type { SynapseDiscoveredDevice } from "../SendToSuperGalleryModal";

export function PhoneTransfer({ paths, onClose }: { paths: string[]; onClose: () => void }) {
  const [devices, setDevices] = useState<SynapseDiscoveredDevice[]>([]);
  const [sending, setSending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Buscando tu teléfono en Synapse…");
  const [error, setError] = useState("");
  const started = useRef(false);
  const mounted = useRef(true);
  const currentPath = useRef("");
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!completed) return;
    const timer = setTimeout(() => closeRef.current(), 1000);
    return () => clearTimeout(timer);
  }, [completed]);

  const send = useCallback(async (device: SynapseDiscoveredDevice) => {
    if (started.current) return;
    started.current = true;
    setSending(true);
    setCompleted(false);
    setError("");
    try {
      for (let index = 0; index < paths.length; index++) {
        currentPath.current = paths[index];
        setProgress(0);
        setMessage(`Enviando ${index + 1}/${paths.length} a ${device.deviceName}…`);
        await invoke<string>("synapse_send_file_to_device", { targetIp: device.ipAddress, targetPort: device.port, filePath: paths[index] });
      }
      if (mounted.current) { setProgress(100); setMessage(`Enviado a ${device.deviceName}`); setCompleted(true); }
    } catch (err) {
      if (mounted.current) setError(String(err));
      // El reintento queda en manos del usuario; el sondeo no repite envíos fallidos.
    } finally { if (mounted.current) setSending(false); }
  }, [paths]);

  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    let inFlight = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let unlistenProgress: (() => void) | undefined;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const discovered = await invoke<SynapseDiscoveredDevice[]>("synapse_get_discovered_devices");
        if (disposed) return;
        const phones = discovered.filter((device) => device.targetApp === "supergallery" || ["mobile", "phone"].includes(device.deviceType));
        setDevices(phones);
        if (phones.length === 1 && !started.current) void send(phones[0]);
        else if (!started.current) setMessage(phones.length ? "Elige el teléfono de destino" : "Abre Super Galería en tu teléfono, en la misma red Wi-Fi");
      } catch (err) { if (!disposed) setError(String(err)); }
      finally { inFlight = false; }
    };
    const initialize = async () => {
      try {
        // El envío automático puede completar en milisegundos. No descubrir ni
        // habilitar destinos hasta que el backend confirme la escucha de progreso.
        const unlisten = await listen<{ fileName: string; progress: number }>("prisma://upload-progress", ({ payload }) => {
          if (!disposed && currentPath.current.split(/[/\\]/).at(-1) === payload.fileName) {
            setProgress(Math.round(Math.min(1, Math.max(0, payload.progress)) * 100));
          }
        });
        if (disposed) { unlisten(); return; }
        unlistenProgress = unlisten;
        void refresh();
        timer = setInterval(() => void refresh(), 2000);
      } catch (err) {
        if (!disposed) setError(`No se pudo iniciar el seguimiento del envío: ${String(err)}`);
      }
    };
    void initialize();
    return () => { disposed = true; mounted.current = false; clearInterval(timer); unlistenProgress?.(); };
  }, [send]);

  return <section className="vault-phone" aria-label="Enviar al teléfono">
    <div className="vault-phone-heading"><Icon name="smartphone" width={22} height={22} /><strong>Enviar al teléfono</strong>
      <button type="button" disabled={sending} onClick={onClose} aria-label="Volver a la barra"><Icon name="close" width={18} height={18} /></button>
    </div>
    <p role="status">{message}</p>
    {(sending || completed) && <div className="vault-phone-transfer-progress">
      <MediaProgressBar position={progress} duration={100} isPlaying={sending} readOnly ariaLabel="Progreso de envío" />
      <span className="vault-phone-transfer-percent">{progress}%</span>
    </div>}
    {error && <p role="alert" className="vault-error">{error}</p>}
    {!sending && (!started.current || error) && devices.map((device) => <button className="vault-device" type="button" key={device.deviceId} onClick={() => { started.current = false; void send(device); }}>{device.deviceName}</button>)}
    {!sending && <small>Los archivos permanecen en la barra.</small>}
  </section>;
}
