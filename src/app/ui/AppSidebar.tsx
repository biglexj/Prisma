import { Icon, type IconName } from "../../shared/ui/Icon";
import { useCustomLibraries } from "../../features/custom_libraries/hooks/useCustomLibraries";
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
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
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

export function AppSidebar({
  activeView,
  backend,
  enabled,
  onNavigate,
  searchQuery = "",
  onSearchChange,
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
  const activeCustomLib = activeLibraries.find((l) => `custom_${l.id}` === activeView);
  const searchPlaceholder =
    activeView === "images"
      ? "Buscar en tus imágenes…"
      : activeView === "videos"
      ? "Buscar en tus vídeos…"
      : activeView === "music"
      ? "Buscar en tu música…"
      : activeCustomLib
      ? `Buscar en ${activeCustomLib.label}…`
      : "Buscar en Prisma…";

  const searchIcon: IconName =
    activeView === "images"
      ? "image"
      : activeView === "videos"
      ? "video"
      : activeView === "music"
      ? "music"
      : activeCustomLib
      ? (activeCustomLib.icon as IconName) || "folder"
      : "search";

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
        <Icon name={searchIcon} />
        <input
          aria-label="Buscar"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
        {searchQuery ? (
          <button
            aria-label="Limpiar búsqueda"
            className="sidebar-search-clear"
            onClick={() => onSearchChange?.("")}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 0,
              color: "var(--on-surface-variant)",
            }}
            type="button"
          >
            <Icon name="x" />
          </button>
        ) : null}
      </div>

      <nav className="sidebar-navigation" aria-label="Navegación multimedia">
        <SidebarSection title="PRINCIPAL" items={principalItems} activeView={activeView} onNavigate={onNavigate} />
        <SidebarSection title="BIBLIOTECA" items={dynamicLibraryItems} activeView={activeView} onNavigate={onNavigate} />
        <SidebarSection title="COLECCIONES" items={collectionItems} activeView={activeView} onNavigate={onNavigate} />
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
