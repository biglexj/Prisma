import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../shared/ui/Icon";
import type { AppView } from "../../../app/ui/AppSidebar";
import { ModelSelectModal, type AIModel } from "./ModelSelectModal";
import "./prisma-upscaler.css";

interface PrismaUpscalerViewProps {
  onNavigate?: (view: AppView) => void;
}

const MODELS: AIModel[] = [
  {
    id: "realesrgan-x4plus-anime",
    name: "Arte Digital / Anime",
    description: "Ideal para ilustraciones digitales, anime, manga y líneas nítidas sin artefactos.",
    scales: [2, 3, 4],
    category: "anime",
  },
  {
    id: "realesrgan-x4plus",
    name: "Fotografía General",
    description: "Restaura fotografías reales, retratos y texturas complejas con alta fidelidad.",
    scales: [2, 3, 4],
    category: "photo",
  },
  {
    id: "ultrasharp",
    name: "UltraSharp",
    description: "Acentuación agresiva de nitidez y micro-detalles en bordes y texturas finas.",
    scales: [4],
    category: "sharp",
  },
  {
    id: "remacri",
    name: "Remacri",
    description: "Restaura texturas y grano con ultra-alta fidelidad en imágenes comprimidas.",
    scales: [4],
    category: "restore",
  },
  {
    id: "compact",
    name: "RealESRGANv2 Compact",
    description: "Modelo ultraligero de baja latencia y consumo mínimo de VRAM para GPU modesta.",
    scales: [2, 3, 4],
    category: "compact",
  },
];

