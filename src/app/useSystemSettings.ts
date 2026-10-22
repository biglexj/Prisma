import { resolveCaptureFormat, type CaptureFormat } from "../shared/captureFormat";
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";

export type QuickLookShortcutMode = "space" | "alt_space" | "shift_space" | "disabled";
export type SidebarDensity = "compact" | "standard" | "intermediate" | "comfortable";
export type ProgressBarStyle =
  | "wavy"
  | "classic"
  | "prism"
  | "soundwave"
  | "fluid"
  | "helix"
  | "neon_pulse"
  | "particles"
  | "vinyl_tape"
  | "elastic_string";

export type ToolKey = "converter" | "renamer" | "comparator" | "duplicates" | "luna_fetch" | "gallery_dl" | "prisma_upscaler" | "wallpapers";

export interface EnabledToolsConfig {
  converter: boolean;
  renamer: boolean;
  comparator: boolean;
  duplicates: boolean;
  luna_fetch: boolean;
  gallery_dl: boolean;
  prisma_upscaler: boolean;
  wallpapers: boolean;
}

export const DEFAULT_ENABLED_TOOLS: EnabledToolsConfig = {
  converter: true,
  renamer: true,
  comparator: true,
  duplicates: true,
  luna_fetch: true,
  gallery_dl: true,
  prisma_upscaler: true,
  wallpapers: true,
};

interface SystemSettings {
  quickLookShortcut: QuickLookShortcutMode;
  autostart: boolean;
  minimizeToTray: boolean;
  confirmDeletion: boolean;
  progressBarStyle: ProgressBarStyle;
  sidebarDensity: SidebarDensity;
  auroraOnlineServicesEnabled: boolean;
  auroraWallpapersEnabled: boolean;
  auroraServerUrl: string;
  videoSnapshotFolder?: string;
  videoSnapshotFormat?: CaptureFormat;
  /** @deprecated El atajo global del capturador vive ahora en el backend. */
  screenCaptureEnabled: boolean;
  /** @deprecated El atajo global del capturador vive ahora en el backend. */
  screenCaptureShortcut: string;
  screenCaptureFolder?: string;
  /** Zona de recepción del sistema (muesca flotante en la pantalla). */
  systemDropZoneEnabled: boolean;
  /** Carpeta donde se copian los archivos soltados en la zona del sistema. */
  systemDropZoneFolder: string;
  enabledTools: EnabledToolsConfig;
}

const STORAGE_KEY = "prisma.system-settings.v1";
const SETTINGS_CHANGE_EVENT = "prisma:settings-changed";
const TAURI_SYNC_EVENT = "prisma:settings-sync";

const DEFAULT_SETTINGS: SystemSettings = {
  quickLookShortcut: "space",
  autostart: false,
  minimizeToTray: true,
  confirmDeletion: true,
  progressBarStyle: "wavy",
  sidebarDensity: "standard",
  auroraOnlineServicesEnabled: false,
  auroraWallpapersEnabled: true,
  auroraServerUrl: "https://www.biglexj.com",
  videoSnapshotFolder: "",
  videoSnapshotFormat: "png",
  screenCaptureEnabled: false,
  screenCaptureShortcut: "Shift+PrintScreen",
  screenCaptureFolder: "",
  systemDropZoneEnabled: true,
  systemDropZoneFolder: "",
  enabledTools: DEFAULT_ENABLED_TOOLS,
};

function loadStoredSettings(): SystemSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      videoSnapshotFormat: resolveCaptureFormat(parsed.videoSnapshotFormat).id,
      enabledTools: {
        ...DEFAULT_SETTINGS.enabledTools,
        ...(parsed.enabledTools || {}),
      },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function notifySettingsChanged(newSettings?: SystemSettings) {
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGE_EVENT));
  const payload = newSettings ?? loadStoredSettings();
  void emit(TAURI_SYNC_EVENT, payload).catch(() => {});
}

/**
 * Preferencias de la zona de recepción del sistema.
 *
 * La zona vive en otra ventana, así que lee las preferencias directamente del
 * almacenamiento local en vez de usar el gancho: así funciona aunque la ventana
 * principal esté en la bandeja.
 */
