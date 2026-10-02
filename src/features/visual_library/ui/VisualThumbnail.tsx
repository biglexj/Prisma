import { useEffect, useRef, useState } from "react";
import { cleanPath, normalizePathSeparators } from "../../../shared/mediaTree";
import { visualLibraryClient } from "../tauri/client";

const MAX_CACHE_ITEMS = 400;
const MAX_CACHE_BYTES = 32 * 1024 * 1024;

interface PreviewCacheEntry {
  data: string | null;
  bytes: number;
  modified?: number;
}

const previewCache = new Map<string, PreviewCacheEntry>();
const pendingPreviews = new Map<string, Promise<string | null>>();
let totalEstimatedCacheBytes = 0;

function normalizeCacheKey(path: string): string {
  return normalizePathSeparators(path).toLowerCase();
}

/**
 * Invalida la caché de miniaturas de imagen en memoria.
 * Si se especifica una ruta, invalida esa imagen y notifica a los componentes activos.
 * Si no se especifica, purga toda la caché y fuerza la recarga global desde disco.
 */
export function invalidateImagePreview(path?: string): void {
  if (path) {
    const key = normalizeCacheKey(path);
    const prev = previewCache.get(key);
    if (prev) totalEstimatedCacheBytes -= prev.bytes;
    previewCache.delete(key);
    pendingPreviews.delete(key);

    const rawPrev = previewCache.get(path);
    if (rawPrev) totalEstimatedCacheBytes -= rawPrev.bytes;
    previewCache.delete(path);
    pendingPreviews.delete(path);

    window.dispatchEvent(
      new CustomEvent("prisma-visual-thumbnail-invalidated", {
        detail: { path: cleanPath(path) },
      }),
    );
  } else {
    previewCache.clear();
    pendingPreviews.clear();
    totalEstimatedCacheBytes = 0;
    window.dispatchEvent(
      new CustomEvent("prisma-visual-thumbnail-invalidated", {
        detail: { all: true },
      }),
    );
  }
}

interface VisualThumbnailProps {
  path: string;
  alt: string;
  className?: string;
  eager?: boolean;
  fit?: "cover" | "contain";
  modified?: number;
  onLoadDimensions?: (width: number, height: number) => void;
}

export function getCachedImagePreview(path: string): string | null {
  const key = normalizeCacheKey(path);
  return previewCache.get(key)?.data ?? previewCache.get(path)?.data ?? null;
}

export function VisualThumbnail({
  path,
  alt,
  className,
  eager = false,
  fit = "cover",
  modified,
  onLoadDimensions,
}: VisualThumbnailProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const cacheKey = path ? normalizeCacheKey(path) : null;
  const isCached = cacheKey ? previewCache.has(cacheKey) : false;
  const [visible, setVisible] = useState(eager || isCached);
  const preview = useImagePreview(path, visible, modified);

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
          crossOrigin="anonymous"
          decoding="async"
          draggable={false}
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

export function useImagePreview(path: string | null, enabled = true, modified?: number) {
  const cacheKey = path ? normalizeCacheKey(path) : null;

  const [preview, setPreview] = useState<string | null | undefined>(() => {
    if (!cacheKey) return null;
    const entry = previewCache.get(cacheKey);
    if (!entry) return null;
    if (modified !== undefined && entry.modified !== undefined && entry.modified !== modified) {
      return null;
    }
    return entry.data;
  });

  // Escuchar eventos de invalidación globales reactivos
  useEffect(() => {
    if (!path) return;
    const targetClean = cleanPath(path);

    const onInvalidate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.all || (detail?.path && cleanPath(detail.path) === targetClean)) {
        if (enabled) {
          requestPreview(path, modified, true).then((dataUrl) => {
            setPreview(dataUrl);
          });
        } else {
          setPreview(undefined);
        }
      }
    };

    window.addEventListener("prisma-visual-thumbnail-invalidated", onInvalidate);
    return () => {
      window.removeEventListener("prisma-visual-thumbnail-invalidated", onInvalidate);
    };
  }, [enabled, modified, path]);

  useEffect(() => {
    if (!path || !cacheKey) {
      setPreview(null);
      return;
    }
    const cached = previewCache.get(cacheKey);
    if (cached !== undefined) {
      if (modified === undefined || cached.modified === undefined || cached.modified === modified) {
        previewCache.delete(cacheKey);
        previewCache.set(cacheKey, cached);
        setPreview(cached.data);
        return;
      }
      // Entrada desactualizada por cambio de fecha/modificación
      totalEstimatedCacheBytes -= cached.bytes;
      previewCache.delete(cacheKey);
    }
    setPreview(undefined);
    if (!enabled) return;
    let cancelled = false;
    requestPreview(path, modified).then((dataUrl) => {
      if (!cancelled) setPreview(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, modified, path]);

  return preview ?? null;
}

function requestPreview(path: string, modified?: number, force = false): Promise<string | null> {
  const cacheKey = normalizeCacheKey(path);
  if (!force) {
    const cached = previewCache.get(cacheKey);
    if (cached !== undefined) {
      if (modified === undefined || cached.modified === undefined || cached.modified === modified) {
        previewCache.delete(cacheKey);
        previewCache.set(cacheKey, cached);
        return Promise.resolve(cached.data);
      }
    }
  } else {
    const previous = previewCache.get(cacheKey);
    if (previous) totalEstimatedCacheBytes -= previous.bytes;
    previewCache.delete(cacheKey);
    pendingPreviews.delete(cacheKey);
  }

  const pending = pendingPreviews.get(cacheKey);
  if (pending && !force) return pending;

  const request = visualLibraryClient
    .imagePreview(path)
    .catch(() => null)
    .then((dataUrl) => {
      const previous = previewCache.get(cacheKey);
      if (previous) totalEstimatedCacheBytes -= previous.bytes;
      previewCache.delete(cacheKey);

      const bytes = dataUrl ? dataUrl.length * 2 : 64;
      previewCache.set(cacheKey, { data: dataUrl, bytes, modified });
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
    .finally(() => pendingPreviews.delete(cacheKey));

  pendingPreviews.set(cacheKey, request);
  return request;
}
