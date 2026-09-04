import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { MusicLibraryItem } from "../model/types";
import { resolveLibraryTrackInfo } from "../model/trackInfo";
import { fetchTrackLyrics } from "../lyrics/lyricsFetcher";
import { musicLibraryClient } from "../tauri/client";
import { tagsClient } from "../../tags/tauri/client";
import { Icon } from "../../../shared/ui/Icon";
import "./batch-lyrics.css";

export interface BatchLyricsModalProps {
  isOpen: boolean;
  folderName: string;
  items: MusicLibraryItem[];
  onClose: () => void;
  onFinished?: () => void;
}

type ItemStatus = "pending" | "loading" | "synced" | "plain" | "skipped" | "not_found" | "error";

interface TrackProgress {
  status: ItemStatus;
  message?: string;
}

export function BatchLyricsModal({
  isOpen,
  folderName,
  items,
  onClose,
  onFinished,
}: BatchLyricsModalProps) {
  const [skipExisting, setSkipExisting] = useState(true);
  const [embedInTags, setEmbedInTags] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [progressMap, setProgressMap] = useState<Record<string, TrackProgress>>({});

  const abortControllerRef = useRef<AbortController | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  // Inicializar mapa de estados cuando se abren nuevos items
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, TrackProgress> = {};
      for (const it of items) {
        initial[it.path] = { status: "pending" };
      }
      setProgressMap(initial);
      setCurrentIndex(-1);
      setIsRunning(false);
    } else {
      // Limpiar controlador si se cierra
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsRunning(false);
    }
  }, [isOpen, items]);

  // Auto-scroll hacia el elemento actualmente en proceso
  useEffect(() => {
    if (currentIndex >= 0 && activeItemRef.current && listContainerRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentIndex]);

  // Métricas acumuladas
  const stats = useMemo(() => {
    let synced = 0;
    let plain = 0;
    let skipped = 0;
    let notFound = 0;
    let error = 0;
    let processed = 0;

    for (const item of items) {
      const p = progressMap[item.path];
      if (!p || p.status === "pending") continue;
      processed++;
      if (p.status === "synced") synced++;
      else if (p.status === "plain") plain++;
      else if (p.status === "skipped") skipped++;
      else if (p.status === "not_found") notFound++;
      else if (p.status === "error") error++;
    }

    const percent = items.length > 0 ? Math.round((processed / items.length) * 100) : 0;

    return { synced, plain, skipped, notFound, error, processed, percent };
  }, [items, progressMap]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const handleStart = useCallback(async () => {
    if (isRunning || items.length === 0) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRunning(true);

    for (let i = 0; i < items.length; i++) {
      if (controller.signal.aborted) break;

      const item = items[i];
      setCurrentIndex(i);

      // Si ya fue completado previamente, no volver a procesar si el usuario reanudó
      const currentStatus = progressMap[item.path]?.status;
      if (
        currentStatus &&
        ["synced", "plain", "skipped"].includes(currentStatus)
      ) {
        continue;
      }

      // 1. Verificar si ya tiene letras si skipExisting está activo
      if (skipExisting) {
        try {
          const existingLyrics = await musicLibraryClient.lyrics(item.path);
          if (existingLyrics && existingLyrics.trim().length > 0) {
            setProgressMap((prev) => ({
              ...prev,
              [item.path]: { status: "skipped", message: "Ya tiene letra local" },
            }));
            continue;
          }
        } catch {
          // Continuar a la búsqueda si la lectura falla
        }
      }

      // 2. Marcar como buscando
      setProgressMap((prev) => ({
        ...prev,
        [item.path]: { status: "loading", message: "Buscando en LRCLIB..." },
      }));

      const { title, artist } = resolveLibraryTrackInfo(item);

      try {
        const result = await fetchTrackLyrics(title, artist, controller.signal);

        if (controller.signal.aborted) break;

        if (result.found && (result.syncedLyrics || result.plainLyrics)) {
          const lyricsToSave = result.syncedLyrics || result.plainLyrics || "";
          // Guardar archivo .lrc en disco
          await tagsClient.saveLyrics(
            item.path,
            lyricsToSave,
            null,
            true, // saveLrcFile = true
            false,
            embedInTags
          );

          setProgressMap((prev) => ({
            ...prev,
            [item.path]: {
              status: result.isSynced ? "synced" : "plain",
              message: result.isSynced
                ? "Letra sincronizada (.lrc) guardada"
                : "Texto guardado (.lrc)",
            },
          }));
        } else {
          setProgressMap((prev) => ({
            ...prev,
            [item.path]: {
              status: "not_found",
              message: result.error || "No encontrada en el catálogo",
            },
          }));
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) break;

        setProgressMap((prev) => ({
          ...prev,
          [item.path]: {
            status: "error",
            message: err instanceof Error ? err.message : "Error al descargar",
          },
        }));
      }

      // Pequeña pausa cortés para respetar rate limits de la API
      await new Promise((r) => setTimeout(r, 220));
    }

    setIsRunning(false);
    abortControllerRef.current = null;
    if (onFinished) {
      onFinished();
    }
  }, [isRunning, items, skipExisting, embedInTags, progressMap, onFinished]);

  if (!isOpen) return null;

  return (
    <div className="batch-lyrics-backdrop" onClick={isRunning ? undefined : onClose}>
      <div
        className="batch-lyrics-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-lyrics-title"
      >
        {/* Encabezado */}
        <div className="batch-lyrics-header">
          <div className="batch-lyrics-header-info">
            <div className="batch-lyrics-title-row">
              <span className="batch-lyrics-icon">
                <Icon name="music" />
              </span>
              <h2 className="batch-lyrics-title" id="batch-lyrics-title">
                Descargador de Letras Sincronizadas
              </h2>
              <span className="batch-lyrics-badge">Karaoke .lrc</span>
            </div>
            <p className="batch-lyrics-subtitle">
              Carpeta: <strong>{folderName}</strong> ({items.length} {items.length === 1 ? "canción" : "canciones"})
            </p>
          </div>

          <button
            className="batch-lyrics-close-btn"
            onClick={isRunning ? handleStop : onClose}
            title={isRunning ? "Detener y cerrar" : "Cerrar"}
          >
            <Icon name="x" />
          </button>
        </div>

        {/* Opciones */}
        <div className="batch-lyrics-options">
          <label className="batch-lyrics-option-label">
            <input
              type="checkbox"
              checked={skipExisting}
              disabled={isRunning}
              onChange={(e) => setSkipExisting(e.target.checked)}
            />
            <span>Omitir canciones que ya tienen letra o archivo .lrc</span>
          </label>

          <label className="batch-lyrics-option-label">
            <input
              type="checkbox"
              checked={embedInTags}
              disabled={isRunning}
              onChange={(e) => setEmbedInTags(e.target.checked)}
            />
            <span>Incrustar también en metadatos del archivo de audio</span>
          </label>
        </div>

        {/* Sección de Progreso y Estadísticas */}
        <div className="batch-lyrics-progress-section">
          <div className="batch-lyrics-progress-bar-bg">
            <div
              className="batch-lyrics-progress-bar-fill"
              style={{ width: `${stats.percent}%` }}
            />
          </div>

          <div className="batch-lyrics-stats-grid">
            <div className="batch-stat-card">
              <span className="batch-stat-title">Progreso</span>
              <span className="batch-stat-value">{stats.processed} / {items.length}</span>
            </div>
            <div className="batch-stat-card is-synced">
              <span className="batch-stat-title">Sincronizadas</span>
              <span className="batch-stat-value">{stats.synced}</span>
            </div>
            <div className="batch-stat-card is-skipped">
              <span className="batch-stat-title">Ya existían</span>
              <span className="batch-stat-value">{stats.skipped}</span>
            </div>
            <div className="batch-stat-card is-not-found">
              <span className="batch-stat-title">No encontradas</span>
              <span className="batch-stat-value">{stats.notFound}</span>
            </div>
            {stats.error > 0 ? (
              <div className="batch-stat-card is-error">
                <span className="batch-stat-title">Errores</span>
                <span className="batch-stat-value">{stats.error}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Lista de Canciones */}
        <div className="batch-lyrics-items-list" ref={listContainerRef}>
          {items.map((item, idx) => {
            const { title, artist } = resolveLibraryTrackInfo(item);
            const statusInfo = progressMap[item.path] || { status: "pending" };
            const isActive = idx === currentIndex && isRunning;

            return (
              <div
                key={item.path}
                className={`batch-lyrics-item-row ${isActive ? "is-active" : ""}`}
                ref={isActive ? activeItemRef : null}
              >
                <div className="batch-lyrics-item-main">
                  <span className="batch-lyrics-item-idx">{idx + 1}</span>
                  <div className="batch-lyrics-item-meta">
                    <span className="batch-lyrics-item-title" title={title}>
                      {title}
                    </span>
                    <span className="batch-lyrics-item-artist" title={artist || "Pista local"}>
                      {artist || "Pista local"}
                    </span>
                  </div>
                </div>

                {statusInfo.status === "loading" ? (
                  <span className="batch-status-badge is-loading">
                    <Icon name="refresh" />
                    <span>Buscando...</span>
                  </span>
                ) : statusInfo.status === "synced" ? (
                  <span className="batch-status-badge is-synced" title={statusInfo.message}>
                    <Icon name="check" />
                    <span>Sincronizada (.lrc)</span>
                  </span>
                ) : statusInfo.status === "plain" ? (
                  <span className="batch-status-badge is-plain" title={statusInfo.message}>
                    <Icon name="file-text" />
                    <span>Texto plano</span>
                  </span>
                ) : statusInfo.status === "skipped" ? (
                  <span className="batch-status-badge is-skipped" title={statusInfo.message}>
                    <Icon name="info" />
                    <span>Ya existía</span>
                  </span>
                ) : statusInfo.status === "not_found" ? (
                  <span className="batch-status-badge is-not-found" title={statusInfo.message}>
                    <Icon name="info" />
                    <span>No encontrada</span>
                  </span>
                ) : statusInfo.status === "error" ? (
                  <span className="batch-status-badge is-error" title={statusInfo.message}>
                    <Icon name="x" />
                    <span>Error</span>
                  </span>
                ) : (
                  <span className="batch-status-badge is-pending">
                    <span>Pendiente</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Pie de Acciones */}
        <div className="batch-lyrics-footer">
          <span className="batch-lyrics-footer-note">
            Archivos .lrc guardados junto a cada audio en UTF-8
          </span>

          <div className="batch-lyrics-footer-actions">
            {isRunning ? (
              <button className="batch-btn is-danger" onClick={handleStop}>
                <Icon name="pause" />
                <span>Detener búsqueda</span>
              </button>
            ) : stats.processed === items.length && items.length > 0 ? (
              <button className="batch-btn is-secondary" onClick={onClose}>
                <Icon name="check" />
                <span>Completado — Cerrar</span>
              </button>
            ) : (
              <>
                <button className="batch-btn is-secondary" onClick={onClose}>
                  <span>Cancelar</span>
                </button>
                <button className="batch-btn is-primary" onClick={handleStart}>
                  <Icon name="download" />
                  <span>
                    {stats.processed > 0 ? "Reanudar descarga" : "Iniciar búsqueda y descarga"}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
