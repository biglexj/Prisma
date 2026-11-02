export const LYRICS_API = "https://api.biglexj.com/api/v1/lyrics";

export interface LyricsRecording {
  id: string;
  label: string;
  durationSeconds: number | null;
  youtubeId: string | null;
  syncedLyrics: string | null;
}

export interface PublicLyric {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  plainLyrics: string | null;
  recordings: LyricsRecording[];
  revision: string | null;
  webUrl: string;
}

export interface ContributionBody {
  title: string;
  artist: string;
  album?: string;
  plainLyrics?: string;
  syncedLyrics?: string;
  recording?: { label: string; durationSeconds: number };
}

export interface ContributionReceipt {
  id: string;
  status: "pending" | "publishing" | "approved" | "rejected";
  lyricId: string | null;
  receiptToken: string;
  resolution?: "matched" | "created" | null;
  recordingId?: string | null;
}

let retryAfter = 0;
export class LyricsServiceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  if (Date.now() < retryAfter) throw new LyricsServiceError(429, "Espera antes de volver a consultar el servicio.");
  const response = await fetch(url, {
    ...init, credentials: "omit", cache: "no-store",
    signal: AbortSignal.any([init.signal ?? new AbortController().signal, AbortSignal.timeout(15000)]),
  });
  if (response.status === 429) {
    const header = response.headers.get("Retry-After");
    const seconds = header && /^\d+$/.test(header) ? Number(header) : 60;
    retryAfter = Date.now() + Math.max(60, seconds) * 1000;
  }
  if (!response.ok) {
    // No reflejar cuerpos remotos, comprobantes ni secretos en mensajes o logs.
    const message = response.status === 404 ? "El servicio o la letra no están disponibles."
      : response.status === 429 ? "Límite de consultas alcanzado. Espera al menos un minuto."
      : response.status === 409 ? "El aporte tiene un conflicto. Conservamos el envío para revisarlo."
      : `El servicio de letras respondió ${response.status}. Puedes reintentar más tarde.`;
    throw new LyricsServiceError(response.status, message);
  }
  return response.json() as Promise<T>;
}

export function searchPublicLyrics(title: string, artist: string, offset: number, signal: AbortSignal) {
  const query = new URLSearchParams({ title: title.trim(), limit: "20", offset: String(offset) });
  if (artist.trim()) query.set("artist", artist.trim());
  return request<{ items: PublicLyric[]; nextOffset: number | null }>(`${LYRICS_API}/search?${query}`, { signal });
}

export function submitContribution(body: ContributionBody, key: string, signal: AbortSignal, authToken?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "Idempotency-Key": key };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return request<ContributionReceipt>(`${LYRICS_API}/contributions`, {
    method: "POST", signal,
    headers,
    body: JSON.stringify(body),
  });
}

export function getContribution(receipt: ContributionReceipt, signal: AbortSignal) {
  return request<Omit<ContributionReceipt, "receiptToken">>(`${LYRICS_API}/contributions/${encodeURIComponent(receipt.id)}`, {
    signal, headers: { "X-Contribution-Token": receipt.receiptToken },
  });
}

/** Cada frase debe tener marca; no inventar tiempos al aportar texto plano. */
export function buildContribution(title: string, artist: string, album: string | undefined,
  text: string, label: string, duration: number): ContributionBody {
  const bytes = (value: string) => new TextEncoder().encode(value).length;
  if (!title.trim() || !artist.trim() || bytes(title.trim()) > 300 || bytes(artist.trim()) > 300) {
    throw new Error("Indica título y artista de hasta 300 bytes cada uno.");
  }
  if (!text.trim() || bytes(text) > 100000) throw new Error("La letra debe contener entre 1 y 100000 bytes.");
  const body: ContributionBody = { title: title.trim(), artist: artist.trim() };
  if (album?.trim()) body.album = album.trim();
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    .filter(line => !/^\[(ti|ar|al|by|offset|source):/i.test(line));
  const timestamp = /^\[(\d{1,3}):([0-5]\d(?:\.\d{1,3})?)\]/;
  if (!lines.length) throw new Error("La letra no contiene frases.");
  if (lines.some(line => timestamp.test(line))) {
    if (!label.trim() || !Number.isFinite(duration) || duration < 1 || duration > 86400) {
      throw new Error("La sincronización necesita nombre de versión y duración entre 1 y 86400 segundos.");
    }
    let previous = -1;
    for (const line of lines) {
      const match = timestamp.exec(line);
      if (!match) throw new Error("Cada línea de una letra sincronizada necesita su marca de tiempo.");
      const time = Number(match[1]) * 60 + Number(match[2]);
      if (time < previous || time > duration + 0.5) throw new Error("Revisa el orden de las marcas y la duración de la versión.");
      previous = time;
    }
    body.syncedLyrics = lines.join("\n");
    body.recording = { label: label.trim(), durationSeconds: duration };
  } else {
    if (lines.some(line => /^\[\d+:/.test(line))) throw new Error("Hay marcas de tiempo inválidas en la letra.");
    body.plainLyrics = lines.join("\n");
  }
  if (bytes(JSON.stringify(body)) > 220000) throw new Error("El aporte supera el tamaño permitido.");
  return body;
}
