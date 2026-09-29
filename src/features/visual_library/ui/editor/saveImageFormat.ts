import type { ImageEditorOutputFormat } from "./editorTypes";

export function originalImageFormat(fileName: string): {
  stem: string;
  format: ImageEditorOutputFormat;
  extension: string;
  canOverwrite: boolean;
} {
  const lastDot = fileName.lastIndexOf(".");
  const stem = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const originalExtension = lastDot > 0 ? fileName.slice(lastDot + 1).toLowerCase() : "";
  const canOverwrite = ["png", "jpg", "jpeg", "webp"].includes(originalExtension);
  const format: ImageEditorOutputFormat = originalExtension === "jpg" || originalExtension === "jpeg"
    ? "jpeg"
    : originalExtension === "webp" ? "webp" : "png";
  const extension = canOverwrite ? `.${originalExtension}` : ".png";
  return { stem, format, extension, canOverwrite };
}

export function extensionForImageFormat(format: ImageEditorOutputFormat, originalExtension: string): string {
  if (format === "jpeg") return originalExtension === ".jpeg" ? ".jpeg" : ".jpg";
  return format === "webp" ? ".webp" : ".png";
}

export function mimeForImageFormat(format: ImageEditorOutputFormat): string {
  return format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
}
