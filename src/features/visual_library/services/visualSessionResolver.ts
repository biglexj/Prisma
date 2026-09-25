import { FolderVisualItemsResult, VisualLibraryItem, VisualMediaKind } from "../model/types";
import { visualLibraryClient } from "../tauri/client";

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

/**
 * Resuelve la sesión/cola de visualización para un video o imagen.
 * 
 * Regla de negocio canónica:
 * - Solamente se encolan los elementos relativos de la misma carpeta (hermanos del mismo kind).
 * - Mantiene su orden correlativo natural (video 1, video 2, video 3...).
 * - Si es el video 5, permanece como video 5 (índice 4). No hay rotación circular.
 * - Las flechas navegan hacia el índice anterior (4) y posterior (6).
 */
export async function resolveVisualSessionForPath(
  path: string,
  kind: VisualMediaKind,
  libraryItems: VisualLibraryItem[],
): Promise<FolderVisualItemsResult> {
  // 1. Buscar en la biblioteca existente
  const foundItem = libraryItems.find((it) => it.path === path && it.kind === kind);

  if (foundItem) {
    const siblingItems = libraryItems.filter((it) => {
      if (it.kind !== kind || it.isExcluded) {
        return false;
      }
      if (foundItem.sourcePath && it.sourcePath) {
        return it.sourcePath === foundItem.sourcePath && it.relativeFolder === foundItem.relativeFolder;
      }
      return it.relativeFolder === foundItem.relativeFolder;
    });

    const itemsToQueue = siblingItems.length > 0 ? siblingItems : [foundItem];

    // Ordenar naturalmente por nombre/título para asegurar correlatividad
    const sortedItems = [...itemsToQueue].sort((a, b) =>
      naturalCollator.compare(a.title || a.path, b.title || b.path)
    );

    const targetIndex = sortedItems.findIndex((it) => it.path === path);
    const safeIndex = targetIndex >= 0 ? targetIndex : 0;

    const cleanFolderName =
      foundItem.relativeFolder
        ?.split(/[/\\]/)
        .filter(Boolean)
        .pop() ||
      path.replace(/\\/g, "/").split("/").slice(-2, -1)[0] ||
      (kind === "video" ? "Vídeos" : "Imágenes");

    return {
      folderName: cleanFolderName,
      targetIndex: safeIndex,
      items: sortedItems,
    };
  }

  // 2. Archivo externo (abierto desde Quick Look o explorador de archivos en carpeta no indexada)
  try {
    const res = await visualLibraryClient.scanFolderItems(path, kind);
    if (res && res.items && res.items.length > 0) {
      return res;
    }
  } catch (error) {
    console.warn("[visualSessionResolver] Fallback al escanear carpeta:", error);
  }

  // Fallback seguro de un solo elemento
  const fileName = path.replace(/\\/g, "/").split("/").pop() || "Elemento";
  const parentFolder =
    path.replace(/\\/g, "/").split("/").slice(-2, -1)[0] ||
    (kind === "video" ? "Vídeos" : "Imágenes");

  return {
    folderName: parentFolder,
    targetIndex: 0,
    items: [
      {
        title: fileName,
        path,
        sourcePath: "",
        relativeFolder: parentFolder,
        kind,
        modifiedAtMillis: Date.now(),
        sizeBytes: 0,
        isExcluded: false,
      },
    ],
  };
}
