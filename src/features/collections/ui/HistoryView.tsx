import { Icon } from "../../../shared/ui/Icon";
import "./collections.css";

export function HistoryView() {
  return (
    <section className="collections-view">
      <header className="collections-heading">
        <div className="section-heading">
          <span className="preview-kicker">COLECCIONES</span>
          <h1>Historial</h1>
          <p>
            El registro de todo lo que has escuchado recientemente en Prisma aparecerá aquí.
          </p>
        </div>
      </header>

      <div className="collections-empty-state">
        <div className="collections-empty-icon">
          <Icon name="history" />
        </div>
        <h2>Historial vacío</h2>
        <p>
          Comienza a reproducir música en Prisma y tu historial
          de escucha se registrará automáticamente.
        </p>
        <span className="collections-coming-badge">Próximamente</span>
      </div>
    </section>
  );
}
