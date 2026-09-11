import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_PRESETS,
  EQ_FREQUENCIES,
  type AudioDeviceItem,
  type AudioEndpointInfo,
  type DspConfig,
  type DspEffectsConfig,
  type DspPreset,
  type GlobalPassthruStatus,
} from "./model/types";
import { selectAudioOutput } from "./selectAudioOutput";
import { reconcileGlobalAudio } from "./reconcileGlobalAudio";
import { dspClient } from "./tauri/client";

const STORAGE_KEY_ENABLED = "prisma_dsp_enabled";
const STORAGE_KEY_CONFIG = "prisma_dsp_config";
const STORAGE_KEY_PRESET = "prisma_dsp_active_preset";
const STORAGE_KEY_CUSTOM_PRESETS = "prisma_dsp_custom_presets";
const STORAGE_KEY_GLOBAL_ENABLED = "prisma_dsp_global_passthru_enabled";
const STORAGE_KEY_CAPTURE_DEVICE = "prisma_dsp_capture_device";
const STORAGE_KEY_RENDER_DEVICE = "prisma_dsp_render_device";

const PRISMA_PRESET = DEFAULT_PRESETS[0];

export function useDspController() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ENABLED);
    return saved !== null ? saved === "true" : true;
  });

  const [activePresetId, setActivePresetId] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PRESET);
    if (!saved || saved === "musiki") return "prisma";
    return saved;
  });

  const [customPresets, setCustomPresets] = useState<DspPreset[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_PRESETS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [preampDb, setPreampDb] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.preampDb === "number" && parsed.preampDb >= -12) return parsed.preampDb;
      }
    } catch {}
    return PRISMA_PRESET.preampDb ?? 1.0;
  });

  const [frequencies, setFrequencies] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.frequencies) && parsed.frequencies.length === 10) {
          return parsed.frequencies;
        }
      }
    } catch {}
    return [...EQ_FREQUENCIES];
  });

  const [bands, setBands] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.bands) && parsed.bands.length === 10) {
          return parsed.bands;
        }
      }
    } catch {}
    return [...PRISMA_PRESET.bands];
  });

  const [effects, setEffects] = useState<DspEffectsConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.effects) return parsed.effects;
      }
    } catch {}
    return { ...PRISMA_PRESET.effects };
  });

  const [devices, setDevices] = useState<AudioDeviceItem[]>([]);
  const [audioEndpoints, setAudioEndpoints] = useState<AudioEndpointInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("auto");
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);

  // Estados de DSP Global de Sistema (WASAPI Loopback Capture & Render)
  const [globalPassthruEnabled, setGlobalPassthruEnabled] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY_GLOBAL_ENABLED) === "true";
  });
  const [globalPassthruStatus, setGlobalPassthruStatus] = useState<GlobalPassthruStatus | null>(null);
  const [selectedCaptureDeviceId, setSelectedCaptureDeviceId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_CAPTURE_DEVICE) || null;
  });
  const [selectedRenderDeviceId, setSelectedRenderDeviceId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_RENDER_DEVICE) || null;
  });
  const [isGlobalLoading, setIsGlobalLoading] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const allPresets: DspPreset[] = [...DEFAULT_PRESETS, ...customPresets];
  const syncTimeoutRef = useRef<number | null>(null);

  // Sincronizar configuración con el backend de MPV
  const pushConfigToBackend = useCallback(
    (cfg: DspConfig) => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
      syncTimeoutRef.current = window.setTimeout(() => {
        void dspClient.setDspConfig(cfg).catch((err) => {
          console.error("Error al sincronizar DSP con MPV:", err);
        });
      }, 50);
    },
    [],
  );

  // Sincronizar cuando cambian parámetros
  useEffect(() => {
    const currentConfig: DspConfig = {
      enabled,
      preampDb,
      bands: bands.map((gainDb, idx) => ({
        freq: frequencies[idx] ?? EQ_FREQUENCIES[idx],
        gainDb,
      })),
      effects,
    };

    localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
    localStorage.setItem(
      STORAGE_KEY_CONFIG,
      JSON.stringify({ preampDb, bands, frequencies, effects }),
    );
    localStorage.setItem(STORAGE_KEY_PRESET, activePresetId);

    pushConfigToBackend(currentConfig);
    window.dispatchEvent(new CustomEvent("prisma-dsp-change", { detail: currentConfig }));
  }, [enabled, preampDb, bands, frequencies, effects, activePresetId, pushConfigToBackend]);

  const previousEndpoints = useRef<Set<string> | null>(null);
  const selectedOutputRef = useRef(selectedRenderDeviceId);
  selectedOutputRef.current = selectedRenderDeviceId;
  const applyAudioEndpoints = useCallback((endpoints: AudioEndpointInfo[]) => {
    const chosen = selectAudioOutput(endpoints, previousEndpoints.current, selectedOutputRef.current, localStorage.getItem(STORAGE_KEY_RENDER_DEVICE));
    previousEndpoints.current = new Set(endpoints.map((ep) => ep.id));
    setAudioEndpoints((previous) => JSON.stringify(previous) === JSON.stringify(endpoints) ? previous : endpoints);
    selectedOutputRef.current = chosen?.id ?? null;
    setSelectedRenderDeviceId(chosen?.id ?? null);
    setSelectedDevice(chosen?.name ?? "auto");
    if (chosen) localStorage.setItem(STORAGE_KEY_RENDER_DEVICE, chosen.id);
  }, []);

  // Cargar dispositivos de audio al inicio y sincronizar la salida física
  const refreshAudioDevices = useCallback(async () => {
    setIsAudioLoading(true);
    try {
      const endpoints = await dspClient.globalPassthruListEndpoints();
      applyAudioEndpoints(endpoints);

      const list = await dspClient.getAudioDevices();
      setDevices(list);
    } catch (err) {
      console.error("Error al obtener dispositivos de audio:", err);
    } finally {
      setIsAudioLoading(false);
    }
  }, [applyAudioEndpoints]);

  useEffect(() => {
    void refreshAudioDevices();
  }, [refreshAudioDevices]);

  const selectAudioDevice = useCallback(
    async (deviceName: string, deviceId?: string) => {
      try {
        const targetEp = audioEndpoints.find((ep) => ep.id === deviceId || ep.name === deviceName);
        const resolvedId = targetEp ? targetEp.id : deviceId;
        const resolvedName = targetEp ? targetEp.name : deviceName;

        setSelectedDevice(resolvedName);
        if (resolvedId) {
          setSelectedRenderDeviceId(resolvedId);
          localStorage.setItem(STORAGE_KEY_RENDER_DEVICE, resolvedId);
        }

        // Si mpv tiene un dispositivo coincidente, sincronizarlo también
        const matchingMpv = devices.find(
          (d) =>
            d.description.toLowerCase().includes(resolvedName.toLowerCase()) ||
            resolvedName.toLowerCase().includes(d.description.toLowerCase()),
        );
        if (matchingMpv) {
          await dspClient.setAudioDevice(matchingMpv.name);
        }

        // Sincronizar en tiempo real con el reproductor de vídeo / elemento <video>
        window.dispatchEvent(
          new CustomEvent("prisma-audio-sink-change", {
            detail: { deviceName: resolvedName, deviceId: resolvedId },
          }),
        );
      } catch (err) {
        console.error("Error al cambiar dispositivo de audio:", err);
      }
    },
    [audioEndpoints, devices, globalPassthruEnabled, selectedCaptureDeviceId],
  );

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  const setBandGain = useCallback((index: number, gainDb: number) => {
    setBands((prev) => {
      const next = [...prev];
      next[index] = Math.max(-12, Math.min(12, Math.round(gainDb * 10) / 10));
      return next;
    });
    setActivePresetId("custom");
  }, []);

  const setBandFrequency = useCallback((index: number, freqHz: number) => {
    setFrequencies((prev) => {
      const next = [...prev];
      next[index] = Math.max(20, Math.min(20000, Math.round(freqHz)));
      return next;
    });
    setActivePresetId("custom");
  }, []);

  const setBandParametric = useCallback((index: number, freqHz: number, gainDb: number) => {
    setFrequencies((prev) => {
      const next = [...prev];
      next[index] = Math.max(20, Math.min(20000, Math.round(freqHz)));
      return next;
    });
    setBands((prev) => {
      const next = [...prev];
      next[index] = Math.max(-12, Math.min(12, Math.round(gainDb * 10) / 10));
      return next;
    });
    setActivePresetId("custom");
  }, []);

  const setEffectValue = useCallback(
    (key: keyof DspEffectsConfig, value: number) => {
      setEffects((prev) => ({
        ...prev,
        [key]: Math.max(0, Math.min(10, Math.round(value * 10) / 10)),
      }));
      setActivePresetId("custom");
    },
    [],
  );

  const applyPreset = useCallback((preset: DspPreset) => {
    setBands([...preset.bands]);
    setFrequencies([...EQ_FREQUENCIES]);
    setEffects({ ...preset.effects });
    if (typeof preset.preampDb === "number") {
      setPreampDb(preset.preampDb);
    }
    setActivePresetId(preset.id);
  }, []);

  const saveCustomPreset = useCallback(
    (name: string) => {
      if (!name.trim()) return;
      const newPreset: DspPreset = {
        id: `custom_${Date.now()}`,
        name: name.trim(),
        isBuiltIn: false,
        preampDb,
        bands: [...bands],
        effects: { ...effects },
      };
      const updated = [...customPresets, newPreset];
      setCustomPresets(updated);
      localStorage.setItem(STORAGE_KEY_CUSTOM_PRESETS, JSON.stringify(updated));
      setActivePresetId(newPreset.id);
    },
    [customPresets, preampDb, bands, effects],
  );

  const deleteCustomPreset = useCallback(
    (id: string) => {
      const updated = customPresets.filter((p) => p.id !== id);
      setCustomPresets(updated);
      localStorage.setItem(STORAGE_KEY_CUSTOM_PRESETS, JSON.stringify(updated));
      if (activePresetId === id) {
        applyPreset(PRISMA_PRESET);
      }
    },
    [customPresets, activePresetId, applyPreset],
  );

  const resetToFlat = useCallback(() => {
    const flatPreset = DEFAULT_PRESETS.find((p) => p.id === "flat") || DEFAULT_PRESETS[6];
    applyPreset(flatPreset);
    setFrequencies([...EQ_FREQUENCIES]);
  }, [applyPreset]);

  const refreshAudioEndpoints = useCallback(async () => {
    try {
      const list = await dspClient.globalPassthruListEndpoints();
      const changed = previousEndpoints.current === null || list.length !== previousEndpoints.current.size || list.some((ep) => !previousEndpoints.current?.has(ep.id));
      applyAudioEndpoints(list);
      if (changed) setDevices(await dspClient.getAudioDevices());
    } catch (err) {
      console.warn("No se pudieron listar endpoints WASAPI:", err);
    }
  }, [applyAudioEndpoints]);

  useEffect(() => {
    const matching = devices.find((device) => device.description === selectedDevice);
    if (matching) void dspClient.setAudioDevice(matching.name).catch((error) => console.warn("No se pudo sincronizar la salida del reproductor:", error));
  }, [devices, selectedDevice]);

  // Sincronización automática periódica y por foco con Windows
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshAudioEndpoints();
    }, 2000);
    const onFocus = () => {
      void refreshAudioEndpoints();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshAudioEndpoints]);

  const [globalVolume, setGlobalVolumeState] = useState<number>(1.0);

  const setGlobalVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setGlobalVolumeState(clamped);
    void dspClient.globalPassthruSetVolume(clamped);
  }, []);

  const refreshGlobalStatus = useCallback(async () => {
    try {
      const st = await dspClient.globalPassthruGetStatus();
      setGlobalPassthruStatus(st);

      if (typeof st.volume === "number") {
        setGlobalVolumeState(st.volume);
      }
    } catch (err) {
      console.warn("No se pudo obtener estado de global passthru:", err);
    }
  }, []);

  const toggleGlobalPassthru = useCallback((overrideState?: boolean) => {
    const next = overrideState ?? !globalPassthruEnabled;
    localStorage.setItem(STORAGE_KEY_GLOBAL_ENABLED, String(next));
    setGlobalPassthruEnabled(next);
  }, [globalPassthruEnabled]);

  // Un único reconciliador mantiene la intención del usuario separada del estado real.
  const desiredBridge = useRef({ enabled: globalPassthruEnabled, capture: selectedCaptureDeviceId, render: selectedRenderDeviceId });
  desiredBridge.current = { enabled: globalPassthruEnabled, capture: selectedCaptureDeviceId, render: selectedRenderDeviceId };
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const reconcile = async () => {
      try {
        const next = await reconcileGlobalAudio(dspClient, () => desiredBridge.current, () => disposed);
        if (!disposed) {
          const desired = desiredBridge.current;
          setGlobalPassthruStatus(next);
          setGlobalError(desired.enabled && !desired.render ? "Esperando una salida de audio disponible…" : null);
        }
      } catch (error) {
        if (!disposed) setGlobalError(`Reconectando audio: ${String(error)}`);
      } finally {
        if (!disposed) {
          setIsGlobalLoading(false);
          timer = setTimeout(reconcile, 1000);
        }
      }
    };
    void reconcile();
    return () => { disposed = true; clearTimeout(timer); };
  }, []);

  const setCaptureDevice = useCallback((id: string | null) => {
    setSelectedCaptureDeviceId(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY_CAPTURE_DEVICE, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_CAPTURE_DEVICE);
    }
  }, []);

  const setRenderDevice = useCallback((id: string | null) => {
    setSelectedRenderDeviceId(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY_RENDER_DEVICE, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_RENDER_DEVICE);
    }
  }, []);

  // Consultar endpoints y estado inicial de passthru global
  useEffect(() => {
    void refreshAudioEndpoints();
    void refreshGlobalStatus();
  }, [refreshAudioEndpoints, refreshGlobalStatus]);


  return {
    enabled,
    toggleEnabled,
    preampDb,
    setPreampDb,
    bands,
    setBandGain,
    frequencies,
    setBandFrequency,
    setBandParametric,
    effects,
    setEffectValue,
    activePresetId,
    allPresets,
    applyPreset,
    saveCustomPreset,
    deleteCustomPreset,
    resetToFlat,
    devices,
    selectedDevice,
    selectAudioDevice,
    refreshAudioDevices,
    isAudioLoading,
    // Modo Global de Sistema
    globalPassthruEnabled,
    globalPassthruStatus,
    audioEndpoints,
    selectedCaptureDeviceId,
    selectedRenderDeviceId,
    isGlobalLoading,
    globalError,
    globalVolume,
    setGlobalVolume,
    toggleGlobalPassthru,
    refreshAudioEndpoints,
    refreshGlobalStatus,
    setCaptureDevice,
    setRenderDevice,
  };
}
