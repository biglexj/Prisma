import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDsp } from "../DspContext";
import "./multi-audio-output.css";

export function MultiAudioOutputSelector() {
  const dsp = useDsp();
  const { config, busy, error, shortcutError, setDevices, setGain, setDelay, toggle } = dsp.multiOutput;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 420 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const endpoints = useMemo(() => dsp.audioEndpoints.filter((endpoint) => !endpoint.isVirtual), [dsp.audioEndpoints]);
  const primary = dsp.selectedRenderDeviceId;
  const selected = new Map(config.devices.map((device) => [device.id, device]));
  const virtualAvailable = dsp.audioEndpoints.some((endpoint) => endpoint.isVirtual);
  const activeCount = config.devices.filter((device) => endpoints.some((endpoint) => endpoint.id === device.id)).length;

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(390, window.innerWidth - 24);
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const showAbove = below < 260 && above > below;
      const maxHeight = Math.max(160, Math.min(440, showAbove ? above - 8 : below - 8));
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: showAbove ? Math.max(12, rect.top - maxHeight - 8) : rect.bottom + 8,
        maxHeight,
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    place();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const changeSelection = (id: string) => {
    let next = config.devices.filter((device) => device.id !== id && endpoints.some((endpoint) => endpoint.id === device.id));
    if (!selected.has(id)) next = [...next, { id, gain: 1, delayMs: 0 }];
    if (primary && !next.some((device) => device.id === primary)) {
      next = [{ id: primary, gain: 1, delayMs: 0 }, ...next];
    }
    void setDevices(next);
  };

  const panel = open && (
    <div
      className="multi-output-popover"
      ref={panelRef}
      role="dialog"
      aria-label="Configurar salidas múltiples"
      style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }}
    >
      <div className="multi-output-popover-header">
        <div>
          <h3>Salidas múltiples</h3>
          <p>Marca las salidas y ajusta su retardo con las flechas en pasos de 10 ms.</p>
        </div>
        <button className="multi-output-close" type="button" aria-label="Cerrar selector" onClick={() => setOpen(false)}>×</button>
      </div>
      <div className="multi-output-status" aria-live="polite">
        <span className={`multi-output-signal ${config.enabled && dsp.globalPassthruStatus?.hasSignal ? "is-live" : ""}`} />
        {config.enabled && dsp.globalPassthruStatus?.isRunning
          ? `${activeCount} salidas conectadas · Búfer principal ~${Math.round(dsp.globalPassthruStatus.latencyMs)} ms`
          : `${activeCount} salidas preparadas`}
      </div>
      <div className="multi-output-list">
        {endpoints.map((endpoint) => {
          const isPrimary = endpoint.id === primary;
          const device = selected.get(endpoint.id) ?? (isPrimary ? { id: endpoint.id, gain: 1, delayMs: 0 } : undefined);
          return (
            <div className="multi-output-row" key={endpoint.id}>
              <label className="multi-output-choice">
                <input
                  type="checkbox"
                  checked={Boolean(device)}
                  disabled={busy || isPrimary}
                  onChange={() => changeSelection(endpoint.id)}
                />
                <span>{endpoint.name}</span>
                {isPrimary && <small>Principal</small>}
              </label>
              {selected.has(endpoint.id) && (
                <>
                  <label className="multi-output-gain">
                    <span>{Math.round(device!.gain * 100)} %</span>
                    <input
                      aria-label={`Volumen de ${endpoint.name}`}
                      type="range" min="0" max="100" step="1"
                      value={Math.round(device!.gain * 100)}
                      onChange={(event) => setGain(endpoint.id, Number(event.target.value) / 100)}
                    />
                  </label>
                  <div className="multi-output-delay" onKeyDown={(event) => {
                    if (["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown"].includes(event.key)) {
                      event.preventDefault();
                      setDelay(endpoint.id, device!.delayMs + (["ArrowRight", "ArrowUp"].includes(event.key) ? 10 : -10));
                    }
                  }}>
                    <span className="multi-output-delay-label">Retardo</span>
                    <button type="button" aria-label={`Reducir retardo de ${endpoint.name} en 10 ms`} disabled={device!.delayMs === 0} onClick={() => setDelay(endpoint.id, device!.delayMs - 10)}>−</button>
                    <input
                      aria-label={`Retardo de ${endpoint.name} en milisegundos`}
                      type="range" min="0" max="2000" step="10"
                      value={device!.delayMs}
                      onChange={(event) => setDelay(endpoint.id, Number(event.target.value))}
                    />
                    <button type="button" aria-label={`Aumentar retardo de ${endpoint.name} en 10 ms`} disabled={device!.delayMs === 2000} onClick={() => setDelay(endpoint.id, device!.delayMs + 10)}>+</button>
                    <output>{device!.delayMs} ms</output>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {!virtualAvailable && <p className="multi-output-message">Se necesita Prisma Audio Enhancer para duplicar el audio.</p>}
      {error && <p className="multi-output-message" role="alert">{error}</p>}
      {shortcutError && <p className="multi-output-message" role="alert">{shortcutError}</p>}
      <div className="multi-output-footer">
        <span>Prisma: Ctrl + Mayús + O<br />Global: Ctrl + Mayús + Alt + O</span>
        <button
          className={`multi-output-toggle ${config.enabled ? "is-on" : ""}`}
          type="button"
          aria-pressed={config.enabled}
          disabled={busy || (!config.enabled && (activeCount < 2 || !virtualAvailable))}
          onClick={() => void toggle()}
        >
          {config.enabled ? "Detener duplicación" : "Activar duplicación"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        className={`dsp-dropdown-trigger multi-output-trigger ${config.enabled ? "is-on" : ""}`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <span className="multi-output-trigger-icon">☑</span>
        <span>{config.enabled ? `${activeCount} salidas` : "Salidas múltiples"}</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {panel && createPortal(panel, document.body)}
    </>
  );
}
