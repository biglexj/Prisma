import type { DragEvent as ReactDragEvent } from "react";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { toPlatformPath } from "./mediaTree";

/**
 * Icono de arrastre universal compacto (32x32 PNG en base64).
 * Renderiza una tarjeta translúcida con el prisma violeta distintivo,
 * garantizando que el cursor de arrastre del sistema operativo (OLE)
 * funcione sin depender de rutas en disco ni causar errores de decodificación.
 */
export const DEFAULT_DRAG_ICON_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAlUlEQVR4nO3VvQ2AIBCG4ZuD2pWcwMTZHMVJ7K0sNXQS/+4+lftIILn6fYICImwrhGb8c9zCjxBXQO74AVEBxe5A189rHBdADA/tMsVBETBgH3+DgABncRRhBtzFEYQJoIlbEWqAJW5BqABIXIsoA+D+CSh+QopjSHERUVzFFI8RxXP8xVQAzw54IJI4BUAyQS7DXmsDEHDSvZ0AkmwAAAAASUVORK5CYII=";

export interface NativeDragOptions {
  icon?: string;
  mode?: "copy" | "move";
}

/**
 * Inicia una sesión de arrastre nativo hacia el sistema operativo (Windows OLE CF_HDROP).
 * Permite soltar archivos directamente en aplicaciones externas como DaVinci Resolve,
 * Affinity Photo/Designer/Publisher, Photoshop, Krita, el Explorador de Windows, etc.
 *
 * @param files Ruta absoluta o lista de rutas absolutas de los archivos a arrastrar.
 * @param options Opciones adicionales como el icono visual o el modo de arrastre.
 */
export async function startNativeFileDrag(
  files: string | string[],
  options?: NativeDragOptions
): Promise<void> {
  const fileList = Array.isArray(files) ? files : [files];
  const validPaths = fileList
    .map((p) => toPlatformPath(p).trim())
    .filter((p) => p.length > 0);

  if (validPaths.length === 0) {
    return;
  }

  // Si se pasa un icono explícito (por ejemplo, ruta a un archivo de imagen en disco o data-url PNG),
  // se utiliza; de lo contrario, se emplea el icono por defecto en base64 para máxima confiabilidad.
  let dragIcon = options?.icon;
  if (!dragIcon || (!dragIcon.startsWith("data:image/png;base64,") && !dragIcon.includes("\\") && !dragIcon.includes("/"))) {
    dragIcon = DEFAULT_DRAG_ICON_BASE64;
  }

  try {
    await startDrag({
      item: validPaths,
      icon: dragIcon,
      mode: options?.mode ?? "copy",
    });
  } catch (error) {
    console.warn("[NativeFileDrag] Error iniciando arrastre nativo hacia el SO:", error);
  }
}

/**
 * Manejador estándar para eventos `onDragStart` de React.
 * Invoca el arrastre nativo en Tauri mientras el botón del ratón está presionado.
 */
export function handleNativeDragStart(
  e: ReactDragEvent,
  files: string | string[],
  options?: NativeDragOptions
): void {
  // En navegadores web e.dataTransfer es requerido para dragstart; en Tauri, iniciamos
  // la llamada nativa a Windows OLE para que DoDragDrop tome el control global del cursor.
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "copyMove";
    // Asignar un tipo MIME dummy para evitar que el motor de renderizado cancele el evento HTML5
    try {
      const firstPath = Array.isArray(files) ? files[0] : files;
      e.dataTransfer.setData("text/plain", firstPath || "");
    } catch {
      // Ignorar restricciones en navegadores
    }
  }

  void startNativeFileDrag(files, options);
}

/**
 * Hook reutilizable para exponer las capacidades de arrastre nativo universal.
 */
export function useNativeFileDrag() {
  return {
    startNativeFileDrag,
    handleNativeDragStart,
  };
}
