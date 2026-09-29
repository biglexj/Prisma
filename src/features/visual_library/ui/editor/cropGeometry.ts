import type { AspectRatioOption, CropRect } from "./editorTypes";

export function aspectRatioValue(option: AspectRatioOption): number | null {
  switch (option) {
    case "1:1": return 1;
    case "4:3": return 4 / 3;
    case "3:4": return 3 / 4;
    case "16:9": return 16 / 9;
    case "9:16": return 9 / 16;
    default: return null;
  }
}

export function fitCropToAspect(option: AspectRatioOption, imageWidth: number, imageHeight: number): CropRect | null {
  const targetRatio = aspectRatioValue(option);
  if (!targetRatio || imageWidth <= 0 || imageHeight <= 0) return null;
  const imageRatio = imageWidth / imageHeight;
  const width = Math.min(1, targetRatio / imageRatio);
  const height = Math.min(1, imageRatio / targetRatio);
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

export function previewPointToImage(x: number, y: number, crop: CropRect | null): { x: number; y: number } {
  return crop ? { x: crop.x + x * crop.width, y: crop.y + y * crop.height } : { x, y };
}

export function brushWidthInImage(brushWidth: number, canvasWidth: number, crop: CropRect | null): number {
  const fullPreviewWidth = crop ? canvasWidth / crop.width : canvasWidth;
  return brushWidth / fullPreviewWidth;
}
