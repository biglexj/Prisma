import React, { useEffect, useState } from "react";
import { toSafeAssetUrl } from "../../../shared/mediaTree";
import { Icon } from "../../../shared/ui/Icon";
import { musicLibraryClient } from "../../music_library/tauri/client";
import type { ComparisonImageSlot } from "../model/types";
import { isVideoPath, isAudioPath } from "../model/types";

interface ComparisonMediaLayerProps {
  slot: ComparisonImageSlot;
  zoom?: number;
  pan?: { x: number; y: number };
  onMediaLoad?: (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement | HTMLAudioElement>, slotId: string) => void;
  videoRef?: (el: HTMLVideoElement | HTMLAudioElement | null) => void;
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
  const isAudio = (slot.item.kind as string) === "audio" || isAudioPath(slot.item.path);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (isAudio) {
      musicLibraryClient
        .artwork(slot.item.path)
        .then((art) => {
          if (active && art) {
            setArtworkUrl(art);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [isAudio, slot.item.path]);

  const fileExt = slot.item.path.split(".").pop()?.toUpperCase() || "AUDIO";

  return (
    <div
      className="img-compare-layer"
      style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      }}
    >
      {isVideo ? (
        <video
          ref={videoRef as (el: HTMLVideoElement | null) => void}
          src={toSafeAssetUrl(slot.item.path)}
          className="img-compare-media-element img-compare-video-element"
          playsInline
          loop
          muted={isMuted}
          onLoadedMetadata={(e) => onMediaLoad?.(e, slot.id)}
        />
      ) : isAudio ? (
        <div className="img-compare-audio-card">
          <audio
            ref={videoRef as (el: HTMLAudioElement | null) => void}
            src={toSafeAssetUrl(slot.item.path)}
            loop
            muted={isMuted}
            onLoadedMetadata={(e) => onMediaLoad?.(e, slot.id)}
          />

          <div className="img-compare-audio-disc-wrap">
            {artworkUrl ? (
              <img
                src={artworkUrl}
                alt={slot.item.title}
                className={`img-compare-audio-cover ${!isMuted ? "is-active" : ""}`}
                draggable={false}
              />
            ) : (
              <div className={`img-compare-audio-vinyl ${!isMuted ? "is-active" : ""}`}>
                <div className="img-compare-vinyl-grooves" />
                <div className="img-compare-vinyl-center">
                  <Icon name="music" />
                </div>
              </div>
            )}

            {!isMuted && (
              <div className="img-compare-audio-equalizer" title="Pista de audio activa">
                <span className="eq-bar eq-1" />
                <span className="eq-bar eq-2" />
                <span className="eq-bar eq-3" />
                <span className="eq-bar eq-4" />
              </div>
            )}
          </div>

          <div className="img-compare-audio-info">
            <span className="img-compare-audio-format-badge">{fileExt}</span>
            <h4 className="img-compare-audio-title-text" title={slot.item.title}>
              {slot.item.title}
            </h4>
            <span className="img-compare-audio-status">
              {isMuted ? "Silenciado (pasa el cursor para escuchar)" : "Sonando (Audio Focus activo)"}
            </span>
          </div>
        </div>
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
