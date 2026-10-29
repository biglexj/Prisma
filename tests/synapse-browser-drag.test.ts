import { expect, test } from "bun:test";
import { fillBrowserFileDrag, SYNAPSE_DRAG_TYPE, sendBrowserFileDrop } from "../src/app/ui/synapse-notch/useBrowserFileDrag";

test("el arrastre entrega el mismo File y miniatura cuadrada, sin sustituirlo por una URL", () => {
  const file = new File(["contenido"], "Foto.png", {type: "image/png"});
  const values = new Map<string, string>();
  const files: File[] = [new File(["viejo"], "anterior.txt")];
  let preview: unknown[] = [];
  const transfer = {
    clearData: () => values.clear(),
    items: { clear: () => { files.length = 0; }, add: (item: File) => { files.push(item); return {kind: "file"}; } },
    setData: (type: string, value: string) => values.set(type, value),
    effectAllowed: "none",
    setDragImage: (...args: unknown[]) => { preview = args; },
  } as unknown as DataTransfer;
  const card = {clientWidth: 106, clientHeight: 106} as Element;
  fillBrowserFileDrag(transfer, file, "tarjeta-1", card);
  expect(files).toEqual([file]);
  expect(files[0]).toBe(file);
  expect(values.get(SYNAPSE_DRAG_TYPE)).toBe("tarjeta-1");
  expect(values.has("text/uri-list")).toBe(false);
  expect(transfer.effectAllowed).toBe("copy");
  expect(preview).toEqual([card, 53, 53]);
});

test("la entrada entrega File a WebView2 sin leer sus bytes ni inventar rutas", () => {
  const originalWindow = globalThis.window;
  let message = "";
  let objects: File[] = [];
  Object.assign(globalThis, {window: {chrome: {webview: {
    postMessageWithAdditionalObjects: (value: string, files: File[]) => { message = value; objects = files; },
  }}}});
  try {
    const file = new File(["texto"], "archivo.txt");
    sendBrowserFileDrop([file], "pin");
    expect(JSON.parse(message)).toEqual({kind: "prisma-synapse-drop", action: "pin"});
    expect(objects[0]).toBe(file);
  } finally { Object.assign(globalThis, {window: originalWindow}); }
});
