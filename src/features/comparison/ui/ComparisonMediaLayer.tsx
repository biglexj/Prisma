import React from "react";
import { toSafeAssetUrl } from "../../../shared/mediaTree";
import type { ComparisonImageSlot } from "../model/types";
import { isVideoPath } from "../model/types";

interface ComparisonMediaLayerProps {
  slot: ComparisonImageSlot;
  zoom?: number;
  pan?: { x: number; y: number };
  onMediaLoad?: (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>, slotId: string) => void;
  videoRef?: (el: HTMLVideoElement | null) => void;
  isMuted?: boolean;
}

export const ComparisonMediaLayer: React.FC<ComparisonMediaLayerProps> = ({
  slot,
  zoom = slot.zoom,
  pan = slot.pan,
  onMediaLoad,
  videoRef,
  isMuted = true,
}) => {
  const isVideo = slot.item.kind === "video" || isVideoPath(slot.item.path);

  return (
    <div
      className="img-compare-layer"
      style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      }}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          src={toSafeAssetUrl(slot.item.path)}
          className="img-compare-media-element img-compare-video-element"
          playsInline
          loop
          muted={isMuted}
          onLoadedMetadata={(e) => onMediaLoad?.(e, slot.id)}
        />
      ) : (
        <img
          src={toSafeAssetUrl(slot.item.path)}
          alt={slot.item.title}
          className="img-compare-media-element img-compare-img-element"
          draggable={false}
          onLoad={(e) => onMediaLoad?.(e, slot.id)}
        />
      )}
    </div>
  );
};
