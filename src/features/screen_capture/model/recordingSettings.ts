import { resolveCaptureFolder } from "../../../shared/captureFolders";

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
  /** Contenedor del vídeo grabado: `mp4`, `mkv` o `mov`. */
  container: RecordingContainer;
}

export type RecordingEncoder = "auto" | "cpu" | "nvenc" | "qsv" | "amf";
export type RecordingQuality = "high" | "medium" | "low";
/** Contenedores disponibles para la grabación: todos llevan H.264 + AAC. */
export type RecordingContainer = "mp4" | "mkv" | "mov";

const STORAGE_KEY = "prisma.recording-settings.v1";

export const DEFAULT_RECORDING_PREFERENCES: RecordingPreferences = {
  fps: 30,
  audioDevice: null,
  encoder: "auto",
  quality: "medium",
  maxHeight: null,
  systemAudio: true,
  container: "mp4",
};

/** Contenedores de vídeo ofrecidos en el capturador. */
export const RECORDING_CONTAINER_OPTIONS: { id: RecordingContainer; label: string; description: string }[] = [
  { id: "mp4", label: "MP4", description: "Universal" },
  { id: "mkv", label: "MKV", description: "Matroska" },
  { id: "mov", label: "MOV", description: "QuickTime" },
];

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
        container:
          parsed.container === "mkv" || parsed.container === "mov"
            ? parsed.container
            : DEFAULT_RECORDING_PREFERENCES.container,
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

/** Carpeta independiente para las grabaciones de pantalla. */
export function resolveRecordingFolder(): Promise<string> {
  return resolveCaptureFolder("video");
}
