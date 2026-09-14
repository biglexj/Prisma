import { Icon } from "../../../shared/ui/Icon";
import { CustomSelect, type CustomSelectOption } from "../../../shared/ui/CustomSelect";
import { useMediaConverter } from "../hooks/useMediaConverter";
import type { ConversionMode } from "../model/types";
import "./prisma-convert.css";

const IMAGE_FORMATS = ["webp", "jpg", "png", "avif", "bmp", "tiff", "gif"];
const VIDEO_TO_AUDIO_FORMATS = ["mp3", "flac", "wav", "aac", "ogg", "m4a"];
const VIDEO_FORMATS = ["mp4", "mkv", "webm"];
const AUDIO_FORMATS = ["mp3", "flac", "wav", "ogg", "aac", "m4a"];

const AUDIO_BITRATE_OPTIONS: CustomSelectOption<string>[] = [
  { value: "320k", label: "320 kbps (Máxima calidad MP3)", description: "Calidad recomendada" },
  { value: "256k", label: "256 kbps (Muy alta)", description: "Alta fidelidad" },
  { value: "192k", label: "192 kbps (Alta calidad)", description: "Balance peso/calidad" },
  { value: "128k", label: "128 kbps (Estándar)", description: "Archivo liviano" },
];

const FLAC_QUALITY_OPTIONS: CustomSelectOption<string>[] = [
  {
    value: "flac_max",
    label: "Máxima fidelidad sin pérdida (Nivel 8 · Bit-Perfect)",
    description: "Compresión lossless óptima sin descarte de datos",
    icon: "sparkles",
  },
  {
    value: "flac_standard",
    label: "Fidelidad sin pérdida estándar (Nivel 5)",
    description: "Compresión lossless balanceada",
    icon: "music",
  },
];

const WAV_QUALITY_OPTIONS: CustomSelectOption<string>[] = [
  {
    value: "wav_24",
    label: "24-bit PCM (Máxima fidelidad Hi-Res)",
    description: "Audio sin compresión de calidad máster de estudio",
    icon: "sparkles",
  },
  {
    value: "wav_16",
    label: "16-bit PCM (Calidad CD estándar)",
    description: "Audio sin compresión estándar 16-bit 44.1/48 kHz",
    icon: "music",
  },
];

const AUDIO_CHANNELS_OPTIONS: CustomSelectOption<number>[] = [
  { value: 2, label: "Estéreo (2 canales)" },
  { value: 1, label: "Mono (1 canal)" },
];

const VIDEO_CODEC_OPTIONS: CustomSelectOption<string>[] = [
  { value: "h264", label: "H.264 / AVC (Máxima compatibilidad)" },
  { value: "hevc", label: "H.265 / HEVC (Alta compresión)" },
  { value: "av1", label: "AV1 (Nueva generación ultra eficiente)" },
  { value: "copy", label: "Copiar stream directo (Sin recodificar)" },
];

const VIDEO_SCALE_OPTIONS: CustomSelectOption<string>[] = [
  { value: "none", label: "Original" },
  { value: "1920:1080", label: "1080p (Full HD)" },
  { value: "1280:720", label: "720p (HD)" },
  { value: "854:480", label: "480p (SD)" },
];

const AUDIO_TRANSCODE_BITRATE_OPTIONS: CustomSelectOption<string>[] = [
  { value: "320k", label: "320 kbps (Máxima calidad)", description: "Calidad recomendada" },
  { value: "256k", label: "256 kbps (Muy alta)", description: "Alta fidelidad" },
  { value: "192k", label: "192 kbps (Alta calidad)", description: "Balance peso/calidad" },
  { value: "128k", label: "128 kbps (Estándar)", description: "Archivo liviano" },
];

