import { useEffect, useState } from "react";
import type { PublicLyric } from "../../services/publicLyricsClient";
import { matchingTrackLyric, publicLyricText } from "../../services/trackLyricsMatch";
import "./track-lyrics-service.css";

export function TrackLyricsService({ enabled, enable, candidates, message, loading, hasLocal, onSelect, onRetry, title, artist, isSynced, source }: {
  enabled: boolean; enable: () => void; candidates: PublicLyric[]; message: string;
  loading: boolean; hasLocal: boolean; onSelect: (raw: string) => void; onRetry: () => void;
  title: string; artist?: string; isSynced?: boolean; source?: string;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [choosingVersion, setChoosingVersion] = useState(false);
  useEffect(() => { setSelectedId(""); setChoosingVersion(false); }, [candidates]);
  const item = candidates.find(candidate => candidate.id === selectedId)
    ?? matchingTrackLyric(candidates, title, artist ?? "")
    ?? (candidates.length === 1 ? candidates[0] : null);
  const recordings = item?.recordings.filter(recording => recording.syncedLyrics) ?? [];
  const selectRecording = (id: string) => {
    const recording = recordings.find(version => version.id === id);
    if (recording) {
      onSelect(`[source:Biglex J · ${recording.label.replace(/[\r\n\[\]]/g, " ")}]\n${recording.syncedLyrics}`);
      setChoosingVersion(false);
    }
  };
  if (loading) return null;
  if (hasLocal) return source ? <div className="track-lyrics-service"><span className="track-lyrics-source">{source.startsWith("Biglex J") ? "biglexj.com" : source}</span></div> : null;
  return <div className="track-lyrics-service">
    {!enabled ? <button type="button" onClick={enable}>Conectar letras de biglexj.com</button> : <>
      {message && <span role="status">{message} <button type="button" onClick={onRetry}>Reintentar</button></span>}
      {candidates.length > 0 && <>
        <span className="track-lyrics-source">biglexj.com</span>
        {!matchingTrackLyric(candidates, title, artist ?? "") && candidates.length > 1 && <select aria-label="Canción" value={selectedId}
          onChange={event => { setSelectedId(event.target.value); setChoosingVersion(false); }}>
          <option value="">Elegir canción</option>
          {candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.title} — {candidate.artist}</option>)}
        </select>}
        {item && <div className="track-lyrics-modes" role="group" aria-label="Formato de letra">
          {publicLyricText(item) && <button type="button" aria-pressed={!isSynced} onClick={() => { onSelect(publicLyricText(item)!); setChoosingVersion(false); }}>Letra</button>}
          {recordings.length > 0 && <button type="button" aria-pressed={Boolean(isSynced)}
            title={recordings.length === 1 ? recordings[0].label : "Elegir grabación"}
            onClick={() => recordings.length === 1 ? selectRecording(recordings[0].id) : setChoosingVersion(true)}>Sincronizada</button>}
        </div>}
        {choosingVersion && <select aria-label="Grabación" defaultValue="" onChange={event => selectRecording(event.target.value)}>
          <option value="" disabled>Elegir versión</option>
          {recordings.map(recording => <option key={recording.id} value={recording.id}>{recording.label}{recording.durationSeconds ? ` · ${recording.durationSeconds} s` : ""}{recording.youtubeId ? ` · ${recording.youtubeId}` : ""}</option>)}
        </select>}
      </>}
    </>}
  </div>;
}
