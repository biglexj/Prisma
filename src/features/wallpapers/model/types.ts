export interface AuroraWallpaper {
  id: string;
  title: string;
  slug: string;
  category: string;
  style: string;
  aspectRatio: string; // e.g. "16:9", "9:16", "21:9", "1:1"
  resolution: string;
  fileSize: number;
  src: string;
  thumbnailSrc: string;
  isPremium: boolean;
  isAuthorized: boolean;
  isNsfw: boolean;
  isFavorite: boolean;
  viewsCount: number;
  downloadsCount: number;
  tags: string[];
  createdAt: string;
}

export interface AuroraWallpapersResponse {
  success: boolean;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  wallpapers: AuroraWallpaper[];
}

export interface WallpaperFilterOptions {
  page?: number;
  limit?: number;
  ratio?: string;
  category?: string;
  sort?: "recent" | "trending" | "views" | "downloads";
  query?: string;
  nsfw?: boolean;
}
