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
};
