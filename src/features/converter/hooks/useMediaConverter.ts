import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { cleanPath } from "../../../shared/mediaTree";
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

export function useMediaConverter() {
  const [inputError, setInputError] = useState<string | null>(null);
  const runningRef = useRef(false);
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
    if (runningRef.current) return;
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
  }, [calculateOutputFilename, customOutputFolder, getTargetExtension, mode, isRunning]);

  const addFilesToQueue = useCallback(
    (filePaths: string[], currentMode: ConversionMode = mode) => {
      if (runningRef.current) return;
      const targetExt = getTargetExtension(currentMode);
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
    async (rawPaths: string[], requestedMode: ConversionMode = mode) => {
      if (runningRef.current) return;
      setInputError(null);
      const paths = rawPaths.map(cleanPath).filter(Boolean);
      if (paths.length === 0) return;

      // Si la cola está vacía, auto-detectar el tipo de archivo o carpeta
      if (queue.length === 0 && paths.length > 0) {
        const directExt = paths[0].split(".").pop()?.toLowerCase() || "";
        if (["jpg", "jpeg", "png", "webp", "avif", "bmp", "tiff", "gif", "heic", "svg"].includes(directExt)) {
          requestedMode = "image";
        } else if (["mp4", "mkv", "webm", "avi", "mov", "wmv", "m4v", "flv", "ts"].includes(directExt) && requestedMode !== "video_transcode" && requestedMode !== "video_to_audio") {
          requestedMode = "video_to_audio";
        } else if (["mp3", "flac", "wav", "ogg", "aac", "m4a", "opus", "wma"].includes(directExt)) {
          requestedMode = "audio_transcode";
        } else {
          // Si no tiene extensión directa (carpeta), inspeccionar su contenido en modo auto
          try {
            const sampled = await converterClient.scanFolder(paths[0], "auto");
            if (sampled.length > 0) {
              const audioMatches = sampled.filter((f) => /\.(mp3|flac|wav|ogg|aac|m4a|opus|wma|aiff|alac)$/i.test(f)).length;
              const videoMatches = sampled.filter((f) => /\.(mp4|mkv|webm|avi|mov|wmv|m4v|flv|ts)$/i.test(f)).length;
              const imageMatches = sampled.filter((f) => /\.(jpg|jpeg|png|webp|avif|bmp|tiff|tif|gif|svg|heic)$/i.test(f)).length;

              if (audioMatches > videoMatches && audioMatches > imageMatches) {
                requestedMode = "audio_transcode";
              } else if (videoMatches >= audioMatches && videoMatches >= imageMatches) {
                requestedMode = "video_to_audio";
              } else if (imageMatches > 0) {
                requestedMode = "image";
              }
            }
          } catch {}
        }
        if (requestedMode !== mode) setMode(requestedMode);
      }

      const files: string[] = [];
      const errors: string[] = [];
      for (const path of paths) {
        try {
          let scanned = await converterClient.scanFolder(path, requestedMode);
          if (!scanned.length) {
            // Reintento con auto para no rechazar si el usuario soltó un tipo de medio distinto
            const fallbackScanned = await converterClient.scanFolder(path, "auto");
            if (fallbackScanned.length > 0) {
              scanned = fallbackScanned;
            } else {
              errors.push(`Sin archivos compatibles con el conversor: ${path}`);
            }
          }
          files.push(...scanned);
        } catch (error) {
          errors.push(String(error));
        }
      }

      if (!runningRef.current && files.length > 0) {
        addFilesToQueue(files, requestedMode);
      }
      if (errors.length) setInputError(errors.join("\n"));
    },
    [addFilesToQueue, mode, queue.length]
  );

  const incomingRef = useRef(handleIncomingPaths);
  incomingRef.current = handleIncomingPaths;

  // Escucha nativa dual (evento propio de Prisma y onDragDropEvent) para carpetas y archivos
  useEffect(() => {
    const unlistens: UnlistenFn[] = [];
    let isCancelled = false;

    const handleDrop = (paths: string[]) => {
      setIsDraggingOver(false);
      if (paths && paths.length > 0) {
        void incomingRef.current(paths);
      }
    };

    // 1. Canal OLE propio de Prisma para Windows/WebView2
    listen<{ paths?: string[] }>("prisma://native-drag-drop", (event) => {
      if (isCancelled) return;
      if (event.payload?.paths && event.payload.paths.length > 0) {
        handleDrop(event.payload.paths);
      } else {
        setIsDraggingOver(false);
      }
    })
      .then((unlisten) => {
        if (isCancelled) unlisten();
        else unlistens.push(unlisten);
      })
      .catch(() => {});

    listen("prisma://native-drag-enter", () => {
      if (!isCancelled) setIsDraggingOver(true);
    })
      .then((unlisten) => {
        if (isCancelled) unlisten();
        else unlistens.push(unlisten);
      })
      .catch(() => {});

    listen("prisma://native-drag-leave", () => {
      if (!isCancelled) setIsDraggingOver(false);
    })
      .then((unlisten) => {
        if (isCancelled) unlisten();
        else unlistens.push(unlisten);
      })
      .catch(() => {});

    // 2. Webview onDragDropEvent
    try {
      const appWindow = getCurrentWebview();
      appWindow
        .onDragDropEvent((event) => {
          if (isCancelled) return;
          if (event.payload.type === "over" || event.payload.type === "enter") {
            setIsDraggingOver(true);
          } else if (event.payload.type === "drop") {
            if (event.payload.paths && event.payload.paths.length > 0) {
              handleDrop(event.payload.paths);
            } else {
              setIsDraggingOver(false);
            }
          } else {
            setIsDraggingOver(false);
          }
        })
        .then((unlisten) => {
          if (isCancelled) unlisten();
          else unlistens.push(unlisten);
        })
        .catch(() => {});
    } catch (err) {
      console.warn("No se pudo iniciar listener de DragDrop en Conversor:", err);
    }

    return () => {
      isCancelled = true;
      for (const u of unlistens) {
        try {
          u();
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    const handleAddFile = async (e: Event) => {
      const customEvent = e as CustomEvent<{
        path?: string;
        paths?: string[];
        mode?: ConversionMode;
        isFolder?: boolean;
      }>;
      if (runningRef.current) return;
      const targetMode = customEvent.detail?.mode || mode;
      if (targetMode !== mode) { setQueue([]); setMode(targetMode); }
      const paths = customEvent.detail?.paths || (customEvent.detail?.path ? [customEvent.detail.path] : []);
      await handleIncomingPaths(paths, targetMode);
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
        await handleIncomingPaths(selected);
      } else if (typeof selected === "string") {
        await handleIncomingPaths([selected]);
      }
    } catch (e) {
      setInputError(String(e));
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
        await handleIncomingPaths([selected]);
      }
    } catch (e) {
      setInputError(String(e));
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
      setInputError(String(e));
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
    if (runningRef.current || queue.length === 0) return;
    runningRef.current = true;
    setInputError(null);
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

    if (abortControllerRef.current) setInputError("Lote detenido. Los archivos pendientes se conservan en la cola.");
    runningRef.current = false;
    setIsRunning(false);
    setCurrentIndex(null);
  };

  const cancelBatch = () => {
    abortControllerRef.current = true;
    setInputError("Se detendrá el lote al terminar el archivo actual.");
  };

  const completedCount = queue.filter((i) => i.status === "completed").length;
  const errorCount = queue.filter((i) => i.status === "error").length;
  const progressPercent = queue.length > 0 ? Math.round((completedCount / queue.length) * 100) : 0;

  return {
    inputError,
    status,
    mode,
    setMode: (next: ConversionMode) => { if (!runningRef.current) { setQueue([]); setMode(next); setInputError(null); } },
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
