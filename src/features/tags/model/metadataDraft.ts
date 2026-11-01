import type { UpdateAudioTagsRequest } from "./types";

/** Los valores comunes explícitos prevalecen; lo vacío mantiene la propuesta individual. */
export function buildBatchTagRequests(paths: string[], drafts: Record<string, UpdateAudioTagsRequest>, common: Omit<UpdateAudioTagsRequest, "path">): UpdateAudioTagsRequest[] {
  const edited = Object.fromEntries(Object.entries(common).filter(([, value]) => value !== undefined));
  return paths.map(path => ({ ...drafts[path], ...edited, path }));
}
