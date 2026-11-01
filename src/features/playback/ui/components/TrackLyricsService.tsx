import type { PublicLyric } from "../../services/publicLyricsClient";
import { publicLyricText } from "../../services/trackLyricsMatch";
import "./track-lyrics-service.css";

export function TrackLyricsService({ enabled, enable, candidates, message, loading, hasLocal, onSelect, onRetry }: {
  enabled: boolean; enable: () => void; candidates: PublicLyric[]; message: string;
  loading: boolean; hasLocal: boolean; onSelect: (raw: string) => void; onRetry: () => void;
}) {
  if (hasLocal || loading) return null;
  return <div className="track-lyrics-service">
    {!enabled ? <><p>La consulta a Biglex J está desactivada.</p>
      <button type="button" onClick={enable}>Activar servicios conectados y buscar letras</button></> : <>
      {message && <p role="status">{message} <button type="button" onClick={onRetry}>Reintentar</button></p>}
      {candidates.length > 0 && <details><summary>Versiones disponibles en Biglex J ({candidates.length})</summary>
        <p>El texto identifica la canción. Elige la grabación que corresponde a tu audio para usar sus tiempos.</p>
        {candidates.map(item => <div key={item.id} className="track-lyrics-candidate">
          <strong>{item.title} — {item.artist}</strong>
          {publicLyricText(item) && <button type="button" onClick={() => onSelect(publicLyricText(item)!)}>Mostrar solo texto</button>}
          {item.recordings.filter(recording => recording.syncedLyrics).map(recording => <button type="button" key={recording.id}
            onClick={() => onSelect(`[source:Biglex J · ${recording.label.replace(/[\r\n\[\]]/g, " ")}]\n${recording.syncedLyrics}`)}>
            Usar tiempos de {recording.label} · {recording.durationSeconds == null ? "duración desconocida" : `${recording.durationSeconds} s`}
            {recording.youtubeId ? ` · YouTube: ${recording.youtubeId}` : ""}
          </button>)}
        </div>)}
      </details>}
    </>}
  </div>;
}
