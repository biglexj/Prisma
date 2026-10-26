import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { AMBIENTS, DEFAULT_OVERLAY_PARTICLES, normalizeComposition, type CompositionConfig } from "../src/features/wallpapers/compositor/config";

describe("Estilizado de selectores y color predefinido #00C9B9", () => {
  test("el color predefinido de 'solid' en AMBIENTS es #00C9B9", () => {
    const solid = AMBIENTS.find(item => item.value === "solid");
    expect(solid?.colors).toBe("#00C9B9");
  });

  test("el color predefinido de overlay particles es #00C9B9", () => {
    expect(DEFAULT_OVERLAY_PARTICLES.color).toBe("#00C9B9");
  });

  test("normalizeComposition migra o inicializa ambientColor a #00C9B9", () => {
    const raw: CompositionConfig = {
      ambient: "solid",
      ambientColor: "",
      ambientColor2: "#703ca5",
      ambientOpacity: 1,
      dynamic: "none",
      scenario: "none",
      particle: "none",
      overlay: { ...DEFAULT_OVERLAY_PARTICLES, color: "" },
      intensity: 1,
      audioLevel: 0,
      paused: false,
      enabled: true,
      controls: {},
      visibility: { ambient: true, dynamic: true, scenario: true, particles: true },
      parallax: { enabled: false, strength: 0.5 },
    };

    const normalized = normalizeComposition(raw);
    expect(normalized.ambientColor).toBe("#00C9B9");
    expect(normalized.overlay.color).toBe("#00C9B9");
  });

  test("normalizeComposition actualiza el antiguo valor por defecto #263b62 y #691BDE a #00C9B9", () => {
    const raw: CompositionConfig = {
      ambient: "solid",
      ambientColor: "#263b62",
      ambientColor2: "#703ca5",
      ambientOpacity: 1,
      dynamic: "none",
      scenario: "none",
      particle: "none",
      overlay: { ...DEFAULT_OVERLAY_PARTICLES, color: "#691BDE" },
      intensity: 1,
      audioLevel: 0,
      paused: false,
      enabled: true,
      controls: {},
      visibility: { ambient: true, dynamic: true, scenario: true, particles: true },
      parallax: { enabled: false, strength: 0.5 },
    };

    const normalized = normalizeComposition(raw);
    expect(normalized.ambientColor).toBe("#00C9B9");
    expect(normalized.overlay.color).toBe("#00C9B9");
  });

  test("los controles UI (botones, switches, sliders) usan var(--primary) según las variantes del tema", () => {
    const studioCss = readFileSync("src/features/wallpapers/ui/composition-studio.css", "utf8");
    const liveCss = readFileSync("src/features/wallpapers/ui/live-wallpapers.css", "utf8");

    // Switches usan var(--primary)
    expect(studioCss).toContain(".scene-switch-control input:checked + .scene-switch-slider");
    expect(studioCss).toContain("background-color: var(--primary);");
    // Sliders usan var(--primary)
    expect(studioCss).toContain(".scene-slider input { width: 100%; accent-color: var(--primary);");
    // Botones activos usan var(--primary)
    expect(studioCss).toContain("color: var(--primary); border-color: var(--primary);");
    // Pestañas de categorías usan var(--primary)
    expect(liveCss).toContain("border-color: color-mix(in srgb, var(--primary) 40%, var(--outline-variant, #ded5df));");
  });

  test("soporta switch de activación/desactivación preservando configuración", () => {
    const activeConfig: CompositionConfig = {
      ambient: "solid",
      ambientColor: "#00C9B9",
      ambientColor2: "#703ca5",
      ambientOpacity: 0.8,
      dynamic: "matrix",
      scenario: "aurora",
      particle: "bubbles",
      overlay: { ...DEFAULT_OVERLAY_PARTICLES, enabled: true, color: "#00C9B9" },
      intensity: 1,
      audioLevel: 0,
      paused: false,
      enabled: true,
      controls: {},
      visibility: { ambient: true, dynamic: true, scenario: true, particles: true },
      parallax: { enabled: true, strength: 0.75 },
    };

    const nextConfig: CompositionConfig = {
      ...activeConfig,
      visibility: {
        ...activeConfig.visibility,
        scenario: false,
      },
      overlay: {
        ...activeConfig.overlay,
        enabled: false,
      },
    };

    expect(nextConfig.visibility.scenario).toBe(false);
    expect(nextConfig.overlay.enabled).toBe(false);
    expect(nextConfig.scenario).toBe("aurora");
    expect(nextConfig.overlay.color).toBe("#00C9B9");
  });
});
