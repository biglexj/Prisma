import type { DragEvent as ReactDragEvent } from "react";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { toPlatformPath } from "./mediaTree";
import { createNativeDragPreview } from "./nativeDragPreview";

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
    dragIcon = DEFAULT_DRAG_ICON_BASE64;
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

export function handleNativeDragStart(
  e: ReactDragEvent,
  files: string | string[],
  options?: NativeDragOptions
): void {
  // Prevenir que Chromium/WebView2 tome el control del drag OLE del sistema con datos HTML5 planos,
  // permitiendo que tauri-plugin-drag inicialice de inmediato DoDragDrop con CF_HDROP nativo hacia el SO.
  if (e.preventDefault) {
    e.preventDefault();
  }
  if (e.stopPropagation) {
    e.stopPropagation();
  }

  // currentTarget deja de ser fiable al salir del evento React: capturar la vista antes de iniciar OLE.
  const fileList = Array.isArray(files) ? files : [files];
  const targetElement = options?.previewElement ?? (e.currentTarget as Element | null) ?? (e.target as Element | null);
  const icon = options?.icon ?? createNativeDragPreview(fileList[0] ?? "", targetElement, fileList.length);
  void startNativeFileDrag(files, { ...options, icon: icon ?? undefined });
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
