import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { saveVideoSnapshot, type SaveSnapshotResult } from "../../../shared/mediaOperations";

export interface VideoSnapshotToast {
  visible: boolean;
  savedPath: string;
  fileName: string;
  folder: string;
  thumbUrl: string;
  timestampStr: string;
  isError?: boolean;
  errorMessage?: string;
}

export interface UseVideoSnapshotOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoPath: string | null;
  videoTitle?: string;
  videoSnapshotFolder?: string;
  videoSnapshotFormat?: "png" | "webp" | "jpeg";
  onSeek?: (newTime: number) => void;
  onPauseStateChange?: (paused: boolean) => void;
}

export function useVideoSnapshot({
  videoRef,
  videoPath,
  videoSnapshotFolder,
  videoSnapshotFormat = "png",
  onSeek,
  onPauseStateChange,
}: UseVideoSnapshotOptions) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [snapshotToast, setSnapshotToast] = useState<VideoSnapshotToast | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  /**
   * Captura el fotograma activo a resolución nativa completa (estilo VLC)
   * utilizando un Canvas off-screen y lo persiste en disco.
   */
  const takeSnapshot = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !videoPath) {
      console.warn("No hay vídeo disponible para capturar.");
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw <= 0 || vh <= 0) {
      console.warn("No hay fotograma de vídeo disponible para capturar.");
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      setSnapshotToast({
        visible: true,
        savedPath: "",
        fileName: "El vídeo aún no está listo",
        folder: "",
        thumbUrl: "",
        timestampStr: "",
        isError: true,
        errorMessage: "Espera a que el vídeo cargue sus metadatos y dimensiones.",
      });
      toastTimeoutRef.current = window.setTimeout(() => {
        setSnapshotToast(null);
      }, 4000);
      return;
    }

    try {
      setIsCapturing(true);

      // Disparar destello de obturador de cámara (visual shutter flash)
      setIsFlashing(true);
      window.setTimeout(() => {
        setIsFlashing(false);
      }, 240);

      // Dibujar fotograma en resolución nativa en canvas offscreen
      const canvas = document.createElement("canvas");
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("No se pudo obtener el contexto 2D del lienzo.");
      }

      ctx.drawImage(video, 0, 0, vw, vh);

      const mime =
        videoSnapshotFormat === "webp"
          ? "image/webp"
          : videoSnapshotFormat === "jpeg"
          ? "image/jpeg"
          : "image/png";
      const quality =
        videoSnapshotFormat === "webp"
          ? 0.92
          : videoSnapshotFormat === "jpeg"
          ? 0.95
          : undefined;

      let dataUrl: string;
      try {
        dataUrl = canvas.toDataURL(mime, quality);
      } catch (canvasErr) {
        console.warn("Error exportando formato solicitado, intentando fallback a PNG:", canvasErr);
        dataUrl = canvas.toDataURL("image/png");
      }

      const currentTime = video.currentTime;
      const totalSecs = Math.max(0, Math.floor(currentTime));
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      const timestampStr =
        hours > 0
          ? `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
          : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

      const res: SaveSnapshotResult = await saveVideoSnapshot({
        videoPath,
        imageBase64: dataUrl,
        outputFolder: videoSnapshotFolder || undefined,
        timestampSecs: currentTime,
        format: videoSnapshotFormat,
      });

      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }

      setSnapshotToast({
        visible: true,
        savedPath: res.savedPath,
        fileName: res.fileName,
        folder: res.folder,
        thumbUrl: dataUrl,
        timestampStr,
        isError: false,
      });

      // Ocultar toast automáticamente tras 4.2 segundos
      toastTimeoutRef.current = window.setTimeout(() => {
        setSnapshotToast(null);
      }, 4200);
    } catch (err: unknown) {
      console.error("Error al capturar fotograma de vídeo:", err);
      const msg = err instanceof Error ? err.message : String(err);
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      setSnapshotToast({
        visible: true,
        savedPath: "",
        fileName: "Error al capturar fotograma",
        folder: "",
        thumbUrl: "",
        timestampStr: "",
        isError: true,
        errorMessage:
          msg.includes("Tainted") || msg.includes("insecure")
            ? "Lienzo protegido por el navegador. Reinicia la aplicación para refrescar los permisos."
            : msg.includes("video_save_snapshot")
            ? "Comando nativo no cargado. Reinicia 'bun run tauri:dev' para compilar el backend."
            : msg,
      });
      toastTimeoutRef.current = window.setTimeout(() => {
        setSnapshotToast(null);
      }, 5500);
    } finally {
      setIsCapturing(false);
    }
  }, [videoRef, videoPath, videoSnapshotFolder, videoSnapshotFormat]);

  /**
   * Avanza 1 fotograma (+1/30 s ~ 33.3ms) pausando automáticamente la reproducción.
   */
  const stepFrameForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!video.paused) {
      video.pause();
      onPauseStateChange?.(true);
    }

    const fpsDelta = 1 / 30;
    const duration = video.duration || Infinity;
    const target = Math.min(duration, video.currentTime + fpsDelta);
    video.currentTime = target;
    onSeek?.(target);
  }, [videoRef, onSeek, onPauseStateChange]);

  /**
   * Retrocede 1 fotograma (-1/30 s ~ 33.3ms) pausando automáticamente la reproducción.
   */
  const stepFrameBackward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!video.paused) {
      video.pause();
      onPauseStateChange?.(true);
    }

    const fpsDelta = 1 / 30;
    const target = Math.max(0, video.currentTime - fpsDelta);
    video.currentTime = target;
    onSeek?.(target);
  }, [videoRef, onSeek, onPauseStateChange]);

  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setSnapshotToast(null);
  }, []);

  const openSnapshotInFolder = useCallback((folderPath: string) => {
    void invoke("show_in_file_manager", { path: folderPath }).catch((err) => {
      console.error("Error al abrir carpeta de capturas:", err);
    });
  }, []);

  return {
    isCapturing,
    isFlashing,
    snapshotToast,
    takeSnapshot,
    stepFrameForward,
    stepFrameBackward,
    dismissToast,
    openSnapshotInFolder,
  };
}
