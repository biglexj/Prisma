import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { useDsp } from "../DspContext";
import { superGalleryName } from "../../../shared/superGalleryName";
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
      if (rect) setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 392)),
        top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 420)) });
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
    const timer = mobile.desktopAvailable ? window.setInterval(discover, 3000) : undefined;
    window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", onKey);
    return () => {
      disposed = true; clearInterval(timer);
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
      <p>Se conecta con {galleryName} a través de Synapse y sigue activo hasta que lo desactives.</p>
      {(phones.length > 1 || (status.device && phones.length > 0 && !rememberedIsVisible)) && <label>Teléfono
        <select value={rememberedIsVisible ? status.device?.address ?? "" : ""} disabled={busy}
          onChange={event => { if (event.target.value) void mobile.selectPhone(event.target.value); }}>
          <option value="">Elige un teléfono disponible</option>
          {phones.map(phone => <option key={phone.ipAddress} value={phone.ipAddress}>{phone.deviceName}</option>)}
        </select>
      </label>}
      <div className="mobile-audio-device">
        <div><strong>{status.device?.name ?? automaticPhone?.deviceName ?? galleryName}</strong>
          <span role="status">{!mobile.desktopAvailable ? "Disponible en Prisma de escritorio" : status.enabled ? LABELS[status.connection] : status.device || automaticPhone ? "Listo para conectar" : phones.length > 1 ? "Elige un teléfono" : "Buscando en Synapse…"}</span></div>
        <button type="button" role="switch" aria-checked={status.enabled} disabled={busy || !mobile.desktopAvailable}
          onClick={() => void mobile.toggle()}>{status.enabled ? "Desactivar" : "Activar"}</button>
      </div>
      {!mobile.desktopAvailable ? <p>Abre Prisma de escritorio para utilizar el teléfono como altavoz.</p> : !status.device && phones.length === 0 && <p>Abre {galleryName} con Synapse activo en la misma red.</p>}
      <label>Volumen del teléfono · {gain} %
        <input aria-label="Volumen enviado al teléfono" type="range" min="0" max="100" value={gain} disabled={busy || !mobile.desktopAvailable}
          onChange={event => setGain(Number(event.target.value))}
          onPointerUp={() => void mobile.configure(gain / 100, status.captureDeviceId)}
          onKeyUp={() => void mobile.configure(gain / 100, status.captureDeviceId)} />
      </label>
      <details>
        <summary>Fuente de audio y atajo</summary>
        <label>Audio que se enviará
          <select value={status.captureDeviceId ?? ""} disabled={busy || !mobile.desktopAvailable || dsp.globalPassthruEnabled}
            onChange={event => void mobile.configure(status.volume, event.target.value || null)}>
            <option value="">Salida predeterminada de Windows</option>
            {dsp.audioEndpoints.map(endpoint => <option key={endpoint.id} value={endpoint.id}>{endpoint.name}</option>)}
          </select>
        </label>
        {dsp.globalPassthruEnabled && <p>Utiliza la señal procesada del DSP global.</p>}
        <label>Atajo global
          <select value={status.shortcut} disabled={busy || !mobile.desktopAvailable} onChange={event => void mobile.setShortcut(event.target.value)}>
            <option value="Ctrl+Shift+Alt+M">Ctrl + Mayús + Alt + M</option>
            <option value="Ctrl+Shift+Alt+T">Ctrl + Mayús + Alt + T</option>
            <option value="Ctrl+Shift+Alt+U">Ctrl + Mayús + Alt + U</option>
            <option value="">Sin atajo</option>
          </select>
        </label>
      </details>
      {status.shortcutError && <p role="alert" className="mobile-audio-error">{status.shortcutError}</p>}
      {(error || status.error) && <p className="mobile-audio-error" role="alert">{error || status.error}</p>}
    </div>, document.body)}
  </>;
}
