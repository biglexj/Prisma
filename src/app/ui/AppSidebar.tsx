import { Icon, type IconName } from "../../shared/ui/Icon";
import appIcon from "../../../icon/icon.png";
import "./app-sidebar.css";

export type AppView = "home" | "player" | "music" | "video_player" | "folders" | "images" | "videos" | "settings";

interface AppSidebarProps {
  activeView: AppView;
  backend: string;
  enabled: boolean;
  onNavigate: (view: AppView) => void;
}

interface SidebarItem {
  icon: IconName;
  label: string;
  view?: AppView;
  soon?: boolean;
}

const principalItems: SidebarItem[] = [
  { icon: "home", label: "Inicio", view: "home" },
  { icon: "disc", label: "Escuchar", view: "player" },
];

const libraryItems: SidebarItem[] = [
  { icon: "music", label: "Música", view: "music" },
  { icon: "image", label: "Imágenes", view: "images" },
  { icon: "video", label: "Vídeos", view: "videos" },
  { icon: "heart", label: "Favoritos", soon: true },
];

export function AppSidebar({ activeView, backend, enabled, onNavigate }: AppSidebarProps) {
  return (
    <aside className="music-sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <img src={appIcon} alt="Prisma" />
        </div>
        <div className="sidebar-copy">
          <strong>Prisma</strong>
          <span>Multimedia local</span>
        </div>
      </div>

      <div className="sidebar-search sidebar-copy">
        <Icon name="music" />
        <input aria-label="Buscar" disabled placeholder="Buscar en tu música…" />
      </div>

      <nav className="sidebar-navigation" aria-label="Navegación multimedia">
        <SidebarSection title="PRINCIPAL" items={principalItems} activeView={activeView} onNavigate={onNavigate} />
        <SidebarSection title="BIBLIOTECA" items={libraryItems} activeView={activeView} onNavigate={onNavigate} />
      </nav>

      <footer className="sidebar-footer">
        <button
          aria-label="Abrir Configuración"
          className={`sidebar-settings-button ${activeView === "settings" ? "is-active" : ""}`}
          onClick={() => onNavigate("settings")}
          title="Configuración de Tema, Carpetas y Motor"
        >
          <span className="sidebar-settings-icon">
            <Icon name="settings" />
          </span>
          <div className="sidebar-copy">
            <strong>Configuración</strong>
            <span>Fuentes y carpetas</span>
          </div>
          <span className={enabled ? "engine-dot is-ready" : "engine-dot"} title={backend} />
        </button>
      </footer>
    </aside>
  );
}

function SidebarSection({
  title,
  items,
  activeView,
  onNavigate,
}: {
  title: string;
  items: SidebarItem[];
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}) {
  return (
    <section className="sidebar-section">
      <span className="sidebar-section-title sidebar-copy">{title}</span>
      {items.map((item) => (
        <button
          className={`sidebar-item ${item.view === activeView ? "is-active" : ""}`}
          disabled={item.soon}
          key={item.label}
          onClick={() => item.view && onNavigate(item.view)}
          title={item.soon ? `${item.label} · Próximamente` : item.label}
        >
          <Icon name={item.icon} />
          <span className="sidebar-copy">{item.label}</span>
          {item.soon ? <small className="sidebar-copy">PRONTO</small> : null}
        </button>
      ))}
    </section>
  );
}
