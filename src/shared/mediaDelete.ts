import { invoke } from "@tauri-apps/api/core";

export interface DeleteMediaResult {
  deleted: number;
  errors: string[];
}

/** Envía los archivos multimedia indicados a la papelera de reciclaje del sistema. */
export function deleteMediaItems(paths: string[]): Promise<DeleteMediaResult> {
  return invoke<DeleteMediaResult>("media_delete_items", { paths });
}
