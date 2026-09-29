import { describe, expect, test } from "bun:test";
import { createNativeDragPreview, nativeDragPreviewKind, nativeDragPreviewLayout } from "../src/shared/nativeDragPreview";

describe("vista previa del arrastre nativo", () => {
  test("reconoce los medios comunes aunque la extensión use mayúsculas", () => {
    expect(nativeDragPreviewKind("C:\\Fotos\\retrato.PNG")).toBe("image");
    expect(nativeDragPreviewKind("D:\\Vídeos\\clip.MKV")).toBe("video");
    expect(nativeDragPreviewKind("D:\\Música\\canción.FLAC")).toBe("music");
    expect(nativeDragPreviewKind("D:\\Docs\\texto.pdf")).toBe("file");
  });

  test("elige cuadrado, 16:9 o 9:16 sin usar dimensiones inválidas", () => {
    expect(nativeDragPreviewLayout(100, 100)).toEqual({ width: 176, height: 176 });
    expect(nativeDragPreviewLayout(1920, 1080)).toEqual({ width: 208, height: 117 });
    expect(nativeDragPreviewLayout(1080, 1920)).toEqual({ width: 117, height: 208 });
    expect(nativeDragPreviewLayout(0, 0)).toEqual({ width: 176, height: 176 });
  });

  test("usa la miniatura ya cargada y entrega un PNG acotado", () => {
    const originalDocument = globalThis.document;
    const originalImage = globalThis.HTMLImageElement;
    const originalVideo = globalThis.HTMLVideoElement;
    const drawn: unknown[][] = [];
    class LoadedImage {
      complete = true;
      constructor(public naturalWidth: number, public naturalHeight: number) {}
      querySelectorAll() { return []; }
    }
    class VideoElement {}
    const context = {
      fillRect() {}, beginPath() {}, rect() {}, clip() {}, save() {}, restore() {},
      drawImage(...args: unknown[]) { drawn.push(args); },
    };
    const canvases: Array<{ width: number; height: number }> = [];
    Object.assign(globalThis, {
      HTMLImageElement: LoadedImage,
      HTMLVideoElement: VideoElement,
      document: {
        createElement() {
          const canvas = {
            width: 0,
            height: 0,
            getContext: () => context,
            toDataURL: (format: string) => format === "image/png" ? "data:image/png;base64,dGVzdA==" : "",
          };
          canvases.push(canvas);
          return canvas;
        },
      },
    });
    try {
      const wide = new LoadedImage(400, 200);
      const tall = new LoadedImage(200, 400);
      const square = new LoadedImage(200, 200);
      for (const image of [wide, tall, square]) {
        expect(createNativeDragPreview("retrato.png", image as unknown as Element)).toStartWith("data:image/png;base64,");
      }
      expect(canvases).toMatchObject([
        { width: 208, height: 117 },
        { width: 117, height: 208 },
        { width: 176, height: 176 },
      ]);
      expect(drawn.map((args) => args.slice(1))).toEqual([
        [8, 10.5, 192, 96],
        [10.5, 8, 96, 192],
        [8, 8, 160, 160],
      ]);
      expect(drawn.map((args) => args[0])).toEqual([wide, tall, square]);
    } finally {
      Object.assign(globalThis, {
        document: originalDocument,
        HTMLImageElement: originalImage,
        HTMLVideoElement: originalVideo,
      });
    }
  });

  test("recupera un PNG de respaldo si la miniatura contamina el lienzo", () => {
    const originalDocument = globalThis.document;
    const originalImage = globalThis.HTMLImageElement;
    const originalVideo = globalThis.HTMLVideoElement;
    class LoadedImage {
      complete = true;
      naturalWidth = 100;
      naturalHeight = 100;
      querySelectorAll() { return []; }
    }
    class VideoElement {}
    let created = 0;
    const context = {
      fillRect() {}, fillText() {}, beginPath() {}, rect() {}, clip() {}, save() {}, restore() {}, drawImage() {},
    };
    Object.assign(globalThis, {
      HTMLImageElement: LoadedImage,
      HTMLVideoElement: VideoElement,
      document: {
        createElement() {
          created += 1;
          const current = created;
          return {
            width: 0,
            height: 0,
            getContext: () => context,
            toDataURL() {
              if (current === 1) throw new Error("SecurityError");
              return "data:image/png;base64,cmVzcGFsZG8=";
            },
          };
        },
      },
    });
    try {
      expect(createNativeDragPreview("song.mp3", new LoadedImage() as unknown as Element)).toBe("data:image/png;base64,cmVzcGFsZG8=");
      expect(created).toBe(2);
    } finally {
      Object.assign(globalThis, {
        document: originalDocument,
        HTMLImageElement: originalImage,
        HTMLVideoElement: originalVideo,
      });
    }
  });
});
