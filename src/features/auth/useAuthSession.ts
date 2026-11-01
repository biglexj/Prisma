import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { prismaAuth } from "./prismaAuth";
import type { SessionSnapshot } from "./types";

const INITIAL_SNAPSHOT: SessionSnapshot = {
  state: "absent",
  userId: null,
  email: null,
  displayName: null,
  avatarUrl: null,
  provider: null,
  expiresAt: null,
  verified: false,
  error: null,
};

export function useAuthSession() {
  const [session, setSession] = useState<SessionSnapshot>(INITIAL_SNAPSHOT);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      // Intentar consumir callback pendiente primero si lo hay
      const pendingSnap = await prismaAuth.consumePendingCallback().catch(() => null);
      if (pendingSnap) {
        setSession(pendingSnap);
        return;
      }
      const current = await prismaAuth.getStatus();
      setSession(current);
    } catch {
      // Ignorar errores transitorios de inicialización
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    fetchStatus();

    listen<SessionSnapshot>("auth://session-changed", (event) => {
      setSession(event.payload);
      setLoading(false);
    }).then((fn) => {
      unlisten = fn;
    });

    const handleFocus = () => {
      fetchStatus();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      if (unlisten) unlisten();
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchStatus]);

  const login = useCallback(async (provider: "google" | "github" | "discord" | "biglexj" = "google") => {
    return prismaAuth.login(provider);
  }, []);

  const logout = useCallback(async () => {
    await prismaAuth.logout();
    setSession(INITIAL_SNAPSHOT);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const snap = await prismaAuth.refresh();
      setSession(snap);
      return snap;
    } catch (e) {
      console.error("[Auth] Error al renovar sesión:", e);
      throw e;
    }
  }, []);

  const getAccessToken = useCallback(async () => {
    return prismaAuth.getAccessToken();
  }, []);

  const isAuthenticated = session.state === "active" && Boolean(session.userId);

  return {
    session,
    loading,
    isAuthenticated,
    login,
    logout,
    refresh,
    getAccessToken,
  };
}
