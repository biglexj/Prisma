import { useEffect, useRef, useState } from "react";
import { visualLibraryClient } from "../tauri/client";

const MAX_CACHE_ITEMS = 16;
const previewCache = new Map<string, string | null>();
const pendingPreviews = new Map<string, Promise<string | null>>();

interface VisualThumbnailProps {
  path: string;
  alt: string;
  className?: string;
  eager?: boolean;
  fit?: "cover" | "contain";
  onLoadDimensions?: (width: number, height: number) => void;
}

export function VisualThumbnail({
  path,
  alt,
  className,
  eager = false,
  fit = "cover",
  onLoadDimensions,
}: VisualThumbnailProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(eager);
  const preview = useImagePreview(path, visible);

  useEffect(() => {
    if (eager) return;
    const target = containerRef.current;
    if (!target || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "220px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [eager]);

  return (
    <span className={className} ref={containerRef}>
      {preview ? (
        <img
          alt={alt}
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              onLoadDimensions?.(img.naturalWidth, img.naturalHeight);
            }
          }}
          src={preview}
          style={{ objectFit: fit }}
        />
      ) : null}
    </span>
  );
}

export function useImagePreview(path: string | null, enabled = true) {
  const [preview, setPreview] = useState<string | null | undefined>(() =>
    path ? previewCache.get(path) : null,
  );

  useEffect(() => {
    if (!path) {
      setPreview(null);
      return;
    }
    const cached = previewCache.get(path);
    if (cached !== undefined) {
      setPreview(cached);
      return;
    }
    setPreview(undefined);
    if (!enabled) return;
    let cancelled = false;
    requestPreview(path).then((dataUrl) => {
      if (!cancelled) setPreview(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, path]);

  return preview ?? null;
}

function requestPreview(path: string): Promise<string | null> {
  if (previewCache.has(path)) {
    return Promise.resolve(previewCache.get(path) ?? null);
  }
  const pending = pendingPreviews.get(path);
  if (pending) return pending;
  const request = visualLibraryClient
    .imagePreview(path)
    .catch(() => null)
    .then((dataUrl) => {
      previewCache.delete(path);
      previewCache.set(path, dataUrl);
      if (previewCache.size > MAX_CACHE_ITEMS) {
        const oldest = previewCache.keys().next().value;
        if (oldest) previewCache.delete(oldest);
      }
      return dataUrl;
    })
    .finally(() => pendingPreviews.delete(path));
  pendingPreviews.set(path, request);
  return request;
}
