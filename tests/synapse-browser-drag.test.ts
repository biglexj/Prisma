import { expect, test } from "bun:test";
import { sendBrowserFileDrop } from "../src/app/ui/synapse-notch/useBrowserFileDrag";

test("la entrada entrega File a WebView2 sin leer sus bytes ni inventar rutas", async () => {
  const originalWindow = globalThis.window;
  let message = "";
  let objects: File[] = [];
  Object.assign(globalThis, {window: {chrome: {webview: {
    postMessageWithAdditionalObjects: (value: string, files: File[]) => { message = value; objects = files; },
  }}}});
  try {
    const file = new File(["texto"], "archivo.txt");
    file.arrayBuffer = () => { throw new Error("No debe leer un archivo aceptado por el host"); };
    expect(await sendBrowserFileDrop([file], "pin")).toBeUndefined();
    expect(JSON.parse(message)).toEqual({kind: "prisma-synapse-drop", action: "pin"});
    expect(objects[0]).toBe(file);
  } finally { Object.assign(globalThis, {window: originalWindow}); }
});

async function withRejectedFiles(run: () => Promise<void>) {
  const originalWindow = globalThis.window;
  Object.assign(globalThis, {window: {chrome: {webview: {
    postMessageWithAdditionalObjects: () => { throw new TypeError("additional File object is not a file on the disk"); },
  }}}});
  try { await run(); }
  finally { Object.assign(globalThis, {window: originalWindow}); }
}

test("una imagen web con nombre Unicode y sin ruta conserva exactamente sus bytes", async () => {
  await withRejectedFiles(async () => {
    const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==", "base64");
    const file = new File([bytes], "niña 🌙.png", {type: "image/png"});
    const result = await sendBrowserFileDrop([file], "temporary", "https://example.invalid/pagina");
    expect(result).toEqual([`data:image/png;base64,${bytes.toString("base64")}`]);
    expect(Buffer.from(result![0].split(",")[1], "base64")).toEqual(bytes);
  });
});

test("prepara todas las imágenes antes de importar un lote y conserva su orden y formato", async () => {
  await withRejectedFiles(async () => {
    const result = await sendBrowserFileDrop([
      new File([new Uint8Array([0, 127, 128, 255])], "primera.webp", {type: "image/webp"}),
      new File(["segunda"], "segunda.gif", {type: "image/gif"}),
    ], "phone", "solo texto alternativo");
    expect(result).toEqual(["data:image/webp;base64,AH+A/w==", "data:image/gif;base64,c2VndW5kYQ=="]);
  });
});

test("una imagen ilegible rechaza el lote sin devolver contenido parcial ni usar la URL", async () => {
  await withRejectedFiles(async () => {
    const unreadable = new File(["imagen"], "inaccesible.png", {type: "image/png"});
    unreadable.arrayBuffer = async () => { throw new Error("Archivo no disponible"); };
    await expect(sendBrowserFileDrop([
      new File(["primera"], "primera.png", {type: "image/png"}), unreadable,
    ], "pin", "https://example.invalid/pagina")).rejects.toThrow("Archivo no disponible");
  });
});

test("rechaza imágenes vacías o que excedan el límite antes de leerlas", async () => {
  await withRejectedFiles(async () => {
    await expect(sendBrowserFileDrop([new File([], "vacia.png", {type: "image/png"})], "pin")).rejects.toThrow("imagen vacía");
    const large = new File(["no leer"], "grande.png", {type: "image/png"});
    Object.defineProperty(large, "size", {value: 64 * 1024 * 1024});
    large.arrayBuffer = () => { throw new Error("No debe leer el lote demasiado grande"); };
    await expect(sendBrowserFileDrop([large], "pin")).rejects.toThrow("superan 64 MB");
  });
});

test("un lote mixto rechazado no se convierte en texto ni descarta sus archivos no visuales", async () => {
  await withRejectedFiles(async () => {
    const image = new File(["imagen"], "imagen.png", {type: "image/png"});
    image.arrayBuffer = () => { throw new Error("No debe leer un lote incompatible"); };
    await expect(sendBrowserFileDrop([image, new File(["pdf"], "archivo.pdf", {type: "application/pdf"})], "temporary", "titulo")).rejects.toThrow("not a file on the disk");
  });
});

test("rechaza lotes vacíos o superiores al límite del puente nativo", async () => {
  await expect(sendBrowserFileDrop([], "temporary")).rejects.toThrow("1 y 100");
  await expect(sendBrowserFileDrop(Array.from({length: 101}, () => new File(["x"], "x.txt")), "temporary")).rejects.toThrow("1 y 100");
});
