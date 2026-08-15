import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../../shared/ui/Icon";

interface VideoThumbnailProps {
  path: string;
  title: string;
  className?: string;
  eager?: boolean;
  onLoadDimensions?: (width: number, height: number) => void;
}

/**
 * Captures the first seekable frame of a local video file via an off-screen
 * <video> element + canvas. Uses Tauri's convertFileSrc to generate the
 * correct asset:// URL for WebView2. Reports real video dimensions so the
 * bento grid can assign the correct card shape.
 *
 * Falls back gracefully to the icon placeholder if the browser cannot read
 * the file (unsupported codec, permission error, tainted canvas, etc.).
 */
export function VideoThumbnail({
  path,
  title,
  className,
  eager = false,
  onLoadDimensions,
}: VideoThumbnailProps) {
  const [thumbSrc, setThumbSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  // Stable ref for the callback — avoids re-triggering the effect
  const onLoadDimsRef = useRef(onLoadDimensions);
  onLoadDimsRef.current = onLoadDimensions;
  const startedRef = useRef(false);

  useEffect(() => {
    if (!path || startedRef.current) return;

    const container = containerRef.current;

    function startCapture() {
      if (startedRef.current) return;
      startedRef.current = true;

      const video = document.createElement("video");
      video.muted = true;
      video.preload = "metadata";
      // Use Tauri's asset protocol — no crossOrigin needed (same-origin)
      video.src = convertFileSrc(path);

      function cleanup() {
        video.src = "";
        video.load();
        video.remove();
      }

      video.addEventListener("error", () => {
        setFailed(true);
        cleanup();
      });

      video.addEventListener("loadedmetadata", () => {
        const { videoWidth, videoHeight } = video;
        if (videoWidth > 0 && videoHeight > 0) {
          onLoadDimsRef.current?.(videoWidth, videoHeight);
        }
        // Seek to 1 s or 10 % into the video for a representative frame
        const target = isFinite(video.duration) && video.duration > 0
          ? Math.min(1, video.duration * 0.1)
          : 0;
        video.currentTime = target;
      });

      video.addEventListener("seeked", () => {
        const { videoWidth: w, videoHeight: h } = video;
        if (w === 0 || h === 0) {
          setFailed(true);
          cleanup();
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setFailed(true);
          cleanup();
          return;
        }
        ctx.drawImage(video, 0, 0, w, h);
        try {
          setThumbSrc(canvas.toDataURL("image/jpeg", 0.72));
        } catch {
          // Canvas tainted — fallback icon
          setFailed(true);
        }
        cleanup();
      });

      // Some videos don't fire seeked if currentTime = 0; force a seek
      video.addEventListener("loadeddata", () => {
        if (video.readyState >= 2 && video.currentTime === 0) {
          video.currentTime = 0.001;
        }
      });

      document.body.appendChild(video);
      video.load();
    }

    // Eager: capture immediately
    if (eager || !container || !("IntersectionObserver" in window)) {
      startCapture();
      return;
    }

    // Lazy: wait until the card enters the viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          startCapture();
        }
      },
      { rootMargin: "400px" },
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
