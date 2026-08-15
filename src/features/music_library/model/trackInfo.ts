export interface ParsedTrackInfo {
  title: string;
  artist: string;
}

/**
 * Parsea el título y artista a partir del nombre de archivo o título sin extensión.
 * Maneja patrones comunes de archivos locales:
 * - "Artista - Título"
 * - "01. Artista - Título"
 * - "01 - Artista - Título"
 * - "01. Título"
 * - "Título"
 */
export function parseTrackInfo(rawTitle: string): ParsedTrackInfo {
  if (!rawTitle) {
    return { title: "Pista sin nombre", artist: "" };
  }

  let cleaned = rawTitle.trim();

  // Eliminar prefijos numéricos de número de pista al inicio (ej: "01. ", "01 - ", "01 ")
  cleaned = cleaned.replace(/^(\d{1,3})[\s._-]+/, (match, _num, _offset, fullStr) => {
    if (match.length >= fullStr.length) return match;
    return "";
  }).trim();

  // Separadores ESTRICTOS con espacios: " - ", " – ", " — " o " _-_ "
  // Nunca separar palabras con guiones internos como "Hi-Fi", "Sci-Fi", "T-ARA", etc.
  const separatorMatch = cleaned.match(/^(.*?)\s+[-–—]\s+(.+)$/) || cleaned.match(/^(.*?)\s*_-_+\s*(.+)$/);
  if (separatorMatch) {
    const artistPart = separatorMatch[1].trim();
    const titlePart = separatorMatch[2].trim();
    if (artistPart && titlePart) {
      return {
        artist: artistPart,
        title: titlePart,
      };
    }
  }

  return {
    title: cleaned || rawTitle,
    artist: "",
  };
}
