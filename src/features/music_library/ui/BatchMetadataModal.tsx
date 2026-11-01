import { useEffect, useRef, useState } from "react";
import type { MusicLibraryItem } from "../model/types";
import { resolveLibraryTrackInfo } from "../model/trackInfo";
import { buildMetadataUpdate, cleanMetadataQuery, type MetadataCandidate, type MetadataOptions } from "../metadata/metadataSearch";
import { musicLibraryClient } from "../tauri/client";
import { tagsClient } from "../../tags/tauri/client";
import { invalidateMusicArtwork } from "../useMusicArtwork";
import "./batch-metadata.css";

interface Props {
  folderName: string;
  items: MusicLibraryItem[];
  onClose: () => void;
  onFinished: () => void;
}
interface Row {
  query: string;
  candidates: MetadataCandidate[];
  selected: number | null;
  message: string;
  saved?: boolean;
}

export function BatchMetadataModal({ folderName, items, onClose, onFinished }: Props) {
  const [rows, setRows] = useState<Record<string, Row>>(() => Object.fromEntries(items.map(item => {
    const info = resolveLibraryTrackInfo(item);
    return [item.path, { query: cleanMetadataQuery(`${info.artist} ${info.title}`), candidates: [], selected: null, message: "Pendiente" }];
  })));
  const [options, setOptions] = useState<MetadataOptions>({ title: true, artist: true, album: true, cover: true, onlyMissing: true });
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);
  const running = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { cancelled.current = true; previous?.focus(); };
  }, []);

  const patch = (path: string, update: Partial<Row>) => setRows(old => ({ ...old, [path]: { ...old[path], ...update } }));
  const start = () => {
    if (running.current) return false;
    running.current = true;
    cancelled.current = false;
    setBusy(true);
    return true;
  };
  const finish = () => {
    if (cancelled.current) setRows(old => Object.fromEntries(Object.entries(old).map(([path, row]) => [path,
      row.message === "Buscando…" || row.message === "Guardando…" ? { ...row, message: "Detenido" } : row,
    ])));
    running.current = false;
    setBusy(false);
  };
  const search = async (targets: MusicLibraryItem[], deezer = false) => {
    if (!start()) return;
    try {
      for (const item of targets) {
        if (cancelled.current) break;
        patch(item.path, { message: "Buscando…", selected: null, saved: false, candidates: [] });
        try {
          const candidates = await musicLibraryClient.searchMetadata(rows[item.path].query, deezer);
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
    let changed = false;
    try {
      for (const item of items) {
        if (cancelled.current) break;
        const row = rows[item.path];
        if (row.selected === null || row.saved) continue;
        const candidate = row.candidates[row.selected];
        patch(item.path, { message: "Guardando…" });
        try {
          const current = await tagsClient.readAudioTags(item.path, false);
          if (cancelled.current) break;
          const request = buildMetadataUpdate(current, candidate, options);
          if (options.cover && candidate.coverUrl && (!options.onlyMissing || !current.has_artwork)) {
            request.artwork_base64 = await musicLibraryClient.downloadCover(candidate.coverUrl);
          }
          if (cancelled.current) break;
          if (Object.keys(request).length === 1) {
            patch(item.path, { message: "Sin cambios: no hay datos nuevos para los campos elegidos", saved: true });
            continue;
          }
          await tagsClient.writeAudioTags(request);
          await invalidateMusicArtwork(item.path);
          changed = true;
          patch(item.path, { message: "Guardado en el archivo de audio", saved: true });
        } catch (error) { patch(item.path, { message: `No se guardó: ${String(error)}` }); }
      }
    } finally {
      finish();
      if (changed) onFinished();
    }
  };
  const selectedCount = Object.values(rows).filter(row => row.selected !== null && !row.saved).length;
  const anyField = options.title || options.artist || options.album || options.cover;
  return (
    <dialog ref={dialog} className="metadata-dialog" aria-labelledby="metadata-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
      <header>
        <div><h2 id="metadata-title">Carátulas y metadatos</h2><p>{folderName} · {items.length} canciones</p></div>
        <button disabled={busy} onClick={onClose} aria-label="Cerrar">×</button>
      </header>
      <div className="metadata-options">
        <p>Busca, revisa las coincidencias y elige cuáles guardar. Se enviarán el título y artista a Apple Music o Deezer.</p>
        <div className="metadata-fields">
          {([["cover", "Carátula"], ["title", "Título"], ["artist", "Artista"], ["album", "Álbum"], ["onlyMissing", "Solo completar campos vacíos"]] as const).map(([key, label]) => (
            <label key={key}><input type="checkbox" checked={options[key]} disabled={busy} onChange={e => setOptions(old => ({ ...old, [key]: e.target.checked }))} />{label}</label>
          ))}
        </div>
        <p>{options.onlyMissing ? "Se conservarán las etiquetas y carátulas existentes." : "Se reemplazarán los campos elegidos de las canciones seleccionadas."} Las letras y los nombres de archivo se conservan.</p>
      </div>
      <div className="metadata-list" aria-busy={busy}>
        {items.map(item => {
          const row = rows[item.path];
          const info = resolveLibraryTrackInfo(item);
          return <article key={item.path} className="metadata-track">
            <strong>{info.title}</strong><p>Actual: {info.artist || "Sin artista"} · {item.album || "Sin álbum"}</p>
            <div className="metadata-search">
              <input aria-label={`Búsqueda para ${info.title}`} value={row.query} disabled={busy} onChange={e => patch(item.path, { query: e.target.value })} />
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
          <button onClick={() => void search(items)}>Buscar en todas</button>
          <button disabled={!selectedCount || !anyField} onClick={() => void apply()}>Guardar seleccionadas ({selectedCount})</button>
          <button onClick={onClose}>Cerrar</button>
        </>}
      </footer>
    </dialog>
  );
}
