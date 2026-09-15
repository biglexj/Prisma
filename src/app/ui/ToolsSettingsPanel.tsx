import { Icon, type IconName } from "../../shared/ui/Icon";
import { useSystemSettings, type ToolKey } from "../useSystemSettings";
import "./tools-settings-panel.css";

interface ToolItemDef {
  key: ToolKey;
  label: string;
  icon: IconName;
  description: string;
  tags: string[];
}

const TOOL_DEFINITIONS: ToolItemDef[] = [
  {
    key: "converter",
    label: "Conversor Multimedia",
    icon: "convert",
    description: "Conversión y transcodificación rápida de audio, vídeo y extracción de archivos comprimidos.",
    tags: [".mp4", ".mkv", ".webm", ".mp3", ".flac", ".opus", ".zip"],
  },
  {
    key: "renamer",
    label: "Renombrador por Lotes",
    icon: "edit",
    description: "Renombrado masivo inteligente con patrones de texto, prefijos, sufijos, numeración secuencial y vista previa en vivo.",
    tags: ["Numeración", "Prefijo / Sufijo", "Reemplazo", "Deshacer"],
  },
  {
    key: "duplicates",
    label: "Buscador de Duplicados",
    icon: "copy",
    description: "Detección exacta por hash, similitud perceptual visual (dHash) y comparativa cruzada de carpetas con upgrade HD/4K.",
    tags: ["Hash 100%", "Similitud dHash", "Comparar Carpetas", "Upgrade HD/4K"],
  },
  {
    key: "luna_fetch",
    label: "Luna Fetch",
    icon: "download",
    description: "Descarga de medios, audio y vídeo desde enlaces y plataformas web mediante el cliente Luna Fetch.",
    tags: ["Descargas Web", "YouTube", "Direct Download"],
  },
  {
    key: "gallery_dl",
    label: "Gallery-DL",
    icon: "layers",
    description: "Extracción y descarga automatizada de álbumes completos y galerías de imágenes desde la web.",
    tags: ["Galerías Web", "Manga / Arte", "Extracción por Lotes"],
  },
  {
    key: "prisma_upscaler",
    label: "Prisma Upscaler",
    icon: "expand",
    description: "Super-resolución neuronal de imágenes (2x, 4x) y aumento a ultra alta definición con IA acelerada por GPU.",
    tags: ["Super-Resolución", "IA NCNN Vulkan", "Aumento 4K", "RealESRGAN"],
  },
  {
    key: "wallpapers",
    label: "Wallpapers Aurora",
    icon: "sparkles",
    description: "Catálogo oficial en la nube de fondos de pantalla de alta resolución del ecosistema Aurora.",
    tags: ["Fondos 4K", "Servicio Oficial", "Descarga Directa"],
  },
];

export function ToolsSettingsPanel() {
  const { enabledTools, setToolEnabled } = useSystemSettings();

  return (
    <div className="tools-settings-panel">
      <div className="tools-header-banner">
        <div className="tools-header-text">
          <h2>Herramientas Integradas</h2>
          <p>
            Activa o desactiva las herramientas en la barra lateral de navegación según tu flujo de trabajo diario.
          </p>
        </div>
      </div>

      <div className="tools-cards-grid">
        {TOOL_DEFINITIONS.map((tool) => {
          const isEnabled = enabledTools[tool.key];
          return (
            <div
              key={tool.key}
              className={`tool-card ${isEnabled ? "is-active" : ""}`}
            >
              <div
                className="tool-card-top"
                onClick={() => setToolEnabled(tool.key, !isEnabled)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setToolEnabled(tool.key, !isEnabled);
                  }
                }}
                title={isEnabled ? "Desactivar de la barra lateral" : "Activar en la barra lateral"}
              >
                <div className="tool-card-icon-title">
                  <div className="tool-card-icon">
                    <Icon name={tool.icon} />
                  </div>
                  <div>
                    <h4>{tool.label}</h4>
                    <span className={`tool-card-tag ${isEnabled ? "is-active-tag" : ""}`}>
                      {isEnabled ? "● Habilitada" : "○ Deshabilitada"}
                    </span>
                  </div>
                </div>

                <label
                  className="tool-toggle-switch"
                  onClick={(e) => e.stopPropagation()}
                  title={isEnabled ? "Desactivar de la barra lateral" : "Activar en la barra lateral"}
                >
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setToolEnabled(tool.key, e.target.checked)}
                  />
                  <span className="tool-slider" />
                </label>
              </div>

              <p
                className="tool-card-desc"
                onClick={() => setToolEnabled(tool.key, !isEnabled)}
              >
                {tool.description}
              </p>

              <div className="tool-card-tags-pills">
                {tool.tags.map((tag) => (
                  <span className="tool-tag-pill" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
