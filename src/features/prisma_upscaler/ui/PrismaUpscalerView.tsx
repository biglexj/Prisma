import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../shared/ui/Icon";
import type { AppView } from "../../../app/ui/AppSidebar";
import "./prisma-upscaler.css";

interface PrismaUpscalerViewProps {
  onNavigate?: (view: AppView) => void;
}

interface UpscalerModel {
  id: string;
  name: string;
  description: string;
  badge: string;
}

const MODELS: UpscalerModel[] = [
  {
    id: "realesrgan-x4plus-anime",
    name: "RealESRGAN Anime x4+",
    description: "Especializado en arte digital, anime, manga e ilustraciones con líneas nítidas.",
    badge: "Anime / Arte",
  },
  {
    id: "realesrgan-x4plus",
    name: "RealESRGAN x4+ General",
    description: "Restaura fotografías reales, texturas complejas y retratos con alta fidelidad.",
    badge: "Fotografía",
  },
  {
    id: "compact",
    name: "RealESRGANv2 Compact",
    description: "Modelo ultraligero de baja latencia y consumo mínimo de VRAM para procesamiento rápido.",
    badge: "Ultrarrápido",
  },
];

const SCALES = [
  { value: 2, label: "2x", sub: "Duplicar" },
  { value: 3, label: "3x", sub: "Intermedio" },
  { value: 4, label: "4x", sub: "Ultra HD" },
];

