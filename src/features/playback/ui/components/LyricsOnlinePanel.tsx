import { useEffect, useRef, useState } from "react";
import { useSystemSettings } from "../../../../app/useSystemSettings";
import { searchPublicLyrics, type PublicLyric } from "../../services/publicLyricsClient";
import { LyricsContributionPanel } from "./LyricsContributionPanel";
import { CustomSelect, type CustomSelectOption } from "../../../../shared/ui/CustomSelect";
import "./lyrics-online-panel.css";

const PROVIDER_OPTIONS: CustomSelectOption<string>[] = [
  { value: "biglexj", label: "Biglex J · biglexj.com", icon: "globe" },
  { value: "lrclib", label: "LRCLIB", icon: "music" },
];

interface Candidate { id: string; title: string; artist: string; album?: string | null; plain: string; versions: { id: string; label: string; duration: number | null; text: string; youtubeId?: string | null }[] }
function toCandidate(item: PublicLyric): Candidate {
  return { id: item.id, title: item.title, artist: item.artist, album: item.album, plain: item.plainLyrics ?? "",
    versions: item.recordings.filter(recording => recording.syncedLyrics).map(recording => ({
      id: recording.id, label: recording.label, duration: recording.durationSeconds, text: recording.syncedLyrics!, youtubeId: recording.youtubeId,
    })) };
}

export function LyricsOnlinePanel({ title, artist = "", album, duration, text, onApply }: {
  title: string; artist?: string; album?: string; duration: number; text: string;
  onApply: (text: string, source: string) => void;
}) {
  const { auroraOnlineServicesEnabled: enabled, setAuroraOnlineServicesEnabled } = useSystemSettings();
  if (!enabled) return <div className="lyrics-online-panel"><p>La consulta a Biglex J está desactivada. Al activar los servicios conectados podrás buscar y aportar letras.</p>
    <button type="button" className="lyrics-sync-btn" onClick={() => setAuroraOnlineServicesEnabled(true)}>Activar servicios conectados</button></div>;
  return <ConnectedLyricsPanel title={title} artist={artist} album={album} duration={duration} text={text} onApply={onApply} />;
}

function ConnectedLyricsPanel({ title, artist, album, duration, text, onApply }: {
  title: string; artist: string; album?: string; duration: number; text: string;
  onApply: (text: string, source: string) => void;
}) {
  const [queryTitle, setQueryTitle] = useState(title);
  const [queryArtist, setQueryArtist] = useState(artist);
  const [provider, setProvider] = useState("biglexj");
  const [items, setItems] = useState<Candidate[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(true);
  const [selection, setSelection] = useState<{ text: string; source: string } | null>(null);
  const [lifetime, setLifetime] = useState<AbortController | null>(null);
  const searchController = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLifetime(controller);
    return () => { controller.abort(); searchController.current?.abort(); };
  }, []);
  const clearResults = () => {
    searchController.current?.abort();
    setBusy(false); setItems([]); setNextOffset(null); setSelection(null); setMessage("");
  };
  const search = async (offset = 0) => {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setBusy(true); setMessage(""); setSelection(null);
    if (!offset) setItems([]);
    try {
      let results: Candidate[];
      if (provider === "biglexj") {
        const result = await searchPublicLyrics(queryTitle, queryArtist, offset, controller.signal);
        results = result.items.map(toCandidate);
        if (!controller.signal.aborted) setNextOffset(result.nextOffset);
      } else {
        const params = new URLSearchParams({ track_name: queryTitle.trim() });
        if (queryArtist.trim()) params.set("artist_name", queryArtist.trim());
        const response = await fetch(`https://lrclib.net/api/search?${params}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), credentials: "omit",
        });
        if (!response.ok) throw new Error(`LRCLIB respondió ${response.status}.`);
        const data = await response.json() as { id: number; trackName: string; artistName: string; albumName?: string; plainLyrics?: string; syncedLyrics?: string; duration?: number }[];
        results = data.slice(0, 50).map(item => ({ id: String(item.id), title: item.trackName, artist: item.artistName,
          album: item.albumName, plain: item.plainLyrics ?? "", versions: item.syncedLyrics ? [{ id: "lrclib", label: "Versión de LRCLIB", duration: item.duration ?? null, text: item.syncedLyrics }] : [] }));
        if (!controller.signal.aborted) setNextOffset(null);
      }
      if (!controller.signal.aborted) {
        setItems(previous => offset ? [...previous, ...results] : results);
        if (!results.length) setMessage("No se encontraron candidatos. Revisa título y artista o prueba la otra fuente.");
      }
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "No se pudo consultar el servicio.");
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <details className="lyrics-online-panel" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Buscar o aportar letras online</summary>
    <div className="lyrics-online-fields">
      <label>Título<input value={queryTitle} onChange={e => { clearResults(); setQueryTitle(e.target.value); }} /></label>
      <label>Artista<input value={queryArtist} onChange={e => { clearResults(); setQueryArtist(e.target.value); }} /></label>
      <div className="lyrics-online-field-group">
        <span className="lyrics-online-label-text">Fuente</span>
        <CustomSelect
          value={provider}
          options={PROVIDER_OPTIONS}
          onChange={(val) => {
            clearResults();
            setProvider(val);
          }}
          className="lyrics-online-provider-select"
        />
      </div>
      <button type="button" className="lyrics-sync-btn" disabled={busy || !queryTitle.trim()} onClick={() => void search()}>Buscar</button>
      {busy && <button type="button" className="lyrics-sync-btn" onClick={() => { searchController.current?.abort(); setBusy(false); }}>Cancelar</button>}
    </div>
    <p>Comprueba título, artista y versión con tu archivo. Una duración similar no confirma la misma grabación.</p>
    <p role="status">{busy ? "Buscando candidatos…" : message}</p>
    <div className="lyrics-online-results">
      {items.map(item => <article key={item.id}>
        <strong>{item.title} — {item.artist}</strong><span>{item.album}</span>
        {item.plain && <button type="button" className="lyrics-sync-btn" onClick={() => setSelection({ text: item.plain, source: provider === "biglexj" ? "Biglex J" : "LRCLIB" })}>Revisar solo texto</button>}
        {item.versions.map(version => <button key={version.id} type="button" className="lyrics-sync-btn" onClick={() => setSelection({ text: version.text, source: `${provider === "biglexj" ? "Biglex J" : "LRCLIB"} · ${version.label}` })}>
          Revisar {version.label} · {version.duration == null ? "duración desconocida" : `${version.duration} s`}
          {version.youtubeId ? ` · YouTube: ${version.youtubeId}` : ""}
        </button>)}
      </article>)}
      {nextOffset !== null && <button type="button" className="lyrics-sync-btn" disabled={busy} onClick={() => void search(nextOffset)}>Más resultados</button>}
    </div>
    {selection && <div className="lyrics-online-selection">
      <strong>{selection.source}</strong><pre>{selection.text}</pre>
      <p>Al usar esta letra reemplazas el borrador del editor. El archivo se modifica al pulsar Guardar letras.</p>
      <button type="button" className="lyrics-sync-btn is-primary" onClick={() => { onApply(selection.text, selection.source); setSelection(null); setOpen(false); }}>Usar esta letra y versión en el editor</button>
    </div>}
    {lifetime && <LyricsContributionPanel title={queryTitle} artist={queryArtist} album={album} text={text} duration={duration} signal={lifetime.signal} />}
  </details>;
}
