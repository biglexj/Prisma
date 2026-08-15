import { invoke } from "@tauri-apps/api/core";
import type { QuickLookPayload } from "../model/types";

export const quickLookClient = {
  hide(): Promise<void> {
    return invoke("quick_look_hide");
  },

  openInMain(path: string): Promise<void> {
    return invoke("quick_look_open_in_main", { path });
  },

  getCurrent(): Promise<QuickLookPayload | null> {
    return invoke("quick_look_get_current");
  },
};
