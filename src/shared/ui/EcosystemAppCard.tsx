import { Icon } from "./Icon";
import type { EcosystemApp, EcosystemAppState, EcosystemStatus } from "../ecosystemApps";
import "./ecosystem-cards.css";

/**
 * Tarjeta de una aplicación del ecosistema biglexj.
 *
 * Se usa en el panel de Aurora Synapse y en la vista "Acerca de", con la
 * misma fuente de datos (`src/shared/ecosystemApps.ts`).
 *
 * La variante `compact` omite la descripción y el botón secundario: es la
 * que permite mostrar las trece aplicaciones sin alargar la página.
 */

export interface EcosystemAppCardProps {
  app: EcosystemApp;
  state?: EcosystemAppState;
  status: EcosystemStatus;
  /** La acción principal está en curso: se deshabilita el botón. */
  busy?: boolean;
  /** Variante corta: sin descripción y con un único botón. */
  compact?: boolean;
  onPrimary: (app: EcosystemApp) => void;
  onSecondary?: (app: EcosystemApp) => void;
}

export function EcosystemAppCard({
  app,
  state,
  status,
  busy = false,
  compact = false,
  onPrimary,
  onSecondary,
}: EcosystemAppCardProps) {
  const isInstalled = state?.installed === true;

  const primaryLabel = app.comingSoon
    ? "Pronto"
    : isInstalled
    ? "Abrir"
    : compact
    ? "Instalar"
    : app.kind === "mobile"
    ? "Instalar en tu móvil"
    : "Obtener";

  return (
    <div className={`eco-card ${compact ? "is-compact" : ""}`} title={app.longDescription || app.description}>
      <div className="eco-card-header">
        <div className="eco-app-icon-wrap">
          {app.iconPath ? <img src={app.iconPath} alt={app.name} /> : <Icon name={app.fallbackIcon} />}
        </div>
        <div className="eco-app-titles">
          <strong>{app.name}</strong>
          <div className="eco-badges-row">
            <span className="eco-badge">{app.category}</span>
            {/* En las apps móviles la categoría ya dice la plataforma:
                repetirla en la insignia sería decirlo dos veces. */}
            {app.kind !== "mobile" && (
              <span className={`eco-status-pill is-${status.tone}`}>{status.label}</span>
            )}
          </div>
        </div>
      </div>

      {!compact && <p title={app.description}>{app.description}</p>}

      <div className="eco-card-actions">
        <button
          type="button"
          className="eco-btn filled"
          onClick={() => onPrimary(app)}
          disabled={busy || app.comingSoon}
          title={isInstalled ? `Abrir ${app.name}` : `Obtener ${app.name}`}
        >
          <Icon name={isInstalled ? "external-link" : "download"} />
          <span>{primaryLabel}</span>
        </button>

        {onSecondary && !compact && (
          <button
            type="button"
            className="eco-btn outline"
            onClick={() => onSecondary(app)}
            title="Abrir ficha oficial, descarga o repositorio"
          >
            <span>{app.linkLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
