import React, { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Icon } from "../../../../shared/ui/Icon";
import { cleanPath } from "../../../../shared/mediaTree";
import { saveEditedImage } from "../../../../shared/mediaOperations";
import type { VisualLibraryItem } from "../../model/types";
import { ImageCropOverlay } from "./ImageCropOverlay";
import { ImageEditorToolbar } from "./ImageEditorToolbar";
import { SaveImageDialog } from "./SaveImageDialog";
import { getFilterCss } from "./filterPresets";
import type {
  AspectRatioOption,
  CropRect,
  DoodlePoint,
  DoodleStroke,
  EditorAdjustments,
  EditorTab,
  ImageEditorSaveOptions,
  PhotoFilter,
} from "./editorTypes";
import "./image-editor.css";

interface ImageEditorProps {
  item: VisualLibraryItem;
  onClose: () => void;
  onSaveSuccess: (savedPath: string, isOverwrite: boolean) => void;
}

const DEFAULT_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };
const DEFAULT_ADJUSTMENTS: EditorAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  blur: 0,
};

export function ImageEditor({ item, onClose, onSaveSuccess }: ImageEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>("transform");

  // Transform
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [isCropActive, setIsCropActive] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>("free");
  const [crop, setCrop] = useState<CropRect>(DEFAULT_CROP);

  // Filters
  const [activeFilter, setActiveFilter] = useState<PhotoFilter>("none");
  const [filterIntensity, setFilterIntensity] = useState(0.8);

  // Adjustments
  const [adjustments, setAdjustments] = useState<EditorAdjustments>(DEFAULT_ADJUSTMENTS);

  // Drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#ff2a4b");
  const [brushWidth, setBrushWidth] = useState(8);
  const [doodleStrokes, setDoodleStrokes] = useState<DoodleStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DoodlePoint[] | null>(null);

  // Loading & Saving
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [stageDimensions, setStageDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);

  // Cargar elemento de imagen original
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = convertFileSrc(cleanPath(item.path));
    img.onload = () => {
      setImageElement(img);
    };
  }, [item.path]);

  // Manejador de teclado (Escape, Ctrl+Z, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSaveDialog || isSaving) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndoStroke();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setShowSaveDialog(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSaveDialog, isSaving, doodleStrokes, onClose]);

  // Recalcular dimensiones de visualización en el viewport
  const updateDisplaySize = useCallback(() => {
    if (!stageContainerRef.current || !imageElement) return;
    const container = stageContainerRef.current;
    const padding = 32;
    const maxW = Math.max(100, container.clientWidth - padding);
    const maxH = Math.max(100, container.clientHeight - padding);

    const isQuarterRotated = Math.abs(rotationDegrees % 180) === 90;
    const baseW = isQuarterRotated ? imageElement.naturalHeight : imageElement.naturalWidth;
    const baseH = isQuarterRotated ? imageElement.naturalWidth : imageElement.naturalHeight;

    const scale = Math.min(maxW / baseW, maxH / baseH, 1);
    const displayW = Math.round(baseW * scale);
    const displayH = Math.round(baseH * scale);

    setStageDimensions({ width: displayW, height: displayH });
  }, [imageElement, rotationDegrees]);

  useEffect(() => {
    updateDisplaySize();
    window.addEventListener("resize", updateDisplaySize);
    return () => window.removeEventListener("resize", updateDisplaySize);
  }, [updateDisplaySize]);

  // Construir string de filtros CSS para el Canvas
  const buildCanvasFilterString = useCallback((): string => {
    const filters: string[] = [];

    // Filtro tonal seleccionado
    const tonalFilter = getFilterCss(activeFilter, filterIntensity);
    if (tonalFilter !== "none") {
      filters.push(tonalFilter);
    }

    // Ajustes manuales
    if (adjustments.brightness !== 0) {
      filters.push(`brightness(${1 + adjustments.brightness / 100})`);
    }
    if (adjustments.contrast !== 0) {
      filters.push(`contrast(${1 + adjustments.contrast / 100})`);
    }
    if (adjustments.saturation !== 0) {
      filters.push(`saturate(${1 + adjustments.saturation / 100})`);
    }
    if (adjustments.blur > 0) {
      filters.push(`blur(${adjustments.blur}px)`);
    }

    return filters.length > 0 ? filters.join(" ") : "none";
  }, [activeFilter, filterIntensity, adjustments]);

  // Renderizar la imagen y los trazos en el Canvas de vista previa
  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageElement || stageDimensions.width <= 0 || stageDimensions.height <= 0) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = stageDimensions.width;
    canvas.height = stageDimensions.height;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Aplicar filtros CSS
    ctx.filter = buildCanvasFilterString();

    // Transformaciones de rotación y volteo centradas
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotationDegrees * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    const isQuarterRotated = Math.abs(rotationDegrees % 180) === 90;
    const drawW = isQuarterRotated ? canvas.height : canvas.width;
    const drawH = isQuarterRotated ? canvas.width : canvas.height;

    ctx.drawImage(imageElement, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Renderizar trazos de dibujo (sin filtros de color aplicados a las líneas)
    const allStrokes = [...doodleStrokes];
    if (currentStroke && currentStroke.length > 0) {
      allStrokes.push({
        points: currentStroke,
        color: brushColor,
        width: brushWidth,
      });
    }

    if (allStrokes.length > 0) {
      ctx.save();
      for (const stroke of allStrokes) {
        if (stroke.points.length === 0) continue;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const first = stroke.points[0];
        ctx.moveTo(first.x * canvas.width, first.y * canvas.height);

        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [
    imageElement,
    stageDimensions,
    rotationDegrees,
    flipH,
    flipV,
    buildCanvasFilterString,
    doodleStrokes,
    currentStroke,
    brushColor,
    brushWidth,
  ]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  // Manejo de eventos de dibujo interactivo
  const handlePointerDownCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTab !== "draw" || isCropActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setCurrentStroke([{ x, y }]);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentStroke) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setCurrentStroke((prev) => (prev ? [...prev, { x, y }] : [{ x, y }]));
  };

  const handlePointerUpCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!currentStroke) return;
    if (currentStroke.length > 0) {
      setDoodleStrokes((prev) => [
        ...prev,
        {
          points: currentStroke,
          color: brushColor,
          width: brushWidth,
        },
      ]);
    }
    setCurrentStroke(null);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Transform actions
  const handleRotateCw = () => setRotationDegrees((prev) => (prev + 90) % 360);
  const handleRotateCcw = () => setRotationDegrees((prev) => (prev - 90 + 360) % 360);
  const handleFlipH = () => setFlipH((prev) => !prev);
  const handleFlipV = () => setFlipV((prev) => !prev);
  const handleResetTransform = () => {
    setRotationDegrees(0);
    setFlipH(false);
    setFlipV(false);
    setCrop(DEFAULT_CROP);
    setIsCropActive(false);
    setAspectRatio("free");
  };

  // Adjustments actions
  const handleResetAdjustments = () => setAdjustments(DEFAULT_ADJUSTMENTS);

  // Doodle actions
  const handleUndoStroke = () => setDoodleStrokes((prev) => prev.slice(0, -1));
  const handleClearStrokes = () => {
    setDoodleStrokes([]);
    setCurrentStroke(null);
  };

  // Guardado de alta resolución
  const handleSaveConfirmed = async (options: ImageEditorSaveOptions) => {
    if (!imageElement) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      // Crear canvas de alta resolución con las dimensiones naturales de la imagen
      const isQuarterRotated = Math.abs(rotationDegrees % 180) === 90;
      const fullRotatedW = isQuarterRotated
        ? imageElement.naturalHeight
        : imageElement.naturalWidth;
      const fullRotatedH = isQuarterRotated
        ? imageElement.naturalWidth
        : imageElement.naturalHeight;

      // Calcular rectángulo de recorte en pixeles de alta resolución
      const cropRect = isCropActive ? crop : DEFAULT_CROP;
      const cropPxX = Math.round(cropRect.x * fullRotatedW);
      const cropPxY = Math.round(cropRect.y * fullRotatedH);
      const cropPxW = Math.max(1, Math.round(cropRect.width * fullRotatedW));
      const cropPxH = Math.max(1, Math.round(cropRect.height * fullRotatedH));

      // 1. Canvas intermedio rotado y filtrado
      const intermediateCanvas = document.createElement("canvas");
      intermediateCanvas.width = fullRotatedW;
      intermediateCanvas.height = fullRotatedH;
      const interCtx = intermediateCanvas.getContext("2d");
      if (!interCtx) throw new Error("No se pudo inicializar el contexto de renderizado");

      interCtx.save();
      interCtx.filter = buildCanvasFilterString();
      interCtx.translate(fullRotatedW / 2, fullRotatedH / 2);
      interCtx.rotate((rotationDegrees * Math.PI) / 180);
      interCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

      const baseDrawW = isQuarterRotated ? fullRotatedH : fullRotatedW;
      const baseDrawH = isQuarterRotated ? fullRotatedW : fullRotatedH;
      interCtx.drawImage(imageElement, -baseDrawW / 2, -baseDrawH / 2, baseDrawW, baseDrawH);
      interCtx.restore();

      // 2. Renderizar trazos de dibujo en el canvas de alta resolución
      if (doodleStrokes.length > 0) {
        interCtx.save();
        const scaleFactor = fullRotatedW / (stageDimensions.width || fullRotatedW);
        for (const stroke of doodleStrokes) {
          if (stroke.points.length === 0) continue;
          interCtx.beginPath();
          interCtx.strokeStyle = stroke.color;
          interCtx.lineWidth = stroke.width * scaleFactor;
          interCtx.lineCap = "round";
          interCtx.lineJoin = "round";

          const first = stroke.points[0];
          interCtx.moveTo(first.x * fullRotatedW, first.y * fullRotatedH);
          for (let i = 1; i < stroke.points.length; i++) {
            const pt = stroke.points[i];
            interCtx.lineTo(pt.x * fullRotatedW, pt.y * fullRotatedH);
          }
          interCtx.stroke();
        }
        interCtx.restore();
      }

      // 3. Canvas final recortado
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = cropPxW;
      finalCanvas.height = cropPxH;
      const finalCtx = finalCanvas.getContext("2d");
      if (!finalCtx) throw new Error("No se pudo generar la imagen final recortada");

      finalCtx.drawImage(
        intermediateCanvas,
        cropPxX,
        cropPxY,
        cropPxW,
        cropPxH,
        0,
        0,
        cropPxW,
        cropPxH
      );

      // Determinar formato de exportación
      const origExt = item.path.split(".").pop()?.toLowerCase();
      const mime =
        origExt === "jpg" || origExt === "jpeg"
          ? "image/jpeg"
          : origExt === "webp"
          ? "image/webp"
          : "image/png";

      const base64Data = finalCanvas.toDataURL(mime, 0.95);

      const result = await saveEditedImage(
        item.path,
        base64Data,
        options.overwrite,
        options.customFileName
      );

      setIsSaving(false);
      setShowSaveDialog(false);
      onSaveSuccess(result.savedPath, result.overwrite);
    } catch (err: any) {
      setIsSaving(false);
      setSaveError(err?.message || String(err) || "Error al procesar y guardar la imagen");
    }
  };

  return (
    <div
      className="image-editor-root"
      role="dialog"
      aria-label={`Editar ${item.title}`}
      aria-modal="true"
    >
      {/* Barra superior de herramientas */}
      <div className="image-editor-header">
        <button
          className="editor-header-btn is-icon-only"
          onClick={onClose}
          title="Cerrar editor (Esc)"
        >
          <Icon name="arrow-left" />
        </button>

        <div className="editor-header-title-wrap">
          <h2 className="editor-header-title">Editar imagen</h2>
          <span className="editor-header-subtitle">{item.title}</span>
        </div>

        <div className="editor-header-actions">
          <button
            className="editor-header-save-btn"
            onClick={() => setShowSaveDialog(true)}
            title="Guardar cambios (Ctrl+S)"
          >
            <Icon name="save" />
            <span>Guardar</span>
          </button>
        </div>
      </div>

      {/* Escenario central interactivo */}
      <div className="image-editor-stage-area" ref={stageContainerRef}>
        <div
          className="image-editor-canvas-wrapper"
          style={{
            width: stageDimensions.width,
            height: stageDimensions.height,
          }}
        >
          <canvas
            ref={canvasRef}
            className={`image-editor-canvas ${isDrawing && activeTab === "draw" ? "is-drawing" : ""}`}
            onPointerDown={handlePointerDownCanvas}
            onPointerMove={handlePointerMoveCanvas}
            onPointerUp={handlePointerUpCanvas}
          />

          {isCropActive && activeTab === "transform" && stageDimensions.width > 0 && (
            <ImageCropOverlay
              containerWidth={stageDimensions.width}
              containerHeight={stageDimensions.height}
              crop={crop}
              aspectRatio={aspectRatio}
              onChange={setCrop}
            />
          )}
        </div>
      </div>

      {/* Error Toast */}
      {saveError && (
        <div className="image-editor-error-toast" role="alert">
          {saveError}
        </div>
      )}

      {/* Barra inferior con controles y pestañas */}
      <ImageEditorToolbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        // Transform
        isCropActive={isCropActive}
        onToggleCrop={() => setIsCropActive(!isCropActive)}
        aspectRatio={aspectRatio}
        onSelectAspectRatio={setAspectRatio}
        onRotateCw={handleRotateCw}
        onRotateCcw={handleRotateCcw}
        onFlipH={handleFlipH}
        onFlipV={handleFlipV}
        onResetTransform={handleResetTransform}
        // Filters
        activeFilter={activeFilter}
        filterIntensity={filterIntensity}
        onSelectFilter={setActiveFilter}
        onChangeFilterIntensity={setFilterIntensity}
        // Adjustments
        adjustments={adjustments}
        onChangeAdjustments={setAdjustments}
        onResetAdjustments={handleResetAdjustments}
        // Draw
        isDrawing={isDrawing}
        onToggleDrawing={setIsDrawing}
        brushColor={brushColor}
        onSelectBrushColor={setBrushColor}
        brushWidth={brushWidth}
        onChangeBrushWidth={setBrushWidth}
        doodleStrokes={doodleStrokes}
        onUndoStroke={handleUndoStroke}
        onClearStrokes={handleClearStrokes}
      />

      {/* Diálogo de guardar */}
      {showSaveDialog && (
        <SaveImageDialog
          originalFileName={item.title}
          onConfirm={handleSaveConfirmed}
          onCancel={() => setShowSaveDialog(false)}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
