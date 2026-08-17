import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../../shared/ui/Icon";
import { fetchLyricsFromLrclib } from "../../services/lrclibClient";
import { tagsClient } from "../../../tags/tauri/client";
import { formatTime } from "../formatters";
import "./lyrics-editor-modal.css";

export interface LyricRow {
  id: string;
  timeSeconds: number | null;
  text: string;
}

interface LyricsEditorModalProps {
  path: string;
  title: string;
  artist?: string;
  album?: string;
  durationSeconds?: number;
  currentPlaybackPosition?: number;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onSeek?: (seconds: number) => void;
  initialLyrics?: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (finalLrc: string) => void;
}

function formatLrcTimestamp(sec: number): string {
  const min = Math.floor(sec / 60);
  const remainingSec = sec % 60;
  const minStr = String(min).padStart(2, "0");
  const secStr = remainingSec.toFixed(3).padStart(6, "0");
  return `${minStr}:${secStr}`;
}

function formatSrtTimestamp(totalSeconds: number): string {
  const safeTotal = Math.max(0, totalSeconds);
  const hours = Math.floor(safeTotal / 3600);
  const minutes = Math.floor((safeTotal % 3600) / 60);
  const seconds = Math.floor(safeTotal % 60);
  const millis = Math.floor((safeTotal % 1) * 1000);

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const ms = String(millis).padStart(3, "0");

  return `${hh}:${mm}:${ss},${ms}`;
}

export function rowsToSrtString(rows: LyricRow[], songDurationSeconds: number): string {
  const validRows = rows.filter((r) => r.text.trim().length > 0);
  if (validRows.length === 0) return "";

  const srtBlocks: string[] = [];
  const defaultInterval =
    songDurationSeconds > 0 && validRows.length > 0
      ? Math.min(4.5, Math.max(1.5, songDurationSeconds / validRows.length))
      : 3.5;

  for (let i = 0; i < validRows.length; i++) {
    const current = validRows[i];
    const startTimeSec =
      current.timeSeconds !== null ? current.timeSeconds : i * defaultInterval;

    let endTimeSec: number;
    if (i < validRows.length - 1 && validRows[i + 1].timeSeconds !== null) {
      endTimeSec = Math.max(startTimeSec + 0.5, validRows[i + 1].timeSeconds!);
    } else {
      endTimeSec =
        songDurationSeconds > startTimeSec + 1
          ? Math.min(songDurationSeconds, startTimeSec + defaultInterval)
          : startTimeSec + defaultInterval;
    }

    const startTimestamp = formatSrtTimestamp(startTimeSec);
    const endTimestamp = formatSrtTimestamp(endTimeSec);

    srtBlocks.push(`${i + 1}\n${startTimestamp} --> ${endTimestamp}\n${current.text.trim()}\n`);
  }

  return srtBlocks.join("\n");
}

function parseLrcToRows(rawText: string): LyricRow[] {
  const lines = rawText.split(/\r?\n/);
  const rows: LyricRow[] = [];
  const timeRegex = /\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g;
  let counter = 1;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (/^\[(ti|ar|al|by|offset):/i.test(trimmed)) continue;

    timeRegex.lastIndex = 0;
    const match = timeRegex.exec(trimmed);

    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseFloat(match[2]);
      const totalSec = min * 60 + sec;
      const cleanText = trimmed.replace(timeRegex, "").trim();
      rows.push({
        id: `row_${counter++}_${Date.now()}`,
        timeSeconds: totalSec,
        text: cleanText || "···",
      });
    } else {
      rows.push({
        id: `row_${counter++}_${Date.now()}`,
        timeSeconds: null,
        text: trimmed,
      });
    }
  }

  return rows.length > 0 ? rows : [{ id: `row_1_${Date.now()}`, timeSeconds: null, text: "" }];
}