export function PrismaUpscalerView({ onNavigate: _onNavigate }: PrismaUpscalerViewProps) {
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("realesrgan-x4plus-anime");
  const [selectedScale, setSelectedScale] = useState<number>(4);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [serverUrl, setServerUrl] = useState("http://localhost:8085");
  const [serverHealth, setServerHealth] = useState<"idle" | "checking" | "online" | "offline">("idle");
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  const dropZoneRef = useRef<HTMLDivElement>(null);

  const currentModel = MODELS.find((m) => m.id === selectedModel) || MODELS[0];

  // Si el modelo actual no soporta la escala seleccionada, auto-ajustar a la primera disponible
  useEffect(() => {
    if (!currentModel.scales.includes(selectedScale)) {
      setSelectedScale(currentModel.scales[0]);
    }
  }, [selectedModel, currentModel, selectedScale]);

  // Selección de archivo con explorador nativo
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
        // Generar URL para visualización en WebView
        try {
          const assetUrl = await invoke<string>("get_media_preview_url", { path: selected });
          setPreviewUrl(assetUrl || null);
        } catch {
          setPreviewUrl(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Limpiar imagen seleccionada
  const handleClearImage = () => {
    setSelectedPath("");
    setPreviewUrl(null);
    setStatusMessage(null);
  };

  // Pegar ruta o imagen desde el portapapeles
  const handlePasteClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text ? text.trim().replace(/^"|"$/g, "") : "";
      if (
        trimmed &&
        (trimmed.endsWith(".png") ||
          trimmed.endsWith(".jpg") ||
          trimmed.endsWith(".jpeg") ||
          trimmed.endsWith(".webp"))
      ) {
        setSelectedPath(trimmed);
        setStatusMessage({ text: "Ruta de imagen pegada desde el portapapeles.", type: "success" });
        try {
          const assetUrl = await invoke<string>("get_media_preview_url", { path: trimmed });
          setPreviewUrl(assetUrl || null);
        } catch {
          setPreviewUrl(null);
        }
        return;
      }
      setStatusMessage({ text: "El portapapeles no contiene una ruta de imagen válida (.png, .jpg, .webp).", type: "info" });
    } catch {
      setStatusMessage({ text: "No se pudo leer el portapapeles.", type: "error" });
    }
  }, []);

  // Soporte de atajo Ctrl+V global en la vista
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        const activeElem = document.activeElement;
        if (activeElem && (activeElem.tagName === "INPUT" || activeElem.tagName === "TEXTAREA")) {
          return;
        }
        void handlePasteClipboard();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePasteClipboard]);

  // Manejo de Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validExts = [".png", ".jpg", ".jpeg", ".webp"];
      const isImage = validExts.some((ext) => file.name.toLowerCase().endsWith(ext));

      if (isImage) {
        // En WebView Tauri, File a menudo expone la ruta real o name
        const filePath = (file as unknown as { path?: string }).path || file.name;
        setSelectedPath(filePath);
        setPreviewUrl(URL.createObjectURL(file));
        setStatusMessage({ text: `Imagen «${file.name}» cargada correctamente.`, type: "success" });
      } else {
        setStatusMessage({ text: "Formato no compatible. Usa imágenes PNG, JPG o WEBP.", type: "error" });
      }
    }
  };

  // Lanzar Prisma Upscaler
  const handleLaunchUpscaler = async () => {
    setIsLaunching(true);
    const targetPath = selectedPath.trim();
    try {
      const launched = await invoke<boolean>("launch_prisma_upscaler", {
        filePath: targetPath ? targetPath : null,
      });

      if (launched) {
        setStatusMessage({
          text: targetPath
            ? "¡Imagen y parámetros enviados a Prisma Upscaler exitosamente!"
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
        text: "Error al comunicar con Prisma Upscaler. Abriendo página de descargas...",
        type: "error",
      });
      void invoke("open_external_url", { url: "https://github.com/biglexj/prisma-upscaler/releases" });
    } finally {
      setIsLaunching(false);
    }
  };

  // Health-check del daemon Axum/NCNN
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

  const getModelIcon = (id: string): import("../../../shared/ui/Icon").IconName => {
    if (id.includes("anime") || id.includes("art")) return "brush";
    if (id.includes("sharp")) return "sparkles";
    if (id.includes("remacri") || id.includes("restore")) return "sliders";
    if (id.includes("compact")) return "clock";
    return "image";
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

      {/* ── Notificación de Estado Flotante / Inline ── */}
      {statusMessage && (
        <div className={`upscaler-status-banner status-${statusMessage.type}`}>
          <Icon name={statusMessage.type === "success" ? "check" : "info"} />
          <span>{statusMessage.text}</span>
          <button
            type="button"
            className="status-close-btn"
            onClick={() => setStatusMessage(null)}
          >
            <Icon name="x" />
          </button>
        </div>
      )}

      {/* ── Cuerpo Principal: Layout por Pasos (Estilo Prisma Upscaler) ── */}
      <div className="upscaler-main-layout">
        {/* Columna Izquierda: Pasos de Configuración Compactos */}
        <div className="upscaler-steps-sidebar">
          {/* PASO 1: Seleccionar imagen */}
          <div className="upscaler-step-card">
            <div className="upscaler-step-header">
              <span className="upscaler-step-badge">Paso 1</span>
              <span className="upscaler-step-title">Seleccionar imagen</span>
            </div>

            <button
              type="button"
              className={`upscaler-select-btn ${selectedPath ? "has-file" : ""}`}
              onClick={() => void handleSelectFile()}
            >
              <Icon name="image" />
              <div className="upscaler-select-btn-text">
                <span className="main-text">
                  {selectedPath ? selectedPath.split(/[\\/]/).pop() : "Elegir archivo..."}
                </span>
                <span className="sub-text">
                  {selectedPath ? "PNG, JPG o WEBP cargado" : "Explorar en este equipo"}
                </span>
              </div>
            </button>

            <div className="upscaler-step1-quick-actions">
              <button
                type="button"
                className="upscaler-action-pill"
                onClick={() => void handlePasteClipboard()}
                title="Pegar imagen o ruta desde el portapapeles (Ctrl+V)"
              >
                <Icon name="copy" />
                <span>Pegar (Ctrl+V)</span>
              </button>
              {selectedPath && (
                <button
                  type="button"
                  className="upscaler-action-pill danger"
                  onClick={handleClearImage}
                  title="Quitar imagen seleccionada"
                >
                  <Icon name="trash" />
                  <span>Quitar</span>
                </button>
              )}
            </div>
          </div>

          {/* PASO 2: Selector de Modelo de IA (Botón Compacto + Modal) */}
          <div className="upscaler-step-card">
            <div className="upscaler-step-header">
              <span className="upscaler-step-badge">Paso 2</span>
              <span className="upscaler-step-title">Modelo de IA & Escala</span>
            </div>

            {/* Selector compacto de modelo con Chevron */}
            <button
              type="button"
              className="upscaler-model-selector-tile"
              onClick={() => setIsModelModalOpen(true)}
              title="Haz clic para elegir el modelo de IA"
            >
              <div className="model-tile-left">
                <span className="model-tile-icon">
                  <Icon name={getModelIcon(currentModel.id)} />
                </span>
                <div className="model-tile-info">
                  <div className="model-tile-name-row">
                    <span className="model-tile-name">{currentModel.name}</span>
                  </div>
                  <span className="model-tile-desc">{currentModel.description}</span>
                </div>
              </div>
              <span className="model-tile-chevron">
                <Icon name="chevron-right" />
              </span>
            </button>

            {/* Selector de Escala (2x, 3x, 4x) */}
            <div className="upscaler-scale-row">
              <span className="scale-label">
                <Icon name="fit-screen" /> Escala:
              </span>
              <div className="scale-pills-group">
                {([2, 3, 4] as const).map((s) => {
                  const isAvailable = currentModel.scales.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`scale-pill ${selectedScale === s ? "is-active" : ""} ${
                        !isAvailable ? "is-disabled" : ""
                      }`}
                      onClick={() => setSelectedScale(s)}
                      disabled={!isAvailable}
                    >
                      {s}x
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PASO 3: Carpeta de Salida */}
          <div className="upscaler-step-card">
            <div className="upscaler-step-header">
              <span className="upscaler-step-badge">Paso 3</span>
              <span className="upscaler-step-title">Carpeta de salida</span>
            </div>

            <div className="upscaler-output-preset">
              <Icon name="folder" />
              <div className="output-preset-info">
                <span className="output-main-text">Misma carpeta</span>
                <span className="output-sub-text">Guarda junto al archivo original</span>
              </div>
            </div>
          </div>

          {/* PASO 4: Acción Principal de Escalado */}
          <div className="upscaler-step-card upscaler-action-card">
            <div className="upscaler-step-header">
              <span className="upscaler-step-badge">Paso 4</span>
              <span className="upscaler-step-title">Ejecutar escalado</span>
            </div>

            <button
              type="button"
              className="upscaler-btn primary-glow upscaler-launch-btn"
              onClick={() => void handleLaunchUpscaler()}
              disabled={isLaunching}
            >
              <Icon name="sparkles" />
              <span>
                {selectedPath
                  ? `Abrir y Escalar (${selectedScale}x)`
                  : "Abrir en Prisma Upscaler"}
              </span>
            </button>
          </div>
        </div>

        {/* Columna Derecha: DropZone Central e Interactiva (Estilo Prisma Upscaler) */}
        <div className="upscaler-content-center">
          <div
            ref={dropZoneRef}
            className={`upscaler-dropzone ${isDragging ? "is-dragging" : ""} ${
              previewUrl || selectedPath ? "has-preview" : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {previewUrl || selectedPath ? (
              <div className="dropzone-preview-container">
                <div className="dropzone-preview-image-wrap">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Vista previa a escalar"
                      className="dropzone-preview-image"
                    />
                  ) : (
                    <div className="dropzone-file-placeholder">
                      <Icon name="image" />
                    </div>
                  )}
                </div>

                <div className="dropzone-preview-bar">
                  <div className="preview-meta">
                    <Icon name="image" />
                    <span className="preview-filename">
                      {selectedPath.split(/[\\/]/).pop()}
                    </span>
                  </div>

                  <div className="preview-actions">
                    <button
                      type="button"
                      className="dropzone-mini-btn"
                      onClick={() => void handleSelectFile()}
                      title="Cambiar imagen"
                    >
                      <Icon name="folder-open" />
                      <span>Cambiar</span>
                    </button>
                    <button
                      type="button"
                      className="dropzone-mini-btn danger"
                      onClick={handleClearImage}
                      title="Quitar imagen"
                    >
                      <Icon name="trash" />
                      <span>Quitar</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="dropzone-empty-state">
                <div className="dropzone-cloud-icon">
                  <Icon name="image" />
                </div>
                <h3>Selecciona una imagen</h3>
                <p>Selecciona o arrastra y suelta una imagen PNG, JPG, JPEG o WEBP.</p>

                <div className="dropzone-badges-row">
                  <span className="dropzone-badge">
                    <kbd>Ctrl+V</kbd> para pegar
                  </span>
                  <span className="dropzone-badge">Hasta 100 MB</span>
                  <span className="dropzone-badge highlight">
                    <Icon name="sparkles" /> GPU Remota NVIDIA / Vulkan
                  </span>
                </div>

                <button
                  type="button"
                  className="upscaler-btn secondary dropzone-explore-btn"
                  onClick={() => void handleSelectFile()}
                >
                  <Icon name="folder-open" />
                  <span>Explorar archivos</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Tarjetas Informativas y Estado del Daemon Neuronal ── */}
          <div className="upscaler-footer-features">
            <div className="upscaler-feature-item">
              <div className="feature-icon-wrap">
                <Icon name="layout" />
              </div>
              <div className="feature-text">
                <h4>Inferencia en GPU Desacoplada</h4>
                <p>Delega el trabajo pesado a una GPU NVIDIA Vulkan dedicada sin congelar la app.</p>
              </div>
            </div>

            <div className="upscaler-feature-item">
              <div className="feature-icon-wrap">
                <Icon name="disc" />
              </div>
              <div className="feature-text">
                <h4>Semáforo Concurrente Unitario</h4>
                <p>Protección anti-OOM procesando tareas en cola estricta para cero colapsos de VRAM.</p>
              </div>
            </div>

            <div className="upscaler-feature-item">
              <div className="feature-icon-wrap">
                <Icon name="link" />
              </div>
              <div className="feature-text">
                <h4>Sinergia Ecosistema Aurora</h4>
                <p>Conéctate en local o en LAN hacia nodos registrados en Aurora Synapse.</p>
              </div>
            </div>
          </div>

          {/* Daemon Status Bar */}
          <div className="upscaler-daemon-bar">
            <div className="daemon-bar-info">
              <span className="daemon-title">Daemon Neuronal (Axum / NCNN)</span>
              <div className="daemon-url-input-wrap">
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost:8085"
                />
              </div>
            </div>

            <div className="daemon-bar-actions">
              <span className={`daemon-status-pill ${serverHealth}`}>
                <span className="daemon-dot" />
                {serverHealth === "idle"
                  ? "Sin comprobar"
                  : serverHealth === "checking"
                  ? "Comprobando..."
                  : serverHealth === "online"
                  ? "En línea"
                  : "Servidor offline"}
              </span>
              <button
                type="button"
                className="upscaler-btn text-icon"
                onClick={() => void handleCheckServer()}
                disabled={serverHealth === "checking"}
              >
                <Icon name="refresh" />
                <span>Comprobar Salud</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal de Selección de Modelos (Estilo Prisma Upscaler) ── */}
      <ModelSelectModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        models={MODELS}
        selectedModel={selectedModel}
        onSelectModel={(id) => setSelectedModel(id)}
      />
    </div>
  );
}
