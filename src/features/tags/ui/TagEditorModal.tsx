import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../../../shared/ui/Icon";
import type { AudioTagData, UpdateAudioTagsRequest } from "../model/types";
import { tagsClient } from "../tauri/client";
import "./tag-editor-modal.css";

interface TagEditorModalProps {
  paths: string[];
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function TagEditorModal({ paths, isOpen, onClose, onSaved }: TagEditorModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "details" | "artwork" | "lyrics">("general");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const pathsKey = paths.join("|");
  const isBatch = paths.length > 1;
  const singlePath = paths[0] || "";

  useEffect(() => {
    if (!isOpen || paths.length === 0) return;
    setLoading(true);
    setError(null);
    setArtworkChanged(false);

    if (!isBatch) {
      tagsClient
        .readAudioTags(singlePath, true)
        .then((data: AudioTagData) => {
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
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
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
  }, [isOpen, pathsKey]);

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
        const reqs: UpdateAudioTagsRequest[] = paths.map((p) => ({
          path: p,
          artist: artist.trim() ? artist.trim() : undefined,
          album: album.trim() ? album.trim() : undefined,
          album_artist: albumArtist.trim() ? albumArtist.trim() : undefined,
          year: typeof year === "number" && year > 0 ? year : undefined,
          genre: genre.trim() ? genre.trim() : undefined,
          comment: comment.trim() ? comment.trim() : undefined,
          artwork_base64: artworkChanged ? (artworkDataUrl || "") : undefined,
        }));
        await tagsClient.batchWriteAudioTags(reqs);
      }

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
    <div className="tag-editor-backdrop" onClick={onClose}>
      <div className="tag-editor-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="tag-editor-header">
          <div className="tag-editor-header-info">
            <h2>{isBatch ? `Editar ${paths.length} canciones en lote` : "Editor de etiquetas de audio"}</h2>
            <p>{isBatch ? "Los cambios aplicados afectarán a todas las canciones seleccionadas" : singlePath}</p>
          </div>
          <button className="tag-editor-close-btn" onClick={onClose} type="button">
            <Icon name="x" />
          </button>
        </header>

        <nav className="tag-editor-tabs">
          <button
            className={`tag-editor-tab-btn ${activeTab === "general" ? "is-active" : ""}`}
            onClick={() => setActiveTab("general")}
            type="button"
          >
            General
          </button>
          <button
            className={`tag-editor-tab-btn ${activeTab === "details" ? "is-active" : ""}`}
            onClick={() => setActiveTab("details")}
            type="button"
          >
            Detalles
          </button>
          <button
            className={`tag-editor-tab-btn ${activeTab === "artwork" ? "is-active" : ""}`}
            onClick={() => setActiveTab("artwork")}
            type="button"
          >
            Carátula
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

              {activeTab === "general" ? (
                <div className="tag-editor-grid">
                  {!isBatch ? (
                    <div className="tag-editor-field is-full">
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

                  <div className="tag-editor-field">
                    <label>Año de lanzamiento</label>
                    <input
                      placeholder={isBatch ? "(Mantener)" : "Ej. 1965"}
                      type="number"
                      value={year}
                      onChange={(e) => setYear(e.target.value ? parseInt(e.target.value, 10) : "")}
                    />
                  </div>

                  <div className="tag-editor-field is-full">
                    <label>Género</label>
                    <input
                      placeholder={isBatch ? "(Mantener existentes)" : "Ej. Rock, Pop, Clásica"}
                      type="text"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              {activeTab === "details" ? (
                <div className="tag-editor-grid">
                  {!isBatch ? (
                    <>
                      <div className="tag-editor-field">
                        <label>Número de Pista</label>
                        <input
                          placeholder="1"
                          type="number"
                          value={trackNumber}
                          onChange={(e) => setTrackNumber(e.target.value ? parseInt(e.target.value, 10) : "")}
                        />
                      </div>
                      <div className="tag-editor-field">
                        <label>Total de Pistas</label>
                        <input
                          placeholder="12"
                          type="number"
                          value={trackTotal}
                          onChange={(e) => setTrackTotal(e.target.value ? parseInt(e.target.value, 10) : "")}
                        />
                      </div>
                      <div className="tag-editor-field">
                        <label>Número de Disco</label>
                        <input
                          placeholder="1"
                          type="number"
                          value={discNumber}
                          onChange={(e) => setDiscNumber(e.target.value ? parseInt(e.target.value, 10) : "")}
                        />
                      </div>
                      <div className="tag-editor-field">
                        <label>Total de Discos</label>
                        <input
                          placeholder="1"
                          type="number"
                          value={discTotal}
                          onChange={(e) => setDiscTotal(e.target.value ? parseInt(e.target.value, 10) : "")}
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="tag-editor-field is-full">
                    <label>Comentarios / Descripción</label>
                    <textarea
                      placeholder="Información adicional..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>
                </div>
              ) : null}

              {activeTab === "artwork" ? (
                <div className="tag-editor-artwork-panel">
                  <div className="tag-editor-artwork-preview">
                    {artworkDataUrl ? (
                      <img src={artworkDataUrl} alt="Carátula" />
                    ) : (
                      <div style={{ textAlign: "center", opacity: 0.5 }}>
                        <Icon name="disc" />
                        <span style={{ display: "block", fontSize: "0.75rem", marginTop: "0.25rem" }}>Sin carátula</span>
                      </div>
                    )}
                  </div>
                  <div className="tag-editor-artwork-actions">
                    <button className="tag-editor-btn is-secondary" onClick={handlePickArtwork} type="button">
                      <Icon name="image" />
                      <span>{artworkDataUrl ? "Cambiar imagen de carátula" : "Cargar carátula"}</span>
                    </button>
                    {artworkDataUrl ? (
                      <button className="tag-editor-btn is-danger" onClick={handleRemoveArtwork} type="button">
                        <Icon name="trash" />
                        <span>Eliminar carátula</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeTab === "lyrics" && !isBatch ? (
                <div className="tag-editor-field is-full">
                  <label>Letras incrustadas (LRC o texto plano)</label>
                  <textarea
                    placeholder="[00:12.34] Letras sincronizadas o sin sincronizar..."
                    style={{ minHeight: "220px", fontFamily: "monospace" }}
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="tag-editor-footer">
          <button className="tag-editor-btn is-secondary" onClick={onClose} type="button" disabled={saving}>
            Cancelar
          </button>
          <button className="tag-editor-btn is-primary" onClick={handleSave} type="button" disabled={saving || loading}>
            {saving ? "Guardando etiquetas..." : "Guardar cambios"}
          </button>
        </footer>
      </div>
    </div>
  );
}
