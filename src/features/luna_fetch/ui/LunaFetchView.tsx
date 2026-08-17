import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import type { AppView } from "../../../app/ui/AppSidebar";
import "./luna-fetch.css";

interface LunaFetchViewProps {
  onNavigate: (view: AppView) => void;
}

type MediaFormat = "video_mp4" | "video_webm" | "audio_mp3" | "audio_m4a";

const FORMAT_OPTIONS: { id: MediaFormat; label: string; isAudio: boolean; short: string }[] = [
  { id: "video_mp4", label: "Video MP4", isAudio: false, short: "MP4" },
  { id: "video_webm", label: "Video WebM", isAudio: false, short: "WebM" },
  { id: "audio_mp3", label: "Audio MP3", isAudio: true, short: "MP3" },
  { id: "audio_m4a", label: "Audio M4A", isAudio: true, short: "M4A" },
];

const VIDEO_QUALITIES = [
  { id: "1080p", label: "1080p · Full HD" },
  { id: "2160p", label: "2160p · 4K Ultra HD" },
  { id: "1440p", label: "1440p · 2K Quad HD" },
  { id: "720p", label: "720p · HD" },
  { id: "480p", label: "480p · SD" },
  { id: "best", label: "Mejor calidad disponible" },
];

const AUDIO_QUALITIES = [
  { id: "320k", label: "320 kbps · Máxima" },
  { id: "256k", label: "256 kbps · Alta" },
  { id: "192k", label: "192 kbps · Estándar" },
  { id: "128k", label: "128 kbps · Media" },
  { id: "best", label: "Mejor calidad disponible" },
];

export function LunaFetchView({ onNavigate }: LunaFetchViewProps) {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<MediaFormat>("video_mp4");
  const [quality, setQuality] = useState<string>("1080p");
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const selectedFormatObj = FORMAT_OPTIONS.find((f) => f.id === format) || FORMAT_OPTIONS[0];
  const isAudio = selectedFormatObj.isAudio;
  const qualityList = isAudio ? AUDIO_QUALITIES : VIDEO_QUALITIES;

  const handleFormatChange = (newFormat: MediaFormat) => {
    setFormat(newFormat);
    const targetObj = FORMAT_OPTIONS.find((f) => f.id === newFormat);
    if (targetObj?.isAudio && !isAudio) {
      setQuality("320k");
    } else if (!targetObj?.isAudio && isAudio) {
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
      const launched = await invoke<boolean>("launch_luna_fetch", {
        url: targetUrl.trim() ? targetUrl.trim() : null,
        format: format.replace("video_", "").replace("audio_", ""),
        quality: quality,
      });

      if (launched) {
        setStatusMessage({
          text: targetUrl.trim()
            ? `¡Enlace enviado a Luna Fetch (${selectedFormatObj.short} · ${quality}) con éxito!`
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
        {/* ── Caja de Descarga Rápida con Parámetros ── */}
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

            {/* Selector inline: Formato */}
            <div className="luna-inline-select-pill" title="Seleccionar formato">
              <Icon name={isAudio ? "music" : "video"} />
              <select
                aria-label="Formato de descarga"
                value={format}
                onChange={(e) => handleFormatChange(e.target.value as MediaFormat)}
              >
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Icon name="chevron-down" className="select-chevron-icon" />
            </div>

            {/* Selector inline: Calidad */}
            <div className="luna-inline-select-pill" title="Seleccionar calidad">
              <Icon name="sliders" />
              <select
                aria-label="Calidad de descarga"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
              >
                {qualityList.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </select>
              <Icon name="chevron-down" className="select-chevron-icon" />
            </div>

            <button
              className="luna-fetch-btn primary"
              onClick={() => void handleLaunchLunaFetch(url)}
              disabled={!url.trim() || isLaunching}
              type="button"
            >
              <Icon name="download" />
              <span>Descargar {selectedFormatObj.short}</span>
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
