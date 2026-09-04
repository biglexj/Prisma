/**
 * Servicio de búsqueda y descarga de letras sincronizadas (.lrc)
 * Soporta LRCLIB (con marcas de tiempo para Karaoke) y búsquedas difusas con limpieza de títulos.
 */

export interface LyricsFetchResult {
  found: boolean;
  syncedLyrics: string | null;
  plainLyrics: string | null;
  provider: "lrclib" | "none";
  isSynced: boolean;
  error?: string;
}

interface LrclibRecord {
  id: number;
  name?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

const LRCLIB_BASE_URL = "https://lrclib.net/api";
const APP_USER_AGENT = "Prisma-Desktop/1.0.8 (https://github.com/biglexj/Prisma)";

/**
 * Limpia sufijos comunes en títulos de canciones descargadas (ej: "[Official Video]", "(Audio)", etc.)
 * para aumentar la probabilidad de coincidencia en bases de datos de letras.
 */
export function cleanTrackTitle(title: string): string {
  let cleaned = title;

  // Remover extensiones si aún estuvieran en el título
  cleaned = cleaned.replace(/\.(mp3|flac|wav|m4a|ogg|opus|aac)$/i, "");

  // Remover etiquetas comunes de YouTube / ripeo entre corchetes o paréntesis
  cleaned = cleaned.replace(
    /\s*[([{\u3010](official\s*(music\s*)?(video|audio|visualizer)|audio|video\s*oficial|letra|lyrics|remastered(\s*\d{4})?|video|hd|4k|karaoke|instrumental|clean|explicit)[)\]}\u3011]/gi,
    ""
  );

  // Remover sufijos tipo "- Official Audio" al final
  cleaned = cleaned.replace(
    /\s*-\s*(official\s*(music\s*)?(video|audio)|video\s*oficial|audio\s*oficial|lyrics|letra)\s*$/gi,
    ""
  );

  return cleaned.trim() || title.trim();
}

/**
 * Busca letras sincronizadas para una canción específica.
 * Prioriza letras con timestamps [mm:ss.xx] ideales para Karaoke.
 */
export async function fetchTrackLyrics(
  rawTitle: string,
  rawArtist = "",
  signal?: AbortSignal
): Promise<LyricsFetchResult> {
  const cleanedTitle = cleanTrackTitle(rawTitle);
  const artist = rawArtist.trim();

  // 1. Intento con búsqueda exacta en LRCLIB si disponemos de artista y título
  if (artist && cleanedTitle) {
    try {
      const url = new URL(`${LRCLIB_BASE_URL}/get`);
      url.searchParams.set("artist_name", artist);
      url.searchParams.set("track_name", cleanedTitle);

      const resp = await fetch(url.toString(), {
        signal,
        headers: {
          "User-Agent": APP_USER_AGENT,
          Accept: "application/json",
        },
      });

      if (resp.ok) {
        const data = (await resp.json()) as LrclibRecord;
        if (data.syncedLyrics && data.syncedLyrics.trim().length > 0) {
          return {
            found: true,
            syncedLyrics: data.syncedLyrics.trim(),
            plainLyrics: data.plainLyrics?.trim() || null,
            provider: "lrclib",
            isSynced: true,
          };
        }
        if (data.plainLyrics && data.plainLyrics.trim().length > 0) {
          return {
            found: true,
            syncedLyrics: null,
            plainLyrics: data.plainLyrics.trim(),
            provider: "lrclib",
            isSynced: false,
          };
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }
      // Si falla la búsqueda exacta, continuamos a la búsqueda libre
    }
  }

  // 2. Búsqueda difusa en LRCLIB por query general
  try {
    const query = artist ? `${artist} ${cleanedTitle}` : cleanedTitle;
    const url = new URL(`${LRCLIB_BASE_URL}/search`);
    url.searchParams.set("q", query);

    const resp = await fetch(url.toString(), {
      signal,
      headers: {
        "User-Agent": APP_USER_AGENT,
        Accept: "application/json",
      },
    });

    if (resp.ok) {
      const results = (await resp.json()) as LrclibRecord[];
      if (Array.isArray(results) && results.length > 0) {
        // Priorizar el primer resultado que tenga letras sincronizadas (syncedLyrics)
        const withSynced = results.find(
          (r) => typeof r.syncedLyrics === "string" && r.syncedLyrics.trim().length > 0
        );

        if (withSynced && withSynced.syncedLyrics) {
          return {
            found: true,
            syncedLyrics: withSynced.syncedLyrics.trim(),
            plainLyrics: withSynced.plainLyrics?.trim() || null,
            provider: "lrclib",
            isSynced: true,
          };
        }

        // Si no hay sincronizadas, verificar si el primero tiene texto plano
        const first = results[0];
        if (first.plainLyrics && first.plainLyrics.trim().length > 0) {
          return {
            found: true,
            syncedLyrics: null,
            plainLyrics: first.plainLyrics.trim(),
            provider: "lrclib",
            isSynced: false,
          };
        }
      }
    }
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    return {
      found: false,
      syncedLyrics: null,
      plainLyrics: null,
      provider: "none",
      isSynced: false,
      error: err instanceof Error ? err.message : "Error de conexión con LRCLIB",
    };
  }

  return {
    found: false,
    syncedLyrics: null,
    plainLyrics: null,
    provider: "none",
    isSynced: false,
  };
}
