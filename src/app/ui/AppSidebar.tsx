import { Icon, type IconName } from "../../shared/ui/Icon";
import { useCustomLibraries } from "../../features/custom_libraries/hooks/useCustomLibraries";
import type { SidebarDensity } from "../useSystemSettings";
import appIcon from "../../../icon/icon.png";
import "./app-sidebar.css";

export type AppView =
  | "home"
  | "player"
  | "music"
  | "video_player"
  | "folders"
  | "images"
  | "videos"
  | "settings"
  | "about"
  | "favorites"
  | "playlists"
  | "history"
  | (string & {});

interface AppSidebarProps {
  activeView: AppView;
  backend: string;
  enabled: boolean;
  onNavigate: (view: AppView) => void;
  density?: SidebarDensity;
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
];

const collectionItems: SidebarItem[] = [
  { icon: "heart", label: "Favoritos", view: "favorites" },
  { icon: "history", label: "Historial", view: "history" },
  { icon: "list-music", label: "Listas de reproducción", view: "playlists" },
];

const toolItems: SidebarItem[] = [
  { icon: "sliders", label: "Conversor", view: "converter" },
  { icon: "download", label: "Luna Fetch", view: "luna_fetch" },
  { icon: "layers", label: "Gallery-DL", view: "gallery_dl" },
];

export function AppSidebar({
  activeView,
  backend,
  enabled,
  onNavigate,
  density = "standard",
}: AppSidebarProps) {
  const { activeLibraries } = useCustomLibraries();

  const dynamicLibraryItems: SidebarItem[] = [
    ...libraryItems,
    ...activeLibraries.map((lib) => ({
      icon: (lib.icon as IconName) || "folder",
      label: lib.label,
      view: `custom_${lib.id}` as AppView,
    })),
  ];

  return (
    <aside className={`music-sidebar density-${density}`} data-density={density}>
      <div className="brand-lockup">
        <div className="brand-mark">
          <img src={appIcon} alt="Prisma" />
        </div>
        <div className="sidebar-copy">
          <strong>Prisma</strong>
          <span>Multimedia local</span>
        </div>
      </div>

      <nav className="sidebar-navigation" aria-label="Navegación multimedia">
        <SidebarSection title="PRINCIPAL" items={principalItems} activeView={activeView} onNavigate={onNavigate} />
        <SidebarSection title="BIBLIOTECA" items={dynamicLibraryItems} activeView={activeView} onNavigate={onNavigate} />
        <SidebarSection title="COLECCIONES" items={collectionItems} activeView={activeView} onNavigate={onNavigate} />
        <SidebarSection title="HERRAMIENTAS" items={toolItems} activeView={activeView} onNavigate={onNavigate} />
      </nav>

      <footer className="sidebar-footer">
        <button
          aria-label="Abrir Configuración"
          className={`sidebar-settings-button ${activeView === "settings" ? "is-active" : ""}`}
          onClick={() => onNavigate("settings")}
          title="Configuración de Tema, Atajos y Sistema"
        >
          <span className="sidebar-settings-icon">
            <Icon name="settings" />
          </span>
          <div className="sidebar-copy">
            <strong>Configuración</strong>
            <span>Fuentes y atajos</span>
          </div>
        </button>

        <button
          aria-label="Acerca de Prisma"
          className={`sidebar-settings-button sidebar-about-button ${activeView === "about" ? "is-active" : ""}`}
          onClick={() => onNavigate("about")}
          title="Acerca de Prisma, Donaciones y Actualizaciones"
        >
          <span className="sidebar-settings-icon">
            <Icon name="info" />
          </span>
          <div className="sidebar-copy">
            <strong>Acerca de</strong>
            <span>v0.0.1 · biglexj</span>
          </div>
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
