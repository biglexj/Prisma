import { toSafeAssetUrl } from "../../../shared/mediaTree";

/**
 * Convierte un Blob o imagen a PNG y la escribe en el portapapeles del sistema
 * utilizando la API estándar ClipboardItem, permitiendo que la imagen sea pegada
 * directamente (Ctrl+V) en aplicaciones como Paint, Discord, WhatsApp, Telegram,
 * Photoshop, Office o navegadores web.
 */
export async function copyImageToClipboard(
  filePath: string,
  existingImg?: HTMLImageElement | null
): Promise<boolean> {
  try {
    let pngBlob: Blob | null = null;

    // Camino 1: Si ya disponemos de un <img> en el visor con dimensiones válidas
    if (existingImg && existingImg.complete && existingImg.naturalWidth > 0) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = existingImg.naturalWidth;
        canvas.height = existingImg.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(existingImg, 0, 0);
          pngBlob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), "image/png");
          });
        }
      } catch (err) {
        // En caso de taint de canvas o error, se reintenta vía fetch de asset
        console.warn("Fallo al exportar desde imgRef existente, reintentando vía fetch:", err);
      }
    }

    // Camino 2: Si no tenemos imagen o falló el canvas directo
    if (!pngBlob) {
      const assetUrl = toSafeAssetUrl(filePath);
      const res = await fetch(assetUrl);
      if (!res.ok) {
        throw new Error(`No se pudo leer el archivo local (${res.status})`);
      }
      const rawBlob = await res.blob();

      // Si el archivo ya es PNG, escribirlo directamente evita recodificar
      if (rawBlob.type === "image/png" || filePath.toLowerCase().endsWith(".png")) {
        pngBlob = rawBlob.type === "image/png"
          ? rawBlob
          : new Blob([await rawBlob.arrayBuffer()], { type: "image/png" });
      } else {
        // Decodificación de alta velocidad con createImageBitmap en Chromium
        let bitmap: ImageBitmap | null = null;
        try {
          bitmap = await createImageBitmap(rawBlob);
        } catch {
          bitmap = null;
        }

        if (bitmap) {
          try {
            if (typeof OffscreenCanvas !== "undefined") {
              const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
              const ctx = offscreen.getContext("2d");
              if (!ctx) throw new Error("No se pudo obtener contexto 2D Offscreen");
              ctx.drawImage(bitmap, 0, 0);
              pngBlob = await offscreen.convertToBlob({ type: "image/png" });
            }
          } catch {
            pngBlob = null;
          } finally {
            bitmap.close();
          }
        }

        // Fallback clásico con elemento Canvas en DOM
        if (!pngBlob) {
          const objectUrl = URL.createObjectURL(rawBlob);
          try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error("Error al decodificar imagen"));
              img.src = objectUrl;
            });

            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("No se pudo obtener contexto 2D");
            ctx.drawImage(img, 0, 0);

            pngBlob = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob((b) => resolve(b), "image/png");
            });
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        }
      }
    }

    if (!pngBlob) {
      throw new Error("No se pudo generar el formato PNG para el portapapeles");
    }

    // Escritura en el portapapeles del sistema
    await navigator.clipboard.write([
      new ClipboardItem({
        "image/png": pngBlob,
      }),
    ]);

    return true;
  } catch (err) {
    console.error("Error al copiar imagen al portapapeles:", err);
    return false;
  }
}
