import type { AudioTagData, UpdateAudioTagsRequest } from "../../tags/model/types";

export interface MetadataCandidate {
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  source: "Apple Music" | "Deezer";
}

// Conserva versiones musicales (live, remix, instrumental); solo elimina ruido editorial.
export function cleanMetadataQuery(value: string): string {
  return value.replace(/\b(?:official\s+(?:music\s+)?video|official\s+audio|video\s+oficial|audio\s+oficial|lyrics|letra|videoclip|4k|hd)\b/gi, " ")
    .replace(/\s*-\s*Topic\b/gi, " ").replace(/[\[(]\s*[\])]/g, " ")
    .replace(/\s+/g, " ").trim();
}

export interface MetadataOptions {
  title: boolean;
  artist: boolean;
  album: boolean;
  cover: boolean;
  onlyMissing: boolean;
}

export function buildMetadataUpdate(current: AudioTagData, candidate: MetadataCandidate, options: MetadataOptions): UpdateAudioTagsRequest {
  const request: UpdateAudioTagsRequest = { path: current.path };
  for (const field of ["title", "artist", "album"] as const) {
    if (options[field] && candidate[field].trim() && (!options.onlyMissing || !current[field]?.trim())) {
      request[field] = candidate[field];
    }
  }
  return request;
}
