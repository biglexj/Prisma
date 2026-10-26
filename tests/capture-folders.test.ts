import { afterEach, expect, test } from "bun:test";
import { captureFolderOverride, resolveCaptureFolder } from "../src/shared/captureFolders";

const saved = new Map<string, PropertyDescriptor | undefined>();
function mockSettings(value: string | null) {
  for (const [key, object] of Object.entries({
    localStorage: { getItem: () => value },
    window: { __TAURI_INTERNALS__: { invoke: async (command: string) => {
      expect(command).toBe("media_get_default_capture_folders");
      return { images: "D:\\Imágenes\\Prisma", videos: "E:\\Vídeos\\Prisma" };
    } } },
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value: object });
  }
}
afterEach(() => {
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  saved.clear();
});

test("capturas, grabaciones y fotogramas consultan ajustes independientes", async () => {
  mockSettings(JSON.stringify({ screenCaptureFolder: "D:\\Capturas propias", screenRecordingFolder: "E:\\Vídeos propios", videoSnapshotFolder: "F:\\Fotogramas" }));
  expect(await resolveCaptureFolder("image")).toBe("D:\\Capturas propias");
  expect(await resolveCaptureFolder("video")).toBe("E:\\Vídeos propios");
  expect(await resolveCaptureFolder("frame")).toBe("F:\\Fotogramas");
});

test("las grabaciones antiguas dejan de heredar la carpeta de capturas", async () => {
  mockSettings(JSON.stringify({ screenCaptureFolder: "D:\\Imágenes\\Prisma" }));
  expect(await resolveCaptureFolder("video")).toBe("E:\\Vídeos\\Prisma");
  expect(await resolveCaptureFolder("image")).toBe("D:\\Imágenes\\Prisma");
});

test("los valores predeterminados usan las bibliotecas reales con Prisma", async () => {
  mockSettings(null);
  expect(await resolveCaptureFolder("image")).toBe("D:\\Imágenes\\Prisma");
  expect(await resolveCaptureFolder("frame")).toBe("D:\\Imágenes\\Prisma");
  expect(await resolveCaptureFolder("video")).toBe("E:\\Vídeos\\Prisma");
});

test("restablecer una ruta vacía no afecta a los otros tipos", () => {
  const settings = { screenCaptureFolder: "  ", screenRecordingFolder: "E:\\Grabaciones", videoSnapshotFolder: "F:\\Frames" };
  expect(captureFolderOverride("image", settings)).toBe("");
  expect(captureFolderOverride("video", settings)).toBe("E:\\Grabaciones");
  expect(captureFolderOverride("frame", settings)).toBe("F:\\Frames");
});

test("ajustes dañados vuelven a las bibliotecas del sistema", async () => {
  mockSettings("{datos rotos");
  expect(await resolveCaptureFolder("video")).toBe("E:\\Vídeos\\Prisma");
});
