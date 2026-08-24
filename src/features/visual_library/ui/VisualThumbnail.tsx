import { useEffect, useRef, useState } from "react";
import { visualLibraryClient } from "../tauri/client";

const MAX_CACHE_ITEMS = 400;
const MAX_CACHE_BYTES = 32 * 1024 * 1024;

interface PreviewCacheEntry {
  data: string | null;
  bytes: number;
}

const previewCache = new Map<string, PreviewCacheEntry>();
const pendingPreviews = new Map<string, Promise<string | null>>();
let totalEstimatedCacheBytes = 0;

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
  const isCached = path ? previewCache.has(path) : false;
  const [visible, setVisible] = useState(eager || isCached);
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
    path ? previewCache.get(path)?.data : null,
  );

  useEffect(() => {
    if (!path) {
      setPreview(null);
      return;
    }
    const cached = previewCache.get(path);
    if (cached !== undefined) {
      previewCache.delete(path);
      previewCache.set(path, cached);
      setPreview(cached.data);
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
  const cached = previewCache.get(path);
  if (cached !== undefined) {
    previewCache.delete(path);
    previewCache.set(path, cached);
    return Promise.resolve(cached.data);
  }
  const pending = pendingPreviews.get(path);
  if (pending) return pending;
  const request = visualLibraryClient
    .imagePreview(path)
    .catch(() => null)
    .then((dataUrl) => {
      const previous = previewCache.get(path);
      if (previous) totalEstimatedCacheBytes -= previous.bytes;
      previewCache.delete(path);

      const bytes = dataUrl ? dataUrl.length * 2 : 64;
      previewCache.set(path, { data: dataUrl, bytes });
      totalEstimatedCacheBytes += bytes;

      while (
        previewCache.size > MAX_CACHE_ITEMS ||
        totalEstimatedCacheBytes > MAX_CACHE_BYTES
      ) {
        const oldest = previewCache.keys().next().value;
        if (!oldest) break;
        const entry = previewCache.get(oldest);
        if (entry) totalEstimatedCacheBytes -= entry.bytes;
        previewCache.delete(oldest);
      }
      return dataUrl;
    })
    .finally(() => pendingPreviews.delete(path));
  pendingPreviews.set(path, request);
  return request;
}