export function loadDropZonePreferences(): { enabled: boolean; folder: string } {
  const stored = loadStoredSettings();
  return {
    enabled: stored.systemDropZoneEnabled !== false,
    folder: stored.systemDropZoneFolder || "",
  };
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(loadStoredSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Sincronizar estado con el backend de Rust al iniciar y escuchar eventos entre ventanas
  useEffect(() => {
    let isMounted = true;

    async function syncWithBackend() {
      try {
        const stored = loadStoredSettings();

        // Enviar valores guardados de atajo y bandeja al backend de Rust
        if (stored.quickLookShortcut) {
          await invoke("quick_look_set_shortcut", { shortcut: stored.quickLookShortcut }).catch(() => {});
        }
        if (typeof stored.minimizeToTray === "boolean") {
          await invoke("set_minimize_to_tray", { enabled: stored.minimizeToTray }).catch(() => {});
        }
        // La zona de recepción del sistema se muestra u oculta al arrancar.
        if (typeof stored.systemDropZoneEnabled === "boolean") {
          await invoke("system_drop_zone_set_visible", {
            visible: stored.systemDropZoneEnabled,
          }).catch(() => {});
        }

        // Leer estado real del registro de Windows
        const registryAutostart = await invoke<boolean>("autostart_get_status").catch(() => false);
        const storedAutostart = stored.autostart ?? false;

        // Auto-sanado post-actualización: si el usuario tenía autostart activo
        // pero el instalador limpió la entrada del registro durante la actualización,
        // se re-registra automáticamente sin requerir acción manual.
        let effectiveAutostart = registryAutostart;
        if (storedAutostart && !registryAutostart) {
          try {
            await invoke("autostart_set", { enabled: true });
            effectiveAutostart = true;
          } catch {
            effectiveAutostart = false;
          }
        }

        if (isMounted) {
          setSettings((prev) => {
            const synced: SystemSettings = {
              quickLookShortcut: stored.quickLookShortcut ?? prev.quickLookShortcut,
              autostart: effectiveAutostart,
              minimizeToTray: stored.minimizeToTray ?? prev.minimizeToTray,
              confirmDeletion: stored.confirmDeletion ?? prev.confirmDeletion,
              progressBarStyle: stored.progressBarStyle ?? prev.progressBarStyle,
              sidebarDensity: stored.sidebarDensity ?? prev.sidebarDensity,
              auroraOnlineServicesEnabled: stored.auroraOnlineServicesEnabled ?? prev.auroraOnlineServicesEnabled,
              auroraWallpapersEnabled: stored.auroraWallpapersEnabled ?? prev.auroraWallpapersEnabled,
              auroraServerUrl: stored.auroraServerUrl ?? prev.auroraServerUrl,
              videoSnapshotFolder: stored.videoSnapshotFolder ?? prev.videoSnapshotFolder,
              videoSnapshotFormat: stored.videoSnapshotFormat ?? prev.videoSnapshotFormat,
              screenCaptureEnabled: stored.screenCaptureEnabled ?? prev.screenCaptureEnabled,
              screenCaptureShortcut: stored.screenCaptureShortcut ?? prev.screenCaptureShortcut,
              screenCaptureFolder: stored.screenCaptureFolder ?? prev.screenCaptureFolder,
              systemDropZoneEnabled: stored.systemDropZoneEnabled ?? prev.systemDropZoneEnabled,
              systemDropZoneFolder: stored.systemDropZoneFolder ?? prev.systemDropZoneFolder,
              enabledTools: stored.enabledTools ?? prev.enabledTools,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
            return synced;
          });

          setIsLoaded(true);
        }
      } catch {
        if (isMounted) setIsLoaded(true);
      }
    }

    syncWithBackend();

    const handleExternalChange = () => {
      if (isMounted) {
        setSettings(loadStoredSettings());
      }
    };

    window.addEventListener(SETTINGS_CHANGE_EVENT, handleExternalChange);
    window.addEventListener("storage", handleExternalChange);

    const unlistenTauriPromise = listen<SystemSettings>(TAURI_SYNC_EVENT, (event) => {
      if (isMounted && event.payload) {
        setSettings(event.payload);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(event.payload));
        } catch {}
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener(SETTINGS_CHANGE_EVENT, handleExternalChange);
      window.removeEventListener("storage", handleExternalChange);
      unlistenTauriPromise.then((unlisten) => unlisten());
    };
  }, []);

  const setQuickLookShortcut = useCallback(async (mode: QuickLookShortcutMode) => {
    try {
      await invoke("quick_look_set_shortcut", { shortcut: mode });
      setSettings((prev) => {
        const next = { ...prev, quickLookShortcut: mode };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        notifySettingsChanged(next);
        return next;
      });
    } catch (err) {
      console.error("Error al configurar atajo de Quick Look:", err);
    }
  }, []);

  const setAutostart = useCallback(async (enabled: boolean) => {
    try {
      await invoke("autostart_set", { enabled });
      setSettings((prev) => {
        const next = { ...prev, autostart: enabled };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        notifySettingsChanged(next);
        return next;
      });
    } catch (err) {
      console.error("Error al configurar inicio automático:", err);
    }
  }, []);

  const setMinimizeToTray = useCallback(async (enabled: boolean) => {
    try {
      await invoke("set_minimize_to_tray", { enabled });
      setSettings((prev) => {
        const next = { ...prev, minimizeToTray: enabled };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        notifySettingsChanged(next);
        return next;
      });
    } catch (err) {
      console.error("Error al configurar minimizar a la bandeja:", err);
    }
  }, []);

  const setConfirmDeletion = useCallback((enabled: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, confirmDeletion: enabled };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
  }, []);

  const setProgressBarStyle = useCallback((style: ProgressBarStyle) => {
    setSettings((prev) => {
      const next = { ...prev, progressBarStyle: style };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
  }, []);

  const setSidebarDensity = useCallback((density: SidebarDensity) => {
    setSettings((prev) => {
      const next = { ...prev, sidebarDensity: density };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
  }, []);

  const setAuroraOnlineServicesEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, auroraOnlineServicesEnabled: enabled };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
  }, []);

  const setAuroraWallpapersEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, auroraWallpapersEnabled: enabled };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
  }, []);

  const setAuroraServerUrl = useCallback((url: string) => {
    setSettings((prev) => {
      const next = { ...prev, auroraServerUrl: url };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
  }, []);

  const setVideoSnapshotFolder = useCallback((folder: string) => {
    setSettings((prev) => {
      const next = { ...prev, videoSnapshotFolder: folder };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
  }, []);

  const setVideoSnapshotFormat = useCallback((format: CaptureFormat) => {
    setSettings((prev) => {
      const next = { ...prev, videoSnapshotFormat: format };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
  }, []);

  const setToolEnabled = useCallback((tool: ToolKey, enabled: boolean) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        enabledTools: {
          ...prev.enabledTools,
          [tool]: enabled,
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
  }, []);

  const setScreenCaptureFolder = useCallback((folder: string) => {
    setSettings((prev) => {
      const next = { ...prev, screenCaptureFolder: folder };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
  }, []);

  const setSystemDropZoneEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, systemDropZoneEnabled: enabled };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
    // La ventana del sistema se muestra u oculta de inmediato.
    void invoke("system_drop_zone_set_visible", { visible: enabled }).catch(() => {});
  }, []);

  const setSystemDropZoneFolder = useCallback((folder: string) => {
    setSettings((prev) => {
      const next = { ...prev, systemDropZoneFolder: folder };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      notifySettingsChanged(next);
      return next;
    });
  }, []);

  return {
    isLoaded,
    quickLookShortcut: settings.quickLookShortcut,
    autostart: settings.autostart,
    minimizeToTray: settings.minimizeToTray,
    confirmDeletion: settings.confirmDeletion,
    progressBarStyle: settings.progressBarStyle,
    sidebarDensity: settings.sidebarDensity,
    auroraOnlineServicesEnabled: settings.auroraOnlineServicesEnabled,
    auroraWallpapersEnabled: settings.auroraWallpapersEnabled,
    auroraServerUrl: settings.auroraServerUrl,
    videoSnapshotFolder: settings.videoSnapshotFolder || "",
    videoSnapshotFormat: settings.videoSnapshotFormat || "png",
    captureFormat: settings.videoSnapshotFormat || "png",
    setCaptureFormat: setVideoSnapshotFormat,
    screenCaptureFolder: settings.screenCaptureFolder || "",
    systemDropZoneEnabled: settings.systemDropZoneEnabled !== false,
    systemDropZoneFolder: settings.systemDropZoneFolder || "",
    enabledTools: settings.enabledTools,
    setQuickLookShortcut,
    setAutostart,
    setMinimizeToTray,
    setConfirmDeletion,
    setProgressBarStyle,
    setSidebarDensity,
    setAuroraOnlineServicesEnabled,
    setAuroraWallpapersEnabled,
    setAuroraServerUrl,
    setVideoSnapshotFolder,
    setVideoSnapshotFormat,
    setScreenCaptureFolder,
    setSystemDropZoneEnabled,
    setSystemDropZoneFolder,
    setToolEnabled,
  };
}
