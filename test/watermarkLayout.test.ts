import { expect, test } from "bun:test";
import {
  applyWatermarkToCanvas,
  DEFAULT_WATERMARK_CONFIG,
  getWatermarkBounds,
  type WatermarkConfig,
  type WatermarkLogoPlacement,
} from "../src/features/visual_library/model/watermark";

type Draw = { x: number; y: number; width: number; height: number };

function mockCanvas() {
  let font = "600 32px sans-serif";
  let logo: Draw | null = null;
  let text: Draw | null = null;
  const ctx = {
    save() {},
    restore() {},
    get font() { return font; },
    set font(value: string) { font = value; },
    measureText(value: string) {
      return { width: value.length * parseFloat(font.match(/[\d.]+px/)?.[0] ?? "32") * 0.55 };
    },
    drawImage(_image: HTMLImageElement, x: number, y: number, width: number, height: number) {
      logo = { x, y, width, height };
    },
    fillText(value: string, x: number, y: number, width: number) {
      text = { x, y, width, height: value ? parseFloat(font.match(/[\d.]+px/)?.[0] ?? "32") : 0 };
    },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, draws: () => ({ logo: logo as Draw | null, text: text as Draw | null }) };
}

const image = { naturalWidth: 200, naturalHeight: 200 } as HTMLImageElement;
const base: WatermarkConfig = {
  ...DEFAULT_WATERMARK_CONFIG,
  enabled: true,
  text: "biglexj",
  withShadow: false,
};

test("logo size changes independently from the text size", () => {
  const small = mockCanvas();
  const large = mockCanvas();
  applyWatermarkToCanvas(small.ctx, 1000, 600, { ...base, logoScale: 0.2 }, image);
  applyWatermarkToCanvas(large.ctx, 1000, 600, { ...base, logoScale: 0.8 }, image);
  expect(large.draws().logo!.width).toBeGreaterThan(small.draws().logo!.width * 3.9);
  expect(large.draws().text!.height).toBe(small.draws().text!.height);
});

test.each<WatermarkLogoPlacement>(["above", "below", "left", "right", "overlay"])(
  "%s positions logo and text within the image",
  (placement) => {
    const { ctx, draws } = mockCanvas();
    const config = { ...base, logoPlacement: placement, position: "bottom-right" as const };
    const bounds = getWatermarkBounds(ctx, 1000, 600, config, image)!;
    applyWatermarkToCanvas(ctx, 1000, 600, config, image);
    const { logo, text } = draws();
    expect(logo).not.toBeNull();
    expect(text).not.toBeNull();
    expect(bounds.x + bounds.width).toBeCloseTo(990);
    expect(bounds.y + bounds.height).toBeCloseTo(594);
    if (placement === "above") expect(logo!.y + logo!.height).toBeLessThan(text!.y);
    if (placement === "below") expect(text!.y + text!.height).toBeLessThan(logo!.y);
    if (placement === "left") expect(logo!.x + logo!.width).toBeLessThan(text!.x - text!.width / 2);
    if (placement === "right") expect(text!.x + text!.width / 2).toBeLessThan(logo!.x);
    if (placement === "overlay") {
      expect(text!.x).toBeCloseTo(logo!.x + logo!.width / 2);
      expect(text!.y).toBeLessThan(logo!.y + logo!.height);
    }
  },
);
