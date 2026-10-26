/**
 * Origen oficial de Aurora Cloud.
 *
 * Se usa el dominio sin "www" a propósito: `https://www.biglexj.com` responde 307
 * hacia `https://biglexj.com` y esa redirección NO incluye cabeceras CORS
 * (`Access-Control-Allow-Origin`). El navegador bloquea la petición del catálogo
 * cuando llega a esa redirección, por lo que la app de escritorio se quedaba sin
 * wallpapers mientras la web (mismo origen) seguía funcionando con normalidad.
 */
export const OFFICIAL_AURORA_ORIGIN = "https://biglexj.com";

/** Origen heredado que hoy redirige; se migra al oficial para evitar el bloqueo CORS. */
export const LEGACY_AURORA_ORIGIN = "https://www.biglexj.com";

/**
 * Normaliza la URL del servidor de Aurora guardada en Preferencias:
 * recorta la barra final y migra el dominio heredado con "www" al oficial.
 */
export function normalizeAuroraServerUrl(url: string | null | undefined): string {
  const trimmed = (url ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return OFFICIAL_AURORA_ORIGIN;
  if (trimmed === LEGACY_AURORA_ORIGIN) return OFFICIAL_AURORA_ORIGIN;
  return trimmed;
}

/** Indica si la URL apunta al servidor oficial de Aurora (ya normalizada o heredada). */
export function isOfficialAuroraServer(url: string | null | undefined): boolean {
  return normalizeAuroraServerUrl(url) === OFFICIAL_AURORA_ORIGIN;
}
