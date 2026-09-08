import type { GlobalPassthruStatus } from "./model/types";

export interface AudioIntent { enabled: boolean; capture: string | null; render: string | null; }
export interface AudioBridgeClient {
  globalPassthruGetStatus(): Promise<GlobalPassthruStatus>;
  globalPassthruToggle(enabled: boolean, capture: string | null, render: string | null): Promise<GlobalPassthruStatus>;
}

export async function reconcileGlobalAudio(client: AudioBridgeClient, getIntent: () => AudioIntent, isCancelled: () => boolean = () => false) {
  const status = await client.globalPassthruGetStatus();
  // Leer la intención después del await: apagar durante una consulta no debe reactivar el motor.
  if (isCancelled()) return status;
  const desired = getIntent();
  if (desired.enabled && desired.render) {
    return client.globalPassthruToggle(true, desired.capture, desired.render);
  }
  // Incluso un motor detenido puede conservar la ruta virtual de Windows.
  return client.globalPassthruToggle(false, null, null);
}
