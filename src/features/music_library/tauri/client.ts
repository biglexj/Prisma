import { invoke } from "@tauri-apps/api/core";
import type { MusicFolderSource, MusicLibraryItem } from "../model/types";

export const musicLibraryClient = {
  listFolders: () =>
    invoke<MusicFolderSource[]>("music_library_list_folders"),
  listExcludedFolders: () =>
    invoke<MusicFolderSource[]>("music_library_list_excluded_folders"),
  addFolder: (path: string) =>
    invoke<MusicFolderSource>("music_library_add_folder", { path }),
  addExcludedFolder: (path: string) =>
    invoke<MusicFolderSource>("music_library_add_excluded_folder", { path }),
  rescanFolder: (path: string) =>
    invoke<MusicFolderSource>("music_library_rescan_folder", { path }),
  removeFolder: (path: string) =>
    invoke<MusicFolderSource[]>("music_library_remove_folder", { path }),
  removeExcludedFolder: (path: string) =>
    invoke<MusicFolderSource[]>("music_library_remove_excluded_folder", { path }),
  listItems: () => invoke<MusicLibraryItem[]>("music_library_list_items"),
  artwork: (path: string) =>
    invoke<string | null>("music_library_artwork", { path }),
  lyrics: (path: string) =>
    invoke<string | null>("music_library_lyrics", { path }),
};
