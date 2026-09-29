import type { PointerEvent as ReactPointerEvent } from "react";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { toPlatformPath } from "./mediaTree";
import { createNativeDragPreview } from "./nativeDragPreview";
import { armNativeDragGesture } from "./nativeDragGesture";

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
  previewElement?: Element | null;
}

let outgoingPaths: string[] = [];
let outgoingUntil = 0;

const dragPathKey = (path: string) => toPlatformPath(path).replace(/\//g, "\\").toLowerCase();

/** Evita que un archivo arrastrado desde Prisma se reimporte al soltarlo dentro de la propia ventana. */
export function isOwnNativeFileDrop(paths: string[]): boolean {
  return Date.now() <= outgoingUntil &&
    paths.length > 0 &&
    paths.every((path) => outgoingPaths.includes(dragPathKey(path)));
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

  // El plugin acepta PNG base64 o la ruta de un icono. El lienzo siempre produce un PNG pequeño.
  let dragIcon = options?.icon ?? createNativeDragPreview(validPaths[0], options?.previewElement, validPaths.length);
  if (!dragIcon || (!dragIcon.startsWith("data:image/png;base64,") && !dragIcon.includes("\\") && !dragIcon.includes("/"))) {
    console.warn("[NativeFileDrag] Cayó al icono por omisión (DEFAULT_DRAG_ICON_BASE64)");
    dragIcon = DEFAULT_DRAG_ICON_BASE64;
  } else {
    console.log("[NativeFileDrag] Icono de arrastre listo:", dragIcon.slice(0, 40), `(longitud: ${dragIcon.length} caracteres)`);
  }

  try {
    outgoingPaths = validPaths.map(dragPathKey);
    outgoingUntil = Number.POSITIVE_INFINITY;
    await startDrag({
      item: validPaths,
      icon: dragIcon,
      mode: options?.mode ?? "copy",
    });
  } catch (error) {
    console.warn("[NativeFileDrag] Error iniciando arrastre nativo hacia el SO:", error);
  } finally {
    // El evento de soltado puede llegar justo después de que termine DoDragDrop.
    outgoingUntil = Date.now() + 1200;
  }
}

export function handleNativeDragPointerDown(
  e: ReactPointerEvent,
  files: string | string[],
  options?: NativeDragOptions
): void {
  if (e.defaultPrevented) return;
  const element = e.currentTarget;
  const control = e.target instanceof Element
    ? e.target.closest("button, input, select, textarea, a, [contenteditable='true'], [role='slider']")
    : null;
  if (control && control !== element && element.contains(control)) return;
  if (armNativeDragGesture(e, element, () => startNativeFileDrag(files, {
    ...options,
    previewElement: options?.previewElement ?? element,
  }))) e.stopPropagation();
}

/**
 * Hook reutilizable para exponer las capacidades de arrastre nativo universal.
 */
export function useNativeFileDrag() {
  return {
    startNativeFileDrag,
    handleNativeDragPointerDown,
  };
}
