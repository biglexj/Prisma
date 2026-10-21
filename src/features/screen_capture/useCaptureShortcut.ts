import { useCallback, useEffect, useState } from "react";
import { screenCaptureClient } from "./services/screenCaptureClient";
import type { ScreenCaptureShortcutStatus } from "./model/types";

const LEGACY_STORAGE_KEY = "prisma.system-settings.v1";
const STATUS_CHANGE_EVENT = "prisma:capture-shortcut-changed";

let cachedStatus: ScreenCaptureShortcutStatus | null = null;
let migrationChecked = false;

interface LegacyPreference {
  enabled: boolean;
  shortcut: string;
}

/**
 * Preferencia antigua: el atajo vivía en el localStorage del frontend y solo se
 * aplicaba cuando el usuario visitaba Configuración. Se lee una única vez para
 * transferirla al backend, que es ahora la fuente de verdad.
 */
function readLegacyPreference(): LegacyPreference | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed?.screenCaptureEnabled !== "boolean") return null;
    const shortcut = typeof parsed.screenCaptureShortcut === "string" ? parsed.screenCaptureShortcut : "";
    return { enabled: parsed.screenCaptureEnabled, shortcut };
  } catch {
    return null;
  }
}

/**
 * Estado real del atajo global del capturador. La fuente de verdad es el backend:
 * Rust registra el atajo al arrancar la aplicación, así que el capturador responde
 * desde el primer momento, en bandeja o minimizado.
 */
export function useCaptureShortcut() {
  const [status, setStatus] = useState<ScreenCaptureShortcutStatus | null>(cachedStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await screenCaptureClient.getShortcutStatus();
      cachedStatus = next;
      setStatus(next);
      return next;
    } catch (error) {
      console.error("Error al consultar el atajo del capturador:", error);
      return cachedStatus;
    }
  }, []);

  // Todas las vistas abiertas comparten el mismo estado real del atajo.
  useEffect(() => {
    const handleChange = () => {
      void refresh();
    };
    window.addEventListener(STATUS_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(STATUS_CHANGE_EVENT, handleChange);
  }, [refresh]);

  // Transferencia única de la preferencia antigua al backend.
  useEffect(() => {
    if (migrationChecked) return;
    migrationChecked = true;
    void (async () => {
      const current = await refresh();
      if (!current || current.hasStoredPreference) return;
      const legacy = readLegacyPreference();
      if (!legacy) return;
      try {
        const next = await screenCaptureClient.configure(legacy.enabled, legacy.shortcut);
        cachedStatus = next;
        setStatus(next);
        window.dispatchEvent(new CustomEvent(STATUS_CHANGE_EVENT));
      } catch (error) {
        console.error("Error al transferir la preferencia del capturador:", error);
      }
    })();
  }, [refresh]);

  const configure = useCallback(async (enabled: boolean, shortcut: string) => {
    setIsUpdating(true);
    try {
      const next = await screenCaptureClient.configure(enabled, shortcut);
      cachedStatus = next;
      setStatus(next);
      window.dispatchEvent(new CustomEvent(STATUS_CHANGE_EVENT));
      return next;
    } catch (error) {
      console.error("Error al configurar el atajo del capturador:", error);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return { status, isUpdating, refresh, configure };
}
