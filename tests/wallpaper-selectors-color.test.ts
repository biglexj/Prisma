import { describe, expect, test } from "bun:test";
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

  test("normalizeComposition actualiza el antiguo valor por defecto #263b62 a #00C9B9", () => {
    const raw: CompositionConfig = {
      ambient: "solid",
      ambientColor: "#263b62",
      ambientColor2: "#703ca5",
      ambientOpacity: 1,
      dynamic: "none",
      scenario: "none",
      particle: "none",
      overlay: { ...DEFAULT_OVERLAY_PARTICLES, color: "#b8efff" },
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
});
