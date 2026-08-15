import { invoke } from "@tauri-apps/api/core";
import type { FavoriteMediaType, FavoritesStore, PlaylistItem, PlaylistMeta } from "../model/types";

export async function playlistsList(): Promise<PlaylistMeta[]> {
  const result = await invoke<Array<{
    name: string;
    path: string;
    item_count: number;
    valid_count: number;
    video_count: number;
    audio_count: number;
    media_kind: "video" | "music" | "mixed";
    modified_at: number;
    is_hidden: boolean;
  }>>("playlists_list");

  return result.map((p) => ({
    name: p.name,
    path: p.path,
    itemCount: p.item_count,
    validCount: p.valid_count,
    videoCount: p.video_count,
    audioCount: p.audio_count,
    mediaKind: p.media_kind,
    modifiedAt: p.modified_at,
    isHidden: p.is_hidden,
  }));
}

export async function playlistsRead(path: string): Promise<PlaylistItem[]> {
  const result = await invoke<Array<{
    path: string;
    title: string;
    duration_secs: number;
    is_available: boolean;
    is_video: boolean;
  }>>("playlists_read", { path });

  return result.map((item) => ({
    path: item.path,
    title: item.title,
    durationSecs: item.duration_secs,
    isAvailable: item.is_available,
    isVideo: item.is_video,
  }));
}

export async function playlistsCreate(name: string, kind?: "music" | "video"): Promise<PlaylistMeta> {
  const result = await invoke<{
    name: string;
    path: string;
    item_count: number;
    valid_count: number;
    video_count: number;
    audio_count: number;
    media_kind: "video" | "music" | "mixed";
    modified_at: number;
    is_hidden: boolean;
  }>("playlists_create", { name, kind: kind || "music" });

  return {
    name: result.name,
    path: result.path,
    itemCount: result.item_count,
    validCount: result.valid_count,
    videoCount: result.video_count,
    audioCount: result.audio_count,
    mediaKind: result.media_kind,
    modifiedAt: result.modified_at,
    isHidden: result.is_hidden,
  };
}

export async function playlistsSaveFromItems(
  name: string,
  items: PlaylistItem[]
): Promise<PlaylistMeta> {
  const rustItems = items.map((it) => ({
    path: it.path,
    title: it.title,
    duration_secs: it.durationSecs,
    is_available: it.isAvailable ?? true,
    is_video: it.isVideo ?? false,
  }));

  const result = await invoke<{
    name: string;
    path: string;
    item_count: number;
    valid_count: number;
    video_count: number;
    audio_count: number;
    media_kind: "video" | "music" | "mixed";
    modified_at: number;
    is_hidden: boolean;
  }>("playlists_save_from_items", { name, items: rustItems });

  return {
    name: result.name,
    path: result.path,
    itemCount: result.item_count,
    validCount: result.valid_count,
    videoCount: result.video_count,
    audioCount: result.audio_count,
    mediaKind: result.media_kind,
    modifiedAt: result.modified_at,
    isHidden: result.is_hidden,
  };
}

export async function playlistsImport(filePath: string): Promise<PlaylistMeta> {
  const result = await invoke<{
    name: string;
    path: string;
    item_count: number;
    valid_count: number;
    modified_at: number;
    is_hidden: boolean;
  }>("playlists_import", { filePath });

  return {
    name: result.name,
    path: result.path,
    itemCount: result.item_count,
    validCount: result.valid_count,
    modifiedAt: result.modified_at,
    isHidden: result.is_hidden,
  };
}

export async function playlistsDelete(path: string): Promise<void> {
  await invoke("playlists_delete", { path });
}

export async function playlistsToggleHidden(path: string): Promise<boolean> {
  return await invoke<boolean>("playlists_toggle_hidden", { path });
}

export async function playlistsCleanMissing(path: string): Promise<PlaylistItem[]> {
  const result = await invoke<Array<{
    path: string;
    title: string;
    duration_secs: number;
    is_available: boolean;
    is_video: boolean;
  }>>("playlists_clean_missing", { path });

  return result.map((item) => ({
    path: item.path,
    title: item.title,
    durationSecs: item.duration_secs,
    isAvailable: item.is_available,
    isVideo: item.is_video,
  }));
}

export async function playlistsAddItem(
  playlistPath: string,
  itemPath: string,
  itemTitle: string,
  itemDuration: number = 0
): Promise<number> {
  return await invoke<number>("playlists_add_item", {
    playlistPath,
    itemPath,
    itemTitle,
    itemDuration,
  });
}

export async function playlistsRemoveItem(
  playlistPath: string,
  itemPath: string
): Promise<number> {
  return await invoke<number>("playlists_remove_item", {
    playlistPath,
    itemPath,
  });
}

export async function playlistsAddFiles(
  playlistPath: string,
  filePaths: string[]
): Promise<PlaylistItem[]> {
  const result = await invoke<Array<{
    path: string;
    title: string;
    duration_secs: number;
    is_available: boolean;
    is_video: boolean;
  }>>("playlists_add_files", { playlistPath, filePaths });

  return result.map((item) => ({
    path: item.path,
    title: item.title,
    durationSecs: item.duration_secs,
    isAvailable: item.is_available,
    isVideo: item.is_video,
  }));
}

export async function playlistsRelinkItem(
  playlistPath: string,
  oldItemPath: string,
  newItemPath: string,
  itemIndex?: number
): Promise<PlaylistItem[]> {
  const result = await invoke<Array<{
    path: string;
    title: string;
    duration_secs: number;
    is_available: boolean;
    is_video: boolean;
  }>>("playlists_relink_item", {
    playlistPath,
    oldItemPath,
    newItemPath,
    itemIndex: itemIndex !== undefined ? itemIndex : null,
  });

  return result.map((item) => ({
    path: item.path,
    title: item.title,
    durationSecs: item.duration_secs,
    isAvailable: item.is_available,
    isVideo: item.is_video,
  }));
}

export async function playlistsRelinkFolder(
  playlistPath: string,
  searchFolder: string
): Promise<{ reconnectedCount: number; updatedItems: PlaylistItem[] }> {
  const result = await invoke<{
    reconnected_count: number;
    updated_items: Array<{
      path: string;
      title: string;
      duration_secs: number;
      is_available: boolean;
      is_video: boolean;
    }>;
  }>("playlists_relink_folder", {
    playlistPath,
    searchFolder,
  });

  return {
    reconnectedCount: result.reconnected_count,
    updatedItems: result.updated_items.map((item) => ({
      path: item.path,
      title: item.title,
      durationSecs: item.duration_secs,
      isAvailable: item.is_available,
      isVideo: item.is_video,
    })),
  };
}

// ── Favoritos ──
export async function favoritesGetAll(): Promise<FavoritesStore> {
  return await invoke<FavoritesStore>("favorites_get_all");
}

export async function favoritesToggle(
  path: string,
  mediaType?: FavoriteMediaType
): Promise<boolean> {
  return await invoke<boolean>("favorites_toggle", { path, mediaType });
}

export async function favoritesIsFavorite(
  path: string,
  mediaType?: FavoriteMediaType
): Promise<boolean> {
  return await invoke<boolean>("favorites_is_favorite", { path, mediaType });
}

