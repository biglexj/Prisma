import { invoke } from "@tauri-apps/api/core";
import type { AuroraWallpaper, AuroraWallpapersResponse, WallpaperFilterOptions } from "../model/types";

const OFFICIAL_AURORA_ORIGIN = "https://www.biglexj.com";
const WALLPAPERS_PATH = "/api/v1/wallpapers";
const FAVORITE_PATH = "/api/v1/wallpapers/favorite";

interface AuroraErrorPayload {
  error?: string;
  message?: string;
}

export class AuroraWallpapersApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AuroraWallpapersApiError";
  }
}

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
  return OFFICIAL_AURORA_ORIGIN;
}

function getAuroraAccessToken(): string | null {
  const token = localStorage.getItem("aurora_access_token")?.trim();
  return token && token !== "null" && token !== "undefined" ? token : null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const { error, message } = payload as AuroraErrorPayload;
    if (typeof error === "string" && error.trim()) return error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function normalizeWallpaper(raw: unknown): AuroraWallpaper {
  if (!raw || typeof raw !== "object") {
    throw new AuroraWallpapersApiError("Aurora devolvió un wallpaper con formato inválido");
  }

  const item = raw as Partial<AuroraWallpaper>;
  if (typeof item.id !== "string" || !item.id.trim()) {
    throw new AuroraWallpapersApiError("Aurora devolvió un wallpaper sin identificador");
  }

  return {
    id: item.id,
    title: typeof item.title === "string" && item.title.trim() ? item.title : "Wallpaper de Aurora",
    slug: typeof item.slug === "string" && item.slug.trim() ? item.slug : item.id,
    category: typeof item.category === "string" && item.category.trim() ? item.category : "General",
    style: typeof item.style === "string" && item.style.trim() ? item.style : "Digital",
    aspectRatio: typeof item.aspectRatio === "string" && item.aspectRatio.trim() ? item.aspectRatio : "16:9",
    resolution: typeof item.resolution === "string" && item.resolution.trim() ? item.resolution : "Alta definición",
    fileSize: typeof item.fileSize === "number" ? item.fileSize : 0,
    src: typeof item.src === "string" && item.src.trim() ? item.src : null,
    thumbnailSrc:
      typeof item.thumbnailSrc === "string" && item.thumbnailSrc.trim() ? item.thumbnailSrc : null,
    isPremium: item.isPremium === true,
    isAuthorized: item.isAuthorized !== false,
    isNsfw: item.isNsfw === true,
    isFavorite: item.isFavorite === true,
    viewsCount: typeof item.viewsCount === "number" ? item.viewsCount : 0,
    downloadsCount: typeof item.downloadsCount === "number" ? item.downloadsCount : 0,
    tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : [],
    createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
  };
}

function normalizeWallpapersResponse(payload: unknown): AuroraWallpapersResponse {
  if (!payload || typeof payload !== "object") {
    throw new AuroraWallpapersApiError("Aurora devolvió una respuesta vacía o inválida");
  }

  const response = payload as Partial<AuroraWallpapersResponse> & AuroraErrorPayload;
  if (response.success === false) {
    throw new AuroraWallpapersApiError(getApiErrorMessage(response, "Aurora rechazó la consulta del catálogo"));
  }
  if (!Array.isArray(response.wallpapers)) {
    throw new AuroraWallpapersApiError("El contrato de Aurora no contiene una lista de wallpapers válida");
  }

  return {
    success: true,
    page: typeof response.page === "number" ? response.page : 1,
    limit: typeof response.limit === "number" ? response.limit : response.wallpapers.length,
    total: typeof response.total === "number" ? response.total : response.wallpapers.length,
    totalPages: typeof response.totalPages === "number" ? response.totalPages : 1,
    wallpapers: response.wallpapers.map(normalizeWallpaper),
  };
}

async function requestWallpapersCatalog(
  serverUrl: string,
  queryString: string,
  signal: AbortSignal | undefined,
  token: string | null,
): Promise<AuroraWallpapersResponse> {
  const response = await fetch(`${serverUrl}${WALLPAPERS_PATH}${queryString}`, {
    signal,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new AuroraWallpapersApiError(
      getApiErrorMessage(payload, `Aurora respondió con código HTTP ${response.status}`),
      response.status,
    );
  }
  return normalizeWallpapersResponse(payload);
}

async function requestWallpapersCatalogWithAuthFallback(
  serverUrl: string,
  queryString: string,
  signal: AbortSignal | undefined,
): Promise<AuroraWallpapersResponse> {
  const token = getAuroraAccessToken();
  if (!token) return requestWallpapersCatalog(serverUrl, queryString, signal, null);

  try {
    return await requestWallpapersCatalog(serverUrl, queryString, signal, token);
  } catch (error) {
    if (isAbortError(error)) throw error;
    // Aurora puede seguir sirviendo el catálogo público mientras se actualiza CORS/autorización.
    return requestWallpapersCatalog(serverUrl, queryString, signal, null);
  }
}

export async function fetchAuroraWallpapers(
  options: WallpaperFilterOptions = {},
  signal?: AbortSignal,
): Promise<AuroraWallpapersResponse> {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));
  if (options.ratio) params.set("ratio", options.ratio);
  if (options.category) params.set("category", options.category);
  if (options.sort) params.set("sort", options.sort);
  if (options.query) params.set("q", options.query);

  const primaryUrl = getAuroraServerUrl();
  const queryString = params.toString() ? `?${params.toString()}` : "";

  // El catálogo usa la API web versionada de Aurora. Synapse queda reservado para IPC entre aplicaciones.
  try {
    return await requestWallpapersCatalogWithAuthFallback(primaryUrl, queryString, signal);
  } catch (err: unknown) {
    if (isAbortError(err)) throw err;
    if (primaryUrl !== OFFICIAL_AURORA_ORIGIN) {
      try {
        return await requestWallpapersCatalogWithAuthFallback(
          OFFICIAL_AURORA_ORIGIN,
          queryString,
          signal,
        );
      } catch (fallbackError: unknown) {
        if (isAbortError(fallbackError)) throw fallbackError;
      }
    }
    throw err instanceof Error
      ? err
      : new AuroraWallpapersApiError("Error al consultar el catálogo de Aurora");
  }
}

