import type { PublicLyric } from "./publicLyricsClient";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function artistIdentity(value: string) {
  return normalize(value).replace(/^(orquesta|grupo)\s+/, "");
}

/** Solo el texto se puede resolver por obra; nunca asignar tiempos por metadatos. */
export function matchingTrackLyric(items: PublicLyric[], title: string, artist: string) {
  if (!normalize(title) || !artistIdentity(artist)) return null;
  const matches = items.filter(item => normalize(item.title) === normalize(title)
    && artistIdentity(item.artist) === artistIdentity(artist));
  return matches.length === 1 ? matches[0] : null;
}

export function publicLyricText(item: PublicLyric) {
  return item.plainLyrics?.trim() ? `[source:Biglex J]\n${item.plainLyrics}` : null;
}
