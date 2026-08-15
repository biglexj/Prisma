import { convertFileSrc } from "@tauri-apps/api/core";
import { useState } from "react";
import type { QuickLookPayload } from "../model/types";

interface QuickLookImageProps {
  payload: QuickLookPayload;
}

export function QuickLookImage({ payload }: QuickLookImageProps) {
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const imgSrc = convertFileSrc(payload.path);

  return (
    <div className="quicklook-image-content">
      <div
        className="quicklook-image-wrapper"
        onClick={() => setZoomed((z) => !z)}
        title={zoomed ? "Reducir zoom" : "Ampliar zoom"}
      >
        <img
          alt={payload.fileName}
          className="quicklook-image-preview"
          decoding="async"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
            }
          }}
          src={imgSrc}
          style={{
            transform: zoomed ? "scale(1.45)" : "scale(1)",
            cursor: zoomed ? "zoom-out" : "zoom-in",
          }}
        />
      </div>

      {dimensions ? (
        <div className="quicklook-image-dims-badge">
          {dimensions.width} × {dimensions.height} px
        </div>
      ) : null}
    </div>
  );
}
