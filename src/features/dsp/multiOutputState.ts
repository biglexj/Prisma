import type { AudioEndpointInfo, MultiOutputDevice } from "./model/types";

/** The main output follows the base selector; absent devices keep their preferences. */
export function includePrimaryOutput(devices: MultiOutputDevice[], endpoints: AudioEndpointInfo[], primary: string | null): MultiOutputDevice[] {
  if (!primary || !endpoints.some((endpoint) => endpoint.id === primary && !endpoint.isVirtual)) return devices;
  if (devices[0]?.id === primary) return devices;
  const main = devices.find((device) => device.id === primary) ?? { id: primary, gain: 1, delayMs: 0 };
  return [main, ...devices.filter((device) => device.id !== primary)];
}

export function outputErrorMessage(cause: unknown): string {
  const detail = String(cause);
  if (/controlador virtual|Prisma Audio Enhancer/i.test(detail)) return "Se necesita Prisma Audio Enhancer para duplicar el audio.";
  if (/al menos dos|dos salidas/i.test(detail)) return "Selecciona otra salida para duplicar el audio.";
  if (/salida física|desconectada/i.test(detail)) return "Esperando una salida de audio disponible…";
  return "No se pudo actualizar el audio. Vuelve a intentarlo.";
}
