import React, { useCallback, useRef } from "react";
import type { AspectRatioOption, CropRect } from "./editorTypes";
import { aspectRatioValue } from "./cropGeometry";

interface ImageCropOverlayProps {
  containerWidth: number;
  containerHeight: number;
  crop: CropRect;
  aspectRatio: AspectRatioOption;
  onChange: (crop: CropRect) => void;
}

type DragHandle =
  | "move"
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "n"
  | "s"
  | "w"
  | "e"
  | null;

export function ImageCropOverlay({
  containerWidth,
  containerHeight,
  crop,
  aspectRatio,
  onChange,
}: ImageCropOverlayProps) {
  const activeHandleRef = useRef<DragHandle>(null);
  const dragStartRef = useRef<{ x: number; y: number; startCrop: CropRect }>({
    x: 0,
    y: 0,
    startCrop: crop,
  });

  const getTargetRatio = useCallback((): number | null => {
    return aspectRatioValue(aspectRatio);
  }, [aspectRatio]);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    handle: DragHandle
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    activeHandleRef.current = handle;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startCrop: { ...crop },
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const handle = activeHandleRef.current;
    if (!handle || containerWidth <= 0 || containerHeight <= 0) return;

    const dx = (e.clientX - dragStartRef.current.x) / containerWidth;
    const dy = (e.clientY - dragStartRef.current.y) / containerHeight;
    const start = dragStartRef.current.startCrop;
    const targetRatio = getTargetRatio();
    const imgAspect = containerWidth / containerHeight;

    let next = { ...start };

    if (handle === "move") {
      next.x = Math.max(0, Math.min(1 - start.width, start.x + dx));
      next.y = Math.max(0, Math.min(1 - start.height, start.y + dy));
      onChange(next);
      return;
    }

    const minSize = 0.05;

    // Manejo de libre o con proporción fija
    if (!targetRatio) {
      if (handle.includes("w")) {
        const maxX = start.x + start.width - minSize;
        next.x = Math.max(0, Math.min(maxX, start.x + dx));
        next.width = start.width - (next.x - start.x);
      }
      if (handle.includes("e")) {
        next.width = Math.max(minSize, Math.min(1 - start.x, start.width + dx));
      }
      if (handle.includes("n")) {
        const maxY = start.y + start.height - minSize;
        next.y = Math.max(0, Math.min(maxY, start.y + dy));
        next.height = start.height - (next.y - start.y);
      }
      if (handle.includes("s")) {
        next.height = Math.max(minSize, Math.min(1 - start.y, start.height + dy));
      }
    } else {
      // Proporción fija
      const normRatio = targetRatio / imgAspect;
      if (handle === "se" || handle === "e" || handle === "s") {
        let newW = Math.max(minSize, Math.min(1 - start.x, start.width + dx));
        let newH = newW / normRatio;
        if (start.y + newH > 1) {
          newH = 1 - start.y;
          newW = newH * normRatio;
        }
        next.width = newW;
        next.height = newH;
      } else if (handle === "sw") {
        let newW = Math.max(minSize, Math.min(start.x + start.width, start.width - dx));
        let newH = newW / normRatio;
        if (start.y + newH > 1) {
          newH = 1 - start.y;
          newW = newH * normRatio;
        }
        next.x = start.x + (start.width - newW);
        next.width = newW;
        next.height = newH;
      } else if (handle === "ne") {
        let newW = Math.max(minSize, Math.min(1 - start.x, start.width + dx));
        let newH = newW / normRatio;
        if (start.y + start.height - newH < 0) {
          newH = start.y + start.height;
          newW = newH * normRatio;
        }
        next.y = start.y + (start.height - newH);
        next.width = newW;
        next.height = newH;
      } else if (handle === "nw" || handle === "n" || handle === "w") {
        let newW = Math.max(minSize, Math.min(start.x + start.width, start.width - dx));
        let newH = newW / normRatio;
        if (start.y + start.height - newH < 0) {
          newH = start.y + start.height;
          newW = newH * normRatio;
        }
        next.x = start.x + (start.width - newW);
        next.y = start.y + (start.height - newH);
        next.width = newW;
        next.height = newH;
      }
    }

    onChange(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeHandleRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      activeHandleRef.current = null;
    }
  };

  const leftPx = crop.x * containerWidth;
  const topPx = crop.y * containerHeight;
  const widthPx = crop.width * containerWidth;
  const heightPx = crop.height * containerHeight;

  return (
    <div
      className="image-crop-overlay-container"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ width: containerWidth, height: containerHeight }}
    >
      {/* 4 Scrims oscuros alrededor del área recortada */}
      <div
        className="crop-scrim"
        style={{ top: 0, left: 0, width: "100%", height: topPx }}
      />
      <div
        className="crop-scrim"
        style={{
          top: topPx,
          left: 0,
          width: leftPx,
          height: heightPx,
        }}
      />
      <div
        className="crop-scrim"
        style={{
          top: topPx,
          left: leftPx + widthPx,
          width: containerWidth - (leftPx + widthPx),
          height: heightPx,
        }}
      />
      <div
        className="crop-scrim"
        style={{
          top: topPx + heightPx,
          left: 0,
          width: "100%",
          height: containerHeight - (topPx + heightPx),
        }}
      />

      {/* Caja de recorte interactiva */}
      <div
        className="crop-active-box"
        style={{
          left: leftPx,
          top: topPx,
          width: widthPx,
          height: heightPx,
        }}
        onPointerDown={(e) => handlePointerDown(e, "move")}
      >
        {/* Rejilla de tercios */}
        <div className="crop-grid-line crop-grid-h-1" />
        <div className="crop-grid-line crop-grid-h-2" />
        <div className="crop-grid-line crop-grid-v-1" />
        <div className="crop-grid-line crop-grid-v-2" />

        {/* 8 Asas de redimensionamiento */}
        <div
          className="crop-handle crop-handle-nw"
          onPointerDown={(e) => handlePointerDown(e, "nw")}
        />
        <div
          className="crop-handle crop-handle-ne"
          onPointerDown={(e) => handlePointerDown(e, "ne")}
        />
        <div
          className="crop-handle crop-handle-sw"
          onPointerDown={(e) => handlePointerDown(e, "sw")}
        />
        <div
          className="crop-handle crop-handle-se"
          onPointerDown={(e) => handlePointerDown(e, "se")}
        />

        {!getTargetRatio() && (
          <>
            <div
              className="crop-handle crop-handle-n"
              onPointerDown={(e) => handlePointerDown(e, "n")}
            />
            <div
              className="crop-handle crop-handle-s"
              onPointerDown={(e) => handlePointerDown(e, "s")}
            />
            <div
              className="crop-handle crop-handle-w"
              onPointerDown={(e) => handlePointerDown(e, "w")}
            />
            <div
              className="crop-handle crop-handle-e"
              onPointerDown={(e) => handlePointerDown(e, "e")}
            />
          </>
        )}
      </div>
    </div>
  );
}