export function PrismaConvertView() {
  const {
    inputError,
    status,
    mode,
    setMode,
    queue,
    isRunning,
    isDraggingOver,
    handleIncomingPaths,
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

  const isVideoToAudioFlac = videoToAudioOptions.target_format === "flac";
  const isVideoToAudioWav = videoToAudioOptions.target_format === "wav";
  const videoToAudioQualityOptions = isVideoToAudioFlac
    ? FLAC_QUALITY_OPTIONS
    : isVideoToAudioWav
    ? WAV_QUALITY_OPTIONS
    : AUDIO_BITRATE_OPTIONS;
  const videoToAudioQualityLabel = isVideoToAudioFlac
    ? "Calidad de audio (Sin pérdida · FLAC)"
    : isVideoToAudioWav
    ? "Calidad de audio (Sin compresión · WAV)"
    : "Bitrate de audio";

  const isAudioTranscodeFlac = audioTranscodeOptions.target_format === "flac";
  const isAudioTranscodeWav = audioTranscodeOptions.target_format === "wav";
  const audioTranscodeQualityOptions = isAudioTranscodeFlac
    ? FLAC_QUALITY_OPTIONS
    : isAudioTranscodeWav
    ? WAV_QUALITY_OPTIONS
    : AUDIO_TRANSCODE_BITRATE_OPTIONS;
  const audioTranscodeQualityLabel = isAudioTranscodeFlac
    ? "Calidad de audio (Sin pérdida · FLAC)"
    : isAudioTranscodeWav
    ? "Calidad de audio (Sin compresión · WAV)"
    : "Bitrate";

  return (
    <div className={`convert-root ${isDraggingOver ? "is-drag-over" : ""}`}>
      {isDraggingOver ? (
        <div className="convert-drop-overlay">
          <div className="convert-drop-card">
            <div className="convert-drop-icon-pulse">
              <Icon name="download" />
            </div>
            <h3>Suelta tus archivos o carpetas aquí</h3>
            <p>Se añadirán y escanearán automáticamente en el Convertidor Prisma</p>
          </div>
        </div>
      ) : null}

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

      {inputError && <p role="alert" style={{ whiteSpace: "pre-line" }}>{inputError}</p>}
      <nav className="convert-mode-tabs" aria-label="Modo de conversión">
        <button
          className={`convert-mode-btn ${mode === "image" ? "is-active" : ""}`}
          disabled={isRunning}
          onClick={() => setMode("image")}
          type="button"
        >
          <Icon name="image" />
          <span>Conversor de Imágenes</span>
        </button>

        <button
          className={`convert-mode-btn ${mode === "video_to_audio" ? "is-active" : ""}`}
          disabled={isRunning}
          onClick={() => setMode("video_to_audio")}
          type="button"
        >
          <Icon name="music" />
          <span>Vídeo a Audio</span>
        </button>

        <button
          className={`convert-mode-btn ${mode === "video_transcode" ? "is-active" : ""}`}
          disabled={isRunning}
          onClick={() => setMode("video_transcode")}
          type="button"
        >
          <Icon name="video" />
          <span>Conversor de Vídeo</span>
        </button>

        <button
          className={`convert-mode-btn ${mode === "audio_transcode" ? "is-active" : ""}`}
          disabled={isRunning}
          onClick={() => setMode("audio_transcode")}
          type="button"
        >
          <Icon name="sliders" />
          <span>Transcodificador de Audio</span>
        </button>
      </nav>

      <fieldset disabled={isRunning} className="convert-panels-grid" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
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
                      onClick={() => {
                        const defaultQuality = fmt === "flac" ? "flac_max" : fmt === "wav" ? "wav_24" : "320k";
                        setVideoToAudioOptions((prev) => ({
                          ...prev,
                          target_format: fmt,
                          bitrate: defaultQuality,
                        }));
                      }}
                      type="button"
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="convert-controls-grid">
                <div className="convert-control-group">
                  <label>{videoToAudioQualityLabel}</label>
                  <CustomSelect
                    value={
                      videoToAudioOptions.bitrate ||
                      (isVideoToAudioFlac ? "flac_max" : isVideoToAudioWav ? "wav_24" : "320k")
                    }
                    options={videoToAudioQualityOptions}
                    onChange={(val) =>
                      setVideoToAudioOptions((prev) => ({ ...prev, bitrate: val }))
                    }
                    disabled={isRunning}
                  />
                </div>

                <div className="convert-control-group">
                  <label>Canales de sonido</label>
                  <CustomSelect
                    value={videoToAudioOptions.channels || 2}
                    options={AUDIO_CHANNELS_OPTIONS}
                    onChange={(val) =>
                      setVideoToAudioOptions((prev) => ({ ...prev, channels: val }))
                    }
                    disabled={isRunning}
                  />
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
                  <CustomSelect
                    value={videoTranscodeOptions.video_codec}
                    options={VIDEO_CODEC_OPTIONS}
                    onChange={(val) =>
                      setVideoTranscodeOptions((prev) => ({ ...prev, video_codec: val }))
                    }
                    disabled={isRunning}
                  />
                </div>

                <div className="convert-control-group">
                  <label>Resolución</label>
                  <CustomSelect
                    value={videoTranscodeOptions.scale || "none"}
                    options={VIDEO_SCALE_OPTIONS}
                    onChange={(val) =>
                      setVideoTranscodeOptions((prev) => ({ ...prev, scale: val }))
                    }
                    disabled={isRunning}
                  />
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
                      onClick={() => {
                        const defaultQuality = fmt === "flac" ? "flac_max" : fmt === "wav" ? "wav_24" : "320k";
                        setAudioTranscodeOptions((prev) => ({
                          ...prev,
                          target_format: fmt,
                          bitrate: defaultQuality,
                        }));
                      }}
                      type="button"
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="convert-controls-grid">
                <div className="convert-control-group">
                  <label>{audioTranscodeQualityLabel}</label>
                  <CustomSelect
                    value={
                      audioTranscodeOptions.bitrate ||
                      (isAudioTranscodeFlac ? "flac_max" : isAudioTranscodeWav ? "wav_24" : "320k")
                    }
                    options={audioTranscodeQualityOptions}
                    onChange={(val) =>
                      setAudioTranscodeOptions((prev) => ({ ...prev, bitrate: val }))
                    }
                    disabled={isRunning}
                  />
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
      </fieldset>

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
                <span>Detener después de este archivo</span>
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
            <div
              className="convert-empty-dropzone"
              onClick={pickFiles}
              onDragOver={(e) => {
                e.preventDefault();
                if (e.dataTransfer) {
                  e.dataTransfer.dropEffect = "copy";
                }
              }}
              style={{
                padding: "3.5rem 1.5rem",
                textAlign: "center",
                cursor: "pointer",
                border: "2px dashed var(--border-subtle, rgba(255, 255, 255, 0.12))",
                borderRadius: "1.25rem",
                margin: "1rem",
                background: "rgba(255, 255, 255, 0.015)",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(var(--accent-rgb, 99, 102, 241), 0.12)",
                  color: "var(--accent, #6366f1)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "0.85rem",
                }}
              >
                <Icon name="download" />
              </div>
              <h4 style={{ margin: "0 0 0.35rem 0", fontSize: "1.05rem", fontWeight: 600 }}>
                Arrastra archivos o carpetas aquí o haz clic para examinar
              </h4>
              <p style={{ margin: "0 0 1.25rem 0", fontSize: "0.84rem", opacity: 0.7 }}>
                Soporta imágenes individuales, colecciones de vídeo y carpetas completas para conversión por lotes.
              </p>
              <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  className="convert-btn is-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    pickFiles();
                  }}
                  type="button"
                  disabled={isRunning}
                >
                  <Icon name="plus" />
                  <span>Añadir archivos</span>
                </button>
                <button
                  className="convert-btn is-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    pickFolder();
                  }}
                  type="button"
                  disabled={isRunning}
                >
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
