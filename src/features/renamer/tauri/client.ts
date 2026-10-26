import { invoke } from "@tauri-apps/api/core";
import type {
  FilterMode,
  RenameBatchResult,
  RenameOperation,
  RenameConflict,
  RenamerFileItem,
  RenamerLoadResult,
} from "../model/types";

export const renamerClient = {
  scanFolder: (
    folderPath: string,
    filterMode: FilterMode = "all",
    customExtensions?: string[],
    includeSubfolders: boolean = false,
    targetType: "files" | "folders" | "both" = "files"
  ): Promise<RenamerFileItem[]> =>
    invoke<RenamerFileItem[]>("renamer_scan_folder", {
      folderPath,
      filterMode,
      customExtensions: customExtensions && customExtensions.length > 0 ? customExtensions : null,
      includeSubfolders,
      targetType,
    }),

  /**
   * Resuelve el origen de trabajo a partir de las rutas soltadas o seleccionadas.
   * Si llega una sola carpeta se escanea completa; si llega una selección de
   * archivos se cargan únicamente esos archivos.
   */
  loadSource: (
    paths: string[],
    filterMode: FilterMode = "all",
    customExtensions?: string[],
    includeSubfolders: boolean = false,
    targetType: "files" | "folders" | "both" = "files"
  ): Promise<RenamerLoadResult> =>
    invoke<RenamerLoadResult>("renamer_scan_paths", {
      paths,
      filterMode,
      customExtensions: customExtensions && customExtensions.length > 0 ? customExtensions : null,
      includeSubfolders,
      targetType,
    }),

  executeBatch: (operations: RenameOperation[]): Promise<RenameBatchResult> =>
    invoke<RenameBatchResult>("renamer_execute_batch", {
      operations,
    }),

  validateBatch: (operations: RenameOperation[]): Promise<RenameConflict[]> =>
    invoke<RenameConflict[]>("renamer_validate_batch", { operations }),

  undoBatch: (): Promise<RenameBatchResult> =>
    invoke<RenameBatchResult>("renamer_undo_batch"),

  canUndo: (): Promise<boolean> => invoke<boolean>("renamer_can_undo"),

  occupiedPaths: (paths: string[]): Promise<string[]> => invoke<string[]>("renamer_occupied_paths", { paths }),
};
