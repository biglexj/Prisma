import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type {
  AudioTranscodeOptions,
  BatchRenameRules,
  ConversionMode,
  ConversionQueueItem,
  FFmpegStatus,
  ImageConvertOptions,
  VideoToAudioOptions,
  VideoTranscodeOptions,
} from "../model/types";
import { converterClient } from "../tauri/client";

const IMAGE_EXTS = [
  "jpg", "jpeg", "png", "webp", "avif", "bmp", "tiff", "tif", "gif", "svg", "ico",
  "heic", "heif", "tga", "dds", "psd", "kra", "afphoto", "raw", "cr2", "nef", "arw",
];
const VIDEO_EXTS = [
  "mp4", "mkv", "webm", "avi", "mov", "wmv", "flv", "ts", "m4v", "mpg", "mpeg", "3gp",
  "vob", "ogv",
];
const AUDIO_EXTS = [
  "mp3", "flac", "wav", "ogg", "aac", "m4a", "opus", "wma", "aiff", "alac", "mid",
];

export function useMediaConverter() {
  const [status, setStatus] = useState<FFmpegStatus | null>(null);
  const [mode, setMode] = useState<ConversionMode>("image");
  const [queue, setQueue] = useState<ConversionQueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [customOutputFolder, setCustomOutputFolder] = useState<string | null>(null);

  // Opciones por modo
  const [imageOptions, setImageOptions] = useState<ImageConvertOptions>({
    target_format: "webp",
    quality: 85,
    keep_aspect_ratio: true,
    strip_metadata: false,
  });

  const [videoToAudioOptions, setVideoToAudioOptions] = useState<VideoToAudioOptions>({
    target_format: "mp3",
    bitrate: "320k",
    channels: 2,
  });

  const [videoTranscodeOptions, setVideoTranscodeOptions] = useState<VideoTranscodeOptions>({
    target_format: "mp4",
    video_codec: "h264",
    crf: 22,
    preset: "medium",
    scale: "none",
    audio_codec: "aac",
    audio_bitrate: "192k",
  });

  const [audioTranscodeOptions, setAudioTranscodeOptions] = useState<AudioTranscodeOptions>({
    target_format: "mp3",
    bitrate: "320k",
  });

  const [renameRules, setRenameRules] = useState<BatchRenameRules>({
    enabled: false,
    prefix: "",
    suffix: "",
    findText: "",
    replaceText: "",
    numberingStart: 1,
    numberingDigits: 2,
  });

  const abortControllerRef = useRef<boolean>(false);

  useEffect(() => {
    converterClient
      .getStatus()
      .then(setStatus)
      .catch((e) => console.warn("No se pudo verificar FFmpeg:", e));
  }, []);

  const calculateOutputFilename = useCallback(
    (originalName: string, targetExt: string, index: number): string => {
      const match = originalName.match(/^(.*?)(\.[^./\\]+)?$/);
      let stem = match?.[1] || originalName;
      const originalExt = (match?.[2] || "").replace(/^\./, "").toLowerCase();
      const targetExtClean = targetExt.replace(/^\./, "").toLowerCase();

      // Si la extensión original coincide con la de salida, agregamos _convertido para evitar sobreescritura accidental
      if (originalExt === targetExtClean) {
        stem = `${stem}_convertido`;
      }

      if (renameRules.enabled) {
        if (renameRules.findText) {
          stem = stem.replaceAll(renameRules.findText, renameRules.replaceText);
        }
        if (renameRules.prefix) {
          stem = `${renameRules.prefix}${stem}`;
        }
        if (renameRules.suffix) {
          stem = `${stem}${renameRules.suffix}`;
        }
        if (renameRules.numberingStart > 0) {
          const num = renameRules.numberingStart + index;
          const numStr = String(num).padStart(renameRules.numberingDigits, "0");
          stem = `${stem}_${numStr}`;
        }
      }
      return `${stem}.${targetExtClean}`;
    },
    [renameRules]
  );

  const getTargetExtension = useCallback(
    (currentMode: ConversionMode): string => {
      switch (currentMode) {
        case "image":
          return imageOptions.target_format;
        case "video_to_audio":
          return videoToAudioOptions.target_format;
        case "video_transcode":
          return videoTranscodeOptions.target_format;
        case "audio_transcode":
          return audioTranscodeOptions.target_format;
      }
    },
    [
      imageOptions.target_format,
      videoToAudioOptions.target_format,
      videoTranscodeOptions.target_format,
      audioTranscodeOptions.target_format,
    ]
  );

  // Recalcular la cola cuando cambia el formato de destino o las reglas de renombrado o la carpeta de salida
  useEffect(() => {
    const targetExt = getTargetExtension(mode);
    setQueue((prev) => {
      let changed = false;
      const next = prev.map((item, idx) => {
        if (item.status === "completed" || item.status === "processing") return item;
        const outName = calculateOutputFilename(item.fileName, targetExt, idx);
        const dir = customOutputFolder || item.inputPath.replace(/[/\\][^/\\]+$/, "");
        const newOutputPath = `${dir.replace(/\\/g, "/")}/${outName}`;
        if (item.targetFormat !== targetExt || item.outputPath !== newOutputPath) {
          changed = true;
          return {
            ...item,
            targetFormat: targetExt,
            outputPath: newOutputPath,
          };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [calculateOutputFilename, customOutputFolder, getTargetExtension, mode]);

  const addFilesToQueue = useCallback(
    (filePaths: string[]) => {
      const targetExt = getTargetExtension(mode);
      setQueue((prev) => {
        const next = [...prev];
        filePaths.forEach((path) => {
          if (next.some((item) => item.inputPath === path)) return;
          const fileName = path.replace(/\\/g, "/").split("/").pop() || "archivo";
          const outName = calculateOutputFilename(fileName, targetExt, next.length);
          const dir = customOutputFolder || path.replace(/[/\\][^/\\]+$/, "");
          const outputPath = `${dir.replace(/\\/g, "/")}/${outName}`;

          next.push({
            id: `${path}_${Date.now()}_${Math.random()}`,
            inputPath: path,
            fileName,
            fileSizeBytes: 0,
            targetFormat: targetExt,
            outputPath,
            status: "pending",
          });
        });
        return next;
      });
    },
    [calculateOutputFilename, customOutputFolder, getTargetExtension, mode]
  );

  const handleIncomingPaths = useCallback(
    async (paths: string[]) => {
      const filesToAdd: string[] = [];
      let detectedMode: ConversionMode | null = null;

      for (const p of paths) {
        // 1. Intentar escanear si la ruta es una carpeta
        try {
          const scanned = await converterClient.scanFolder(p, mode);
          if (scanned && scanned.length > 0) {
            filesToAdd.push(...scanned);
            continue;
          }
        } catch {
          // No es carpeta válida, continúa como archivo individual
        }

        // 2. Comprobar archivo individual y detección de modo sugerido
        const ext = p.split(".").pop()?.toLowerCase() || "";
        const isImage = IMAGE_EXTS.includes(ext);
        const isVideo = VIDEO_EXTS.includes(ext);
        const isAudio = AUDIO_EXTS.includes(ext);

        if (queue.length === 0 && !detectedMode) {
          if (isImage && mode !== "image") {
            detectedMode = "image";
          } else if (isVideo && mode !== "video_to_audio" && mode !== "video_transcode") {
            detectedMode = "video_to_audio";
          } else if (isAudio && mode !== "audio_transcode") {
            detectedMode = "audio_transcode";
          }
        }

        filesToAdd.push(p);
      }

      if (detectedMode) {
        setMode(detectedMode);
      }

      if (filesToAdd.length > 0) {
        addFilesToQueue(filesToAdd);
      }
    },
    [addFilesToQueue, mode, queue.length]
  );

  // Escucha nativa de Drag & Drop de Tauri v2
  useEffect(() => {
    let unlistenPromise: Promise<() => void> | undefined;

    try {
      const appWindow = getCurrentWebviewWindow();
      unlistenPromise = appWindow.onDragDropEvent((event) => {
        if (event.payload.type === "over" || event.payload.type === "enter") {
          setIsDraggingOver(true);
        } else if (event.payload.type === "drop") {
          setIsDraggingOver(false);
          const droppedPaths = event.payload.paths;
          if (droppedPaths && droppedPaths.length > 0) {
            void handleIncomingPaths(droppedPaths);
          }
        } else {
          setIsDraggingOver(false);
        }
      });
    } catch (err) {
      console.warn("No se pudo iniciar listener de DragDrop en Tauri:", err);
    }

    return () => {
      if (unlistenPromise) {
        unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
      }
    };
  }, [handleIncomingPaths]);

  useEffect(() => {
    const handleAddFile = async (e: Event) => {
      const customEvent = e as CustomEvent<{
        path?: string;
        paths?: string[];
        mode?: ConversionMode;
        isFolder?: boolean;
      }>;
      const targetMode = customEvent.detail?.mode || mode;
      if (customEvent.detail?.mode) {
        setMode(customEvent.detail.mode);
      }
      if (customEvent.detail?.paths && customEvent.detail.paths.length > 0) {
        void handleIncomingPaths(customEvent.detail.paths);
      } else if (customEvent.detail?.path) {
        if (customEvent.detail.isFolder) {
          try {
            const scanned = await converterClient.scanFolder(customEvent.detail.path, targetMode);
            if (scanned && scanned.length > 0) {
              addFilesToQueue(scanned);
            }
          } catch (err) {
            console.error("Error al escanear carpeta para el conversor:", err);
          }
        } else {
          void handleIncomingPaths([customEvent.detail.path]);
        }
      }
    };
    window.addEventListener("prisma-converter-add-file", handleAddFile);
    return () => window.removeEventListener("prisma-converter-add-file", handleAddFile);
  }, [addFilesToQueue, handleIncomingPaths, mode]);

  const pickFiles = async () => {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
        title: "Seleccionar archivos para convertir",
      });

      if (Array.isArray(selected)) {
        addFilesToQueue(selected);
      } else if (typeof selected === "string") {
        addFilesToQueue([selected]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const pickFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Seleccionar carpeta con archivos para añadir a la cola",
      });

      if (typeof selected === "string") {
        const scannedFiles = await converterClient.scanFolder(selected, mode);
        if (scannedFiles && scannedFiles.length > 0) {
          addFilesToQueue(scannedFiles);
        }
      }
    } catch (e) {
      console.error("Error al escanear carpeta:", e);
    }
  };

  const pickOutputFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Seleccionar carpeta de destino para archivos convertidos",
      });

      if (typeof selected === "string") {
        setCustomOutputFolder(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearQueue = () => {
    setQueue([]);
    setCurrentIndex(null);
  };

  const startBatch = async () => {
    if (isRunning || queue.length === 0) return;
    setIsRunning(true);
    abortControllerRef.current = false;

    for (let i = 0; i < queue.length; i++) {
      if (abortControllerRef.current) break;
      const item = queue[i];
      if (item.status === "completed") continue;

      setCurrentIndex(i);
      setQueue((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "processing" } : it))
      );

      try {
        let payloadOptions:
          | ImageConvertOptions
          | VideoToAudioOptions
          | VideoTranscodeOptions
          | AudioTranscodeOptions = imageOptions;

        if (mode === "video_to_audio") payloadOptions = videoToAudioOptions;
        if (mode === "video_transcode") payloadOptions = videoTranscodeOptions;
        if (mode === "audio_transcode") payloadOptions = audioTranscodeOptions;

        const res = await converterClient.processBatchItem({
          mode,
          input_path: item.inputPath,
          output_path: item.outputPath,
          options: payloadOptions,
        });

        setQueue((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: res.success ? "completed" : "error",
                  errorMessage: res.error || undefined,
                }
              : it
          )
        );
      } catch (err: unknown) {
        setQueue((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: "error",
                  errorMessage: err instanceof Error ? err.message : String(err),
                }
              : it
          )
        );
      }
    }

    setIsRunning(false);
    setCurrentIndex(null);
  };

  const cancelBatch = () => {
    abortControllerRef.current = true;
    setIsRunning(false);
    setCurrentIndex(null);
  };

  const completedCount = queue.filter((i) => i.status === "completed").length;
  const errorCount = queue.filter((i) => i.status === "error").length;
  const progressPercent = queue.length > 0 ? Math.round((completedCount / queue.length) * 100) : 0;

  return {
    status,
    mode,
    setMode,
    queue,
    isRunning,
    currentIndex,
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
    addFilesToQueue,
    handleIncomingPaths,
    isDraggingOver,
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
  };
}
