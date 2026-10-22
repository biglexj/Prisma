import { getDefaultPicturesDir } from "../../../shared/mediaOperations";

/** Preferencias de la grabadora de vídeo, compartidas entre ventanas. */
export interface RecordingPreferences {
  /** Fotogramas por segundo de la grabación. */
  fps: number;
  /** Dispositivo de audio DirectShow; `null` significa grabación sin audio. */
  audioDevice: string | null;
  /** Codificador: `auto`, `cpu`, `nvenc`, `qsv` o `amf`. */
  encoder: RecordingEncoder;
  /** Calidad: `high`, `medium` o `low`. */
  quality: RecordingQuality;
  /** Altura máxima del vídeo; `null` mantiene el tamaño de la región. */
  maxHeight: number | null;
  /** Capturar el audio del sistema por WASAPI loopback. */
  systemAudio: boolean;
}

export type RecordingEncoder = "auto" | "cpu" | "nvenc" | "qsv" | "amf";
export type RecordingQuality = "high" | "medium" | "low";

const STORAGE_KEY = "prisma.recording-settings.v1";
const SETTINGS_KEY = "prisma.system-settings.v1";

export const DEFAULT_RECORDING_PREFERENCES: RecordingPreferences = {
  fps: 30,
  audioDevice: null,
  encoder: "auto",
  quality: "medium",
  maxHeight: null,
  systemAudio: true,
};

export const RECORDING_FPS_OPTIONS = [24, 30, 60];

/** Alturas ofrecidas como límite de la grabación. */
export const RECORDING_SIZE_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Original", value: null },
  { label: "1080p", value: 1080 },
  { label: "720p", value: 720 },
];

/**
 * Las preferencias viven en localStorage porque el overlay corre en otra
 * webview: así la grabadora hereda los mismos ajustes sin pasar por eventos.
 */
export function loadRecordingPreferences(): RecordingPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RecordingPreferences>;
      const fps = Number(parsed.fps);
      const maxHeight = parsed.maxHeight === null || parsed.maxHeight === undefined
        ? null
        : Number(parsed.maxHeight);
      return {
        fps:
          Number.isFinite(fps) && fps >= 5 && fps <= 60
            ? Math.round(fps)
            : DEFAULT_RECORDING_PREFERENCES.fps,
        audioDevice:
          typeof parsed.audioDevice === "string" && parsed.audioDevice.trim()
            ? parsed.audioDevice
            : null,
        encoder:
          parsed.encoder === "cpu" ||
          parsed.encoder === "nvenc" ||
          parsed.encoder === "qsv" ||
          parsed.encoder === "amf"
            ? parsed.encoder
            : DEFAULT_RECORDING_PREFERENCES.encoder,
        quality:
          parsed.quality === "high" || parsed.quality === "low"
            ? parsed.quality
            : DEFAULT_RECORDING_PREFERENCES.quality,
        maxHeight:
          maxHeight !== null && Number.isFinite(maxHeight) && maxHeight >= 240
            ? Math.round(maxHeight)
            : null,
        systemAudio:
          typeof parsed.systemAudio === "boolean"
            ? parsed.systemAudio
            : DEFAULT_RECORDING_PREFERENCES.systemAudio,
      };
    }
  } catch {
    // Sin almacenamiento disponible: se usan los valores por defecto.
  }
  return { ...DEFAULT_RECORDING_PREFERENCES };
}

export function saveRecordingPreferences(preferences: RecordingPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Preferencia opcional.
  }
}

/**
 * Carpeta donde se guardan las grabaciones. Reutiliza la carpeta configurada
 * para las capturas y, si no existe, la carpeta de Imágenes del sistema.
 */
export async function resolveRecordingFolder(): Promise<string> {
  let folder = "";
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.screenCaptureFolder === "string" && parsed.screenCaptureFolder.trim()) {
        folder = parsed.screenCaptureFolder.trim();
      }
    }
  } catch {
    // Sin ajustes guardados: se usa la carpeta por defecto del sistema.
  }

  if (folder) return folder;

  try {
    const picturesDir = await getDefaultPicturesDir();
    if (picturesDir) return `${picturesDir}\\Grabaciones`;
  } catch {
    // Sin carpeta de Imágenes disponible.
  }

  return "C:\\Grabaciones";
}
