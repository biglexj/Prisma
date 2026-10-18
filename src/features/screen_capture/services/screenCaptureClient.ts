import { invoke } from "@tauri-apps/api/core";
import type {
  CaptureMode,
  CaptureSessionInit,
  DetectedTarget,
  EditorPayload,
  RectSelection,
  ScreenCaptureShortcutStatus,
} from "../model/types";

export const screenCaptureClient = {
  async startCapture(mode?: CaptureMode): Promise<CaptureSessionInit> {
    return invoke<CaptureSessionInit>("screen_capture_start", { mode });
  },

  async detectSubregion(
    parentX: number,
    parentY: number,
    screenX: number,
    screenY: number
  ): Promise<DetectedTarget | null> {
    return invoke<DetectedTarget | null>("screen_capture_detect_subregion", {
      parentX,
      parentY,
      screenX,
      screenY,
    });
  },

  async confirmCapture(rect: RectSelection): Promise<EditorPayload> {
    return invoke<EditorPayload>("screen_capture_confirm", { rect });
  },

  async cancelCapture(): Promise<void> {
    return invoke<void>("screen_capture_cancel");
  },

  async getEditorPayload(): Promise<EditorPayload | null> {
    return invoke<EditorPayload | null>("screen_capture_get_editor_payload");
  },

  async saveFile(filePath: string, dataBase64: string): Promise<string> {
    return invoke<string>("screen_capture_save_file", {
      filePath,
      dataBase64,
    });
  },

  async getShortcutStatus(): Promise<ScreenCaptureShortcutStatus> {
    return invoke<ScreenCaptureShortcutStatus>("screen_capture_get_shortcut_status");
  },

  async setShortcut(shortcut: string): Promise<void> {
    return invoke<void>("screen_capture_set_shortcut", { shortcut });
  },
};
