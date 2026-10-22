export type CaptureFormat = "png" | "webp" | "jpeg" | "elx";

export const CAPTURE_FORMATS = [
  { id: "png", extension: "png", label: "PNG", description: "Sin pérdidas" },
  { id: "webp", extension: "webp", label: "WebP", description: "Sin pérdidas" },
  { id: "jpeg", extension: "jpg", label: "JPG", description: "Universal" },
  { id: "elx", extension: "elx", label: "ELX", description: "Experimental" },
] as const;

export function resolveCaptureFormat(value: unknown) {
  return CAPTURE_FORMATS.find(option => option.id === value) ?? CAPTURE_FORMATS[0];
}

export function getCaptureFormat() {
  let stored: unknown;
  try {
    stored = JSON.parse(localStorage.getItem("prisma.system-settings.v1") || "{}").videoSnapshotFormat;
  } catch { /* Preferencia ausente o dañada: PNG. */ }
  return resolveCaptureFormat(stored);
}
