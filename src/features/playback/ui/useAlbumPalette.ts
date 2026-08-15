import { useEffect, useState } from "react";

export interface AlbumPalette {
  accent: string;
  accentSoft: string;
  accentDeep: string;
  onAccent: string;
}

const MAX_PALETTE_ENTRIES = 64;
const paletteCache = new Map<string, AlbumPalette>();

function getArtworkKey(artwork: string): string {
  if (artwork.length <= 128) return artwork;
  let hash = 5381;
  const step = Math.max(1, Math.floor(artwork.length / 64));
  for (let i = 0; i < artwork.length; i += step) {
    hash = ((hash << 5) + hash) + artwork.charCodeAt(i);
    hash |= 0;
  }
  return `${artwork.length}_${hash}`;
}

export function useAlbumPalette(artwork: string | null) {
  const key = artwork ? getArtworkKey(artwork) : null;
  const [palette, setPalette] = useState<AlbumPalette | null>(() =>
    key ? paletteCache.get(key) ?? null : null,
  );

  useEffect(() => {
    if (!artwork || !key) {
      setPalette(null);
      return;
    }
    const cached = paletteCache.get(key);
    if (cached) {
      paletteCache.delete(key);
      paletteCache.set(key, cached);
      setPalette(cached);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled) return;
      const next = extractPalette(image);
      paletteCache.delete(key);
      paletteCache.set(key, next);
      if (paletteCache.size > MAX_PALETTE_ENTRIES) {
        const oldest = paletteCache.keys().next().value;
        if (oldest) paletteCache.delete(oldest);
      }
      setPalette(next);
      image.onload = null;
      image.onerror = null;
      image.src = "";
    };
    image.onerror = () => {
      if (!cancelled) setPalette(null);
      image.onload = null;
      image.onerror = null;
    };
    image.src = artwork;
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
      image.src = "";
    };
  }, [artwork, key]);

  return palette;
}

function extractPalette(image: HTMLImageElement): AlbumPalette {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return fallbackPalette();
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let totalWeight = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 180) continue;
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const brightness = (max + min) / 510;
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (brightness < 0.08 || brightness > 0.94) continue;
    const weight = 0.35 + saturation * 1.8;
    red += r * weight;
    green += g * weight;
    blue += b * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return fallbackPalette();
  const rgb: [number, number, number] = [
    Math.round(red / totalWeight),
    Math.round(green / totalWeight),
    Math.round(blue / totalWeight),
  ];
  const accent = mix(rgb, luminance(rgb) < 0.22 ? [255, 255, 255] : [0, 0, 0], 0.12);
  return {
    accent: toRgb(accent),
    accentSoft: toRgb(mix(accent, [255, 248, 247], 0.78)),
    accentDeep: toRgb(mix(accent, [24, 14, 18], 0.55)),
    onAccent: luminance(accent) > 0.42 ? "rgb(25 15 18)" : "rgb(255 255 255)",
  };
}

function fallbackPalette(): AlbumPalette {
  return { accent: "rgb(201 0 69)", accentSoft: "rgb(255 217 223)", accentDeep: "rgb(85 20 47)", onAccent: "rgb(255 255 255)" };
}

function mix(left: [number, number, number], right: [number, number, number], amount: number): [number, number, number] {
  return left.map((value, index) => Math.round(value + (right[index] - value) * amount)) as [number, number, number];
}

function toRgb([red, green, blue]: [number, number, number]) {
  return `rgb(${red} ${green} ${blue})`;
}

function luminance([red, green, blue]: [number, number, number]) {
  const channels = [red, green, blue].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
