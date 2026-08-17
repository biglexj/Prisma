export interface LrclibResponse {
  id?: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string;
  syncedLyrics?: string;
}

export async function fetchLyricsFromLrclib(params: {
  trackName: string;
  artistName?: string;
  albumName?: string;
  durationSeconds?: number;
}): Promise<LrclibResponse | null> {
  const queryParams = new URLSearchParams();
  queryParams.set("track_name", params.trackName);
  if (params.artistName) queryParams.set("artist_name", params.artistName);
  if (params.albumName) queryParams.set("album_name", params.albumName);
  if (params.durationSeconds && params.durationSeconds > 0) {
    queryParams.set("duration", Math.round(params.durationSeconds).toString());
  }

  try {
    // 1. Intento por endpoint directo GET
    const directUrl = `https://lrclib.net/api/get?${queryParams.toString()}`;
    const res = await fetch(directUrl);
    if (res.ok) {
      const data = (await res.json()) as LrclibResponse;
      if (data.syncedLyrics || data.plainLyrics) {
        return data;
      }
    }

    // 2. Fallback: Endpoint de búsqueda flexible
    const searchQuery = [params.trackName, params.artistName].filter(Boolean).join(" ");
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`;
    const searchRes = await fetch(searchUrl);
    if (searchRes.ok) {
      const list = (await searchRes.json()) as LrclibResponse[];
      if (Array.isArray(list) && list.length > 0) {
        const withSynced = list.find((item) => item.syncedLyrics && item.syncedLyrics.trim().length > 0);
        return withSynced || list[0] || null;
      }
    }
  } catch (err) {
    console.warn("No se pudieron obtener letras desde LRCLIB:", err);
  }

  return null;
}
