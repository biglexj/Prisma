/** Configuración compartida y ligera: importar la galería no carga Three.js. */
import catalog from "./catalog.json";
import type { BackgroundControls } from "./aurora/controls";
export { BACKGROUND_MOTIONS, BACKGROUND_VIEWS } from "./aurora/controls";
import { AMBIENT_BACKGROUNDS } from "./aurora/Backgrounds/themes";
export const AMBIENTS = [...AMBIENT_BACKGROUNDS,
  { value: "solid", label: "Color sólido", colors: "#00C9B9" },
  { value: "gradient", label: "Degradado", colors: "linear-gradient(135deg,#00C9B9,#703ca5)" }];
export const SCENARIOS = catalog;
export type SceneEntry = typeof catalog[number];

/**
 * Capas del modelo de composición (el nativo habla de "capas 2 a 6"):
 * 1 base (vídeo o imagen) · 2 ambiente · 3 fondos planos · 4 escenarios 3D
 * · 5 partículas 3D · 6 partículas 2D. El parallax actúa sobre las capas con cámara.
 */
export type Layer = "ambient" | "dynamic" | "scene" | "particles" | "overlay" | "parallax";
/** Capas que guardan ajustes por efecto dentro de `controls`. */
export type EffectLayer = Exclude<Layer, "overlay" | "parallax">;
export type LayerControls = Omit<BackgroundControls, "ambient" | "clickEffect" | "clickTrail">;

/**
 * Partículas 2D: capa propia, independiente de las volumétricas.
 * Las formas y su dibujo vienen de Aurora (`aurora/particles/ParticleLayer.tsx`).
 */
export const OVERLAY_SHAPES = [
  { value: "tech", label: "Circuito", glyph: "⚡" },
  { value: "circle", label: "Círculo", glyph: "●" },
  { value: "star", label: "Estrella", glyph: "★" },
  { value: "heart", label: "Corazón", glyph: "♥" },
  { value: "square", label: "Cuadrado", glyph: "■" },
  { value: "diamond", label: "Rombo", glyph: "◆" },
  { value: "sparkle", label: "Destello", glyph: "✦" },
  { value: "ripple", label: "Onda", glyph: "◎" },
  { value: "digits", label: "Dígitos", glyph: "01" },
  { value: "bubble", label: "Burbuja", glyph: "◌" },
  { value: "petal", label: "Pétalo", glyph: "❀" },
  { value: "note", label: "Nota", glyph: "♪" },
  { value: "snow", label: "Nieve", glyph: "❄" },
] as const;
export type OverlayShape = typeof OVERLAY_SHAPES[number]["value"];

export const OVERLAY_DIRECTIONS = [
  { value: "down", label: "Caen" }, { value: "up", label: "Suben" }, { value: "float", label: "Flotan" },
] as const;
export type OverlayDirection = typeof OVERLAY_DIRECTIONS[number]["value"];

export interface OverlayParticlesConfig {
  enabled: boolean;
  paused: boolean;
  shape: OverlayShape;
  direction: OverlayDirection;
  color: string;
  size: number;
  density: number;
  speed: number;
  opacity: number;
}
/** Mismos valores por defecto que la capa nativa, para que la ida y vuelta no cambie nada. */
export const DEFAULT_OVERLAY_PARTICLES: OverlayParticlesConfig = {
  enabled: false, paused: false, shape: "circle", direction: "float",
  color: "#00C9B9", size: 1, density: 1, speed: 1, opacity: 1,
};

export interface CompositionConfig {
  /** Capa 2: ambiente. Por sí solo ya es un fondo. */
  ambient: string;
  ambientColor: string;
  ambientColor2: string;
  ambientOpacity: number;
  /** Capa 3: fondo plano de pantalla completa. */
  dynamic: string;
  /** Capa 4: escenario 3D. */
  scenario: string;
  /** Capa 5: partículas volumétricas. */
  particle: string;
  /** Capa 6: partículas 2D dibujadas sobre el lienzo. */
  overlay: OverlayParticlesConfig;
  intensity: number;
  audioLevel: number;
  paused: boolean;
  enabled: boolean;
  controls: Record<string, LayerControls>;
  visibility: { ambient: boolean; dynamic: boolean; scenario: boolean; particles: boolean };
  parallax: { enabled: boolean; strength: number; base?: boolean };
}
export const DEFAULT_LAYER_CONTROLS: LayerControls = {
  motion: "spinAxis", view: "front", speed: 0.5, zoom: 1, panX: 0, panY: 0,
  yaw: 0, pitch: 0, paused: false, colorCycle: false, quality: 1,
};
export function layerKey(config: CompositionConfig, layer: EffectLayer): string {
  if (layer === "ambient") return "ambient";
  if (layer === "dynamic") return `dynamic:${config.dynamic}`;
  if (layer === "scene") return `scene:${config.scenario}`;
  return `particles:${config.particle}`;
}
export function getLayerControls(config: CompositionConfig, layer: EffectLayer): LayerControls {
  return { ...DEFAULT_LAYER_CONTROLS, ...config.controls?.[layerKey(config, layer)] };
}
function clamp(value: number, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
export function normalizeComposition(config: CompositionConfig): CompositionConfig {
  const overlay = { ...DEFAULT_OVERLAY_PARTICLES, ...config.overlay };
  return { ...config,
    ambientColor: (!config.ambientColor || config.ambientColor === "#263b62") ? "#00C9B9" : config.ambientColor, ambientColor2: config.ambientColor2 ?? "#703ca5",
    ambientOpacity: clamp(config.ambientOpacity, 0, 1, 1),
    dynamic: config.dynamic ?? "none",
    particle: config.particle ?? "none",
    overlay: {
      ...overlay,
      shape: OVERLAY_SHAPES.some(item => item.value === overlay.shape) ? overlay.shape : DEFAULT_OVERLAY_PARTICLES.shape,
      color: (!overlay.color || overlay.color === "#b8efff") ? "#00C9B9" : overlay.color,
      direction: OVERLAY_DIRECTIONS.some(item => item.value === overlay.direction) ? overlay.direction : DEFAULT_OVERLAY_PARTICLES.direction,
      size: clamp(overlay.size, 0.25, 4, DEFAULT_OVERLAY_PARTICLES.size),
      density: clamp(overlay.density, 0.1, 3, DEFAULT_OVERLAY_PARTICLES.density),
      speed: clamp(overlay.speed, 0.1, 3, DEFAULT_OVERLAY_PARTICLES.speed),
      opacity: clamp(overlay.opacity, 0, 1, DEFAULT_OVERLAY_PARTICLES.opacity),
    },
    controls: config.controls ?? {},
    visibility: { ambient: config.visibility?.ambient ?? true, dynamic: config.visibility?.dynamic ?? true,
      scenario: config.visibility?.scenario ?? true, particles: config.visibility?.particles ?? true },
    parallax: { enabled: config.parallax?.enabled ?? false, strength: config.parallax?.strength ?? 0.5 } };
}
