import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "../../../../shared/ui/Icon";
import { cleanPath, toSafeAssetUrl } from "../../../../shared/mediaTree";
import { saveEditedImage } from "../../../../shared/mediaOperations";
import type { VisualLibraryItem } from "../../model/types";
import { ImageCropOverlay } from "./ImageCropOverlay";
import { brushWidthInImage, fitCropToAspect, previewPointToImage } from "./cropGeometry";
import { ImageEditorToolbar } from "./ImageEditorToolbar";
import { SaveImageDialog } from "./SaveImageDialog";
import { WatermarkModal } from "./WatermarkModal";
import {
  type WatermarkConfig,
  DEFAULT_WATERMARK_CONFIG,
  applyWatermarkToCanvas,
  getWatermarkBounds,
} from "../../model/watermark";
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
  const [isCropPreview, setIsCropPreview] = useState(false);
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

  // Watermark
  const [watermark, setWatermark] = useState<WatermarkConfig>(DEFAULT_WATERMARK_CONFIG);
  const [showWatermarkModal, setShowWatermarkModal] = useState(false);
  const [isMovingWatermark, setIsMovingWatermark] = useState(false);
  const [logoImageElement, setLogoImageElement] = useState<HTMLImageElement | null>(null);

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
  const currentStrokeRef = useRef<DoodlePoint[] | null>(null);
  const currentStrokeWidthRef = useRef(0);
  const watermarkDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  // Cargar elemento de imagen original
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = toSafeAssetUrl(item.path);
    img.onload = () => {
      setImageElement(img);
    };
  }, [item.path]);

  // La proporción fija se recalcula al cargar o girar la imagen, nunca al
  // volver de una vista previa ni al cambiar de pestaña.
  useEffect(() => {
    if (!imageElement) return;
    const turned = Math.abs(rotationDegrees % 180) === 90;
    const fitted = fitCropToAspect(
      aspectRatio,
      turned ? imageElement.naturalHeight : imageElement.naturalWidth,
      turned ? imageElement.naturalWidth : imageElement.naturalHeight,
    );
    if (fitted) setCrop(fitted);
  }, [aspectRatio, imageElement, rotationDegrees]);

  // Cargar logotipo de marca de agua si se especifica
  useEffect(() => {
    if (!watermark.logoDataUrl) {
      setLogoImageElement(null);
      return;
    }
    const logoImg = new Image();
    logoImg.crossOrigin = "anonymous";
    logoImg.onload = () => setLogoImageElement(logoImg);
    logoImg.onerror = () => setLogoImageElement(null);
    logoImg.src = watermark.logoDataUrl;
  }, [watermark.logoDataUrl]);

  // Manejador de teclado del editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSaveDialog || showWatermarkModal || isSaving) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (isMovingWatermark) setIsMovingWatermark(false);
        else onClose();
      } else if (e.key === "Enter" && isCropActive && activeTab === "transform") {
        if (target?.closest("button")) return;
        e.preventDefault();
        setIsCropPreview((current) => !current);
        setIsMovingWatermark(false);
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
  }, [showSaveDialog, showWatermarkModal, isSaving, doodleStrokes, onClose, isMovingWatermark, isCropActive, activeTab]);

  // Recalcular dimensiones de visualización en el viewport
  const updateDisplaySize = useCallback(() => {
    if (!stageContainerRef.current || !imageElement) return;
    const container = stageContainerRef.current;
    const padding = 32;
    const maxW = Math.max(100, container.clientWidth - padding);
    const maxH = Math.max(100, container.clientHeight - padding);

    const isQuarterRotated = Math.abs(rotationDegrees % 180) === 90;
    const baseW = (isQuarterRotated ? imageElement.naturalHeight : imageElement.naturalWidth)
      * (isCropActive && isCropPreview ? crop.width : 1);
    const baseH = (isQuarterRotated ? imageElement.naturalWidth : imageElement.naturalHeight)
      * (isCropActive && isCropPreview ? crop.height : 1);

    const scale = Math.min(maxW / baseW, maxH / baseH, 1);
    const displayW = Math.round(baseW * scale);
    const displayH = Math.round(baseH * scale);

    setStageDimensions({ width: displayW, height: displayH });
  }, [imageElement, rotationDegrees, isCropActive, isCropPreview, crop]);

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

    const fullWidth = isCropActive && isCropPreview ? canvas.width / crop.width : canvas.width;
    const fullHeight = isCropActive && isCropPreview ? canvas.height / crop.height : canvas.height;
    const offsetX = isCropActive && isCropPreview ? crop.x * fullWidth : 0;
    const offsetY = isCropActive && isCropPreview ? crop.y * fullHeight : 0;

    // Aplicar filtros CSS
    ctx.filter = buildCanvasFilterString();

    // Transformaciones de rotación y volteo centradas
    ctx.translate(fullWidth / 2 - offsetX, fullHeight / 2 - offsetY);
    ctx.rotate((rotationDegrees * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    const isQuarterRotated = Math.abs(rotationDegrees % 180) === 90;
    const drawW = isQuarterRotated ? fullHeight : fullWidth;
    const drawH = isQuarterRotated ? fullWidth : fullHeight;

    ctx.drawImage(imageElement, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Renderizar trazos de dibujo (sin filtros de color aplicados a las líneas)
    const allStrokes = [...doodleStrokes];
    if (currentStroke && currentStroke.length > 0) {
      allStrokes.push({
        points: currentStroke,
        color: brushColor,
        width: currentStrokeWidthRef.current,
      });
    }

    if (allStrokes.length > 0) {
      ctx.save();
      for (const stroke of allStrokes) {
        if (stroke.points.length === 0) continue;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width * fullWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        const first = stroke.points[0];
        ctx.moveTo(first.x * fullWidth - offsetX, first.y * fullHeight - offsetY);

        for (let i = 1; i < stroke.points.length; i++) {
          const pt = stroke.points[i];
          ctx.lineTo(pt.x * fullWidth - offsetX, pt.y * fullHeight - offsetY);
        }
        if (stroke.points.length === 1) {
          ctx.beginPath();
          ctx.arc(first.x * fullWidth - offsetX, first.y * fullHeight - offsetY, ctx.lineWidth / 2, 0, Math.PI * 2);
          ctx.fillStyle = stroke.color;
          ctx.fill();
        } else {
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 3. Estampar marca de agua si está activa
    if (watermark.enabled) {
      if (isCropActive && !isCropPreview) {
        ctx.save();
        ctx.translate(crop.x * canvas.width, crop.y * canvas.height);
        applyWatermarkToCanvas(ctx, crop.width * canvas.width, crop.height * canvas.height, watermark, logoImageElement);
        ctx.restore();
      } else {
        applyWatermarkToCanvas(ctx, canvas.width, canvas.height, watermark, logoImageElement);
      }
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
    watermark,
    logoImageElement,
    isCropActive,
    isCropPreview,
    crop,
  ]);

  useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  // Manejo de eventos de dibujo interactivo
  const handlePointerDownCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pixelX = (e.clientX - rect.left) * canvas.width / rect.width;
    const pixelY = (e.clientY - rect.top) * canvas.height / rect.height;

    if (isMovingWatermark && watermark.enabled) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const bounds = getWatermarkBounds(ctx, canvas.width, canvas.height, watermark, logoImageElement);
      if (!bounds || pixelX < bounds.x - 12 || pixelX > bounds.x + bounds.width + 12 || pixelY < bounds.y - 12 || pixelY > bounds.y + bounds.height + 12) return;
      watermarkDragRef.current = {
        pointerId: e.pointerId,
        offsetX: pixelX - (bounds.x + bounds.width / 2),
        offsetY: pixelY - (bounds.y + bounds.height / 2),
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (!isDrawing || activeTab !== "draw") return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const previewCrop = isCropActive && isCropPreview ? crop : null;
    currentStrokeWidthRef.current = brushWidthInImage(brushWidth, canvas.width, previewCrop);
    currentStrokeRef.current = [previewPointToImage(x, y, previewCrop)];
    setCurrentStroke(currentStrokeRef.current);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = watermarkDragRef.current;
    if (drag?.pointerId === e.pointerId) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const pixelX = (e.clientX - rect.left) * canvas.width / rect.width;
      const pixelY = (e.clientY - rect.top) * canvas.height / rect.height;
      setWatermark((current) => ({
        ...current,
        position: "custom",
        normX: Math.max(0, Math.min(1, (pixelX - drag.offsetX) / canvas.width)),
        normY: Math.max(0, Math.min(1, (pixelY - drag.offsetY) / canvas.height)),
      }));
      return;
    }
    if (!currentStrokeRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const previewCrop = isCropActive && isCropPreview ? crop : null;
    currentStrokeRef.current = [...currentStrokeRef.current, previewPointToImage(x, y, previewCrop)];
    setCurrentStroke(currentStrokeRef.current);
  };

  const handlePointerUpCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (watermarkDragRef.current?.pointerId === e.pointerId) {
      watermarkDragRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      return;
    }
    const strokePoints = currentStrokeRef.current;
    if (!strokePoints) return;
    if (strokePoints.length > 0) {
      setDoodleStrokes((prev) => [
        ...prev,
        {
          points: strokePoints,
          color: brushColor,
          width: currentStrokeWidthRef.current,
        },
      ]);
    }
    currentStrokeRef.current = null;
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
    setIsCropPreview(false);
    setAspectRatio("free");
  };

  // Adjustments actions
  const handleResetAdjustments = () => setAdjustments(DEFAULT_ADJUSTMENTS);

  // Doodle actions
  const handleUndoStroke = () => setDoodleStrokes((prev) => prev.slice(0, -1));
  const handleClearStrokes = () => {
    setDoodleStrokes([]);
    currentStrokeRef.current = null;
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
        for (const stroke of doodleStrokes) {
          if (stroke.points.length === 0) continue;
          interCtx.beginPath();
          interCtx.strokeStyle = stroke.color;
          interCtx.lineWidth = stroke.width * fullRotatedW;
          interCtx.lineCap = "round";
          interCtx.lineJoin = "round";

          const first = stroke.points[0];
          interCtx.moveTo(first.x * fullRotatedW, first.y * fullRotatedH);
          for (let i = 1; i < stroke.points.length; i++) {
            const pt = stroke.points[i];
            interCtx.lineTo(pt.x * fullRotatedW, pt.y * fullRotatedH);
          }
          if (stroke.points.length === 1) {
            interCtx.beginPath();
            interCtx.arc(first.x * fullRotatedW, first.y * fullRotatedH, interCtx.lineWidth / 2, 0, Math.PI * 2);
            interCtx.fillStyle = stroke.color;
            interCtx.fill();
          } else {
            interCtx.stroke();
          }
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

      // 4. Estampar marca de agua si está activa sobre el canvas final de alta resolución
      if (watermark.enabled) {
        applyWatermarkToCanvas(finalCtx, cropPxW, cropPxH, watermark, logoImageElement);
      }

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
            className={`image-editor-canvas ${isDrawing && activeTab === "draw" ? "is-drawing" : ""} ${isMovingWatermark ? "is-moving-watermark" : ""}`}
            onPointerDown={handlePointerDownCanvas}
            onPointerMove={handlePointerMoveCanvas}
            onPointerUp={handlePointerUpCanvas}
            onPointerCancel={handlePointerUpCanvas}
          />

          {isCropActive && !isCropPreview && activeTab === "transform" && stageDimensions.width > 0 && (
            <ImageCropOverlay
              containerWidth={stageDimensions.width}
              containerHeight={stageDimensions.height}
              crop={crop}
              aspectRatio={aspectRatio}
              onChange={setCrop}
            />
          )}
        </div>
        {isMovingWatermark && (
          <div className="watermark-move-hint">
            Arrastra la marca para ubicarla
            <button type="button" onClick={() => setIsMovingWatermark(false)}>Listo</button>
          </div>
        )}
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
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setIsMovingWatermark(false);
          if (tab === "draw") {
            setIsDrawing(true);
          }
        }}
        // Transform
        isCropActive={isCropActive}
        isCropPreview={isCropPreview}
        onToggleCrop={() => {
          setIsCropActive((current) => !current);
          setIsCropPreview(false);
          setIsMovingWatermark(false);
        }}
        onToggleCropPreview={() => {
          setIsCropPreview((current) => !current);
          setIsMovingWatermark(false);
        }}
        aspectRatio={aspectRatio}
        onSelectAspectRatio={(ratio) => {
          setAspectRatio(ratio);
          if (imageElement) {
            const turned = Math.abs(rotationDegrees % 180) === 90;
            const fitted = fitCropToAspect(
              ratio,
              turned ? imageElement.naturalHeight : imageElement.naturalWidth,
              turned ? imageElement.naturalWidth : imageElement.naturalHeight,
            );
            if (fitted) setCrop(fitted);
          }
          setIsCropPreview(false);
          setIsMovingWatermark(false);
        }}
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
        // Watermark
        watermark={watermark}
        onOpenWatermarkModal={() => setShowWatermarkModal(true)}
      />

      {/* Diálogo de marca de agua */}
      {showWatermarkModal && (
        <WatermarkModal
          isOpen={showWatermarkModal}
          config={watermark}
          onClose={() => setShowWatermarkModal(false)}
          onApply={(newConfig) => {
            setWatermark(newConfig);
            setIsMovingWatermark(newConfig.enabled && Boolean(newConfig.text.trim() || newConfig.includeDate || newConfig.logoDataUrl));
            if (newConfig.enabled && isCropActive) setIsCropPreview(true);
          }}
        />
      )}

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
