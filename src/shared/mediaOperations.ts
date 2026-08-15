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
