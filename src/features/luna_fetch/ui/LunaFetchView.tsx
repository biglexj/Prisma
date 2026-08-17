import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon, type IconName } from "../../../shared/ui/Icon";
import type { AppView } from "../../../app/ui/AppSidebar";
import "./luna-fetch.css";

interface LunaFetchViewProps {
  onNavigate: (view: AppView) => void;
}

type MediaFormat = "video_mp4" | "video_webm" | "audio_mp3" | "audio_m4a";

interface DropdownOption<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
}

const FORMAT_OPTIONS: DropdownOption<MediaFormat>[] = [
  { id: "video_mp4", label: "Video MP4", icon: "video" },
  { id: "video_webm", label: "Video WebM", icon: "video" },
  { id: "audio_mp3", label: "Audio MP3", icon: "music" },
  { id: "audio_m4a", label: "Audio M4A", icon: "music" },
];

const VIDEO_QUALITIES: DropdownOption<string>[] = [
  { id: "1080p", label: "1080p · Full HD" },
  { id: "2160p", label: "2160p · 4K Ultra HD" },
  { id: "1440p", label: "1440p · 2K Quad HD" },
  { id: "720p", label: "720p · HD" },
  { id: "480p", label: "480p · SD" },
  { id: "best", label: "Mejor disponible" },
];

const AUDIO_QUALITIES: DropdownOption<string>[] = [
  { id: "320k", label: "320 kbps · Máxima" },
  { id: "256k", label: "256 kbps · Alta" },
  { id: "192k", label: "192 kbps · Estándar" },
  { id: "128k", label: "128 kbps · Media" },
  { id: "best", label: "Mejor disponible" },
];

interface LunaDropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (val: T) => void;
  leadingIcon: IconName;
  title: string;
}

