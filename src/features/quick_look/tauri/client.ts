import { invoke } from "@tauri-apps/api/core";
import type { QuickLookPayload } from "../model/types";

export const quickLookClient = {
  hide(): Promise<void> {
    return invoke("quick_look_hide");
  },

  openInMain(path: string, currentTime?: number): Promise<void> {
    return invoke("quick_look_open_in_main", { path, currentTime });
  },

  openDetached(path: string): Promise<string> {
    return invoke("quick_look_open_detached", { path });
  },

  getCurrent(): Promise<QuickLookPayload | null> {
    return invoke("quick_look_get_current");
  },

  getDetachedPayload(label: string): Promise<QuickLookPayload | null> {
    return invoke("quick_look_get_detached_payload", { label });
  },

  closeWindow(): Promise<void> {
    return invoke("quick_look_close_window");
  },

  stepSelection(forward: boolean): Promise<boolean> {
    return invoke("quick_look_step_selection", { forward });
  },

  editFile(path: string): Promise<void> {
    return invoke("quick_look_edit_file", { path });
  },

  openWithDefaultApp(path: string): Promise<void> {
    return invoke("open_path_with_default_app", { path });
  },
};
