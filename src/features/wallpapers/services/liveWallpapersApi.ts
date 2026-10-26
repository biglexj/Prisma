import { invoke } from "@tauri-apps/api/core";
import type { CompositionConfig } from "../compositor/config";

/** Tipo de medio de la capa 1: vídeo o imagen estática. */
export type MediaKind = "video" | "image";

/**
 * Qué tipos de medio entran en la cola y en la cuadrícula.
 * Por defecto solo hay vídeos: es lo que hacía la aplicación antes de que
 * existieran las imágenes, así que un fondo ya configurado no cambia de
 * comportamiento al abrirse. Mezclar es una decisión explícita.
 */
export type MediaKindMode = "video" | "image" | "mixed";

export interface FolderSource {
  id: string;
  path: string;
  name: string;
  enabled: boolean;
  /** Archivos de medio hallados en la carpeta (vídeos e imágenes). */
  mediaCount: number;
  available: boolean;
  hidden: boolean;
}

/** Un medio de la cuadrícula: un vídeo o una imagen estática. */
export interface WallpaperMediaItem {
  path: string;
  name: string;
  folderId: string;
  folderName: string;
  kind: MediaKind;
  hidden: boolean;
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
  /** Rutas de los medios ocultados (vídeos e imágenes). */
  hiddenMedia: string[];
  /** Sonido del fondo vivo. Independiente del reproductor de la app. */
  audioEnabled: boolean;
  /** Segundos que una imagen estática permanece en pantalla. */
  imageDurationSec: number;
  /** Tipo de medio que entra en la cola y en la cuadrícula. */
  mediaKindMode: MediaKindMode;
}

export interface WallpaperStateSnapshot {
  isActive: boolean;
  baseActive: boolean;
  isPaused: boolean;
  currentMedia: string | null;
  currentFolder: string | null;
  totalMedia: number;
  /** Si la composición de escritorio (capas 2 a 6) está montada. */
  compositorEnabled: boolean;
  settings: WallpaperSettings;
  media: WallpaperMediaItem[];
}

/**
 * Selecciona los medios visibles en la cuadrícula.
 * Los medios ocultados no se muestran salvo que se pida verlos
 * ("Mostrar ocultos"), en cuyo caso aparecen marcados para poder recuperarlos.
 */
export function selectVisibleMedia(
  media: WallpaperMediaItem[],
  options: { showHidden: boolean; query?: string }
): WallpaperMediaItem[] {
  const query = (options.query ?? "").trim().toLowerCase();
  return media.filter((item) => {
    if (item.hidden && !options.showHidden) return false;
    if (!query) return true;
    return (
      item.name.toLowerCase().includes(query) ||
      item.folderName.toLowerCase().includes(query)
    );
  });
}

/** Sustantivo en singular del tipo de medio activo: vídeo, imagen o medio. */
export function mediaNoun(mode: MediaKindMode): "vídeo" | "imagen" | "medio" {
  if (mode === "image") return "imagen";
  if (mode === "mixed") return "medio";
  return "vídeo";
}

/** Sustantivo en plural del tipo de medio activo. */
export function mediaNounPlural(mode: MediaKindMode): "vídeos" | "imágenes" | "medios" {
  if (mode === "image") return "imágenes";
  if (mode === "mixed") return "medios";
  return "vídeos";
}

/** Texto en mayúscula para las etiquetas del selector de tipo. */
export function mediaKindLabel(mode: MediaKindMode): "Vídeos" | "Imágenes" | "Combinado" {
  if (mode === "image") return "Imágenes";
  if (mode === "mixed") return "Combinado";
  return "Vídeos";
}

/**
 * Cantidad de medios con el sustantivo correcto y bien pluralizado:
 * "1 vídeo", "3 vídeos", "2 imágenes", "5 medios".
 */
export function mediaCountLabel(mode: MediaKindMode, count: number): string {
  const noun = count === 1 ? mediaNoun(mode) : mediaNounPlural(mode);
  return `${count} ${noun}`;
}

/** ¿Este medio tiene pista de sonido? Solo los vídeos. */
export function mediaHasAudio(kind: MediaKind): boolean {
  return kind === "video";
}

/**
 * ¿El interruptor de sonido tiene efecto con el estado actual?
 * Con el tipo en "Imágenes" no hay ningún vídeo en la cola, y si lo que está
 * en pantalla es una imagen tampoco hay audio que apagar.
 */
export function audioToggleApplies(mode: MediaKindMode, currentKind: MediaKind | null): boolean {
  if (mode === "image") return false;
  if (currentKind === "image") return false;
  return true;
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
  stopBase: () => invoke<WallpaperStateSnapshot>("live_wallpaper_stop_base"),
  addFolder: (path: string) => invoke<FolderSource>("live_wallpaper_add_folder", { path }),
  removeFolder: (id: string) => invoke<WallpaperStateSnapshot>("live_wallpaper_remove_folder", { id }),
  toggleFolder: (id: string, enabled: boolean) =>
    invoke<WallpaperStateSnapshot>("live_wallpaper_toggle_folder", { id, enabled }),
  refreshSources: () => invoke<WallpaperStateSnapshot>("live_wallpaper_refresh_sources"),
  setMode: (mode: WallpaperMode) => invoke<WallpaperStateSnapshot>("live_wallpaper_set_mode", { mode }),
  setFit: (fit: WallpaperFit) => invoke<WallpaperStateSnapshot>("live_wallpaper_set_fit", { fit }),
  setAudioEnabled: (enabled: boolean) =>
    invoke<WallpaperStateSnapshot>("live_wallpaper_set_audio_enabled", { enabled }),
  setFolderHidden: (id: string, hidden: boolean) =>
    invoke<WallpaperStateSnapshot>("live_wallpaper_set_folder_hidden", { id, hidden }),
  setMediaHidden: (path: string, hidden: boolean) =>
    invoke<WallpaperStateSnapshot>("live_wallpaper_set_media_hidden", { path, hidden }),
  setMediaKindMode: (mode: MediaKindMode) =>
    invoke<WallpaperStateSnapshot>("live_wallpaper_set_media_kind_mode", { mode }),
  setImageDuration: (seconds: number) =>
    invoke<WallpaperStateSnapshot>("live_wallpaper_set_image_duration", { seconds }),
  setCompositorEnabled: (enabled: boolean) =>
    invoke<WallpaperStateSnapshot>("live_wallpaper_compositor_set", { enabled }),
  getCompositorConfig: () => invoke<CompositionConfig>("live_wallpaper_compositor_config_get"),
  setCompositorConfig: (config: CompositionConfig) =>
    invoke<void>("live_wallpaper_compositor_config_set", { config }),
};
