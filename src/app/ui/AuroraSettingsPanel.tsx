import { useState } from "react";
import { Icon } from "../../shared/ui/Icon";
import { OFFICIAL_AURORA_ORIGIN, isOfficialAuroraServer, normalizeAuroraServerUrl } from "../../shared/auroraServer";
import { AuthSessionCard } from "../../features/auth/ui/AuthSessionCard";
import "./ecosystem-settings.css";

interface AuroraSettingsPanelProps {
  auroraLyricsEnabled: boolean;
  setAuroraLyricsEnabled: (enabled: boolean) => void;
  auroraWallpapersEnabled: boolean;
  setAuroraWallpapersEnabled: (enabled: boolean) => void;
  auroraServerUrl: string;
  setAuroraServerUrl: (url: string) => void;
}

export function AuroraSettingsPanel({ auroraLyricsEnabled, setAuroraLyricsEnabled, auroraWallpapersEnabled,
  setAuroraWallpapersEnabled, auroraServerUrl, setAuroraServerUrl }: AuroraSettingsPanelProps) {
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testFeedback, setTestFeedback] = useState("");
  const official = isOfficialAuroraServer(auroraServerUrl);
  const testConnection = async () => {
    setTestStatus("testing"); setTestFeedback("Comprobando el catálogo…");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const base = normalizeAuroraServerUrl(auroraServerUrl);
      const url = new URL(base);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Usa una dirección HTTP o HTTPS sin credenciales.");
      const response = await fetch(`${base}/api/v1/wallpapers?limit=1`, { signal: controller.signal, cache: "no-store", credentials: "omit", redirect: "error" });
      if (!response.ok || !Array.isArray((await response.json()).wallpapers)) throw new Error("El servidor no ofrece un catálogo compatible.");
      setTestStatus("success"); setTestFeedback("Catálogo disponible.");
    } catch (error) {
      setTestStatus("error");
      setTestFeedback(error instanceof Error && error.name !== "AbortError" ? error.message : "El servidor no respondió a tiempo.");
    } finally { window.clearTimeout(timeout); }
  };
  return <div className="settings-panel ecosystem-settings">
    <header className="ecosystem-heading"><div className="aurora-hero-icon"><Icon name="sparkles" /></div>
      <div><h2>Ecosistema Online</h2><p>Tu cuenta Biglex J y los servicios que eliges usar en Prisma.</p></div></header>
    <AuthSessionCard />
    <div className="ecosystem-services">
      <section className="settings-card ecosystem-service">
        <div className="settings-card-header-row"><div className="ecosystem-service-title"><Icon name="music" /><h3>Letras</h3></div>
          <label className="toggle-switch"><input type="checkbox" checked={auroraLyricsEnabled} onChange={event => setAuroraLyricsEnabled(event.target.checked)} aria-label="Activar letras online" /><span className="toggle-slider" /></label></div>
        <p>Consulta letras y versiones sincronizadas de biglexj.com, trabaja en el editor y comparte tus aportes.</p>
        <ul><li>Puedes consultar y aportar sin iniciar sesión.</li><li>Con tu cuenta, cada aporte conserva su autoría y seguimiento.</li><li>Las letras locales y el sincronizador siguen disponibles sin conexión.</li></ul>
      </section>
      <section className="settings-card ecosystem-service">
        <div className="settings-card-header-row"><div className="ecosystem-service-title"><Icon name="sparkles" /><h3>Wallpapers</h3></div>
          <label className="toggle-switch"><input type="checkbox" checked={auroraWallpapersEnabled} onChange={event => setAuroraWallpapersEnabled(event.target.checked)} aria-label="Activar catálogo de wallpapers" /><span className="toggle-slider" /></label></div>
        <p>Explora el catálogo de biglexj.com y aplica fondos en Prisma.</p>
        <ul><li>Wallpapers públicos disponibles sin cuenta.</li><li>Contenido exclusivo según los permisos de tu cuenta.</li><li>La misma cuenta Biglex J que utilizas en Super Galería.</li></ul>
      </section>
    </div>
    <p className="ecosystem-local-note"><Icon name="folder" />Tu biblioteca, archivos y preferencias se conservan en este equipo. Iniciar sesión no sube tu biblioteca.</p>
    <details className="settings-card ecosystem-server">
      <summary><Icon name="server" />Servidor del catálogo <span>{official ? "biglexj.com" : "Personalizado"}</span></summary>
      <div className="ecosystem-server-body"><p>La cuenta y las letras utilizan biglexj.com. Este ajuste cambia el servidor de wallpapers.</p>
        <label className="ecosystem-server-choice"><input type="radio" name="ecosystem-server" checked={official} onChange={() => { setAuroraServerUrl(OFFICIAL_AURORA_ORIGIN); setTestStatus("idle"); }} />Oficial · biglexj.com</label>
        <label className="ecosystem-server-choice"><input type="radio" name="ecosystem-server" checked={!official} onChange={() => { setAuroraServerUrl("http://localhost:4321"); setTestStatus("idle"); }} />Servidor personalizado</label>
        {!official && <div className="ecosystem-server-input"><input aria-label="Dirección del servidor de wallpapers" type="url" value={auroraServerUrl} spellCheck={false} onChange={event => { setAuroraServerUrl(event.target.value); setTestStatus("idle"); }} placeholder="https://servidor.example" />
          <button type="button" className="aurora-test-btn" disabled={testStatus === "testing"} onClick={() => void testConnection()}><Icon name="refresh" />{testStatus === "testing" ? "Probando…" : "Probar conexión"}</button></div>}
        {testStatus !== "idle" && <p className={`aurora-test-feedback is-${testStatus}`} role="status">{testFeedback}</p>}
      </div>
    </details>
  </div>;
}
