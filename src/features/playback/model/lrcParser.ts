export interface ParsedLyricLine {
  id: number;
  time: number;
  text: string;
}

export interface ParsedLyrics {
  isSynced: boolean;
  lines: ParsedLyricLine[];
  title?: string;
  artist?: string;
  album?: string;
}

/**
 * Parser de archivos de letras sincronizadas (.lrc) o texto plano.
 * Soporta timestamps múltiples por línea ([00:12.34][00:45.67]), metadatos estándar ID tags ([ti:], [ar:], [al:])
 * y ordenamiento cronológico automático.
 */
export function parseLrc(rawLrc: string): ParsedLyrics {
  const lines = rawLrc.split(/\r?\n/);
  const result: ParsedLyricLine[] = [];
  let isSynced = false;
  let title: string | undefined;
  let artist: string | undefined;
  let album: string | undefined;
  let nextId = 0;

  // Regex para timestamps estándar: [00:12.34], [01:23.456], [01:23]
  const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
  const tagRegex = /^\[(ti|ar|al|by|offset):(.*)\]$/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Verificar metadatos de cabecera tipo [ti:Title] [ar:Artist] [al:Album]
    const tagMatch = line.match(tagRegex);
    if (tagMatch) {
      const key = tagMatch[1].toLowerCase();
      const val = tagMatch[2].trim();
      if (key === "ti") title = val;
      if (key === "ar") artist = val;
      if (key === "al") album = val;
      continue;
    }

    // Buscar todos los timestamps en la línea
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    timeRegex.lastIndex = 0;

    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millis = match[3] ? parseInt(match[3].padEnd(3, "0").slice(0, 3), 10) : 0;
      timestamps.push(minutes * 60 + seconds + millis / 1000);
    }

    if (timestamps.length > 0) {
      isSynced = true;
      const text = line.replace(timeRegex, "").trim();
      for (const time of timestamps) {
        result.push({
          id: nextId++,
          time,
          text: text || "···",
        });
      }
    } else if (!isSynced && line.length > 0 && !line.startsWith("[")) {
      // Línea de texto plano sin sincronizar
      result.push({
        id: nextId++,
        time: 0,
        text: line,
      });
    }
  }

  if (isSynced) {
    result.sort((a, b) => a.time - b.time);
  }

  return {
    isSynced,
    lines: result,
    title,
    artist,
    album,
  };
}
