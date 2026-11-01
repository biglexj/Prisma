import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../shared/ui/Icon";
import type { AudioTagData, UpdateAudioTagsRequest } from "../model/types";
import { tagsClient } from "../tauri/client";
import { MetadataLookupPanel } from "./MetadataLookupPanel";
import { LyricsEditorModal } from "../../playback/ui/components/LyricsEditorModal";
import { buildBatchTagRequests } from "../model/metadataDraft";
import { invalidateMusicArtwork } from "../../music_library/useMusicArtwork";
import type { MusicLibraryItem } from "../../music_library/model/types";
import "./tag-editor-modal.css";

interface TagEditorModalProps {
  paths: string[];
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function TagEditorModal({ paths, isOpen, onClose, onSaved }: TagEditorModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "lyrics" | "online">("general");
  const [lookupMode, setLookupMode] = useState<"all" | "cover">("all");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupItems, setLookupItems] = useState<MusicLibraryItem[]>([]);
  const [metadataDrafts, setMetadataDrafts] = useState<Record<string, UpdateAudioTagsRequest>>({});
  const [lookupNotice, setLookupNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncEditorOpen, setIsSyncEditorOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [albumArtist, setAlbumArtist] = useState("");
  const [year, setYear] = useState<number | "">("");
  const [genre, setGenre] = useState("");
  const [trackNumber, setTrackNumber] = useState<number | "">("");
  const [trackTotal, setTrackTotal] = useState<number | "">("");
  const [discNumber, setDiscNumber] = useState<number | "">("");
  const [discTotal, setDiscTotal] = useState<number | "">("");
  const [comment, setComment] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [artworkDataUrl, setArtworkDataUrl] = useState<string | null>(null);
  const [artworkChanged, setArtworkChanged] = useState(false);

  const pathsKey = JSON.stringify(paths);
  const isBatch = paths.length > 1;
  const singlePath = paths[0] || "";

  useEffect(() => {
    if (!isOpen || paths.length === 0) return;
    setLoading(true);
    setError(null);
    setArtworkChanged(false);
    setLookupBusy(false);
    setIsSyncEditorOpen(false);
    setMetadataDrafts({});
    setLookupNotice("");
    setActiveTab("general");
    let cancelled = false;
    setLookupItems(paths.map(path => ({ path, title: path.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, ""), sourcePath: path, relativeFolder: "" })));

    if (!isBatch) {
      tagsClient
        .readAudioTags(singlePath, true)
        .then((data: AudioTagData) => {
          if (cancelled) return;
          setLookupItems([{ path: singlePath, title: data.title || singlePath.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, ""), titleFromMetadata: !!data.title, artist: data.artist || "", album: data.album || "", sourcePath: singlePath, relativeFolder: "" }]);
          setTitle(data.title || "");
          setArtist(data.artist || "");
          setAlbum(data.album || "");
          setAlbumArtist(data.album_artist || "");
          setYear(data.year ?? "");
          setGenre(data.genre || "");
          setTrackNumber(data.track_number ?? "");
          setTrackTotal(data.track_total ?? "");
          setDiscNumber(data.disc_number ?? "");
          setDiscTotal(data.disc_total ?? "");
          setComment(data.comment || "");
          setLyrics(data.lyrics || "");
          setArtworkDataUrl(data.artwork_data_url || null);
        })
        .catch((e) => { if (!cancelled) setError(String(e)); })
        .finally(() => { if (!cancelled) setLoading(false); });
    } else {
      // Modo por lotes: inicializar campos comunes vacíos
      setTitle("");
      setArtist("");
      setAlbum("");
      setAlbumArtist("");
      setYear("");
      setGenre("");
      setTrackNumber("");
      setTrackTotal("");
      setDiscNumber("");
      setDiscTotal("");
      setComment("");
      setLyrics("");
      setArtworkDataUrl(null);
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [isOpen, pathsKey]);

  const openLookup = (mode: "all" | "cover") => {
    setLookupMode(mode);
    setActiveTab("online");
  };
  const readCurrentForLookup = async (path: string): Promise<AudioTagData> => {
    const current = await tagsClient.readAudioTags(path, false);
    if (!isBatch) return { ...current, title, artist, album, has_artwork: !!artworkDataUrl };
    const draft = metadataDrafts[path];
    return { ...current, title: draft?.title ?? current.title, artist: artist.trim() || draft?.artist || current.artist,
      album: album.trim() || draft?.album || current.album,
      has_artwork: artworkChanged ? !!artworkDataUrl : draft?.artwork_base64 !== undefined ? !!draft.artwork_base64 : current.has_artwork };
  };
  const prepareMetadata = (updates: UpdateAudioTagsRequest[]) => {
    if (!isBatch) {
      const update = updates[0];
      if (update.title !== undefined) setTitle(update.title || "");
      if (update.artist !== undefined) setArtist(update.artist || "");
      if (update.album !== undefined) setAlbum(update.album || "");
      if (update.artwork_base64 !== undefined) { setArtworkDataUrl(update.artwork_base64 || null); setArtworkChanged(true); }
      setActiveTab("general");
    } else {
      setMetadataDrafts(old => {
        const next = { ...old };
        for (const update of updates) next[update.path] = { ...next[update.path], ...update };
        return next;
      });
    }
    setLookupNotice("Datos preparados. Revisa los cambios y pulsa «Guardar cambios» para escribirlos en el audio.");
  };

  const handlePickArtwork = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Imágenes de Carátula",
            extensions: ["jpg", "jpeg", "png", "webp"],
          },
        ],
        title: "Seleccionar nueva carátula",
      });

      if (typeof selected === "string") {
        // Leer imagen como Base64 desde el backend o FileReader
        const img = new Image();
        img.src = `asset://localhost/${encodeURIComponent(selected)}`;
        setArtworkDataUrl(img.src);
        setArtworkChanged(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveArtwork = () => {
    setArtworkDataUrl(null);
    setArtworkChanged(true);
  };

  const handleSave = async () => {
    if (saving || loading || lookupBusy) return;
    setSaving(true);
    setError(null);

    try {
      if (!isBatch) {
        const req: UpdateAudioTagsRequest = {
          path: singlePath,
          title: title.trim() || null,
          artist: artist.trim() || null,
          album: album.trim() || null,
          album_artist: albumArtist.trim() || null,
          year: typeof year === "number" ? year : null,
          genre: genre.trim() || null,
          track_number: typeof trackNumber === "number" ? trackNumber : null,
          track_total: typeof trackTotal === "number" ? trackTotal : null,
          disc_number: typeof discNumber === "number" ? discNumber : null,
          disc_total: typeof discTotal === "number" ? discTotal : null,
          comment: comment.trim() || null,
          lyrics: lyrics.trim() || null,
          artwork_base64: artworkChanged ? (artworkDataUrl || "") : undefined,
        };
        await tagsClient.writeAudioTags(req);
      } else {
        // Batch write: solo enviar campos que se hayan rellenado
        const reqs = buildBatchTagRequests(paths, metadataDrafts, {
          artist: artist.trim() ? artist.trim() : undefined,
          album: album.trim() ? album.trim() : undefined,
          album_artist: albumArtist.trim() ? albumArtist.trim() : undefined,
          year: typeof year === "number" && year > 0 ? year : undefined,
          genre: genre.trim() ? genre.trim() : undefined,
          comment: comment.trim() ? comment.trim() : undefined,
          artwork_base64: artworkChanged ? (artworkDataUrl || "") : undefined,
        }).filter(request => Object.keys(request).some(key => key !== "path" && request[key as keyof UpdateAudioTagsRequest] !== undefined));
        const errors = await tagsClient.batchWriteAudioTags(reqs);
        if (errors.length) {
          await Promise.all(paths.map(invalidateMusicArtwork));
          onSaved?.();
          throw new Error(errors.join("\n"));
        }
      }

      await Promise.all(paths.map(invalidateMusicArtwork));

      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="tag-editor-backdrop" onClick={saving || lookupBusy ? undefined : onClose}>
      <div className="tag-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="tag-editor-title" onClick={(e) => e.stopPropagation()}>
        <header className="tag-editor-header">
          <div className="tag-editor-header-info">
            <h2 id="tag-editor-title">{isBatch ? `Editar ${paths.length} canciones en lote` : "Editor de etiquetas de audio"}</h2>
            <p>{isBatch ? "Campos comunes para la selección; búsqueda en línea por canción" : singlePath}</p>
          </div>
          <button className="tag-editor-close-btn" onClick={onClose} type="button" disabled={saving || lookupBusy} aria-label="Cerrar editor de etiquetas">
            <Icon name="x" />
          </button>
        </header>

        <nav className="tag-editor-tabs" aria-label="Secciones de etiquetas" inert={saving || lookupBusy}>
          <button
            className={`tag-editor-tab-btn ${activeTab === "general" ? "is-active" : ""}`}
            onClick={() => setActiveTab("general")}
            type="button"
          >
            General
          </button>
          {!isBatch ? (
            <button
              className={`tag-editor-tab-btn ${activeTab === "lyrics" ? "is-active" : ""}`}
              onClick={() => setActiveTab("lyrics")}
              type="button"
            >
              Letras
            </button>
          ) : null}
          <button className={`tag-editor-tab-btn ${activeTab === "online" ? "is-active" : ""}`} onClick={() => openLookup("all")} type="button">Buscar en línea</button>
        </nav>

        <div className="tag-editor-body">
          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", opacity: 0.7 }}>
              <p>Leyendo metadatos del archivo...</p>
            </div>
          ) : (
            <>
              {error ? (
                <div style={{ padding: "0.75rem", background: "rgba(242,184,181,0.15)", color: "#f2b8b5", borderRadius: "12px" }}>
                  {error}
                </div>
              ) : null}
              {lookupNotice ? <p className="tag-editor-lookup-notice" role="status">{lookupNotice}</p> : null}
              {isBatch && Object.keys(metadataDrafts).length ? <p className="tag-editor-lookup-notice">{Object.keys(metadataDrafts).length} canciones con metadatos individuales preparados. Los campos comunes que rellenes en General prevalecen al guardar.</p> : null}

              {activeTab === "online" ? <MetadataLookupPanel key={`${pathsKey}:${lookupMode}`} items={lookupItems} mode={lookupMode} readCurrent={readCurrentForLookup} onPrepared={prepareMetadata} onBusyChange={setLookupBusy} /> : null}

              {activeTab === "general" ? (
                <div className="tag-editor-general-wrapper">
                  <div className="tag-editor-online-action">
                    <button
                      className="tag-editor-btn is-secondary"
                      type="button"
                      onClick={() => openLookup("all")}
                    >
                      <Icon name="search" />
                      <span>Buscar carátula y metadatos en línea</span>
                    </button>
                    <span>Revisa título, artista, álbum y carátula antes de guardar.</span>
                  </div>

                  <div className="tag-editor-general-layout">
                    {/* Columna Izquierda: Carátula interactiva */}
                    <div className="tag-editor-cover-col">
                      <div className="tag-editor-cover-preview">
                        {artworkDataUrl ? (
                          <img src={artworkDataUrl} alt="Carátula" />
                        ) : (
                          <div className="tag-editor-cover-placeholder">
                            <Icon name="disc" />
                            <span>Sin carátula</span>
                          </div>
                        )}
                      </div>
                      <div className="tag-editor-cover-actions">
                        <button
                          className="tag-editor-btn is-secondary"
                          onClick={handlePickArtwork}
                          type="button"
                        >
                          <Icon name="image" />
                          <span>{artworkDataUrl ? "Cambiar carátula" : "Cargar carátula"}</span>
                        </button>
                        {artworkDataUrl ? (
                          <button
                            className="tag-editor-btn is-danger"
                            onClick={handleRemoveArtwork}
                            type="button"
                          >
                            <Icon name="trash" />
                            <span>Eliminar carátula</span>
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Columna Derecha: Metadatos y Detalles */}
                    <div className="tag-editor-meta-col">
                      <div className="tag-editor-grid">
                        {!isBatch ? (
                          <div className="tag-editor-field">
                            <label>Título de la pista</label>
                            <input
                              placeholder="Ej. Yesterday"
                              type="text"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                            />
                          </div>
                        ) : null}

                        <div className="tag-editor-field">
                          <label>Artista</label>
                          <input
                            placeholder={isBatch ? "(Mantener existentes)" : "Ej. The Beatles"}
                            type="text"
                            value={artist}
                            onChange={(e) => setArtist(e.target.value)}
                          />
                        </div>

                        <div className="tag-editor-field">
                          <label>Álbum</label>
                          <input
                            placeholder={isBatch ? "(Mantener existentes)" : "Ej. Help!"}
                            type="text"
                            value={album}
                            onChange={(e) => setAlbum(e.target.value)}
                          />
                        </div>

                        <div className="tag-editor-field">
                          <label>Artista del Álbum</label>
                          <input
                            placeholder={isBatch ? "(Mantener existentes)" : "Ej. The Beatles"}
                            type="text"
                            value={albumArtist}
                            onChange={(e) => setAlbumArtist(e.target.value)}
                          />
                        </div>

                        {/* Fila a dos columnas: Género a la izquierda, Año a la derecha */}
                        <div className="tag-editor-row-2col">
                          <div className="tag-editor-field">
                            <label>Género</label>
                            <input
                              placeholder={isBatch ? "(Mantener existentes)" : "Ej. Rock, Pop, Clásica"}
                              type="text"
                              value={genre}
                              onChange={(e) => setGenre(e.target.value)}
                            />
                          </div>
                          <div className="tag-editor-field">
                            <label>Año de lanzamiento</label>
                            <input
                              placeholder={isBatch ? "(Mantener)" : "Ej. 1965"}
                              type="number"
                              value={year}
                              onChange={(e) => setYear(e.target.value ? parseInt(e.target.value, 10) : "")}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Detalles técnicos (2 filas) */}
                      <div className="tag-editor-details-section">
                        {!isBatch ? (
                          <div className="tag-editor-track-disc-grid">
                            <div className="tag-editor-field">
                              <label>Pista (Nº / Total)</label>
                              <div className="tag-editor-pair-inputs">
                                <input
                                  placeholder="1"
                                  type="number"
                                  value={trackNumber}
                                  onChange={(e) => setTrackNumber(e.target.value ? parseInt(e.target.value, 10) : "")}
                                  aria-label="Número de pista"
                                />
                                <span className="tag-editor-pair-sep">/</span>
                                <input
                                  placeholder="12"
                                  type="number"
                                  value={trackTotal}
                                  onChange={(e) => setTrackTotal(e.target.value ? parseInt(e.target.value, 10) : "")}
                                  aria-label="Total de pistas"
                                />
                              </div>
                            </div>
                            <div className="tag-editor-field">
                              <label>Disco (Nº / Total)</label>
                              <div className="tag-editor-pair-inputs">
                                <input
                                  placeholder="1"
                                  type="number"
                                  value={discNumber}
                                  onChange={(e) => setDiscNumber(e.target.value ? parseInt(e.target.value, 10) : "")}
                                  aria-label="Número de disco"
                                />
                                <span className="tag-editor-pair-sep">/</span>
                                <input
                                  placeholder="1"
                                  type="number"
                                  value={discTotal}
                                  onChange={(e) => setDiscTotal(e.target.value ? parseInt(e.target.value, 10) : "")}
                                  aria-label="Total de discos"
                                />
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="tag-editor-field is-full">
                          <label>Comentarios / Descripción</label>
                          <input
                            placeholder={isBatch ? "(Mantener existentes)" : "Información adicional o notas..."}
                            type="text"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "lyrics" && !isBatch ? (
                <div className="tag-editor-lyrics-panel">
                  <div className="tag-editor-lyrics-header">
                    <label>Letras incrustadas (LRC o texto plano)</label>
                    <button
                      type="button"
                      className="tag-editor-btn is-secondary"
                      onClick={() => setIsSyncEditorOpen(true)}
                      title="Abrir sincronizador de letras interactivo"
                    >
                      <Icon name="music" />
                      <span>Sincronizar letra</span>
                    </button>
                  </div>
                  <textarea
                    placeholder="[00:12.34] Letras sincronizadas o sin sincronizar..."
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                  />

                  {isSyncEditorOpen ? (
                    <LyricsEditorModal
                      path={singlePath}
                      title={title || singlePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || ""}
                      artist={artist}
                      album={album}
                      initialLyrics={lyrics}
                      isOpen={isSyncEditorOpen}
                      onClose={() => setIsSyncEditorOpen(false)}
                      onSaved={(finalLrc) => {
                        setLyrics(finalLrc);
                        setIsSyncEditorOpen(false);
                      }}
                    />
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="tag-editor-footer">
          <button className="tag-editor-btn is-secondary" onClick={onClose} type="button" disabled={saving || lookupBusy}>
            Cancelar
          </button>
          <button className="tag-editor-btn is-primary" onClick={handleSave} type="button" disabled={saving || loading || lookupBusy}>
            {saving ? "Guardando etiquetas..." : "Guardar cambios"}
          </button>
        </footer>
      </div>
    </div>
  );
}
