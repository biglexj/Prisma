import React from "react";
import type { VideoTechnicalMetadata } from "../../model/types";
import { Icon } from "../../../../shared/ui/Icon";
import "./video-technical-hud.css";

interface VideoTechnicalHudProps {
  metadata: VideoTechnicalMetadata | null;
  loading?: boolean;
  visible: boolean;
  onClose?: () => void;
}

export const VideoTechnicalHud: React.FC<VideoTechnicalHudProps> = ({
  metadata,
  loading = false,
  visible,
  onClose,
}) => {
  if (!visible) return null;

  return (
    <div className="video-technical-hud-card" onClick={(e) => e.stopPropagation()}>
      <div className="video-technical-hud-header">
        <div className="video-technical-hud-title">
          <Icon name="film" width={15} height={15} />
          <span>Ficha Técnica · Telemetría</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="take-pill-btn"
            style={{ padding: "2px 6px", fontSize: "0.7rem" }}
            title="Ocultar ficha técnica (I)"
          >
            <Icon name="x" width={13} height={13} />
          </button>
        )}
      </div>

      {loading && (
        <div style={{ fontSize: "0.78rem", color: "#94a3b8", padding: "6px 0" }}>
          Analizando pistas y metadatos con ffprobe...
        </div>
      )}

      {!loading && metadata && (
        <div className="video-technical-hud-chips">
          {/* Resolución & Aspect Ratio */}
          <span className="video-hud-chip highlight-res" title="Resolución nativa y relación de aspecto">
            <Icon name="video" width={12} height={12} />
            <span>
              {metadata.width}×{metadata.height} ({metadata.aspect_ratio})
            </span>
          </span>

          {/* Cuadros por segundo (FPS) */}
          <span className="video-hud-chip highlight-fps" title={`Frecuencia exacta: ${metadata.fps_fraction}`}>
            <span>{metadata.fps} fps</span>
          </span>

          {/* Códec de Vídeo & Perfil */}
          <span className="video-hud-chip" title={`Códec: ${metadata.codec} | Perfil: ${metadata.profile || "N/A"}`}>
            <span>{metadata.codec_display}</span>
          </span>

          {/* Profundidad de Color & Formato de Píxel */}
          <span className="video-hud-chip" title={`Formato de píxel: ${metadata.pixel_format}`}>
            <span>{metadata.bit_depth}-bit ({metadata.pixel_format})</span>
          </span>

          {/* Perfil de Color / HDR / Log */}
          {metadata.log_curve && (
            <span className="video-hud-chip highlight-log" title="Perfil Logarítmico detectado para DaVinci / Corrección de color">
              <Icon name="sliders" width={12} height={12} />
              <span>{metadata.log_curve}</span>
            </span>
          )}

          {metadata.is_hdr && !metadata.log_curve && (
            <span className="video-hud-chip highlight-hdr" title="Rango Dinámico Alto (HDR)">
              <span>HDR ({metadata.color_transfer || "PQ/HLG"})</span>
            </span>
          )}

          {metadata.color_space && !metadata.log_curve && !metadata.is_hdr && (
            <span className="video-hud-chip" title="Espacio de color">
              <span>{metadata.color_space.toUpperCase()}</span>
            </span>
          )}

          {/* Tasa de Bits (Bitrate) */}
          {metadata.bitrate_display !== "N/A" && (
            <span className="video-hud-chip" title="Bitrate promedio del archivo">
              <span>{metadata.bitrate_display}</span>
            </span>
          )}

          {/* Cámara / Modelo */}
          {(metadata.camera_make || metadata.camera_model) && (
            <span className="video-hud-chip highlight-camera" title="Cámara o dispositivo de captura">
              <Icon name="camera" width={12} height={12} />
              <span>
                {[metadata.camera_make, metadata.camera_model].filter(Boolean).join(" ")}
              </span>
            </span>
          )}

          {/* Pista de Audio */}
          {metadata.audio_codec && (
            <span className="video-hud-chip" title={`Audio: ${metadata.audio_channels} canales @ ${metadata.audio_sample_rate} Hz`}>
              <Icon name="volume" width={12} height={12} />
              <span>
                {metadata.audio_codec.toUpperCase()} {metadata.audio_channels === 2 ? "Stereo" : `${metadata.audio_channels}ch`}
              </span>
            </span>
          )}
        </div>
      )}

      {!loading && !metadata && (
        <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
          Metadatos no disponibles para este archivo.
        </div>
      )}
    </div>
  );
};
