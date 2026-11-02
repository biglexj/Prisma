import { invoke } from "@tauri-apps/api/core";
import type { SessionSnapshot } from "./types";

export const prismaAuth = {
  async getStatus(): Promise<SessionSnapshot> {
    return invoke<SessionSnapshot>("auth_session_status");
  },

  async login(provider: "google" | "github" | "discord" | "biglexj" = "google"): Promise<string> {
    const url = await invoke<string>("auth_session_login", { provider });
    if (url) {
      await invoke("open_external_url", { url }).catch(() => {
        window.open(url, "_blank");
      });
    }
    return url;
  },

  async complete(code: string): Promise<SessionSnapshot> {
    return invoke<SessionSnapshot>("auth_session_complete", { code });
  },

  async cancelLogin(): Promise<SessionSnapshot> {
    return invoke<SessionSnapshot>("auth_session_cancel_login");
  },

  async refresh(): Promise<SessionSnapshot> {
    return invoke<SessionSnapshot>("auth_session_refresh");
  },

  async logout(): Promise<void> {
    return invoke<void>("auth_session_logout");
  },

  async getAccessToken(): Promise<string | null> {
    return invoke<string | null>("auth_session_access_token");
  },

  async consumePendingCallback(): Promise<SessionSnapshot | null> {
    return invoke<SessionSnapshot | null>("auth_consume_pending_callback");
  },
};
