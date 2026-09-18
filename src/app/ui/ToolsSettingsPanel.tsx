import { Icon, type IconName } from "../../shared/ui/Icon";
import { useSystemSettings, type ToolKey } from "../useSystemSettings";
import "./tools-settings-panel.css";

type ToolCategory = "native" | "ecosystem";

interface ToolItemDef {
  key: ToolKey;
  label: string;
  icon: IconName;
  description: string;
  tags: string[];
  category: ToolCategory;
}

const TOOL_DEFINITIONS: ToolItemDef[] = [
  // ── Herramientas Nativas ──
  {
    key: "converter",
    label: "Conversor Multimedia",
    icon: "convert",
    description: "Conversión y transcodificación rápida de audio, vídeo y extracción de archivos comprimidos.",
    tags: [".mp4", ".mkv", ".webm", ".mp3", ".flac", ".opus", ".zip"],
    category: "native",
  },
  {
    key: "renamer",
    label: "Renombrador por Lotes",
    icon: "edit",
    description: "Renombrado masivo inteligente con patrones de texto, prefijos, sufijos, numeración secuencial y vista previa en vivo.",
    tags: ["Numeración", "Prefijo / Sufijo", "Reemplazo", "Deshacer"],
    category: "native",
  },
  {
    key: "comparator",
    label: "Comparador Multimedia",
    icon: "compare",
    description: "Comparativa interactiva lado a lado, cortinilla antes/después, alternar rápido A/B y cuadrícula multi-imagen con zoom sincronizado.",
    tags: ["Lado a Lado", "Cortinilla", "Alternar A/B", "Zoom Sincronizado"],
    category: "native",
  },
  {
    key: "duplicates",
    label: "Buscador de Duplicados",
    icon: "copy",
    description: "Detección exacta por hash, similitud perceptual visual (dHash) y comparativa cruzada de carpetas con upgrade HD/4K.",
    tags: ["Hash 100%", "Similitud dHash", "Comparar Carpetas", "Upgrade HD/4K"],
    category: "native",
  },

  // ── Herramientas de Aurora Synapse / Ecosistema ──
  {
    key: "luna_fetch",
    label: "Luna Fetch",
    icon: "download",
    description: "Descarga de medios, audio y vídeo desde enlaces y plataformas web mediante el cliente Luna Fetch.",
    tags: ["Descargas Web", "YouTube", "Direct Download"],
    category: "ecosystem",
  },
  {
    key: "gallery_dl",
    label: "Gallery-DL",
    icon: "layers",
    description: "Extracción y descarga automatizada de álbumes completos y galerías de imágenes desde la web.",
    tags: ["Galerías Web", "Manga / Arte", "Extracción por Lotes"],
    category: "ecosystem",
  },
  {
    key: "prisma_upscaler",
    label: "Prisma Upscaler",
    icon: "expand",
    description: "Super-resolución neuronal de imágenes (2x, 4x) y aumento a ultra alta definición con IA acelerada por GPU.",
    tags: ["Super-Resolución", "IA NCNN Vulkan", "Aumento 4K", "RealESRGAN"],
    category: "ecosystem",
  },
  {
    key: "wallpapers",
    label: "Wallpapers Aurora",
    icon: "sparkles",
    description: "Catálogo oficial en la nube de fondos de pantalla de alta resolución del ecosistema Aurora.",
    tags: ["Fondos 4K", "Servicio Oficial", "Descarga Directa"],
    category: "ecosystem",
  },
];

export function ToolsSettingsPanel() {
  const { enabledTools, setToolEnabled } = useSystemSettings();

  const nativeTools = TOOL_DEFINITIONS.filter((t) => t.category === "native");
  const ecosystemTools = TOOL_DEFINITIONS.filter((t) => t.category === "ecosystem");

  const renderToolCard = (tool: ToolItemDef) => {
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
  };

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

      {/* Bloque 1: Herramientas Nativas */}
      <section className="tools-category-section">
        <div className="tools-category-header">
          <div className="tools-category-badge is-native">
            <Icon name="tool" />
            <span>Herramientas Nativas</span>
          </div>
          <p className="tools-category-desc">
            Utilidades de alto rendimiento del núcleo local de Prisma para transcodificación, renombrado por patrones, comparativa y escaneo de duplicados.
          </p>
        </div>
        <div className="tools-cards-grid">
          {nativeTools.map(renderToolCard)}
        </div>
      </section>

      {/* Bloque 2: Herramientas de Aurora Synapse */}
      <section className="tools-category-section">
        <div className="tools-category-header">
          <div className="tools-category-badge is-ecosystem">
            <Icon name="synapse" />
            <span>Aurora Synapse & Ecosistema</span>
          </div>
          <p className="tools-category-desc">
            Integraciones inteligentes del ecosistema Aurora para descargas web multiconexión, extracción de galerías, super-resolución por IA y fondos en la nube.
          </p>
        </div>
        <div className="tools-cards-grid">
          {ecosystemTools.map(renderToolCard)}
        </div>
      </section>
    </div>
  );
}
