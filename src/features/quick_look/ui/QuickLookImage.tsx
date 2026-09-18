import { invoke } from "@tauri-apps/api/core";
import { useState, useRef, useEffect } from "react";
import { toSafeAssetUrl } from "../../../shared/mediaTree";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";

interface QuickLookImageProps {
  payload: QuickLookPayload;
  onDimensionsLoad?: (dims: { width: number; height: number }) => void;
}

export function QuickLookImage({ payload, onDimensionsLoad }: QuickLookImageProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPanRef = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  const baseSrc = toSafeAssetUrl(payload.path);
  const imgSrc = retryKey > 0 ? `${baseSrc}?r=${retryKey}` : baseSrc;

  useEffect(() => {
    setHasError(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRetryKey(0);

    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      onDimensionsLoad?.({ width: imgRef.current.naturalWidth, height: imgRef.current.naturalHeight });
    }
  }, [payload.path, onDimensionsLoad]);

  const handleImageLoad = async (e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(false);
    const img = e.currentTarget;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (nw && nh) {
      onDimensionsLoad?.({ width: nw, height: nh });

      try {
        const isMax = await invoke<boolean>("quick_look_is_maximized");
        if (isMax) return;
        if (payload.width === nw && payload.height === nh) return;

        const screenW = window.screen.availWidth || 1920;
        const screenH = window.screen.availHeight || 1080;
        const maxAvailW = Math.min(screenW * 0.85, 1280);
        const maxAvailH = Math.min(screenH * 0.85, 820);

        const headerH = 48;
        const maxContentH = maxAvailH - headerH;

        const aspect = nw / nh;
        const scale = Math.min(1, maxAvailW / nw, maxContentH / nh);
        let fittedW = Math.round(nw * scale);
        let fittedH = Math.round(nh * scale);

        const minW = 340;
        if (fittedW < minW) {
          fittedW = minW;
          fittedH = Math.round(fittedW / aspect);
        }

        if (fittedH > maxContentH) {
          fittedH = maxContentH;
          fittedW = Math.round(fittedH * aspect);
        }

        const targetW = fittedW;
        const targetH = fittedH + headerH;

        void invoke("quick_look_set_size", { width: targetW, height: targetH }).catch(() => { });
      } catch { }
    }
  };

  const handleImageError = () => {
    console.warn("[QuickLookImage] Fallo al cargar la imagen:", payload.path);
    setIsLoading(false);
    setHasError(true);
  };

  // Zoom con punto focal en dirección del cursor / lápiz de tableta gráfica
  const handleWheel = (e: React.WheelEvent) => {
    if (hasError) return;
    e.preventDefault();
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseRelX = e.clientX - (rect.left + rect.width / 2);
    const mouseRelY = e.clientY - (rect.top + rect.height / 2);

    const oldZoom = zoom;
    const nextZoom = Math.max(0.5, Math.min(6.0, oldZoom * factor));

    if (nextZoom <= 1.04) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const ratio = nextZoom / oldZoom;
    const newPanX = mouseRelX - ratio * (mouseRelX - pan.x);
    const newPanY = mouseRelY - ratio * (mouseRelY - pan.y);

    setZoom(Number(nextZoom.toFixed(2)));
    setPan({
      x: Math.round(newPanX),
      y: Math.round(newPanY),
    });
  };

  const handleDoubleClick = () => {
    if (hasError) return;
    setZoom((prev) => (prev > 1 ? 1 : 1.75));
    setPan({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.button !== 0 && e.buttons !== 1) || zoom <= 1 || hasError) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch { }

    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPanRef.current = { ...pan };
  };

  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - dragStartRef.current.x;
      const dy = ev.clientY - dragStartRef.current.y;
      setPan({
        x: Math.round(initialPanRef.current.x + dx),
        y: Math.round(initialPanRef.current.y + dy),
      });
    };

    const onPointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isDragging]);

  if (hasError) {
    return (
      <div className="quicklook-error-boundary-state" role="alert">
        <div className="quicklook-error-icon-wrapper">
          <Icon name="image" />
        </div>
        <div className="quicklook-error-text-wrapper">
          <h3 className="quicklook-error-title">No se pudo decodificar la imagen</h3>
          <p className="quicklook-error-subtitle">
            «{payload.fileName}» no pudo ser renderizada o el archivo está temporalmente en uso por otra aplicación.
          </p>
        </div>
        <div className="quicklook-error-actions">
          <button
            type="button"
            className="quicklook-error-btn quicklook-error-btn-secondary"
            onClick={() => {
              setHasError(false);
              setRetryKey((k) => k + 1);
            }}
          >
            <Icon name="refresh" />
            <span>Reintentar decodificación</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="quicklook-image-content"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      style={{
        cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
      }}
    >
      <div className="quicklook-image-wrapper">
        <img
          ref={imgRef}
          alt={payload.fileName}
          className="quicklook-image-preview"
          decoding="auto"
          draggable={false}
          onError={handleImageError}
          onLoad={handleImageLoad}
          src={imgSrc}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: isDragging ? "none" : "transform 0.12s ease-out",
          }}
        />
      </div>
    </div>
  );
}
