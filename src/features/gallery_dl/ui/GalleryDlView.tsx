import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon, type IconName } from "../../../shared/ui/Icon";
import type { AppView } from "../../../app/ui/AppSidebar";
import galleryDlLogo from "../../../assets/icons/gallery-dl.png";
import "./gallery-dl.css";

interface GalleryDlViewProps {
  onNavigate: (view: AppView) => void;
}

type DirectoryStructure = "Flat" | "CollectionOnly" | "AuthorCollection" | "Default";

interface DropdownOption<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
}

const STRUCTURE_OPTIONS: DropdownOption<DirectoryStructure>[] = [
  { id: "Flat", label: "Sin Subcarpetas", icon: "folder" },
  { id: "CollectionOnly", label: "Solo Carpeta de Colección", icon: "layers" },
  { id: "AuthorCollection", label: "Autor / Colección", icon: "image" },
  { id: "Default", label: "Estructura Completa", icon: "folder-open" },
];

interface GalleryDropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (val: T) => void;
  leadingIcon: IconName;
  title: string;
}

function GalleryDropdown<T extends string>({
  value,
  options,
  onChange,
  leadingIcon,
  title,
}: GalleryDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption = options.find((o) => o.id === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="gallery-dl-custom-select-container" ref={containerRef}>
      <button
        type="button"
        className={`gallery-dl-inline-select-pill ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Icon name={currentOption.icon || leadingIcon} />
        <span className="gallery-dl-select-value">{currentOption.label}</span>
        <Icon name="chevron-down" className={`select-chevron-icon ${isOpen ? "is-rotated" : ""}`} />
      </button>

      {isOpen && (
        <div className="gallery-dl-custom-dropdown-menu" role="listbox">
          {options.map((opt) => {
            const isSelected = opt.id === value;
            return (
              <button
                type="button"
                key={opt.id}
                role="option"
                aria-selected={isSelected}
                className={`gallery-dl-dropdown-item ${isSelected ? "is-selected" : ""}`}
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                }}
              >
                <div className="gallery-dl-item-content">
                  {opt.icon && <Icon name={opt.icon} />}
                  <span className="gallery-dl-item-label">{opt.label}</span>
                </div>
                {isSelected && <Icon name="check" className="gallery-dl-check-icon" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function GalleryDlView({ onNavigate }: GalleryDlViewProps) {
  const [url, setUrl] = useState("");
  const [structure, setStructure] = useState<DirectoryStructure>("CollectionOnly");
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith("http://") || text.startsWith("https://"))) {
        setUrl(text.trim());
        setStatusMessage({ text: "Enlace de galería pegado desde el portapapeles", type: "info" });
      } else {
        setStatusMessage({ text: "El portapapeles no contiene una URL válida", type: "error" });
      }
    } catch {
      setStatusMessage({ text: "No se pudo acceder al portapapeles", type: "error" });
    }
  };

  const handleLaunchGalleryDl = async (customUrl?: string) => {
    setIsLaunching(true);
    const targetUrl = customUrl !== undefined ? customUrl : url;
    try {
      const launched = await invoke<boolean>("launch_gallery_dl", {
        url: targetUrl.trim() ? targetUrl.trim() : null,
        directoryStructure: structure,
      });

      if (launched) {
        setStatusMessage({
          text: targetUrl.trim()
            ? "¡Galería enviada a Gallery-DL GUI con éxito!"
            : "¡Gallery-DL GUI iniciado en el escritorio!",
          type: "success",
        });
        if (targetUrl.trim()) {
          setUrl("");
        }
      } else {
        setStatusMessage({
          text: "Abriendo la página oficial de Gallery-DL GUI para su instalación...",
          type: "info",
        });
        void invoke("open_external_url", { url: "https://github.com/biglexj/Gallery-DL-GUI/releases" });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({
        text: "Error al comunicar con Gallery-DL GUI. Abriendo repositorio oficial...",
        type: "error",
      });
      void invoke("open_external_url", { url: "https://github.com/biglexj/Gallery-DL-GUI/releases" });
    } finally {
      setIsLaunching(false);
    }
  };

  const openDownloadsInExplorer = async () => {
    try {
      const downloadsDir = await invoke<string>("synapse_get_downloads_dir");
      await invoke("open_in_file_manager", { path: downloadsDir });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="gallery-dl-view">
      {/* ── Banner Principal ── */}
      <header className="gallery-dl-header">
        <div className="gallery-dl-header-content">
          <div className="gallery-dl-brand">
            <div className="gallery-dl-icon-badge">
              <img src={galleryDlLogo} alt="Gallery-DL" />
            </div>
            <div>
              <div className="gallery-dl-title-row">
                <h1>Gallery-DL</h1>
                <span className="gallery-dl-pill">Ecosistema biglexj</span>
              </div>
              <p className="gallery-dl-subtitle">
                Descargador masivo de álbumes, galerías y colecciones de imágenes conectado con Prisma.
              </p>
            </div>
          </div>

          <div className="gallery-dl-actions">
            <button
              className="gallery-dl-btn secondary"
              onClick={() => void handleLaunchGalleryDl()}
              disabled={isLaunching}
              type="button"
            >
              <Icon name="external-link" />
              <span>Abrir Gallery-DL GUI</span>
            </button>
            <button
              className="gallery-dl-btn outline"
              onClick={() => void invoke("open_external_url", { url: "https://github.com/biglexj/Gallery-DL-GUI" })}
              type="button"
            >
              <Icon name="github" />
              <span>Repositorio</span>
            </button>
          </div>
        </div>
      </header>

      <div className="gallery-dl-body">
        {/* ── Caja de Descarga Masiva de Galerías ── */}
        <section className="gallery-dl-card input-hero-card">
          <div className="card-header-simple">
            <Icon name="link" />
            <h2>Descarga Masiva de Galerías y Álbumes</h2>
          </div>
          <p className="card-description">
            Introduce la URL de una galería, álbum o perfil de arte (Pixiv, ArtStation, Reddit, Danbooru, Twitter/X, Instagram, etc.) para procesar todas sus imágenes en lote con Gallery-DL.
          </p>

          <div className="gallery-dl-input-group">
            <div className="input-with-icon">
              <Icon name="search" />
              <input
                type="url"
                placeholder="Pega acá la URL de la galería (Pixiv, ArtStation, Danbooru, Reddit, Twitter/X...)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && url.trim()) {
                    void handleLaunchGalleryDl(url);
                  }
                }}
              />
            </div>
            <button
              className="gallery-dl-btn subtle"
              onClick={() => void handlePaste()}
              type="button"
              title="Pegar enlace del portapapeles"
            >
              <Icon name="copy" />
              <span>Pegar</span>
            </button>

            {/* Selector de Estructura */}
            <GalleryDropdown
              value={structure}
              options={STRUCTURE_OPTIONS}
              onChange={setStructure}
              leadingIcon="folder"
              title="Estructura de salida de carpetas"
            />

            <button
              className="gallery-dl-btn primary"
              onClick={() => void handleLaunchGalleryDl(url)}
              disabled={!url.trim() || isLaunching}
              type="button"
            >
              <Icon name="download" />
              <span>Descargar Galería</span>
            </button>
          </div>

          {statusMessage && (
            <div className={`gallery-dl-status-bar is-${statusMessage.type}`}>
              <span>{statusMessage.text}</span>
              <button
                className="status-close-btn"
                onClick={() => setStatusMessage(null)}
                type="button"
              >
                <Icon name="close" />
              </button>
            </div>
          )}
        </section>

        {/* ── Gestión de Contenidos Descargados ── */}
        <section className="gallery-dl-card bridge-card">
          <div className="card-header-simple">
            <Icon name="synapse" />
            <h2>Integración y Sinergia con Prisma</h2>
          </div>
          <p className="card-description">
            Las colecciones y álbumes descargados con Gallery-DL se integran de inmediato en la galería visual y el conversor por lotes de Prisma.
          </p>

          <div className="bridge-actions-grid">
            <button
              className="bridge-action-tile"
              onClick={() => onNavigate("images")}
              type="button"
            >
              <div className="tile-icon"><Icon name="image" /></div>
              <div className="tile-info">
                <strong>Explorar Galería de Imágenes</strong>
                <span>Visualizar, filtrar y editar fotos con zoom hasta 500%</span>
              </div>
            </button>

            <button
              className="bridge-action-tile"
              onClick={() => onNavigate("converter")}
              type="button"
            >
              <div className="tile-icon"><Icon name="sliders" /></div>
              <div className="tile-info">
                <strong>Convertidor Prisma</strong>
                <span>Redimensionar por lotes o convertir a WebP/AVIF</span>
              </div>
            </button>

            <button
              className="bridge-action-tile"
              onClick={() => void openDownloadsInExplorer()}
              type="button"
            >
              <div className="tile-icon"><Icon name="folder-open" /></div>
              <div className="tile-info">
                <strong>Abrir Carpeta de Descargas</strong>
                <span>Ver los álbumes organizados en el Explorador</span>
              </div>
            </button>

            <button
              className="bridge-action-tile"
              onClick={() => void handleLaunchGalleryDl()}
              type="button"
            >
              <div className="tile-icon"><Icon name="external-link" /></div>
              <div className="tile-info">
                <strong>Abrir Gallery-DL GUI</strong>
                <span>Gestionar colas activas y configuración avanzada</span>
              </div>
            </button>
          </div>
        </section>

        {/* ── Capacidades de Gallery-DL ── */}
        <div className="gallery-dl-features-grid">
          <div className="feature-card">
            <span className="feature-badge">Descarga Masiva</span>
            <h3>Álbumes y Perfiles Completos</h3>
            <p>
              Obtén cientos de ilustraciones y fotografías en un solo proceso con numeración ordenada y metadatos preservados.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-badge">+100 Sitios</span>
            <h3>Extractores Especializados</h3>
            <p>
              Compatibilidad con plataformas líderes de ilustración (Pixiv, ArtStation, Danbooru, Reddit, Instagram, etc.).
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-badge">Organización</span>
            <h3>Estructura Personalizable</h3>
            <p>
              Clasifica automáticamente las imágenes en carpetas individuales por artista, dominio o en un directorio plano listo para proyectar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
