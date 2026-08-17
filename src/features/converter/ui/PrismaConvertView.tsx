import { Icon } from "../../../shared/ui/Icon";
import { useMediaConverter } from "../hooks/useMediaConverter";
import type { ConversionMode } from "../model/types";
import "./prisma-convert.css";

const IMAGE_FORMATS = ["webp", "jpg", "png", "avif", "bmp", "tiff", "gif"];
const VIDEO_TO_AUDIO_FORMATS = ["mp3", "flac", "wav", "aac", "ogg", "m4a"];
const VIDEO_FORMATS = ["mp4", "mkv", "webm"];
const AUDIO_FORMATS = ["mp3", "flac", "wav", "ogg", "aac", "m4a"];

export function PrismaConvertView() {
  const {
    status,
    mode,
    setMode,
    queue,
    isRunning,
    customOutputFolder,
    setCustomOutputFolder,
    imageOptions,
    setImageOptions,
    videoToAudioOptions,
    setVideoToAudioOptions,
    videoTranscodeOptions,
    setVideoTranscodeOptions,
    audioTranscodeOptions,
    setAudioTranscodeOptions,
    renameRules,
    setRenameRules,
    pickFiles,
    pickFolder,
    pickOutputFolder,
    removeItem,
    clearQueue,
    startBatch,
    cancelBatch,
    completedCount,
    errorCount,
    progressPercent,
  } = useMediaConverter();

  return (
    <div className="convert-root">
      <header className="convert-header">
        <div className="convert-title-area">
          <h1>Convertidor Prisma</h1>
          <p>Motor de conversión por lotes de imágenes, extracción de vídeo a audio y transcodificación</p>
        </div>

        <div className={`convert-ffmpeg-badge ${status?.is_available ? "is-ok" : "is-missing"}`}>
          <Icon name={status?.is_available ? "check" : "close"} />
          <span>
            {status?.is_available
              ? "FFmpeg activo"
              : "FFmpeg no detectado"}
          </span>
        </div>
      </header>

      <nav className="convert-mode-tabs" aria-label="Modo de conversión">
        <button
          className={`convert-mode-btn ${mode === "image" ? "is-active" : ""}`}
          onClick={() => setMode("image")}
          type="button"
        >
          <Icon name="image" />
          <span>Conversor de Imágenes</span>
        </button>

        <button
          className={`convert-mode-btn ${mode === "video_to_audio" ? "is-active" : ""}`}
          onClick={() => setMode("video_to_audio")}
          type="button"
        >
          <Icon name="music" />
          <span>Vídeo a Audio</span>
        </button>

        <button
          className={`convert-mode-btn ${mode === "video_transcode" ? "is-active" : ""}`}
          onClick={() => setMode("video_transcode")}
          type="button"
        >
          <Icon name="video" />
          <span>Conversor de Vídeo</span>
        </button>

        <button
          className={`convert-mode-btn ${mode === "audio_transcode" ? "is-active" : ""}`}
          onClick={() => setMode("audio_transcode")}
          type="button"
        >
          <Icon name="sliders" />
          <span>Transcodificador de Audio</span>
        </button>
      </nav>

      <div className="convert-panels-grid">
        {/* Panel Izquierdo: Opciones de Formato y Procesamiento */}
        <div className="convert-card">
          <span className="convert-card-title">
            <Icon name="sliders" />
            <span>Ajustes de Conversión</span>
          </span>

          {mode === "image" ? (
            <>
              <div className="convert-control-group">
                <label>Formato de salida</label>
                <div className="convert-format-selector">
                  {IMAGE_FORMATS.map((fmt) => (
                    <button
                      key={fmt}
                      className={`convert-format-pill ${imageOptions.target_format === fmt ? "is-active" : ""}`}
                      onClick={() => setImageOptions((prev) => ({ ...prev, target_format: fmt }))}
                      type="button"
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="convert-controls-grid">
                <div className="convert-control-group">
                  <label>Calidad ({imageOptions.quality || 85}%)</label>
                  <input
                    max={100}
                    min={1}
                    type="range"
                    value={imageOptions.quality || 85}
                    onChange={(e) =>
                      setImageOptions((prev) => ({ ...prev, quality: parseInt(e.target.value, 10) }))
                    }
                  />
                </div>

                <div className="convert-control-group">
                  <label>Redimensionar (Ancho px)</label>
                  <input
                    placeholder="Original"
                    type="number"
                    value={imageOptions.resize_width || ""}
                    onChange={(e) =>
                      setImageOptions((prev) => ({
                        ...prev,
                        resize_width: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      }))
                    }
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={imageOptions.keep_aspect_ratio ?? true}
                    onChange={(e) =>
                      setImageOptions((prev) => ({ ...prev, keep_aspect_ratio: e.target.checked }))
                    }
                  />
                  <span>Preservar proporción de aspecto</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={imageOptions.strip_metadata ?? false}
                    onChange={(e) =>
                      setImageOptions((prev) => ({ ...prev, strip_metadata: e.target.checked }))
                    }
                  />
                  <span>Eliminar metadatos EXIF</span>
                </label>
              </div>
            </>
          ) : null}

          {mode === "video_to_audio" ? (
            <>
              <div className="convert-control-group">
                <label>Formato de audio destino</label>
                <div className="convert-format-selector">
                  {VIDEO_TO_AUDIO_FORMATS.map((fmt) => (
                    <button
                      key={fmt}
                      className={`convert-format-pill ${videoToAudioOptions.target_format === fmt ? "is-active" : ""}`}
                      onClick={() => setVideoToAudioOptions((prev) => ({ ...prev, target_format: fmt }))}
                      type="button"
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="convert-controls-grid">
                <div className="convert-control-group">
                  <label>Bitrate de audio</label>
                  <select
                    value={videoToAudioOptions.bitrate || "320k"}
                    onChange={(e) =>
                      setVideoToAudioOptions((prev) => ({ ...prev, bitrate: e.target.value }))
                    }
                  >
                    <option value="128k">128 kbps (Estándar)</option>
                    <option value="192k">192 kbps (Alta calidad)</option>
                    <option value="256k">256 kbps (Muy alta)</option>
                    <option value="320k">320 kbps (Máxima calidad MP3)</option>
                  </select>
                </div>

                <div className="convert-control-group">
                  <label>Canales de sonido</label>
                  <select
                    value={videoToAudioOptions.channels || 2}
                    onChange={(e) =>
                      setVideoToAudioOptions((prev) => ({ ...prev, channels: parseInt(e.target.value, 10) }))
                    }
                  >
                    <option value={2}>Estéreo (2 canales)</option>
                    <option value={1}>Mono (1 canal)</option>
                  </select>
                </div>
              </div>
            </>
          ) : null}

          {mode === "video_transcode" ? (
            <>
              <div className="convert-control-group">
                <label>Contenedor de salida</label>
                <div className="convert-format-selector">
                  {VIDEO_FORMATS.map((fmt) => (
                    <button
                      key={fmt}
                      className={`convert-format-pill ${videoTranscodeOptions.target_format === fmt ? "is-active" : ""}`}
                      onClick={() => setVideoTranscodeOptions((prev) => ({ ...prev, target_format: fmt }))}
                      type="button"
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="convert-controls-grid">
                <div className="convert-control-group">
                  <label>Códec de vídeo</label>
                  <select
                    value={videoTranscodeOptions.video_codec}
                    onChange={(e) =>
                      setVideoTranscodeOptions((prev) => ({ ...prev, video_codec: e.target.value }))
                    }
                  >
                    <option value="h264">H.264 / AVC (Máxima compatibilidad)</option>
                    <option value="hevc">H.265 / HEVC (Alta compresión)</option>
                    <option value="av1">AV1 (Nueva generación ultra eficiente)</option>
                    <option value="copy">Copiar stream directo (Sin recodificar)</option>
                  </select>
                </div>

                <div className="convert-control-group">
                  <label>Resolución</label>
                  <select
                    value={videoTranscodeOptions.scale || "none"}
                    onChange={(e) =>
                      setVideoTranscodeOptions((prev) => ({ ...prev, scale: e.target.value }))
                    }
                  >
                    <option value="none">Original</option>
                    <option value="1920:1080">1080p (Full HD)</option>
                    <option value="1280:720">720p (HD)</option>
                    <option value="854:480">480p (SD)</option>
                  </select>
                </div>
              </div>
            </>
          ) : null}

          {mode === "audio_transcode" ? (
            <>
              <div className="convert-control-group">
                <label>Formato destino</label>
                <div className="convert-format-selector">
                  {AUDIO_FORMATS.map((fmt) => (
                    <button
                      key={fmt}
                      className={`convert-format-pill ${audioTranscodeOptions.target_format === fmt ? "is-active" : ""}`}
                      onClick={() => setAudioTranscodeOptions((prev) => ({ ...prev, target_format: fmt }))}
                      type="button"
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="convert-controls-grid">
                <div className="convert-control-group">
                  <label>Bitrate</label>
                  <select
                    value={audioTranscodeOptions.bitrate || "320k"}
                    onChange={(e) =>
                      setAudioTranscodeOptions((prev) => ({ ...prev, bitrate: e.target.value }))
                    }
                  >
                    <option value="128k">128 kbps</option>
                    <option value="192k">192 kbps</option>
                    <option value="256k">256 kbps</option>
                    <option value="320k">320 kbps</option>
                  </select>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Panel Derecho: Renombrado y Carpeta de Salida */}
        <div className="convert-card">
          <span className="convert-card-title">
            <Icon name="edit" />
            <span>Destino y Reglas de Renombrado</span>
          </span>

          <div className="convert-control-group">
            <label>Carpeta de destino</label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                readOnly
                placeholder="Misma carpeta que el archivo original"
                value={customOutputFolder || ""}
                style={{ flex: 1 }}
              />
              <button className="convert-btn is-secondary" onClick={pickOutputFolder} type="button">
                <Icon name="folder-open" />
                <span>Cambiar</span>
              </button>
              {customOutputFolder ? (
                <button
                  className="convert-btn is-danger"
                  onClick={() => setCustomOutputFolder(null)}
                  title="Restablecer a carpeta original"
                  type="button"
                >
                  <Icon name="undo" />
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--outline-variant, rgba(208, 188, 255, 0.08))", paddingTop: "0.75rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", cursor: "pointer", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={renameRules.enabled}
                onChange={(e) =>
                  setRenameRules((prev) => ({ ...prev, enabled: e.target.checked }))
                }
              />
              <span>Habilitar renombrado automático por lote</span>
            </label>

            {renameRules.enabled ? (
              <div className="convert-controls-grid" style={{ marginTop: "0.75rem" }}>
                <div className="convert-control-group">
                  <label>Prefijo</label>
                  <input
                    placeholder="Ej. Prisma_"
                    value={renameRules.prefix}
                    onChange={(e) => setRenameRules((prev) => ({ ...prev, prefix: e.target.value }))}
                  />
                </div>
                <div className="convert-control-group">
                  <label>Sufijo</label>
                  <input
                    placeholder="Ej. _convertido"
                    value={renameRules.suffix}
                    onChange={(e) => setRenameRules((prev) => ({ ...prev, suffix: e.target.value }))}
                  />
                </div>
                <div className="convert-control-group">
                  <label>Buscar texto</label>
                  <input
                    placeholder="Texto a reemplazar"
                    value={renameRules.findText}
                    onChange={(e) => setRenameRules((prev) => ({ ...prev, findText: e.target.value }))}
                  />
                </div>
                <div className="convert-control-group">
                  <label>Reemplazar con</label>
                  <input
                    placeholder="Nuevo texto"
                    value={renameRules.replaceText}
                    onChange={(e) => setRenameRules((prev) => ({ ...prev, replaceText: e.target.value }))}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Cola de Conversión */}
      <div className="convert-card" style={{ flex: 1 }}>
        <div className="convert-queue-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span className="convert-card-title">
              <Icon name="queue" />
              <span>Cola de Archivos ({queue.length})</span>
            </span>
            {queue.length > 0 ? (
              <span style={{ fontSize: "0.82rem", opacity: 0.7 }}>
                {completedCount} listos · {errorCount > 0 ? `${errorCount} con error · ` : ""}{progressPercent}% completado
              </span>
            ) : null}
          </div>

          <div className="convert-queue-actions">
            <button className="convert-btn is-secondary" onClick={pickFiles} type="button" disabled={isRunning}>
              <Icon name="plus" />
              <span>Añadir archivos</span>
            </button>

            <button className="convert-btn is-secondary" onClick={pickFolder} type="button" disabled={isRunning}>
              <Icon name="folder-open" />
              <span>Añadir carpeta</span>
            </button>

            {queue.length > 0 ? (
              <button className="convert-btn is-danger" onClick={clearQueue} type="button" disabled={isRunning}>
                <Icon name="trash" />
                <span>Limpiar</span>
              </button>
            ) : null}

            {isRunning ? (
              <button className="convert-btn is-danger" onClick={cancelBatch} type="button">
                <Icon name="close" />
                <span>Cancelar proceso</span>
              </button>
            ) : (
              <button
                className="convert-btn is-primary"
                onClick={startBatch}
                type="button"
                disabled={queue.length === 0}
              >
                <Icon name="play" />
                <span>Iniciar conversión</span>
              </button>
            )}
          </div>
        </div>

        {isRunning || progressPercent > 0 ? (
          <div className="convert-global-progress">
            <div className="convert-progress-track">
              <div className="convert-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        ) : null}

        <div className="convert-queue-table-container">
          {queue.length === 0 ? (
            <div style={{ padding: "3rem 1.5rem", textAlign: "center", opacity: 0.75 }}>
              <Icon name="download" />
              <p style={{ margin: "0.6rem 0 1rem", fontSize: "0.86rem" }}>
                Arrastra archivos o carpetas aquí o usa los botones para comenzar
              </p>
              <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", flexWrap: "wrap" }}>
                <button className="convert-btn is-secondary" onClick={pickFiles} type="button" disabled={isRunning}>
                  <Icon name="plus" />
                  <span>Añadir archivos</span>
                </button>
                <button className="convert-btn is-secondary" onClick={pickFolder} type="button" disabled={isRunning}>
                  <Icon name="folder-open" />
                  <span>Añadir carpeta</span>
                </button>
              </div>
            </div>
          ) : (
            <table className="convert-queue-table">
              <thead>
                <tr>
                  <th>Nombre del Archivo</th>
                  <th>Formato Destino</th>
                  <th>Ruta de Salida</th>
                  <th>Estado</th>
                  <th style={{ textAlign: "right" }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.id} className={item.status === "processing" ? "is-processing" : ""}>
                    <td>
                      <strong style={{ display: "block" }}>{item.fileName}</strong>
                      <span style={{ fontSize: "0.75rem", opacity: 0.6 }}>{item.inputPath}</span>
                    </td>
                    <td>
                      <span className="convert-format-pill" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>
                        {item.targetFormat.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.8rem", opacity: 0.8 }}>{item.outputPath}</td>
                    <td>
                      <span className={`convert-status-badge status-${item.status}`}>
                        {item.status === "pending" ? "En espera" : null}
                        {item.status === "processing" ? "Convirtiendo..." : null}
                        {item.status === "completed" ? "✓ Completado" : null}
                        {item.status === "error" ? `✕ Error` : null}
                      </span>
                      {item.errorMessage ? (
                        <span style={{ display: "block", fontSize: "0.72rem", color: "#f2b8b5", marginTop: "0.2rem" }}>
                          {item.errorMessage}
                        </span>
                      ) : null}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="convert-btn is-danger"
                        disabled={isRunning}
                        onClick={() => removeItem(item.id)}
                        style={{ padding: "0.3rem 0.5rem" }}
                        title="Eliminar de la cola"
                        type="button"
                      >
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
