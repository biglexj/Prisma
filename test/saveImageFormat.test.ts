import { describe, expect, test } from "bun:test";
import { extensionForImageFormat, mimeForImageFormat, originalImageFormat } from "../src/features/visual_library/ui/editor/saveImageFormat";

describe("formato al guardar imágenes editadas", () => {
  test("conserva el formato original compatible al proponer una copia", () => {
    expect(originalImageFormat("retrato.JPEG")).toEqual({
      stem: "retrato",
      format: "jpeg",
      extension: ".jpeg",
      canOverwrite: true,
    });
    expect(extensionForImageFormat("jpeg", ".jpeg")).toBe(".jpeg");
    expect(extensionForImageFormat("webp", ".jpeg")).toBe(".webp");
    expect(mimeForImageFormat("webp")).toBe("image/webp");
  });

  test("propone PNG y prohíbe sobrescribir originales que no pueden codificarse igual", () => {
    expect(originalImageFormat("animación.gif")).toEqual({
      stem: "animación",
      format: "png",
      extension: ".png",
      canOverwrite: false,
    });
    expect(originalImageFormat("ilustración.svg").canOverwrite).toBe(false);
    expect(extensionForImageFormat("jpeg", ".png")).toBe(".jpg");
    expect(mimeForImageFormat("jpeg")).toBe("image/jpeg");
  });
});
