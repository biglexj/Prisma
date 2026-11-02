import { Icon } from "../../shared/ui/Icon";
import { AuthSessionCard } from "../../features/auth/ui/AuthSessionCard";
import "./ecosystem-settings.css";

interface AuroraSettingsPanelProps {
  auroraLyricsEnabled: boolean;
  setAuroraLyricsEnabled: (enabled: boolean) => void;
  auroraWallpapersEnabled: boolean;
  setAuroraWallpapersEnabled: (enabled: boolean) => void;
}

export function AuroraSettingsPanel({ auroraLyricsEnabled, setAuroraLyricsEnabled, auroraWallpapersEnabled,
  setAuroraWallpapersEnabled }: AuroraSettingsPanelProps) {
  return <div className="settings-panel ecosystem-settings">
    <header className="ecosystem-heading"><div className="aurora-hero-icon"><Icon name="sparkles" /></div>
      <div><h2>Ecosistema Online</h2><p>Tu cuenta Biglex J y los servicios que eliges usar en Prisma.</p></div></header>
    <div className="ecosystem-columns">
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
    </div>
    <p className="ecosystem-local-note"><Icon name="folder" />Tu biblioteca, archivos y preferencias se conservan en este equipo. Iniciar sesión no sube tu biblioteca.</p>
  </div>;
}
