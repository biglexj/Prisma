import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_PRESETS,
  EQ_FREQUENCIES,
  type AudioDeviceItem,
  type DspConfig,
  type DspEffectsConfig,
  type DspPreset,
} from "./model/types";
import { dspClient } from "./tauri/client";

const STORAGE_KEY_ENABLED = "prisma_dsp_enabled";
const STORAGE_KEY_CONFIG = "prisma_dsp_config";
const STORAGE_KEY_PRESET = "prisma_dsp_active_preset";
const STORAGE_KEY_CUSTOM_PRESETS = "prisma_dsp_custom_presets";

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
        if (typeof parsed.preampDb === "number" && parsed.preampDb >= 0) return parsed.preampDb;
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
  const [selectedDevice, setSelectedDevice] = useState<string>("auto");
  const [isAudioLoading, setIsAudioLoading] = useState<boolean>(false);

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
  }, [enabled, preampDb, bands, frequencies, effects, activePresetId, pushConfigToBackend]);

  // Cargar dispositivos de audio al inicio
  const refreshAudioDevices = useCallback(async () => {
    setIsAudioLoading(true);
    try {
      const list = await dspClient.getAudioDevices();
      setDevices(list);
      const active = list.find((d) => d.isActive);
      if (active) {
        setSelectedDevice(active.name);
      }
    } catch (err) {
      console.error("Error al obtener dispositivos de audio:", err);
    } finally {
      setIsAudioLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAudioDevices();
  }, [refreshAudioDevices]);

  const selectAudioDevice = useCallback(async (deviceName: string) => {
    try {
      await dspClient.setAudioDevice(deviceName);
      setSelectedDevice(deviceName);
      setDevices((prev) =>
        prev.map((d) => ({
          ...d,
          isActive: d.name === deviceName,
        })),
      );
    } catch (err) {
      console.error("Error al cambiar dispositivo de audio:", err);
    }
  }, []);

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
  };
}
