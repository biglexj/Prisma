import { invoke } from "@tauri-apps/api/core";
import type { AuroraWallpaper, AuroraWallpapersResponse, WallpaperFilterOptions } from "../model/types";

function getAuroraServerUrl(): string {
  try {
    const raw = localStorage.getItem("prisma.system-settings.v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.auroraServerUrl) {
        return parsed.auroraServerUrl.replace(/\/$/, "");
      }
    }
  } catch {}
  return "https://www.biglexj.com";
}

export async function fetchAuroraWallpapers(options: WallpaperFilterOptions = {}): Promise<AuroraWallpapersResponse> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.ratio) params.set("ratio", options.ratio);
  if (options.category) params.set("category", options.category);
  if (options.sort) params.set("sort", options.sort);
  if (options.query) params.set("q", options.query);
  if (options.nsfw) params.set("nsfw", "true");

  const primaryUrl = getAuroraServerUrl();
  const queryStr = params.toString() ? `?${params.toString()}` : "";

  // 1. Intentar con el servidor configurado (GET limpio sin headers innecesarios para evitar OPTIONS preflight)
  try {
    const res = await fetch(`${primaryUrl}/api/v1/wallpapers${queryStr}`);
    if (res.ok) {
      return await res.json();
    }
    throw new Error(`Servidor respondió con código HTTP ${res.status}`);
  } catch (err: unknown) {
    // 2. Si el servidor configurado era personalizado/LAN y falló, intentar con el servidor oficial como respaldo
    if (primaryUrl !== "https://www.biglexj.com") {
      try {
        const fallbackRes = await fetch(`https://www.biglexj.com/api/v1/wallpapers${queryStr}`);
        if (fallbackRes.ok) {
          return await fallbackRes.json();
        }
      } catch {}
    }
    throw err instanceof Error ? err : new Error("Error al consultar el catálogo de Aurora");
  }
}

export async function toggleAuroraFavorite(wallpaperId: string, currentFavorite: boolean): Promise<boolean> {
  const token = localStorage.getItem("aurora_access_token");
  if (!token || token === "null" || token === "undefined") {
    throw new Error("Inicia sesión en Aurora para sincronizar favoritos");
  }

  const serverUrl = getAuroraServerUrl();
  const res = await fetch(`${serverUrl}/api/v1/wallpapers/favorite`, {
    method: currentFavorite ? "DELETE" : "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ wallpaperId }),
  });

  if (!res.ok) {
    throw new Error(`Error ${res.status} al alternar favorito`);
  }

  return !currentFavorite;
}

export async function setWindowsWallpaper(wallpaper: AuroraWallpaper): Promise<{ success: boolean; path: string }> {
  // 1. Descargar la imagen en alta definición
  const response = await fetch(wallpaper.src);
  if (!response.ok) {
    throw new Error("No se pudo descargar la imagen en alta definición");
  }
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  
  // Convertir a base64 de manera segura
  let binary = "";
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const base64 = btoa(binary);

  const cleanTitle = (wallpaper.title || wallpaper.slug || "Wallpaper")
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .trim();
  const ext = wallpaper.src.split("?")[0]?.split(".").pop() || "png";
  const fileName = `Aurora_${cleanTitle}_${Date.now()}.${ext}`;

  // 2. Guardar en disco (Pictures/Prisma Wallpapers) y aplicar como fondo de Windows en Rust
  return await invoke<{ success: boolean; path: string }>("wallpaper_save_and_apply", {
    imageBase64: base64,
    fileName,
  });
}

export async function downloadWallpaperHd(wallpaper: AuroraWallpaper): Promise<void> {
  const response = await fetch(wallpaper.src);
  if (!response.ok) {
    throw new Error("Error al descargar archivo");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ext = wallpaper.src.split("?")[0]?.split(".").pop() || "png";
  const cleanTitle = (wallpaper.title || wallpaper.slug || "wallpaper")
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .trim();
  a.download = `Aurora_${cleanTitle}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
