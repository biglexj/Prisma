import type { AudioDeviceItem, AudioEndpointInfo } from "./model/types";

/** Internal playback must enter the same endpoint that feeds the phone/bridge. */
export function playbackAudioRoute(
  endpoints: AudioEndpointInfo[], devices: AudioDeviceItem[], selectedName: string,
  selectedId: string | null, bridgeRunning: boolean, bridgeCaptureName: string | null,
  phoneEnabled: boolean, phoneCaptureId: string | null,
) {
  const endpoint = bridgeRunning
    ? endpoints.find(ep => ep.name === bridgeCaptureName) ?? endpoints.find(ep => ep.isVirtual)
    : phoneEnabled
      ? endpoints.find(ep => phoneCaptureId ? ep.id === phoneCaptureId : ep.isDefault)
      : endpoints.find(ep => ep.id === selectedId || ep.name === selectedName);
  const mpvDevice = endpoint
    ? `wasapi/${endpoint.id}`
    : !bridgeRunning && !phoneEnabled
      ? devices.find(device => device.description === selectedName)?.name ?? "auto"
      : !bridgeRunning && !phoneCaptureId ? "auto" : undefined;
  return { endpoint, mpvDevice, throughGlobalDsp: bridgeRunning };
}
