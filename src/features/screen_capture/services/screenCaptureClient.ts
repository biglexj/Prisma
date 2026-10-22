import { getCaptureFormat, type CaptureFormat } from "../../../shared/captureFormat";
import { invoke } from "@tauri-apps/api/core";
import type {
  CaptureIntent,
  CaptureMode,
  CaptureSessionInit,
  DetectedTarget,
  EditorPayload,
  RecordingInfo,
  RecordingOptions,
  RectSelection,
  ScreenCaptureShortcutStatus,
} from "../model/types";

export const screenCaptureClient = {
  async startCapture(mode?: CaptureMode, intent: CaptureIntent = "image"): Promise<CaptureSessionInit> {
    return invoke<CaptureSessionInit>("screen_capture_start", { mode, intent });
  },

  async detectSubregion(
    parentHwnd: number,
    screenX: number,
    screenY: number
  ): Promise<DetectedTarget | null> {
    return invoke<DetectedTarget | null>("screen_capture_detect_subregion", {
      parentHwnd,
      screenX,
      screenY,
    });
  },

  /**
   * Resuelve la ventana bajo el cursor con el hit-test del sistema operativo.
   * Es la fuente de verdad del modo Ventana: no depende de la lista de la sesión.
   */
  async detectWindowAt(
    screenX: number,
    screenY: number
  ): Promise<DetectedTarget | null> {
    return invoke<DetectedTarget | null>("screen_capture_detect_window_at", {
      screenX: Math.round(screenX),
      screenY: Math.round(screenY),
    });
  },

  /** Sesión de captura vigente en el backend (respaldo si se pierde el evento). */
  async getSession(): Promise<CaptureSessionInit | null> {
    return invoke<CaptureSessionInit | null>("screen_capture_get_session");
  },

  async overlayReady(sessionId: number): Promise<void> {
    return invoke<void>("screen_capture_overlay_ready", { sessionId });
  },

  async confirmCapture(rect: RectSelection): Promise<EditorPayload> {
    return invoke<EditorPayload>("screen_capture_confirm", { rect });
  },

  async cancelCapture(): Promise<void> {
    return invoke<void>("screen_capture_cancel");
  },

  async pickColor(
    screenX: number,
    screenY: number
  ): Promise<{ hex: string; r: number; g: number; b: number }> {
    return invoke<{ hex: string; r: number; g: number; b: number }>(
      "screen_capture_pick_color",
      {
        screenX: Math.round(screenX),
        screenY: Math.round(screenY),
      }
    );
  },

  async getEditorPayload(): Promise<EditorPayload | null> {
    return invoke<EditorPayload | null>("screen_capture_get_editor_payload");
  },

  async saveFile(filePath: string, dataBase64: string, format: CaptureFormat = getCaptureFormat().id): Promise<string> {
    return invoke<string>("screen_capture_save_file", {
      filePath,
      dataBase64,
      format,
    });
  },

  async getShortcutStatus(): Promise<ScreenCaptureShortcutStatus> {
    return invoke<ScreenCaptureShortcutStatus>("screen_capture_get_shortcut_status");
  },

  /**
   * Aplica la preferencia del atajo global. El backend registra en el sistema
   * operativo, guarda la preferencia y devuelve el estado resultante; un
   * conflicto viaja en `error` para poder explicarlo en la interfaz.
   */
  async configure(enabled: boolean, shortcut: string): Promise<ScreenCaptureShortcutStatus> {
    return invoke<ScreenCaptureShortcutStatus>("screen_capture_configure", { enabled, shortcut });
  },

  // ── Grabadora de vídeo ──────────────────────────────────────────────────

  /** Inicia la grabación de la región indicada. El overlay se oculta antes. */
  async startRecording(options: RecordingOptions): Promise<RecordingInfo> {
    return invoke<RecordingInfo>("screen_recorder_start", { options });
  },

  /** Detiene la grabación y cierra el archivo para que quede reproducible. */
  async stopRecording(): Promise<RecordingInfo> {
    return invoke<RecordingInfo>("screen_recorder_stop");
  },

  /** Estado de la grabación en curso, si la hay. */
  async getRecordingStatus(): Promise<RecordingInfo | null> {
    return invoke<RecordingInfo | null>("screen_recorder_status");
  },

  /** Detiene la grabación y descarta el archivo parcial. */
  async cancelRecording(): Promise<void> {
    return invoke<void>("screen_recorder_cancel");
  },

  /** Dispositivos de audio capturables (micrófono, cable de audio, mezcla estéreo). */
  async listAudioDevices(): Promise<string[]> {
    return invoke<string[]>("screen_recorder_list_audio_devices");
  },
};
