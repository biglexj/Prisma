import { useEffect, useState } from "react";

export interface AlbumPalette {
  accent: string;
  accentSoft: string;
  accentDeep: string;
  onAccent: string;
  primaryContainerDark: string;
  onPrimaryContainerDark: string;
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
      if (next) {
        paletteCache.set(key, next);
        if (paletteCache.size > MAX_PALETTE_ENTRIES) {
          const oldest = paletteCache.keys().next().value;
          if (oldest) paletteCache.delete(oldest);
        }
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

/**
 * Calcula la luminancia relativa según el estándar WCAG 2.1
 */
function luminance([red, green, blue]: [number, number, number]): number {
  const channels = [red, green, blue].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

/**
 * Determina el color de texto con máximo contraste garantizado (WCAG AAA)
 * contra el fondo dado: negro profundo (#0a0608) si el fondo es claro/medio,
 * o blanco puro (#ffffff) si el fondo es oscuro.
 */
export function getContrastingTextColor(rgb: [number, number, number]): string {
  const L = luminance(rgb);
  // Contraste con blanco (#ffffff, L=1.0): 1.05 / (L + 0.05)
  // Contraste con negro (#000000, L=0.0): (L + 0.05) / 0.05
  // El punto de cruce matemático exacto en WCAG 2.1 es L ≈ 0.179
  const contrastWhite = 1.05 / (L + 0.05);
  const contrastBlack = (L + 0.05) / 0.05;
  return contrastBlack >= contrastWhite ? "#0a0608" : "#ffffff";
}

function extractPalette(image: HTMLImageElement): AlbumPalette | null {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  let vibrantR = 0, vibrantG = 0, vibrantB = 0, vibrantWeight = 0;
  let fallbackR = 0, fallbackG = 0, fallbackB = 0, fallbackWeight = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 180) continue;
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const brightness = (max + min) / 510;
    const delta = max - min;
    const saturation = max === 0 ? 0 : delta / max;

    // Descartar extremos sin contenido cromático útil (blancos quemados y negros profundos)
    if (brightness < 0.06 || brightness > 0.95) continue;

    // Acumular fallback general para imágenes en blanco y negro o sepia
    fallbackR += r;
    fallbackG += g;
    fallbackB += b;
    fallbackWeight += 1;

    // Si el píxel contiene saturación real (color cromático), priorizarlo fuertemente
    if (saturation >= 0.16) {
      // Ponderación cuadrática según saturación y cercanía al punto medio de luminosidad (0.5)
      const weight = Math.pow(saturation, 2.2) * (1 - Math.abs(brightness - 0.5) * 0.7) + 0.15;
      vibrantR += r * weight;
      vibrantG += g * weight;
      vibrantB += b * weight;
      vibrantWeight += weight;
    }
  }

  const baseRgb: [number, number, number] = vibrantWeight > 0
    ? [
        Math.round(vibrantR / vibrantWeight),
        Math.round(vibrantG / vibrantWeight),
        Math.round(vibrantB / vibrantWeight),
      ]
    : fallbackWeight > 0
      ? [
          Math.round(fallbackR / fallbackWeight),
          Math.round(fallbackG / fallbackWeight),
          Math.round(fallbackB / fallbackWeight),
        ]
      : [168, 85, 247]; // fallback morado Prisma

  // Ajuste sutil de acento para presencia escénica
  const accentRgb = mix(baseRgb, luminance(baseRgb) < 0.18 ? [255, 255, 255] : [0, 0, 0], 0.08);
  const accentHex = toRgb(accentRgb);
  const onAccentText = getContrastingTextColor(accentRgb);

  // Contenedor oscuro con tinte refinado (para sidebar activo y tarjetas en dark mode)
  const darkContainer = `color-mix(in srgb, ${accentHex} 24%, #180e12)`;
  // Texto sobre el contenedor oscuro: contraste alto garantizado
  const darkOnContainer = `color-mix(in srgb, ${accentHex} 70%, #ffffff)`;

  return {
    accent: accentHex,
    accentSoft: `color-mix(in srgb, ${accentHex} 20%, var(--surface-container))`,
    accentDeep: `color-mix(in srgb, ${accentHex} 75%, #ffffff)`,
    onAccent: onAccentText,
    primaryContainerDark: darkContainer,
    onPrimaryContainerDark: darkOnContainer,
  };
}

function mix(left: [number, number, number], right: [number, number, number], amount: number): [number, number, number] {
  return left.map((value, index) => Math.round(value + (right[index] - value) * amount)) as [number, number, number];
}

function toRgb([red, green, blue]: [number, number, number]) {
  return `rgb(${red} ${green} ${blue})`;
}
