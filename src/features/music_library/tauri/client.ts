import { invoke } from "@tauri-apps/api/core";
import type { MusicFolderSource, MusicLibraryItem } from "../model/types";
import type { DuplicateGroup, DuplicateScanOptions } from "../../visual_library/model/types";
import type { MetadataCandidate } from "../metadata/metadataSearch";

export const musicLibraryClient = {
  searchMetadata: (query: string, deezer = false) =>
    invoke<MetadataCandidate[]>("music_library_search_metadata", { query, deezer }),
  downloadCover: (url: string) => invoke<string>("music_library_download_cover", { url }),
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
  scanDuplicates: (options: DuplicateScanOptions) =>
    invoke<DuplicateGroup[]>("music_library_scan_duplicates", { options }),
};

