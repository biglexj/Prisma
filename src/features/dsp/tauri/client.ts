import { invoke } from "@tauri-apps/api/core";
import type { AudioDeviceItem, AudioEndpointInfo, DspConfig, GlobalPassthruStatus } from "../model/types";

export const dspClient = {
  setDspConfig: (config: DspConfig) =>
    invoke<void>("playback_set_dsp_config", { config }),
  getAudioDevices: () =>
    invoke<AudioDeviceItem[]>("playback_get_audio_devices"),
  setAudioDevice: (deviceName: string) =>
    invoke<void>("playback_set_audio_device", { deviceName }),
  globalPassthruGetStatus: () =>
    invoke<GlobalPassthruStatus>("global_passthru_get_status"),
  globalPassthruToggle: (enabled: boolean, captureDeviceId?: string | null, renderDeviceId?: string | null) =>
    invoke<GlobalPassthruStatus>("global_passthru_toggle", {
      enabled,
      captureDeviceId: captureDeviceId ?? null,
      renderDeviceId: renderDeviceId ?? null,
    }),
  globalPassthruListEndpoints: () =>
    invoke<AudioEndpointInfo[]>("global_passthru_list_endpoints"),
  globalPassthruSetVolume: (volume: number) =>
    invoke<void>("global_passthru_set_volume", { volume }),
  setSystemDefaultDevice: (deviceId: string) =>
    invoke<void>("playback_set_system_default_device", { deviceId }),
};
