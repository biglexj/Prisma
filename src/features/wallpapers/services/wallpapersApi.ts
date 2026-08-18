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

  const token = localStorage.getItem("aurora_access_token");
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const primaryUrl = getAuroraServerUrl();
  const queryStr = params.toString() ? `?${params.toString()}` : "";

  try {
    const res = await fetch(`${primaryUrl}/api/v1/wallpapers${queryStr}`, {
      method: "GET",
      headers,
    });

    if (res.ok) {
      return await res.json();
    }

    // Si devuelve 404 en producción, intentar preview como fallback automático
    if (res.status === 404 && primaryUrl.includes("www.biglexj.com")) {
      const fallbackRes = await fetch(`https://preview.biglexj.com/api/v1/wallpapers${queryStr}`, {
        method: "GET",
        headers,
      });
      if (fallbackRes.ok) {
        return await fallbackRes.json();
      }
    }

    if (res.status === 401) {
      throw new Error(`El servidor (${primaryUrl}) respondió con código 401. El despliegue de la API se encuentra en progreso.`);
    }

    throw new Error(`Error HTTP ${res.status} al consultar catálogo`);
  } catch (err: any) {
    throw err;
  }
}

export async function toggleAuroraFavorite(wallpaperId: string, currentFavorite: boolean): Promise<boolean> {
  const token = localStorage.getItem("aurora_access_token");
  if (!token) {
    throw new Error("Inicia sesión en Aurora Blog para sincronizar favoritos");
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
  // 1. Descargar la imagen
  const response = await fetch(wallpaper.src);
  if (!response.ok) {
    throw new Error("No se pudo descargar la imagen en alta definición");
  }
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
  );

  // 2. Guardar en disco temporal o de imágenes
  const cleanTitle = wallpaper.title.replace(/[^a-zA-Z0-9_\- ]/g, "").trim() || wallpaper.slug;
  const fileName = `Aurora_${cleanTitle}_${Date.now()}.png`;

  // Usar media_save_image de Prisma
  const saveResult = await invoke<{ savedPath: string }>("media_save_image", {
    sourcePath: fileName,
    imageBase64: base64,
    overwrite: false,
    customFileName: fileName,
  });

  // 3. Invocar wallpaper_set_desktop con la ruta absoluta guardada
  return await invoke<{ success: boolean; path: string }>("wallpaper_set_desktop", {
    imagePath: saveResult.savedPath,
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
  a.download = `Aurora_${wallpaper.slug || "wallpaper"}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
