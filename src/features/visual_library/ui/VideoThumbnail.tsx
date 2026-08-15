import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../shared/ui/Icon";
import { visualLibraryClient } from "../tauri/client";
import "./video-thumbnail.css";

interface VideoThumbnailProps {
  path: string;
  title: string;
  className?: string;
  eager?: boolean;
  onLoadDimensions?: (width: number, height: number) => void;
}

const MAX_FALLBACK_CANVAS_DIM = 480;
const MAX_VIDEO_CACHE = 300;
const videoThumbCache = new Map<string, string>();

/**
 * Loads video thumbnails natively via Rust (Windows Shell API) for fast,
 * memory-efficient downscaled previews without decoding 4K video in WebView2.
 * Falls back to an off-screen canvas (strictly downscaled to <= 480px) if needed.
 */
export function VideoThumbnail({
  path,
  title,
  className,
  eager = false,
  onLoadDimensions,
}: VideoThumbnailProps) {
  const [thumbSrc, setThumbSrc] = useState<string | null>(() => {
    return path ? videoThumbCache.get(path) ?? null : null;
  });
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const onLoadDimsRef = useRef(onLoadDimensions);
  onLoadDimsRef.current = onLoadDimensions;
  const startedRef = useRef(false);

  useEffect(() => {
    if (!path) return;
    if (videoThumbCache.has(path)) {
      setThumbSrc(videoThumbCache.get(path) ?? null);
      return;
    }
    if (startedRef.current) return;

    const container = containerRef.current;

    function startCapture() {
      if (startedRef.current) return;
      startedRef.current = true;

      // 1. Try native Rust thumbnail generator first
      visualLibraryClient
        .imagePreview(path)
        .then((nativeDataUrl) => {
          if (nativeDataUrl) {
            if (videoThumbCache.size >= MAX_VIDEO_CACHE) {
              const oldest = videoThumbCache.keys().next().value;
              if (oldest) videoThumbCache.delete(oldest);
            }
            videoThumbCache.set(path, nativeDataUrl);
            setThumbSrc(nativeDataUrl);
            return;
          }
          fallbackCanvasCapture();
        })
        .catch(() => {
          fallbackCanvasCapture();
        });
    }

    function fallbackCanvasCapture() {
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "auto";
      video.src = convertFileSrc(path);

      let cleaned = false;
      function cleanup() {
        if (cleaned) return;
        cleaned = true;
        video.src = "";
        video.remove();
      }

      const timeout = setTimeout(() => {
        setFailed(true);
        cleanup();
      }, 5000);

      video.addEventListener("error", () => {
        clearTimeout(timeout);
        setFailed(true);
        cleanup();
      });

      video.addEventListener("loadedmetadata", () => {
        const { videoWidth, videoHeight } = video;
        if (videoWidth > 0 && videoHeight > 0) {
          onLoadDimsRef.current?.(videoWidth, videoHeight);
        }
        const target =
          isFinite(video.duration) && video.duration > 0
            ? Math.min(1, Math.max(0.1, video.duration * 0.05))
            : 0.1;
        video.currentTime = target;
      });

      video.addEventListener("seeked", () => {
        clearTimeout(timeout);
        const { videoWidth: w, videoHeight: h } = video;
        if (w === 0 || h === 0) {
          setFailed(true);
          cleanup();
          return;
        }

        // Bound canvas dimension strictly to MAX_FALLBACK_CANVAS_DIM to prevent memory spikes
        const scale = Math.min(1, MAX_FALLBACK_CANVAS_DIM / Math.max(w, h));
        const canvasW = Math.max(1, Math.round(w * scale));
        const canvasH = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement("canvas");
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setFailed(true);
          cleanup();
          return;
        }
        try {
          ctx.drawImage(video, 0, 0, canvasW, canvasH);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
          if (dataUrl && dataUrl.length > 50) {
            videoThumbCache.set(path, dataUrl);
            setThumbSrc(dataUrl);
          } else {
            setFailed(true);
          }
        } catch {
          setFailed(true);
        }
        cleanup();
      });

      document.body.appendChild(video);
      video.load();
    }

    if (eager || !container || !("IntersectionObserver" in window)) {
      startCapture();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          startCapture();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [path, eager]);

  return (
    <span className={`video-thumbnail-container ${className ?? ""}`} ref={containerRef}>
      {thumbSrc ? (
        <img
          alt={title}
          className="video-thumbnail-media"
          decoding="async"
          src={thumbSrc}
        />
      ) : failed ? (
        <span className="video-thumbnail-fallback">
          <Icon name="video" />
        </span>
      ) : (
        <span className="video-thumbnail-fallback video-thumbnail-loading">
          <Icon name="video" />
        </span>
      )}
    </span>
  );
}
