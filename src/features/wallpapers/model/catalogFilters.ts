import type { AuroraWallpaper, WallpaperFilterOptions, WallpaperVisibility } from "./types";

export const WALLPAPER_VISIBILITY_OPTIONS: { value: WallpaperVisibility; label: string }[] = [
  { value: "all", label: "Mostrar todo" },
  { value: "general", label: "General" },
  { value: "premium", label: "Premium" },
  { value: "nsfw", label: "+18" },
];

export function wallpaperCatalogQuery(options: WallpaperFilterOptions): URLSearchParams {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.ratio) params.set("ratio", options.ratio);
  if (options.category) params.set("category", options.category);
  if (options.sort) params.set("sort", options.sort);
  if (options.query) params.set("q", options.query);
  const visibility = options.visibility ?? "general";
  params.set("vis", visibility);
  if (visibility === "all" || visibility === "nsfw") params.set("nsfw", "true");
  return params;
}

/** Same presentation filters as the web/mobile. Only the server grants access. */
export function matchesWallpaperFilter(wallpaper: Pick<AuroraWallpaper, "isAuthorized" | "isPremium" | "isNsfw">, visibility: WallpaperVisibility): boolean {
  if (wallpaper.isAuthorized !== true) return false;
  switch (visibility) {
    case "general": return !wallpaper.isPremium && !wallpaper.isNsfw;
    case "premium": return wallpaper.isPremium && !wallpaper.isNsfw;
    case "nsfw": return wallpaper.isNsfw;
    case "all": return true;
  }
}
