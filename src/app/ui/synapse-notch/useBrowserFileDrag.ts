type Host = {
  postMessageWithAdditionalObjects(message: string, files: File[]): void;
};
const MAX_IMAGE_PAYLOAD = 64 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/svg+xml"]);
function host(): Host | undefined { return (window as unknown as {chrome?: {webview?: Host}}).chrome?.webview; }

/** undefined: el host recibió los archivos; imágenes: importar sus bytes con vault_import. */
export async function sendBrowserFileDrop(files: File[], action: string, text?: string): Promise<string[] | undefined> {
  if (!files.length || files.length > 100) throw new Error("Suelta entre 1 y 100 archivos");
  try {
    const bridge = host();
    if (!bridge) throw new Error("WebView2 no expuso el puente de archivos");
    // Fast path para archivos en disco: no leer ni serializar sus bytes.
    bridge.postMessageWithAdditionalObjects(JSON.stringify({kind: "prisma-synapse-drop", action, text}), files);
    return;
  } catch (error) {
    // Las imágenes arrastradas de una página pueden ser File en memoria.
    // WebView2 lanza antes de publicar el mensaje si no tienen respaldo en disco.
    if (!files.every(file => IMAGE_TYPES.has(file.type))) throw error;
  }

  // Validar el lote antes de leerlo: mismo límite de payload que vault_import.
  const payloadSize = files.reduce((size, file) => size + 4 * Math.ceil(file.size / 3) + `data:${file.type};base64,`.length, 0);
  if (payloadSize > MAX_IMAGE_PAYLOAD) throw new Error("Las imágenes superan 64 MB");
  if (files.some(file => !file.size)) throw new Error("El navegador entregó una imagen vacía");
  const images: string[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    images.push(`data:${file.type};base64,${btoa(binary)}`);
  }
  // No sustituir los bytes por text/html, URL de la página o nombre del archivo.
  return images;
}
