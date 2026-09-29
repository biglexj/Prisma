import { describe, expect, test } from "bun:test";
import { createNativeDragPreview, nativeDragPreviewKind } from "../src/shared/nativeDragPreview";

describe("vista previa del arrastre nativo", () => {
  test("reconoce los medios comunes aunque la extensión use mayúsculas", () => {
    expect(nativeDragPreviewKind("C:\\Fotos\\retrato.PNG")).toBe("image");
    expect(nativeDragPreviewKind("D:\\Vídeos\\clip.MKV")).toBe("video");
    expect(nativeDragPreviewKind("D:\\Música\\canción.FLAC")).toBe("music");
    expect(nativeDragPreviewKind("D:\\Docs\\texto.pdf")).toBe("file");
  });

  test("usa la miniatura ya cargada y entrega un PNG acotado", () => {
    const originalDocument = globalThis.document;
    const originalImage = globalThis.HTMLImageElement;
    const originalVideo = globalThis.HTMLVideoElement;
    const drawn: unknown[][] = [];
    class LoadedImage {
      complete = true;
      naturalWidth = 400;
      naturalHeight = 200;
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
      const image = new LoadedImage();
      const result = createNativeDragPreview("retrato.png", image as unknown as Element);
      expect(result).toStartWith("data:image/png;base64,");
      expect(canvases[0]).toMatchObject({ width: 152, height: 152 });
      expect(drawn).toHaveLength(1);
      expect(drawn[0]?.[0]).toBe(image);
      expect(drawn[0]?.slice(1)).toEqual([-60, 8, 272, 136]);
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
