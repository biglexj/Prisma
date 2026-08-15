import { useEffect, useMemo, useRef } from "react";
import { formatTime } from "../formatters";
import "./lyrics-preview.css";

interface LyricLine {
  id: number;
  time: number;
  text: string;
}

interface LyricsPreviewProps {
  title: string;
  positionSeconds: number;
  durationSeconds: number;
  onSeek: (seconds: number) => void;
}

function generateDemoLyrics(title: string, durationSeconds: number): LyricLine[] {
  const duration = Math.max(durationSeconds > 0 ? durationSeconds : 180, 30);
  const step = Math.max(4, Math.floor(duration / 14));

  const templates = [
    `🎶 Escuchando "${title}" en la experiencia Prisma...`,
    "Sintetizando frecuencias armónicas en el prisma digital",
    "Las notas emergen en ondas de luz y claridad pura",
    "Resonancia continua transitando entre canales estéreo",
    "La profundidad tonal envuelve el espacio envolvente",
    "Pulsaciones rítmicas sincronizadas al 10,000 millones por ciento",
    "Destellos luminosos en cada transición de frecuencia",
    "Drift sónico en equilibrio perfecto con los matices del álbum",
    "Atmósfera inmersiva expandiéndose en alta fidelidad",
    "Eco espectral resonando con elegancia y precisión",
    "El flujo melódico avanza hacia el climax de la pista",
    "Capa tras capa de instrumentación cristalina",
    "Diminuendo progresivo hacia el silencio de la señal",
    "Sintonía perfecta conseguida en la biblioteca Prisma 🌌",
  ];

  return templates.map((text, index) => ({
    id: index,
    time: Math.min(duration - 2, index * step),
    text,
  }));
}

export function LyricsPreview({
  title,
  positionSeconds,
  durationSeconds,
  onSeek,
}: LyricsPreviewProps) {
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const lyrics = useMemo(
    () => generateDemoLyrics(title, durationSeconds),
    [title, durationSeconds],
  );

  const activeIndex = useMemo(() => {
    let current = 0;
    for (let i = 0; i < lyrics.length; i++) {
      if (positionSeconds >= lyrics[i].time) {
        current = i;
      } else {
        break;
      }
    }
    return current;
  }, [lyrics, positionSeconds]);

  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex]);

  return (
    <div className="lyrics-stage-container" ref={containerRef}>
      <header className="lyrics-header-badge">
        <span className="lyrics-kicker">LETRAS EN VIVO · SINCRONIZACIÓN</span>
        <h2>{title}</h2>
      </header>

      <div className="lyrics-scroll-viewport">
        {lyrics.map((line, index) => {
          const isActive = index === activeIndex;
          const isPast = index < activeIndex;
          const isFuture = index > activeIndex;

          return (
            <div
              key={line.id}
              ref={isActive ? activeLineRef : null}
              className={`lyric-line-item ${isActive ? "is-active" : ""} ${isPast ? "is-past" : ""} ${isFuture ? "is-future" : ""}`}
              onClick={() => onSeek(line.time)}
              role="button"
              tabIndex={0}
              title={`Saltar a ${formatTime(line.time)}`}
            >
              <span className="lyric-timestamp">{formatTime(line.time)}</span>
              <p className="lyric-text-content">
                {line.text}
              </p>
              {isActive ? <i className="lyric-active-glow-bar" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
