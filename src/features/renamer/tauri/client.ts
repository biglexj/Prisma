import { invoke } from "@tauri-apps/api/core";
import type {
  FilterMode,
  RenameBatchResult,
  RenameOperation,
  RenamerFileItem,
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

  executeBatch: (operations: RenameOperation[]): Promise<RenameBatchResult> =>
    invoke<RenameBatchResult>("renamer_execute_batch", {
      operations,
    }),

  undoBatch: (): Promise<RenameBatchResult> =>
    invoke<RenameBatchResult>("renamer_undo_batch"),
};
