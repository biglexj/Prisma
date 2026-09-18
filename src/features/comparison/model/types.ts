import type { VisualLibraryItem } from "../../visual_library/model/types";

export type ComparisonMode = "split" | "curtain" | "grid" | "flick";

export interface ComparisonImageSlot {
  id: string;
  item: VisualLibraryItem;
  zoom: number;
  pan: { x: number; y: number };
  width?: number;
  height?: number;
  duration?: number;
  currentTime?: number;
  isMuted?: boolean;
}

export const SUPPORTED_IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "svg",
  "avif",
];

export const SUPPORTED_VIDEO_EXTENSIONS = [
  "mp4",
  "webm",
  "mkv",
  "mov",
  "avi",
  "wmv",
  "flv",
  "m4v",
  "ts",
];

export const SUPPORTED_AUDIO_EXTENSIONS = [
  "mp3",
  "flac",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "opus",
  "wma",
  "aiff",
  "alac",
];

export const SUPPORTED_ALL_MEDIA_EXTENSIONS = [
  ...SUPPORTED_IMAGE_EXTENSIONS,
  ...SUPPORTED_VIDEO_EXTENSIONS,
  ...SUPPORTED_AUDIO_EXTENSIONS,
];

export type ComparisonMediaType = "image" | "video" | "audio";

export function isImagePath(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
}

export function isVideoPath(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return SUPPORTED_VIDEO_EXTENSIONS.includes(ext);
}

export function isAudioPath(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return SUPPORTED_AUDIO_EXTENSIONS.includes(ext);
}

export function isSupportedMediaPath(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return SUPPORTED_ALL_MEDIA_EXTENSIONS.includes(ext);
}

export function getMediaType(filePath: string): ComparisonMediaType | null {
  if (isAudioPath(filePath)) return "audio";
  if (isVideoPath(filePath)) return "video";
  if (isImagePath(filePath)) return "image";
  return null;
}

export function createVisualItemFromPath(filePath: string): VisualLibraryItem {
  const normalized = filePath.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop() || "Archivo";
  const isVideo = isVideoPath(filePath);
  const isAudio = isAudioPath(filePath);
  return {
    path: filePath,
    title: fileName,
    sourcePath: filePath,
    relativeFolder: "",
    kind: isAudio ? ("audio" as any) : isVideo ? "video" : "image",
    modifiedAtMillis: Date.now(),
    sizeBytes: 0,
  };
}
