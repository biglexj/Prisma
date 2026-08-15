import { invoke } from "@tauri-apps/api/core";
import type {
  VisualFolderSource,
  VisualLibraryItem,
  VisualMediaKind,
} from "../model/types";

export const visualLibraryClient = {
  listFolders: (kind: VisualMediaKind) =>
    invoke<VisualFolderSource[]>("visual_library_list_folders", { kind }),
  listExcludedFolders: (kind: VisualMediaKind) =>
    invoke<VisualFolderSource[]>("visual_library_list_excluded_folders", { kind }),
  addFolder: (path: string, kind: VisualMediaKind) =>
    invoke<VisualFolderSource>("visual_library_add_folder", { path, kind }),
  addExcludedFolder: (path: string, kind: VisualMediaKind) =>
    invoke<VisualFolderSource>("visual_library_add_excluded_folder", { path, kind }),
  rescanFolder: (path: string, kind: VisualMediaKind) =>
    invoke<VisualFolderSource>("visual_library_rescan_folder", { path, kind }),
  removeFolder: (path: string, kind: VisualMediaKind) =>
    invoke<VisualFolderSource[]>("visual_library_remove_folder", { path, kind }),
  removeExcludedFolder: (path: string, kind: VisualMediaKind) =>
    invoke<VisualFolderSource[]>("visual_library_remove_excluded_folder", { path, kind }),
  listItems: (kind: VisualMediaKind) =>
    invoke<VisualLibraryItem[]>("visual_library_list_items", { kind }),
  imagePreview: (path: string) =>
    invoke<string | null>("visual_library_image_preview", { path }),
};
