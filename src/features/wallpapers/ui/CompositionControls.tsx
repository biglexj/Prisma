import { useEffect, useState } from "react";
import { AMBIENTS, SCENARIOS, type CompositionConfig } from "../compositor/config";
import { liveWallpapersApi } from "../services/liveWallpapersApi";

/** Los controles no importan el motor WebGL: vive en compositor.html. */
export function CompositionControls({ enabled }: { enabled: boolean }) {
  const [config, setConfig] = useState<CompositionConfig | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let alive = true;
    void liveWallpapersApi.getCompositorConfig()
      .then(value => { if (alive) setConfig(value); })
      .catch(reason => { if (alive) setError(String(reason)); });
    return () => { alive = false; };
  }, []);
  const update = async (patch: Partial<CompositionConfig>) => {
    if (!config || saving) return;
    setSaving(true);
    try {
      const next = { ...config, ...patch };
      await liveWallpapersApi.setCompositorConfig(next);
      setConfig(next);
      setError("");
    } catch (reason) { setError(String(reason)); }
    finally { setSaving(false); }
  };
  return <fieldset className="live-composition-controls" disabled={!config || saving}>
    <legend>Escenarios de Aurora</legend>
    <label>Ambiente
      <select aria-label="Ambiente Aurora" value={config?.ambient ?? "original"}
        onChange={event => { void update({ ambient: event.target.value }); }}>
        {AMBIENTS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
    <label>Escenario
      <select aria-label="Escenario Aurora" value={config?.scenario ?? "prisma"}
        onChange={event => { void update({ scenario: event.target.value }); }}>
        {SCENARIOS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
    <p>{enabled ? "Fondo 3D activo en el escritorio." : "Elige un escenario y pulsa Activar fondo para verlo en el escritorio."}</p>
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}
