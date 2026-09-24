import { invoke } from "@tauri-apps/api/core";
import { MusicQueueItem } from "../model/queue";
import { MusicLibraryItem } from "../../music_library/model/types";
import { parseTrackInfo, resolveLibraryTrackInfo } from "../../music_library/model/trackInfo";

export interface FolderAudioTrackItem {
  path: string;
  title: string;
  artist?: string | null;
  sizeBytes?: number;
}

export interface FolderAudioTracksResult {
  folderName: string;
  targetIndex: number;
  tracks: FolderAudioTrackItem[];
}

export interface ResolvedMusicQueue {
  folderName: string;
  queueItems: MusicQueueItem[];
}

/**
 * Resuelve la cola de reproducción para una canción abierta (interna o externa).
 * Regla de negocio canónica:
 * - La canción abierta pasa a ser la #1 en la cola (índice 0).
 * - Las demás canciones de la carpeta le siguen la corriente en orden natural correlativo.
 * - Ciclo completo: se incluyen todas las pistas de audio de la carpeta (sin imágenes ni vídeos).
 */
export async function resolveMusicQueueForPath(
  path: string,
  libraryItems: MusicLibraryItem[],
): Promise<ResolvedMusicQueue> {
  const foundItem = libraryItems.find((it) => it.path === path);

  if (foundItem) {
    const siblingItems = libraryItems.filter((it) => {
      if (foundItem.sourcePath && it.sourcePath) {
        return it.sourcePath === foundItem.sourcePath && it.relativeFolder === foundItem.relativeFolder;
      }
      return it.relativeFolder === foundItem.relativeFolder;
    });

    const itemsToQueue = siblingItems.length > 0 ? siblingItems : [foundItem];
    const folderStartIndex = itemsToQueue.findIndex((it) => it.path === path);
    const safeIndex = folderStartIndex >= 0 ? folderStartIndex : 0;

    // La canción seleccionada es la #1 en la cola, las demás le siguen la corriente en rotación circular
    const reordered = [
      ...itemsToQueue.slice(safeIndex),
      ...itemsToQueue.slice(0, safeIndex),
    ];

    const cleanFolderName =
      foundItem.relativeFolder
        ?.replace(/^Álbum:\s*/i, "")
        .split(/[/\\]/)
        .filter(Boolean)
        .pop() ||
      path.replace(/\\/g, "/").split("/").slice(-2, -1)[0] ||
      "Música";

    const queueItems: MusicQueueItem[] = reordered.map((it) => {
      const { title, artist } = resolveLibraryTrackInfo(it);
      return {
        id: it.path,
        path: it.path,
        title,
        artist: artist || null,
        folder: it.relativeFolder,
        sizeBytes: it.sizeBytes,
      };
    });

    return { folderName: cleanFolderName, queueItems };
  }

  // Archivo externo (abierto desde Quick Look o explorador de Windows en carpeta no indexada)
  try {
    const res = await invoke<FolderAudioTracksResult>("music_library_scan_folder_tracks", {
      filePath: path,
    });

    if (res && res.tracks && res.tracks.length > 0) {
      const safeIndex = Math.max(0, Math.min(res.targetIndex, res.tracks.length - 1));
      // La canción seleccionada es la #1 en la cola, las demás le siguen la corriente en rotación circular
      const reordered = [
        ...res.tracks.slice(safeIndex),
        ...res.tracks.slice(0, safeIndex),
      ];

      const queueItems: MusicQueueItem[] = reordered.map((track) => ({
        id: track.path,
        path: track.path,
        title: track.title,
        artist: track.artist || null,
        folder: res.folderName,
        sizeBytes: track.sizeBytes,
      }));

      return { folderName: res.folderName, queueItems };
    }
  } catch (err) {
    console.warn("No se pudo escanear la carpeta de audio externa, usando fallback unitario:", err);
  }

  // Fallback si falla el escaneo de carpeta
  const normalizedPath = path.replace(/\\/g, "/");
  const parts = normalizedPath.split("/").filter(Boolean);
  const fileName = parts.pop() || "Audio";
  const folderName = parts.pop() || "Música";
  const parsed = parseTrackInfo(fileName);

  return {
    folderName,
    queueItems: [
      {
        id: path,
        path,
        title: parsed.title || fileName,
        artist: parsed.artist || null,
        folder: folderName,
      },
    ],
  };
}