export async function toggleAuroraFavorite(wallpaperId: string, currentFavorite: boolean): Promise<boolean> {
  const token = getAuroraAccessToken();
  if (!token) {
    throw new Error("Inicia sesión en Aurora para sincronizar favoritos");
  }

  const serverUrl = getAuroraServerUrl();
  const response = await fetch(`${serverUrl}${FAVORITE_PATH}`, {
    method: currentFavorite ? "DELETE" : "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ wallpaperId }),
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new AuroraWallpapersApiError(
      getApiErrorMessage(payload, `Error ${response.status} al sincronizar el favorito`),
      response.status,
    );
  }

  if (payload && typeof payload === "object" && typeof (payload as { isFavorite?: unknown }).isFavorite === "boolean") {
    return (payload as { isFavorite: boolean }).isFavorite;
  }
  throw new AuroraWallpapersApiError("Aurora no confirmó el nuevo estado del favorito");
}

export async function setWindowsWallpaper(wallpaper: AuroraWallpaper): Promise<{ success: boolean; path: string }> {
  const sourceUrl = getAuthorizedWallpaperSource(wallpaper);
  // 1. Descargar la imagen en alta definición
  const response = await fetch(sourceUrl);
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
  const ext = sourceUrl.split("?")[0]?.split(".").pop() || "png";
  const fileName = `Aurora_${cleanTitle}_${Date.now()}.${ext}`;

  // 2. Guardar en disco (Pictures/Prisma Wallpapers) y aplicar como fondo de Windows en Rust
  return await invoke<{ success: boolean; path: string }>("wallpaper_save_and_apply", {
    imageBase64: base64,
    fileName,
  });
}

export async function downloadWallpaperHd(wallpaper: AuroraWallpaper): Promise<void> {
  const sourceUrl = getAuthorizedWallpaperSource(wallpaper);
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error("Error al descargar archivo");
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ext = sourceUrl.split("?")[0]?.split(".").pop() || "png";
  const cleanTitle = (wallpaper.title || wallpaper.slug || "wallpaper")
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .trim();
  a.download = `Aurora_${cleanTitle}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export function getAuthorizedWallpaperSource(wallpaper: AuroraWallpaper): string {
  if (wallpaper.isAuthorized === false) {
    throw new Error("Este wallpaper requiere una cuenta Fan autorizada");
  }
  if (!wallpaper.src) {
    throw new Error("Aurora no entregó el archivo HD autorizado");
  }
  return wallpaper.src;
}
