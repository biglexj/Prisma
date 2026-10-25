import { invoke } from "@tauri-apps/api/core";

export interface FolderSource {
  id: string;
  path: string;
  name: string;
  enabled: boolean;
  videoCount: number;
  available: boolean;
}

export interface WallpaperVideoItem {
  path: string;
  name: string;
  folderId: string;
  folderName: string;
}

export type WallpaperMode = "sequential" | "shuffle";
export type WallpaperFit = "cover" | "contain";

export interface WallpaperSettings {
  version: number;
  sources: FolderSource[];
  mode: WallpaperMode;
  fit: WallpaperFit;
  autoStart: boolean;
  isActive: boolean;
}

export interface WallpaperStateSnapshot {
  isActive: boolean;
  isPaused: boolean;
  currentVideo: string | null;
  currentFolder: string | null;
  totalVideos: number;
  settings: WallpaperSettings;
  videos: WallpaperVideoItem[];
}

export const liveWallpapersApi = {
  getState: () => invoke<WallpaperStateSnapshot>("live_wallpaper_get_state"),
  start: () => invoke<WallpaperStateSnapshot>("live_wallpaper_start"),
  playFile: (path: string) => invoke<WallpaperStateSnapshot>("live_wallpaper_play_file", { path }),
  pause: () => invoke<WallpaperStateSnapshot>("live_wallpaper_pause"),
  resume: () => invoke<WallpaperStateSnapshot>("live_wallpaper_resume"),
  next: () => invoke<WallpaperStateSnapshot>("live_wallpaper_next"),
  prev: () => invoke<WallpaperStateSnapshot>("live_wallpaper_prev"),
  stop: () => invoke<WallpaperStateSnapshot>("live_wallpaper_stop"),
  addFolder: (path: string) => invoke<FolderSource>("live_wallpaper_add_folder", { path }),
  removeFolder: (id: string) => invoke<WallpaperStateSnapshot>("live_wallpaper_remove_folder", { id }),
  toggleFolder: (id: string, enabled: boolean) =>
    invoke<WallpaperStateSnapshot>("live_wallpaper_toggle_folder", { id, enabled }),
  refreshSources: () => invoke<WallpaperStateSnapshot>("live_wallpaper_refresh_sources"),
  setMode: (mode: WallpaperMode) => invoke<WallpaperStateSnapshot>("live_wallpaper_set_mode", { mode }),
  setFit: (fit: WallpaperFit) => invoke<WallpaperStateSnapshot>("live_wallpaper_set_fit", { fit }),
};
