import type { VisualLibraryItem } from "../../model/types";

export type ComparisonMode = "split" | "curtain" | "grid" | "flick";

export interface ComparisonImageSlot {
  id: string;
  item: VisualLibraryItem;
  zoom: number;
  pan: { x: number; y: number };
  width?: number;
  height?: number;
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

export function isImagePath(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
}

export function createVisualItemFromPath(filePath: string): VisualLibraryItem {
  const normalized = filePath.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop() || "Imagen";
  return {
    path: filePath,
    title: fileName,
    sourcePath: filePath,
    relativeFolder: "",
    kind: "image",
    modifiedAtMillis: Date.now(),
    sizeBytes: 0,
  };
}
