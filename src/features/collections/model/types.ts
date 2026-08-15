export interface PlaylistItem {
  path: string;
  title: string;
  durationSecs: number;
  isAvailable?: boolean;
  isVideo?: boolean;
}

export type PlaylistMediaKind = "video" | "music" | "mixed";

export interface PlaylistMeta {
  name: string;
  path: string;
  itemCount: number;
  validCount?: number;
  videoCount?: number;
  audioCount?: number;
  mediaKind?: PlaylistMediaKind;
  modifiedAt: number;
  isHidden?: boolean;
}

export interface FavoritesStore {
  music: string[];
  images: string[];
  videos: string[];
}

export type FavoriteMediaType = "music" | "image" | "video";