function rowsToLrcString(rows: LyricRow[]): string {
  return rows
    .map((row) => {
      const text = row.text.trim();
      if (row.timeSeconds !== null && row.timeSeconds >= 0) {
        return `[${formatLrcTimestamp(row.timeSeconds)}] ${text}`;
      }
      return text;
    })
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

export function LyricsEditorModal({
  path,
  title,
  artist,
  album,
  durationSeconds = 0,
  currentPlaybackPosition = 0,
  isPlaying = false,
  onTogglePlay,
  onSeek,
  initialLyrics = "",
  isOpen,
  onClose,
  onSaved,
}: LyricsEditorModalProps) {
  const [rows, setRows] = useState<LyricRow[]>(() => parseLrcToRows(initialLyrics));
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  const [editorMode, setEditorMode] = useState<"interactive" | "raw">("interactive");
  const [rawText, setRawText] = useState(initialLyrics);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveToLrc, setSaveToLrc] = useState(true);
  const [saveToSrt, setSaveToSrt] = useState(true);
  const [embedInTag, setEmbedInTag] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isImportingText, setIsImportingText] = useState(false);
  const [importedRawText, setImportedRawText] = useState("");

  const listContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const parsed = parseLrcToRows(initialLyrics);
      setRows(parsed);
      setRawText(initialLyrics);
      setActiveRowIndex(0);
      setStatusMessage(null);
    }
  }, [isOpen, initialLyrics]);

  // Auto-scroll a la fila objetivo activa
  useEffect(() => {
    if (!listContainerRef.current) return;
    const activeEl = listContainerRef.current.querySelector(".lyrics-sync-row.is-active-target") as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeRowIndex]);

  // Manejador global de teclado en fase de captura para evitar que pause el reproductor principal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.code === "Space" || e.key === " ") && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        stampCurrentTime();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, activeRowIndex, currentPlaybackPosition, rows]);

  const stampCurrentTime = (indexToStamp?: number) => {
    const targetIdx = indexToStamp ?? activeRowIndex;
    if (targetIdx < 0 || targetIdx >= rows.length) return;

    const stampTime = Math.max(0, currentPlaybackPosition);
    setRows((prev) =>
      prev.map((r, i) => (i === targetIdx ? { ...r, timeSeconds: stampTime } : r))
    );

    // Avanzar automáticamente a la siguiente fila
    const nextIdx = targetIdx + 1;
    if (nextIdx < rows.length) {
      setActiveRowIndex(nextIdx);
    }
  };

  const adjustRowTime = (idx: number, delta: number) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i === idx) {
          const current = r.timeSeconds ?? currentPlaybackPosition;
          return { ...r, timeSeconds: Math.max(0, current + delta) };
        }
        return r;
      })
    );
  };

  const updateRowText = (idx: number, newText: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, text: newText } : r)));
  };

  const addRowAfter = (idx: number) => {
    setRows((prev) => {
      const copy = [...prev];
      copy.splice(idx + 1, 0, {
        id: `row_${Date.now()}_${Math.random()}`,
        timeSeconds: null,
        text: "",
      });
      return copy;
    });
    setActiveRowIndex(idx + 1);
  };

  const removeRow = (idx: number) => {
    if (rows.length <= 1) {
      setRows([{ id: `row_${Date.now()}`, timeSeconds: null, text: "" }]);
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== idx));
    if (activeRowIndex >= rows.length - 1) {
      setActiveRowIndex(Math.max(0, rows.length - 2));
    }
  };

  const handleGlobalOffset = (seconds: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.timeSeconds !== null
          ? { ...r, timeSeconds: Math.max(0, r.timeSeconds + seconds) }
          : r
      )
    );
  };

  const handleSearchOnline = async () => {
    setSearching(true);
    setStatusMessage(null);
    try {
      const res = await fetchLyricsFromLrclib({
        trackName: title,
        artistName: artist,
        albumName: album,
        durationSeconds,
      });

      if (res && (res.syncedLyrics || res.plainLyrics)) {
        const found = res.syncedLyrics || res.plainLyrics || "";
        const parsed = parseLrcToRows(found);
        setRows(parsed);
        setRawText(found);
        setStatusMessage(
          res.syncedLyrics
            ? "✅ Letras sincronizadas aplicadas desde LRCLIB"
            : "ℹ️ Letras en texto plano aplicadas desde LRCLIB"
        );
      } else {
        setStatusMessage("❌ No se encontraron letras en LRCLIB.");
      }
    } catch {
      setStatusMessage("❌ Error al buscar letras en internet.");
    } finally {
      setSearching(false);
    }
  };

  const handleSearchOnWeb = () => {
    const cleanArtist = (artist || "").trim();
    const cleanTitle = (title || "").trim();
    const query = `${cleanArtist} ${cleanTitle} lyrics`.trim();
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    void invoke("open_external_url", { url: searchUrl }).catch(() => {
      window.open(searchUrl, "_blank");
    });
  };

  const handleApplyImportedText = () => {
    if (importedRawText.trim()) {
      const parsed = parseLrcToRows(importedRawText);
      setRows(parsed);
      setIsImportingText(false);
      setImportedRawText("");
      setStatusMessage("✅ Texto importado correctamente. Listo para sincronizar.");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    const finalLrc = editorMode === "raw" ? rawText : rowsToLrcString(rows);
    const finalSrt = saveToSrt ? rowsToSrtString(rows, durationSeconds) : null;

    try {
      await tagsClient.saveLyrics(path, finalLrc, finalSrt, saveToLrc, saveToSrt, embedInTag);
      onSaved(finalLrc);
      onClose();
    } catch (e) {
      setStatusMessage(`❌ Error al guardar letras: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="lyrics-sync-backdrop" onClick={onClose}>
      <div className="lyrics-sync-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Cabecera */}
        <header className="lyrics-sync-header">
          <div className="lyrics-sync-header-info">
            <h2>Editor y Sincronizador de Letras</h2>
            <p>
              {title} {artist ? `· ${artist}` : ""}
            </p>
          </div>
          <button
            className="lyrics-row-delete-btn"
            onClick={onClose}
            style={{ padding: "0.5rem", borderRadius: "50%" }}
            type="button"
          >
            <Icon name="close" />
          </button>
        </header>

        {/* Barra de herramientas */}
        <div className="lyrics-sync-toolbar">
          <div className="lyrics-sync-toolbar-left">
            <button
              className="lyrics-sync-btn is-primary"
              disabled={searching}
              onClick={handleSearchOnline}
              title="Buscar sincronización automática en LRCLIB"
              type="button"
            >
              <Icon name="search" />
              <span>{searching ? "Buscando..." : "Buscar en LRCLIB"}</span>
            </button>

            <button
              className="lyrics-sync-btn"
              onClick={handleSearchOnWeb}
              title="Abrir búsqueda en Google para copiar la letra"
              type="button"
            >
              <Icon name="link" />
              <span>Buscar en Google</span>
            </button>

            <button
              className="lyrics-sync-btn"
              onClick={() => setIsImportingText(true)}
              title="Pegar estrofas en texto plano"
              type="button"
            >
              <Icon name="copy" />
              <span>Pegar texto</span>
            </button>

            <button
              className="lyrics-sync-btn"
              onClick={() => addRowAfter(rows.length - 1)}
              type="button"
            >
              <Icon name="plus" />
              <span>Añadir línea</span>
            </button>
          </div>

          <div className="lyrics-sync-toolbar-right">
            <span style={{ fontSize: "0.78rem", opacity: 0.7 }}>Desfase global:</span>
            <button
              className="lyrics-sync-btn"
              onClick={() => handleGlobalOffset(-0.5)}
              style={{ padding: "0.35rem 0.6rem" }}
              title="Atrasar todas las líneas 0.5s"
              type="button"
            >
              -0.5s
            </button>
            <button
              className="lyrics-sync-btn"
              onClick={() => handleGlobalOffset(0.5)}
              style={{ padding: "0.35rem 0.6rem" }}
              title="Adelantar todas las líneas 0.5s"
              type="button"
            >
              +0.5s
            </button>

            <div style={{ display: "flex", gap: "2px", marginLeft: "0.5rem" }}>
              <button
                className={`lyrics-sync-btn ${editorMode === "interactive" ? "is-active" : ""}`}
                onClick={() => {
                  if (editorMode === "raw") {
                    setRows(parseLrcToRows(rawText));
                  }
                  setEditorMode("interactive");
                }}
                type="button"
              >
                Líneas
              </button>
              <button
                className={`lyrics-sync-btn ${editorMode === "raw" ? "is-active" : ""}`}
                onClick={() => {
                  if (editorMode === "interactive") {
                    setRawText(rowsToLrcString(rows));
                  }
                  setEditorMode("raw");
                }}
                type="button"
              >
                Texto .LRC
              </button>
            </div>
          </div>
        </div>

        {statusMessage ? (
          <div
            style={{
              padding: "0.5rem 1.75rem",
              background: "rgba(208, 188, 255, 0.1)",
              fontSize: "0.84rem",
              borderBottom: "1px solid rgba(208, 188, 255, 0.08)",
            }}
          >
            {statusMessage}
          </div>
        ) : null}

        {/* Modal interno para pegar texto en bloque */}
        {isImportingText ? (
          <div style={{ padding: "1.25rem 1.75rem", display: "flex", flexDirection: "column", gap: "0.75rem", background: "var(--surface-container)" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>Pegar letra en texto plano o párrafos:</span>
            <textarea
              placeholder="Pega aquí la letra de la canción. Cada salto de línea será una frase sincronizable..."
              style={{
                minHeight: "170px",
                background: "var(--surface-container-high)",
                border: "1px solid var(--outline-variant)",
                borderRadius: "14px",
                padding: "0.85rem",
                color: "#fff",
                fontSize: "0.9rem",
                lineHeight: "1.5",
              }}
              value={importedRawText}
              onChange={(e) => setImportedRawText(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button className="lyrics-sync-btn" onClick={() => setIsImportingText(false)} type="button">
                Cancelar
              </button>
              <button className="lyrics-sync-btn is-primary" onClick={handleApplyImportedText} type="button">
                Convertir a líneas sincronizables
              </button>
            </div>
          </div>
        ) : null}

        {/* Cuerpo del Editor */}
        <div className="lyrics-sync-body" ref={listContainerRef}>
          {editorMode === "interactive" ? (
            rows.map((row, idx) => {
              const isCurrentTarget = idx === activeRowIndex;
              const isTimeSynced = row.timeSeconds !== null;
              const isPlayingHere =
                isTimeSynced &&
                row.timeSeconds! <= currentPlaybackPosition &&
                (idx === rows.length - 1 ||
                  rows[idx + 1].timeSeconds === null ||
                  rows[idx + 1].timeSeconds! > currentPlaybackPosition);

              return (
                <div
                  key={row.id}
                  className={`lyrics-sync-row ${isCurrentTarget ? "is-active-target" : ""} ${
                    isPlayingHere ? "is-playing-now" : ""
                  }`}
                  onClick={() => setActiveRowIndex(idx)}
                >
                  {/* Selector de tiempo con micro-flechas */}
                  <div className="lyrics-sync-time-box">
                    <div className="lyrics-sync-time-btn-col">
                      <button
                        className="lyrics-sync-micro-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustRowTime(idx, 0.5);
                        }}
                        title="+0.5s"
                        type="button"
                      >
                        ▲▲
                      </button>
                      <button
                        className="lyrics-sync-micro-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustRowTime(idx, 0.1);
                        }}
                        title="+0.1s"
                        type="button"
                      >
                        ▲
                      </button>
                    </div>

                    <span
                      className={`lyrics-sync-time-display ${!isTimeSynced ? "is-empty" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (row.timeSeconds !== null && onSeek) {
                          onSeek(row.timeSeconds);
                        }
                      }}
                      style={{ cursor: isTimeSynced ? "pointer" : "default" }}
                      title={isTimeSynced ? "Saltar a este segundo" : "Sin tiempo asignado"}
                    >
                      {isTimeSynced ? formatLrcTimestamp(row.timeSeconds!) : "--:--.---"}
                    </span>

                    <div className="lyrics-sync-time-btn-col">
                      <button
                        className="lyrics-sync-micro-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustRowTime(idx, -0.1);
                        }}
                        title="-0.1s"
                        type="button"
                      >
                        ▼
                      </button>
                      <button
                        className="lyrics-sync-micro-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustRowTime(idx, -0.5);
                        }}
                        title="-0.5s"
                        type="button"
                      >
                        ▼▼
                      </button>
                    </div>
                  </div>

                  {/* Input de texto de la línea */}
                  <input
                    className="lyrics-sync-text-input"
                    placeholder="Escribe la frase..."
                    value={row.text}
                    onChange={(e) => updateRowText(idx, e.target.value)}
                    onFocus={() => setActiveRowIndex(idx)}
                  />

                  {/* Botones de acción de fila */}
                  <div className="lyrics-sync-row-actions">
                    <button
                      className="lyrics-stamp-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        stampCurrentTime(idx);
                      }}
                      title="Asignar el segundo actual de la canción a esta línea"
                      type="button"
                    >
                      <Icon name="clock" />
                      <span>{formatTime(currentPlaybackPosition)}</span>
                    </button>

                    <button
                      className="lyrics-row-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRow(idx);
                      }}
                      title="Eliminar línea"
                      type="button"
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <textarea
              placeholder="[00:12.340] Letra en formato LRC..."
              style={{
                flex: 1,
                width: "100%",
                background: "transparent",
                border: "none",
                color: "#e6e1e5",
                fontFamily: "monospace",
                fontSize: "0.92rem",
                lineHeight: "1.6",
                resize: "none",
                outline: "none",
              }}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
          )}
        </div>

        {/* Reproductor de audio integrado para sincronizar en vivo */}
        <div className="lyrics-sync-player-bar">
          <div className="lyrics-sync-player-controls">
            <button
              className="lyrics-sync-play-btn"
              onClick={onTogglePlay}
              title={isPlaying ? "Pausar canción" : "Reproducir canción"}
              type="button"
            >
              <Icon name={isPlaying ? "pause" : "play"} />
            </button>

            {onSeek ? (
              <button
                className="lyrics-sync-btn"
                onClick={() => onSeek(Math.max(0, currentPlaybackPosition - 3))}
                title="Retroceder 3 segundos"
                type="button"
              >
                <Icon name="undo" />
                <span>-3s</span>
              </button>
            ) : null}

            <span className="lyrics-sync-time-info">
              {formatTime(currentPlaybackPosition)} / {formatTime(durationSeconds)}
            </span>
          </div>

          <div
            className="lyrics-sync-space-badge"
            onClick={() => stampCurrentTime()}
            title="Presiona la barra espaciadora o haz clic aquí mientras escuchas para marcar el segundo en la línea activa"
          >
            <Icon name="check" />
            <span>Marcar tiempo en línea activa</span>
            <kbd>Espacio</kbd>
          </div>
        </div>

        {/* Pie de modal con opciones de guardado */}
        <footer className="lyrics-sync-footer">
          <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.84rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={saveToLrc}
                onChange={(e) => setSaveToLrc(e.target.checked)}
              />
              <span>Guardar archivo <strong>.lrc</strong></span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.84rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={saveToSrt}
                onChange={(e) => setSaveToSrt(e.target.checked)}
              />
              <span>Guardar archivo <strong>.srt</strong></span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.84rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={embedInTag}
                onChange={(e) => setEmbedInTag(e.target.checked)}
              />
              <span>Incrustar en tags de audio</span>
            </label>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="lyrics-sync-btn" disabled={saving} onClick={onClose} type="button">
              Cancelar
            </button>
            <button
              className="lyrics-sync-btn is-primary"
              disabled={saving || (!saveToLrc && !saveToSrt && !embedInTag)}
              onClick={handleSave}
              type="button"
            >
              {saving ? "Guardando..." : "Guardar letras"}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}