export function PrismaUpscalerView({ onNavigate }: PrismaUpscalerViewProps) {
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("realesrgan-x4plus-anime");
  const [selectedScale, setSelectedScale] = useState<number>(4);
  const [isLaunching, setIsLaunching] = useState(false);
  const [serverUrl, setServerUrl] = useState("http://localhost:8085");
  const [serverHealth, setServerHealth] = useState<"idle" | "checking" | "online" | "offline">("idle");
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Imágenes compatibles",
            extensions: ["png", "jpg", "jpeg", "webp"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setSelectedPath(selected);
        setStatusMessage(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && (text.endsWith(".png") || text.endsWith(".jpg") || text.endsWith(".jpeg") || text.endsWith(".webp"))) {
        setSelectedPath(text.trim());
        setStatusMessage({ text: "Ruta de imagen pegada desde el portapapeles.", type: "success" });
      } else {
        setStatusMessage({ text: "El portapapeles no contiene una ruta de imagen válida.", type: "info" });
      }
    } catch {
      setStatusMessage({ text: "No se pudo leer el portapapeles.", type: "error" });
    }
  };

  const handleLaunchUpscaler = async (customPath?: string) => {
    setIsLaunching(true);
    const targetPath = customPath !== undefined ? customPath : selectedPath;
    try {
      const launched = await invoke<boolean>("launch_prisma_upscaler", {
        filePath: targetPath.trim() ? targetPath.trim() : null,
      });

      if (launched) {
        setStatusMessage({
          text: targetPath.trim()
            ? "¡Imagen enviada a Prisma Upscaler exitosamente!"
            : "¡Prisma Upscaler iniciado en el escritorio!",
          type: "success",
        });
      } else {
        setStatusMessage({
          text: "Prisma Upscaler no está instalado en este equipo. Abriendo repositorio oficial...",
          type: "info",
        });
        void invoke("open_external_url", { url: "https://github.com/biglexj/prisma-upscaler/releases" });
      }
    } catch (err) {
      console.error(err);
      setStatusMessage({
        text: "Error al comunicar con Prisma Upscaler. Abriendo página de lanzamientos...",
        type: "error",
      });
      void invoke("open_external_url", { url: "https://github.com/biglexj/prisma-upscaler/releases" });
    } finally {
      setIsLaunching(false);
    }
  };

  const handleCheckServer = async () => {
    setServerHealth("checking");
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${serverUrl.replace(/\/+$/, "")}/api/v1/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        setServerHealth("online");
      } else {
        setServerHealth("offline");
      }
    } catch {
      setServerHealth("offline");
    }
  };

  return (
    <div className="prisma-upscaler-view">
      {/* ── Banner Principal ── */}
      <header className="upscaler-header">
        <div className="upscaler-header-content">
          <div className="upscaler-brand">
            <div className="upscaler-icon-badge">
              <img src="/icons/prisma-upscaler/icon.webp" alt="Prisma Upscaler" />
            </div>
            <div>
              <div className="upscaler-title-row">
                <h1>Prisma Upscaler</h1>
                <span className="upscaler-pill">Ecosistema biglexj · IA Neuronal</span>
              </div>
              <p className="upscaler-subtitle">
                Suite de super-resolución e inferencia neuronal de imágenes con aceleración por GPU (NVIDIA Vulkan / NCNN).
              </p>
            </div>
          </div>

          <div className="upscaler-actions">
            <button
              className="upscaler-btn secondary"
              onClick={() => void handleLaunchUpscaler()}
              disabled={isLaunching}
              type="button"
            >
              <Icon name="external-link" />
              <span>Abrir App Desktop</span>
            </button>
            <button
              className="upscaler-btn outline"
              onClick={() => void invoke("open_external_url", { url: "https://github.com/biglexj/prisma-upscaler" })}
              type="button"
            >
              <Icon name="github" />
              <span>Repositorio</span>
            </button>
          </div>
        </div>
      </header>

      <div className="upscaler-body">
        {/* ── Tarjeta de Lanzador y Selección Rápida ── */}
        <section className="upscaler-card upscaler-launcher-card">
          <div className="upscaler-card-header">
            <div className="upscaler-card-icon-wrap">
              <Icon name="sparkles" />
            </div>
            <div>
              <h2>Lanzador Rápido de Super-Resolución</h2>
              <p>Selecciona una imagen para enviarla con parámetros preconfigurados directamente a la suite de escalado.</p>
            </div>
          </div>

          <div className="upscaler-input-group">
            <div className="upscaler-path-box">
              <Icon name="image" />
              <input
                type="text"
                placeholder="Ruta del archivo de imagen (.png, .jpg, .webp)..."
                value={selectedPath}
                onChange={(e) => setSelectedPath(e.target.value)}
              />
              {selectedPath && (
                <button
                  type="button"
                  className="upscaler-clear-btn"
                  onClick={() => setSelectedPath("")}
                  title="Limpiar"
                >
                  <Icon name="x" />
                </button>
              )}
            </div>

            <div className="upscaler-path-actions">
              <button
                type="button"
                className="upscaler-btn text-icon"
                onClick={() => void handleSelectFile()}
                title="Examinar archivo en tu equipo"
              >
                <Icon name="folder" />
                <span>Explorar</span>
              </button>
              <button
                type="button"
                className="upscaler-btn text-icon"
                onClick={() => void handlePasteClipboard()}
                title="Pegar ruta desde el portapapeles"
              >
                <Icon name="copy" />
                <span>Pegar</span>
              </button>
            </div>
          </div>

          {/* Opciones de Modelo */}
          <div className="upscaler-options-row">
            <div className="upscaler-models-col">
              <label className="upscaler-label">Modelo Neuronal Recomendado</label>
              <div className="upscaler-models-grid">
                {MODELS.map((m) => (
                  <div
                    key={m.id}
                    className={`upscaler-model-chip ${selectedModel === m.id ? "is-selected" : ""}`}
                    onClick={() => setSelectedModel(m.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="model-chip-header">
                      <strong>{m.name}</strong>
                      <span className="model-badge">{m.badge}</span>
                    </div>
                    <p>{m.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Escala */}
            <div className="upscaler-scale-col">
              <label className="upscaler-label">Factor de Escala</label>
              <div className="upscaler-scales-grid">
                {SCALES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className={`upscaler-scale-btn ${selectedScale === s.value ? "is-active" : ""}`}
                    onClick={() => setSelectedScale(s.value)}
                  >
                    <span className="scale-number">{s.label}</span>
                    <span className="scale-sub">{s.sub}</span>
                  </button>
                ))}
              </div>

              {/* Botón de Lanzamiento Primario */}
              <button
                type="button"
                className="upscaler-launch-cta"
                onClick={() => void handleLaunchUpscaler()}
                disabled={isLaunching}
              >
                <Icon name="sparkles" />
                <span>Abrir en Prisma Upscaler</span>
              </button>
            </div>
          </div>

          {statusMessage && (
            <div className={`upscaler-status-alert is-${statusMessage.type}`}>
              <Icon name={statusMessage.type === "success" ? "check" : "info"} />
              <span>{statusMessage.text}</span>
            </div>
          )}
        </section>

        {/* ── Cuadrícula de Sinergia y Arquitectura ── */}
        <section className="upscaler-features-grid">
          <div className="upscaler-feature-card">
            <div className="feature-icon is-gpu">
              <Icon name="hard-drive" />
            </div>
            <h3>Inferencia en GPU Desacoplada</h3>
            <p>
              Prisma Upscaler delega el trabajo pesado de redes neuronales a una GPU dedicada NVIDIA Vulkan sin congelar ni estresar térmicamente tu estación de trabajo.
            </p>
          </div>

          <div className="upscaler-feature-card">
            <div className="feature-icon is-shield">
              <Icon name="sliders" />
            </div>
            <h3>Semáforo Concurrente Unitario</h3>
            <p>
              Protección anti-OOM (Out-of-Memory). Procesa exactamente una tarea a la vez en cola estricta para garantizar cero colapsos y óptima refrigeración.
            </p>
          </div>

          <div className="upscaler-feature-card">
            <div className="feature-icon is-sync">
              <Icon name="refresh" />
            </div>
            <h3>Sinergia Ecosistema Aurora</h3>
            <p>
              Conéctate tanto en modo local (esta misma PC) como a través de la red local LAN hacia nodos remotos registrados en el ecosistema Aurora Synapse.
            </p>
          </div>
        </section>

        {/* ── Tarjeta de Estado del Daemon Neuronal ── */}
        <section className="upscaler-card upscaler-daemon-card">
          <div className="daemon-header-row">
            <div>
              <h3>Daemon Neuronal (Axum / NCNN)</h3>
              <p>Monitoreo del microservicio de inferencia local o remoto en la red:</p>
            </div>
            <div className="daemon-status-badge">
              <span className={`status-dot is-${serverHealth}`} />
              <span>
                {serverHealth === "idle" && "Sin comprobar"}
                {serverHealth === "checking" && "Comprobando..."}
                {serverHealth === "online" && "Servidor en Línea"}
                {serverHealth === "offline" && "Servidor no detectado"}
              </span>
            </div>
          </div>

          <div className="daemon-controls">
            <div className="daemon-url-input">
              <Icon name="server" />
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => {
                  setServerUrl(e.target.value);
                  setServerHealth("idle");
                }}
                placeholder="http://localhost:8085"
              />
            </div>
            <button
              type="button"
              className="upscaler-btn secondary"
              onClick={() => void handleCheckServer()}
              disabled={serverHealth === "checking"}
            >
              <Icon name="refresh" />
              <span>Comprobar Salud</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
