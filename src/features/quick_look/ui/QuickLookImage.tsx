import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useState, useRef } from "react";
import type { QuickLookPayload } from "../model/types";

interface QuickLookImageProps {
  payload: QuickLookPayload;
  onDimensionsLoad?: (dims: { width: number; height: number }) => void;
}

export function QuickLookImage({ payload, onDimensionsLoad }: QuickLookImageProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPanRef = useRef({ x: 0, y: 0 });

  const imgSrc = convertFileSrc(payload.path);

  const handleImageLoad = async (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (nw && nh) {
      onDimensionsLoad?.({ width: nw, height: nh });

      try {
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

        void invoke("quick_look_set_size", { width: targetW, height: targetH }).catch(() => {});
      } catch {}
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((prev) => {
      const next = Math.max(0.5, Math.min(5.0, prev * factor));
      if (next <= 1.05) {
        setPan({ x: 0, y: 0 });
        return 1;
      }
      return Number(next.toFixed(2));
    });
  };

  const handleDoubleClick = () => {
    setZoom((prev) => (prev > 1 ? 1 : 1.75));
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && zoom > 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      initialPanRef.current = { ...pan };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current && zoom > 1) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({
        x: initialPanRef.current.x + dx,
        y: initialPanRef.current.y + dy,
      });
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div
      className="quicklook-image-content"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <div className="quicklook-image-wrapper">
        <img
          alt={payload.fileName}
          className="quicklook-image-preview"
          decoding="async"
          draggable={false}
          onLoad={handleImageLoad}
          src={imgSrc}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            cursor: zoom > 1 ? "grab" : "zoom-in",
            transition: isDraggingRef.current ? "none" : "transform 0.12s ease-out",
          }}
        />
      </div>
    </div>
  );
}
