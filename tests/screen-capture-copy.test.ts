import { afterEach, beforeEach, expect, test } from "bun:test";
import { screenCaptureClient } from "../src/features/screen_capture/services/screenCaptureClient";

const saved = new Map<string, PropertyDescriptor | undefined>();
let writes: string[];
let imports: { command: string; payload: { text: string; pinned: boolean; path: null } }[];
let failClipboard: boolean;
let failImport: boolean;

beforeEach(() => {
  writes = []; imports = []; failClipboard = false; failImport = false;
  const replacements = {
    navigator: { clipboard: { write: async () => {
      if (failClipboard) throw new Error("clipboard unavailable");
      writes.push("clipboard");
    } } },
    ClipboardItem: class { constructor(public data: unknown) {} },
    FileReader: class {
      result = "";
      onload?: () => void;
      async readAsDataURL(blob: Blob) {
        this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
        this.onload?.();
      }
    },
    window: { __TAURI_INTERNALS__: { invoke: async (command: string, payload: typeof imports[number]["payload"]) => {
      writes.push("synapse");
      if (failImport) throw new Error("vault unavailable");
      imports.push({ command, payload });
    } } },
  };
  for (const [key, value] of Object.entries(replacements)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
});

afterEach(() => {
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  saved.clear();
});

test("copiar cinco capturas también envía las cinco imágenes a la rotación de Synapse", async () => {
  for (let index = 0; index < 5; index++) {
    const bytes = new Uint8Array([137, 80, 78, 71, index]);
    await screenCaptureClient.copyToClipboard(new Blob([bytes], { type: "image/png" }));
    expect(imports[index]).toEqual({ command: "vault_import", payload: {
      path: null, pinned: false, text: `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`,
    } });
  }
  expect(writes).toEqual(Array.from({ length: 5 }, () => ["clipboard", "synapse"]).flat());
});

test("un fallo del portapapeles no registra una captura como copiada", async () => {
  failClipboard = true;
  await expect(screenCaptureClient.copyToClipboard(new Blob())).rejects.toThrow("clipboard unavailable");
  expect(imports).toHaveLength(0);
});

test("si falla Synapse se informa que la captura sí quedó copiada", async () => {
  failImport = true;
  await expect(screenCaptureClient.copyToClipboard(new Blob())).rejects.toThrow("Captura copiada, pero no se pudo añadir a Synapse");
  expect(writes).toEqual(["clipboard", "synapse"]);
});
