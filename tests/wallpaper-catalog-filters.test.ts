import { describe, expect, test } from "bun:test";
import { matchesWallpaperFilter, wallpaperCatalogQuery, WALLPAPER_VISIBILITY_OPTIONS } from "../src/features/wallpapers/model/catalogFilters";
import type { WallpaperVisibility } from "../src/features/wallpapers/model/types";

describe("filtros del catálogo compartidos con web y móvil", () => {
  test("General es el valor inicial y no solicita contenido adulto", () => {
    expect(WALLPAPER_VISIBILITY_OPTIONS[0].value).toBe("all");
    const query = wallpaperCatalogQuery({});
    expect(query.get("vis")).toBe("general");
    expect(query.has("nsfw")).toBe(false);
  });
  test("combina formato, búsqueda y visibilidad usando el contrato público", () => {
    for (const visibility of ["general", "all", "premium", "nsfw"] as const) {
      const query = wallpaperCatalogQuery({ visibility, ratio: "9:16", query: "Ely & Biglex", sort: "trending", page: 2 });
      expect(query.get("vis")).toBe(visibility);
      expect(query.has("nsfw")).toBe(visibility === "all" || visibility === "nsfw");
      expect(query.get("ratio")).toBe("9:16");
      expect(new URLSearchParams(query.toString()).get("q")).toBe("Ely & Biglex");
      expect(query.get("page")).toBe("2");
    }
  });
  test("Mostrar todo nunca concede autorización ni acepta autorización ausente", () => {
    for (const visibility of ["general", "all", "premium", "nsfw"] as WallpaperVisibility[]) {
      expect(matchesWallpaperFilter({ isAuthorized: false, isPremium: true, isNsfw: true }, visibility)).toBe(false);
      expect(matchesWallpaperFilter({ isAuthorized: undefined as unknown as boolean, isPremium: false, isNsfw: false }, visibility)).toBe(false);
    }
  });
  test("clasifica contenido general, premium y adulto igual que Super Galería", () => {
    const content = [
      { isAuthorized: true, isPremium: false, isNsfw: false },
      { isAuthorized: true, isPremium: true, isNsfw: false },
      { isAuthorized: true, isPremium: false, isNsfw: true },
      { isAuthorized: true, isPremium: true, isNsfw: true },
    ];
    expect(content.filter(wp => matchesWallpaperFilter(wp, "general"))).toEqual([content[0]]);
    expect(content.filter(wp => matchesWallpaperFilter(wp, "premium"))).toEqual([content[1]]);
    expect(content.filter(wp => matchesWallpaperFilter(wp, "nsfw"))).toEqual([content[2], content[3]]);
    expect(content.filter(wp => matchesWallpaperFilter(wp, "all"))).toEqual(content);
  });
});
