import type { AudioEndpointInfo } from "./model/types";

export function selectAudioOutput(endpoints: AudioEndpointInfo[], previousIds: ReadonlySet<string> | null, currentId: string | null, savedId: string | null) {
  const available = endpoints.filter((ep) => !ep.isVirtual && !/prisma audio|fxsound/i.test(ep.name));
  const added = previousIds === null ? [] : available.filter((ep) => !previousIds.has(ep.id));
  return added.find((ep) => ep.isDefault) ?? added[0]
    ?? available.find((ep) => ep.id === currentId)
    ?? available.find((ep) => ep.id === savedId)
    ?? available.find((ep) => ep.isDefault)
    ?? available[0] ?? null;
}
