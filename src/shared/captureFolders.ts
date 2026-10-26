import { invoke } from "@tauri-apps/api/core";

export type CaptureFolderKind = "image" | "video" | "frame";
export type DefaultCaptureFolders = { images: string; videos: string };
const keys = { image: "screenCaptureFolder", video: "screenRecordingFolder", frame: "videoSnapshotFolder" } as const;

/** Crea y resuelve las carpetas Prisma dentro de las bibliotecas del sistema. */
export function getDefaultCaptureFolders(): Promise<DefaultCaptureFolders> {
  return invoke<DefaultCaptureFolders>("media_get_default_capture_folders");
}

export function captureFolderOverride(kind: CaptureFolderKind, settings: Record<string, unknown>): string {
  const value = settings[keys[kind]];
  return typeof value === "string" ? value.trim() : "";
}

/** Cada tipo consulta únicamente su ajuste; las grabaciones nunca heredan Imágenes. */
export async function resolveCaptureFolder(kind: CaptureFolderKind): Promise<string> {
  try {
    const stored = JSON.parse(localStorage.getItem("prisma.system-settings.v1") || "{}");
    const custom = captureFolderOverride(kind, stored ?? {});
    if (custom) return custom;
  } catch { /* Ajustes ausentes o inválidos: usar la biblioteca del sistema. */ }
  const defaults = await getDefaultCaptureFolders();
  return kind === "video" ? defaults.videos : defaults.images;
}