function LunaDropdown<T extends string>({
  value,
  options,
  onChange,
  leadingIcon,
  title,
}: LunaDropdownProps<T>) {
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
    <div className="luna-custom-select-container" ref={containerRef}>
      <button
        type="button"
        className={`luna-inline-select-pill ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Icon name={currentOption.icon || leadingIcon} />
        <span className="luna-select-value">{currentOption.label}</span>
        <Icon name="chevron-down" className={`select-chevron-icon ${isOpen ? "is-rotated" : ""}`} />
      </button>

      {isOpen && (
        <div className="luna-custom-dropdown-menu" role="listbox">
          {options.map((opt) => {
            const isSelected = opt.id === value;
            return (
              <button
                type="button"
                key={opt.id}
                role="option"
                aria-selected={isSelected}
                className={`luna-dropdown-item ${isSelected ? "is-selected" : ""}`}
                onClick={() => {
                  onChange(opt.id);
                  setIsOpen(false);
                }}
              >
                <div className="luna-item-content">
                  {opt.icon && <Icon name={opt.icon} />}
                  <span className="luna-item-label">{opt.label}</span>
                </div>
                {isSelected && <Icon name="check" className="luna-check-icon" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function LunaFetchView({ onNavigate }: LunaFetchViewProps) {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<MediaFormat>("video_mp4");
  const [quality, setQuality] = useState<string>("1080p");
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const isAudio = format.startsWith("audio_");
  const qualityList = isAudio ? AUDIO_QUALITIES : VIDEO_QUALITIES;

  const handleFormatChange = (newFormat: MediaFormat) => {
    setFormat(newFormat);
    const newIsAudio = newFormat.startsWith("audio_");
    if (newIsAudio && !isAudio) {
      setQuality("320k");
    } else if (!newIsAudio && isAudio) {
      setQuality("1080p");
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith("http://") || text.startsWith("https://"))) {
        setUrl(text.trim());
        setStatusMessage({ text: "Enlace pegado desde el portapapeles", type: "info" });
      } else {
        setStatusMessage({ text: "El portapapeles no contiene una URL válida", type: "error" });
      }
    } catch {
      setStatusMessage({ text: "No se pudo acceder al portapapeles", type: "error" });
    }
  };

  const handleLaunchLunaFetch = async (customUrl?: string) => {
    setIsLaunching(true);
    const targetUrl = customUrl !== undefined ? customUrl : url;
    try {
      const formatShort = format.replace("video_", "").replace("audio_", "");
      const launched = await invoke<boolean>("launch_luna_fetch", {
        url: targetUrl.trim() ? targetUrl.trim() : null,
        format: formatShort,
        quality: quality,
      });

      if (launched) {
        setStatusMessage({
          text: targetUrl.trim()
            ? `¡Enlace enviado a Luna Fetch (${formatShort.toUpperCase()} · ${quality}) con éxito!`
            : "¡Luna Fetch iniciado en el escritorio!",
          type: "success",
        });
        if (targetUrl.trim()) {
          setUrl("");
        }
      } else {
        setStatusMessage({
          text: "Abriendo la página oficial de Luna Fetch para su instalación...",
          type: "info",
        });
        void invoke("open_external_url", { url: "https://github.com/biglexj/Luna---Fetch/releases" });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({
        text: "Error al comunicar con Luna Fetch. Abriendo repositorio oficial...",
        type: "error",
      });
      void invoke("open_external_url", { url: "https://github.com/biglexj/Luna---Fetch/releases" });
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

  const formatButtonLabel = format.replace("video_", "").replace("audio_", "").toUpperCase();

  return (
    <div className="luna-fetch-view">
      {/* ── Banner Principal ── */}
      <header className="luna-fetch-header">
        <div className="luna-fetch-header-content">
          <div className="luna-fetch-brand">
            <div className="luna-fetch-icon-badge">
              <Icon name="download" />
            </div>
            <div>
              <div className="luna-fetch-title-row">
                <h1>Luna Fetch</h1>
                <span className="luna-fetch-pill">Ecosistema biglexj</span>
              </div>
              <p className="luna-fetch-subtitle">
                Gestor y analizador de descargas multimedia de alta fidelidad conectado con Prisma.
              </p>
            </div>
          </div>

          <div className="luna-fetch-actions">
            <button
              className="luna-fetch-btn secondary"
              onClick={() => void handleLaunchLunaFetch()}
              disabled={isLaunching}
              type="button"
            >
              <Icon name="external-link" />
              <span>Abrir Luna Fetch</span>
            </button>
            <button
              className="luna-fetch-btn outline"
              onClick={() => void invoke("open_external_url", { url: "https://github.com/biglexj/Luna---Fetch" })}
              type="button"
            >
              <Icon name="github" />
              <span>Repositorio</span>
            </button>
          </div>
        </div>
      </header>

      <div className="luna-fetch-body">
        {/* ── Caja de Descarga Rápida con Parámetros Inline ── */}
        <section className="luna-fetch-card input-hero-card">
          <div className="card-header-simple">
            <Icon name="link" />
            <h2>Descarga Rápida de Medios</h2>
          </div>
          <p className="card-description">
            Introduce el enlace de un vídeo o pista de audio (YouTube, SoundCloud, Vimeo, TikTok, etc.) y selecciona el formato y calidad deseados para enviarlos a Luna Fetch.
          </p>

          <div className="luna-fetch-input-group">
            <div className="input-with-icon">
              <Icon name="search" />
              <input
                type="url"
                placeholder="Pega acá la URL (YouTube, TikTok, SoundCloud, Instagram...)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && url.trim()) {
                    void handleLaunchLunaFetch(url);
                  }
                }}
              />
            </div>
            <button
              className="luna-fetch-btn subtle"
              onClick={() => void handlePaste()}
              type="button"
              title="Pegar enlace del portapapeles"
            >
              <Icon name="copy" />
              <span>Pegar</span>
            </button>

            {/* Selector Rediseñado: Formato */}
            <LunaDropdown
              value={format}
              options={FORMAT_OPTIONS}
              onChange={handleFormatChange}
              leadingIcon={isAudio ? "music" : "video"}
              title="Formato de descarga"
            />

            {/* Selector Rediseñado: Calidad */}
            <LunaDropdown
              value={quality}
              options={qualityList}
              onChange={setQuality}
              leadingIcon="sliders"
              title="Calidad de descarga"
            />

            <button
              className="luna-fetch-btn primary"
              onClick={() => void handleLaunchLunaFetch(url)}
              disabled={!url.trim() || isLaunching}
              type="button"
            >
              <Icon name="download" />
              <span>Descargar {formatButtonLabel}</span>
            </button>
          </div>

          {statusMessage && (
            <div className={`luna-fetch-status-bar is-${statusMessage.type}`}>
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
        <section className="luna-fetch-card bridge-card">
          <div className="card-header-simple">
            <Icon name="synapse" />
            <h2>Integración y Sinergia con Prisma</h2>
          </div>
          <p className="card-description">
            Todo el material descargado con Luna Fetch se encuentra disponible para su reproducción local-first inmediata en Prisma.
          </p>

          <div className="bridge-actions-grid">
            <button
              className="bridge-action-tile"
              onClick={() => onNavigate("music")}
              type="button"
            >
              <div className="tile-icon"><Icon name="music" /></div>
              <div className="tile-info">
                <strong>Explorar Música</strong>
                <span>Reproducir pistas descargadas en alta fidelidad</span>
              </div>
            </button>

            <button
              className="bridge-action-tile"
              onClick={() => onNavigate("videos")}
              type="button"
            >
              <div className="tile-icon"><Icon name="video" /></div>
              <div className="tile-info">
                <strong>Explorar Vídeos</strong>
                <span>Ver vídeos con subtítulos y modo PiP adaptable</span>
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
                <span>Extraer audio, cambiar formatos o redimensionar</span>
              </div>
            </button>

            <button
              className="bridge-action-tile"
              onClick={() => void openDownloadsInExplorer()}
              type="button"
            >
              <div className="tile-icon"><Icon name="folder-open" /></div>
              <div className="tile-info">
                <strong>Abrir Carpeta</strong>
                <span>Ver la carpeta de descargas en el Explorador</span>
              </div>
            </button>
          </div>
        </section>

        {/* ── Capacidades de Luna Fetch ── */}
        <div className="luna-fetch-features-grid">
          <div className="feature-card">
            <span className="feature-badge">Audio Hi-Fi</span>
            <h3>Extracción y Portadas Embebidas</h3>
            <p>
              Convierte a MP3 y M4A preservando metadatos completos (artista, título, álbum) y carátulas oficiales incrustadas.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-badge">Ultra HD</span>
            <h3>Vídeo hasta 4K y 60 FPS</h3>
            <p>
              Descarga vídeos en la máxima resolución disponible (MP4/WebM) listos para proyectar en Prisma con control fluido de velocidad.
            </p>
          </div>

          <div className="feature-card">
            <span className="feature-badge">Sin Cables</span>
            <h3>Aurora Synapse Handoff</h3>
            <p>
              Conexión directa entre aplicaciones del ecosistema sin cuentas en la nube ni servicios intermediarios.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
