import { useEffect, useRef, useState } from "react";
import type { MusicLibraryItem } from "../../music_library/model/types";
import { resolveLibraryTrackInfo } from "../../music_library/model/trackInfo";
import { buildMetadataUpdate, cleanMetadataQuery, type MetadataCandidate, type MetadataOptions } from "../../music_library/metadata/metadataSearch";
import { musicLibraryClient } from "../../music_library/tauri/client";
import type { AudioTagData, UpdateAudioTagsRequest } from "../model/types";
import "./metadata-lookup.css";

interface Props {
  items: MusicLibraryItem[];
  mode: "all" | "cover";
  readCurrent: (path: string) => Promise<AudioTagData>;
  onPrepared: (updates: UpdateAudioTagsRequest[]) => void;
  onBusyChange: (busy: boolean) => void;
}
interface Row {
  query: string;
  queryEdited?: boolean;
  current?: Pick<AudioTagData, "title" | "artist" | "album">;
  candidates: MetadataCandidate[];
  selected: number | null;
  message: string;
  saved?: boolean;
}

export function MetadataLookupPanel({ items, mode, readCurrent, onPrepared, onBusyChange }: Props) {
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(items.map(item => {
    const info = resolveLibraryTrackInfo(item);
    return [item.path, { query: cleanMetadataQuery(`${info.artist} ${info.title}`), candidates: [], selected: null, message: "Pendiente" }];
  })));
  const [options, setOptions] = useState<MetadataOptions>({ title: mode === "all", artist: mode === "all", album: mode === "all", cover: true, onlyMissing: false });
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);
  const running = useRef(false);
  useEffect(() => {
    return () => { cancelled.current = true; };
  }, []);

  const patch = (path: string, update: Partial<Row>) => setRows(old => ({ ...old, [path]: { ...old[path], ...update } }));
  const start = () => {
    if (running.current) return false;
    running.current = true;
    cancelled.current = false;
    setBusy(true);
    onBusyChange(true);
    return true;
  };
  const finish = () => {
    if (cancelled.current) setRows(old => Object.fromEntries(Object.entries(old).map(([path, row]) => [path,
      row.message === "Buscando…" || row.message === "Preparando…" ? { ...row, message: "Detenido" } : row,
    ])));
    running.current = false;
    setBusy(false);
    onBusyChange(false);
  };
  const search = async (targets: MusicLibraryItem[], deezer = false) => {
    if (!start()) return;
    try {
      for (const item of targets) {
        if (cancelled.current) break;
        patch(item.path, { message: "Buscando…", selected: null, saved: false, candidates: [] });
        try {
          const current = await readCurrent(item.path);
          if (cancelled.current) break;
          const info = resolveLibraryTrackInfo({ title: current.title?.trim() || item.title, artist: current.artist,
            titleFromMetadata: !!current.title?.trim() });
          const query = rows[item.path].queryEdited ? rows[item.path].query : cleanMetadataQuery(`${info.artist} ${info.title}`);
          patch(item.path, { query, current: { ...info, album: current.album } });
          const candidates = await musicLibraryClient.searchMetadata(query, deezer);
          if (cancelled.current) { patch(item.path, { message: "Búsqueda detenida" }); break; }
          patch(item.path, { candidates, message: candidates.length ? "Revisa y elige una coincidencia" : "Sin coincidencias; ajusta la búsqueda o prueba Deezer" });
        } catch (error) {
          patch(item.path, { message: String(error) });
        }
      }
    } finally { finish(); }
  };

  const apply = async () => {
    if (!start()) return;
    const updates: UpdateAudioTagsRequest[] = [];
    try {
      for (const item of items) {
        if (cancelled.current) break;
        const row = rows[item.path];
        if (row.selected === null || row.saved) continue;
        const candidate = row.candidates[row.selected];
        patch(item.path, { message: "Preparando…" });
        try {
          const current = await readCurrent(item.path);
          if (cancelled.current) break;
          const request = buildMetadataUpdate(current, candidate, options);
          if (options.cover && candidate.coverUrl && (!options.onlyMissing || !current.has_artwork)) {
            request.artwork_base64 = await musicLibraryClient.downloadCover(candidate.coverUrl);
          }
          if (cancelled.current) break;
          if (Object.keys(request).length === 1) {
            patch(item.path, { message: "Sin cambios: no hay datos nuevos para los campos elegidos. Puedes cambiar las opciones y volver a usar la selección." });
            continue;
          }
          updates.push(request);
          patch(item.path, { message: "Preparado; pendiente de Guardar cambios", saved: true });
        } catch (error) { patch(item.path, { message: `No se preparó: ${String(error)}` }); }
      }
    } finally {
      finish();
      if (updates.length) onPrepared(updates);
    }
  };
  const selectedCount = Object.values(rows).filter(row => row.selected !== null && !row.saved).length;
  const anyField = options.title || options.artist || options.album || options.cover;
  return (
    <section className="metadata-panel" aria-label="Búsqueda de carátulas y metadatos">
      <div className="metadata-options">
        <p>Busca y elige qué datos llevar al editor. Funciona también con etiquetas y carátulas existentes. Se consultarán Apple Music o Deezer con el título y artista.</p>
        <div className="metadata-fields">
          {([["cover", "Carátula"], ["title", "Título"], ["artist", "Artista"], ["album", "Álbum"], ["onlyMissing", "Solo completar campos vacíos"]] as const).map(([key, label]) => (
            <label key={key}><input type="checkbox" checked={options[key]} disabled={busy} onChange={e => setOptions(old => ({ ...old, [key]: e.target.checked }))} />{label}</label>
          ))}
        </div>
        <p>{options.onlyMissing ? "Se conservarán los datos que ya estén completos." : "Los campos elegidos sustituirán los datos del editor."} El archivo solo cambia al pulsar «Guardar cambios».</p>
      </div>
      <div className="metadata-list" aria-busy={busy}>
        {items.map(item => {
          const row = rows[item.path];
          const info = row.current ? { title: row.current.title || item.title, artist: row.current.artist || "" } : resolveLibraryTrackInfo(item);
          return <article key={item.path} className="metadata-track">
            <strong>{info.title}</strong><p>Actual: {info.artist || "Sin artista"} · {row.current?.album || item.album || "Sin álbum"}</p>
            <div className="metadata-search">
              <input aria-label={`Búsqueda para ${info.title}`} value={row.query} disabled={busy} onChange={e => patch(item.path, { query: e.target.value, queryEdited: true })} />
              <button disabled={busy} onClick={() => void search([item])}>Buscar</button>
              <button disabled={busy} onClick={() => void search([item], true)}>Deezer</button>
            </div>
            <p role="status">{row.message}</p>
            {row.candidates.map((candidate, index) => <label key={`${candidate.source}-${index}`} className="metadata-candidate">
              <input type="radio" name={item.path} checked={row.selected === index} disabled={busy || row.saved} onChange={() => patch(item.path, { selected: index })} />
              {candidate.coverUrl ? <img src={candidate.coverUrl} alt={`Carátula de ${candidate.album || candidate.title}`} loading="lazy" referrerPolicy="no-referrer" /> : <span>Sin carátula</span>}
              <span><strong>{candidate.title}</strong><span>{candidate.artist} · {candidate.album}</span><small>{candidate.source}</small></span>
            </label>)}
            {row.selected !== null && !row.saved ? <button disabled={busy} onClick={() => patch(item.path, { selected: null })}>Omitir esta canción</button> : null}
          </article>;
        })}
      </div>
      <footer>
        {busy ? <button onClick={() => { cancelled.current = true; }}>Detener después de la operación actual</button> : <>
          {items.length > 1 ? <button onClick={() => void search(items)}>Buscar en todas</button> : null}
          <button disabled={!selectedCount || !anyField} onClick={() => void apply()}>Usar selección en el editor{items.length > 1 ? ` (${selectedCount})` : ""}</button>
        </>}
      </footer>
    </section>
  );
}
