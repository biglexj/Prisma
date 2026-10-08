import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useDsp } from "../DspContext";
import { superGalleryName } from "../../../shared/superGalleryName";
import { CustomSelect } from "../../../shared/ui/CustomSelect";
import "./mobile-audio-output.css";

const LABELS = { off: "Desactivado", connecting: "Conectando…", connected: "Conectado", reconnecting: "Reconectando…" };
interface SynapsePhone { deviceName: string; ipAddress: string; capabilities: string[] }

export function MobileAudioOutputSelector() {
  const dsp = useDsp();
  const mobile = dsp.mobileAudioOutput;
  const galleryName = superGalleryName();
  const { status, busy, error } = mobile;
  const [open, setOpen] = useState(false);
  const [phones, setPhones] = useState<SynapsePhone[]>([]);
  const [position, setPosition] = useState({ left: 12, top: 100 });
  const [gain, setGain] = useState(100);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { setGain(Math.round(status.volume * 100)); }, [status.volume]);
  useEffect(() => {
    if (!open) return;
    let disposed = false;
    const update = () => {
      const rect = trigger.current?.getBoundingClientRect();
      const height = Math.min(panel.current?.scrollHeight ?? 420, window.innerHeight - 24);
      if (rect) setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 392)),
        top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - height - 12)) });
    };
    const discover = () => {
      void invoke<SynapsePhone[]>("synapse_get_discovered_devices").then(devices => {
        if (!disposed) setPhones(devices.filter(device => device.capabilities.includes("audio-receiver-tls-pcm-v1")));
      }).catch(() => {});
    };
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    update(); if (mobile.desktopAvailable) discover();
    const resize = new ResizeObserver(update);
    const mutations = new MutationObserver(update);
    if (panel.current) {
      resize.observe(panel.current);
      mutations.observe(panel.current, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    }
    const timer = mobile.desktopAvailable ? window.setInterval(discover, 3000) : undefined;
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", onKey);
    return () => {
      disposed = true; clearInterval(timer);
      resize.disconnect(); mutations.disconnect();
      window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true);
      document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", onKey);
    };
  }, [open, mobile.desktopAvailable]);
  const rememberedIsVisible = phones.some(phone => phone.ipAddress === status.device?.address);
  const automaticPhone = !status.device && phones.length === 1 ? phones[0] : null;
  return <>
    <button ref={trigger} type="button" className={`dsp-dropdown-trigger mobile-audio-trigger ${status.enabled ? "is-on" : ""}`}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(previous => !previous)}>
      <span aria-hidden="true">▣</span><span>Usar el teléfono como altavoz</span><span aria-hidden="true">⌄</span>
    </button>
    {open && createPortal(<div ref={panel} className="mobile-audio-panel" role="dialog" aria-label="Usar el teléfono como altavoz"
      style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 12}px)` }}>
      <div className="mobile-audio-heading"><strong>Usar el teléfono como altavoz</strong><button type="button" aria-label="Cerrar" onClick={() => setOpen(false)}>×</button></div>
      <p>Recibe el audio de Windows en tu teléfono.</p>
      {(phones.length > 1 || (status.device && phones.length > 0 && !rememberedIsVisible)) && <label>Teléfono
        <CustomSelect value={rememberedIsVisible ? status.device?.address ?? "" : ""} disabled={busy}
          aria-label="Teléfono" placeholder="Elige un teléfono disponible"
          options={phones.map(phone => ({ value: phone.ipAddress, label: phone.deviceName }))}
          onChange={address => { if (address) void mobile.selectPhone(address); }} />
      </label>}
      <div className="mobile-audio-device">
        <div><strong>{status.device?.name ?? automaticPhone?.deviceName ?? galleryName}</strong>
          <span role="status">{!mobile.desktopAvailable ? "Disponible en Prisma de escritorio" : status.enabled ? LABELS[status.connection] : status.device || automaticPhone ? "Listo para conectar" : phones.length > 1 ? "Elige un teléfono" : "Buscando en Synapse…"}</span></div>
        <button type="button" role="switch" aria-checked={status.enabled} disabled={busy || !mobile.desktopAvailable}
          onClick={() => void mobile.toggle()}>{status.enabled ? "Desactivar" : "Activar"}</button>
      </div>
      {!mobile.desktopAvailable ? <p>Disponible en Prisma de escritorio.</p> : !status.device && phones.length === 0 && <p>Abre {galleryName} en la misma red.</p>}
      <label>Volumen del teléfono · {gain} %
        <input aria-label="Volumen enviado al teléfono" type="range" min="0" max="100" value={gain} disabled={busy || !mobile.desktopAvailable}
          onChange={event => setGain(Number(event.target.value))}
          onPointerUp={() => void mobile.configure(gain / 100, status.captureDeviceId)}
          onKeyUp={() => void mobile.configure(gain / 100, status.captureDeviceId)} />
      </label>
      <details>
        <summary>Fuente de audio</summary>
        <label>Audio que se enviará
          <CustomSelect value={status.captureDeviceId ?? ""} disabled={busy || !mobile.desktopAvailable || dsp.globalPassthruEnabled}
            aria-label="Audio que se enviará"
            options={[{ value: "", label: "Salida predeterminada de Windows" }, ...dsp.audioEndpoints.map(endpoint => ({ value: endpoint.id, label: endpoint.name }))]}
            onChange={id => void mobile.configure(status.volume, id || null)} />
        </label>
      </details>
      {(error || status.error) && <p className="mobile-audio-error" role="alert">{error || status.error}</p>}
    </div>, document.body)}
  </>;
}
