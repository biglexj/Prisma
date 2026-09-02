import { invoke } from "@tauri-apps/api/core";
import type { AudioDeviceItem, DspConfig } from "../model/types";

export const dspClient = {
  setDspConfig: (config: DspConfig) =>
    invoke<void>("playback_set_dsp_config", { config }),
  getAudioDevices: () =>
    invoke<AudioDeviceItem[]>("playback_get_audio_devices"),
  setAudioDevice: (deviceName: string) =>
    invoke<void>("playback_set_audio_device", { deviceName }),
};
