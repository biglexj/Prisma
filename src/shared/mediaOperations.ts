import { invoke } from "@tauri-apps/api/core";

export interface DeleteMediaResult {
  deleted: number;
  errors: string[];
}

export interface RenameMediaResult {
  oldPath: string;
  newPath: string;
  newName: string;
}

export interface SaveImageResult {
  savedPath: string;
  fileName: string;
  overwrite: boolean;
}

/** Envía los archivos multimedia indicados a la papelera de reciclaje del sistema. */
export function deleteMediaItems(paths: string[]): Promise<DeleteMediaResult> {
  return invoke<DeleteMediaResult>("media_delete_items", { paths });
}

/** Renombra un archivo multimedia de manera segura preservando la extensión y ruta. */
export function renameMediaItem(path: string, newName: string): Promise<RenameMediaResult> {
  return invoke<RenameMediaResult>("media_rename_item", { path, newName });
}

/** Guarda una imagen editada en disco (sobrescribiendo o como nueva copia). */
export function saveEditedImage(
  sourcePath: string,
  imageBase64: string,
  overwrite: boolean,
  customFileName?: string
): Promise<SaveImageResult> {
  return invoke<SaveImageResult>("media_save_image", {
    sourcePath,
    imageBase64,
    overwrite,
    customFileName: customFileName?.trim() || null,
  });
}

export interface SaveSnapshotResult {
  savedPath: string;
  fileName: string;
  folder: string;
}

export interface SaveSnapshotParams {
  videoPath: string;
  imageBase64: string;
  outputFolder?: string;
  timestampSecs?: number;
  format?: "png" | "webp" | "jpeg";
}

/** Guarda una captura de pantalla de un fotograma de vídeo en disco. */
export function saveVideoSnapshot(params: SaveSnapshotParams): Promise<SaveSnapshotResult> {
  return invoke<SaveSnapshotResult>("video_save_snapshot", {
    videoPath: params.videoPath,
    imageBase64: params.imageBase64,
    outputFolder: params.outputFolder?.trim() || null,
    timestampSecs: typeof params.timestampSecs === "number" ? params.timestampSecs : null,
    format: params.format || "png",
  });
}

/** Obtiene la ruta canónica del directorio de imágenes del sistema. */
export function getDefaultPicturesDir(): Promise<string> {
  return invoke<string>("media_get_default_pictures_dir");
}

