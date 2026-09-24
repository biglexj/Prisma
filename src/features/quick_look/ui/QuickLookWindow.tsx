import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState, useRef, useCallback, type CSSProperties } from "react";
import { useTheme } from "../../../app/useTheme";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";
import { quickLookClient } from "../tauri/client";
import { QuickLookHeader } from "./QuickLookHeader";
import { QuickLookErrorBoundary } from "./QuickLookErrorBoundary";
import { QuickLookImage } from "./QuickLookImage";
import { QuickLookMusic } from "./QuickLookMusic";
import { QuickLookVideo } from "./QuickLookVideo";
import { QuickLookPdf } from "./QuickLookPdf";
import { QuickLookMarkdown } from "./QuickLookMarkdown";
import { QuickLookText } from "./QuickLookText";
import { QuickLookFolder } from "./QuickLookFolder";
import { QuickLookProject } from "./QuickLookProject";
import { QuickLookPlaylist } from "./QuickLookPlaylist";
import { QuickLookLyrics } from "./QuickLookLyrics";
import { QuickLookHtml } from "./QuickLookHtml";
import { QuickLookArchive } from "./QuickLookArchive";
import { QuickLookEpub } from "./QuickLookEpub";
import { QuickLookFallback } from "./QuickLookFallback";
import { ImageComparisonModal } from "../../comparison";
import "./quick-look.css";

export function QuickLookWindow() {
  useTheme();
  const windowLabel = getCurrentWebviewWindow().label;
  const isDetached = windowLabel !== "quicklook";
  const [payload, setPayload] = useState<QuickLookPayload | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [paletteStyle, setPaletteStyle] = useState<CSSProperties | undefined>(undefined);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    quickLookClient.isPinned().then(setIsPinned).catch(() => {});
  }, []);

  const handleTogglePin = useCallback(async () => {
    const next = !isPinned;
    setIsPinned(next);
    await quickLookClient.setPinned(next).catch(() => {});
  }, [isPinned]);

  const handleStartComparing = useCallback(() => {
    setIsComparing(true);
    void invoke("quick_look_set_comparing", { comparing: true }).catch(() => {});
  }, []);

  const handleStopComparing = useCallback(() => {
    setIsComparing(false);
    void invoke("quick_look_set_comparing", { comparing: false }).catch(() => {});
  }, []);

  const requestVersionRef = useRef(0);
  const isDetachedRef = useRef(isDetached);
  isDetachedRef.current = isDetached;
  const windowLabelRef = useRef(windowLabel);
  windowLabelRef.current = windowLabel;

  const refreshCurrent = useCallback(() => {
    const version = ++requestVersionRef.current;
    const request = isDetachedRef.current
      ? quickLookClient.getDetachedPayload(windowLabelRef.current)
      : quickLookClient.getCurrent();
    return request.then((res) => {
      if (version === requestVersionRef.current && res) {
        setPayload((prev) => {
          if (
            prev &&
            prev.path === res.path &&
            prev.selectionIndex === res.selectionIndex &&
            prev.selectionTotal === res.selectionTotal
          ) {
            return prev;
          }
          setImageDimensions(null);
          return res;
        });
        return res;
      }
      return null;
    }).catch(() => null);
  }, []);

  useEffect(() => {
    let disposed = false;

    refreshCurrent().then((res) => {
      if (res && startupIntervalId) {
        window.clearInterval(startupIntervalId);
      }
    });

    // En instancias desacopladas o apertura en frío, consultar periódicamente
    // hasta recibir el primer payload y detener el intervalo inmediatamente.
    const startupIntervalId = window.setInterval(() => {
      refreshCurrent().then((res) => {
        if (res) {
          window.clearInterval(startupIntervalId);
        }
      });
    }, 150);

    const startupTimeoutId = window.setTimeout(() => {
      window.clearInterval(startupIntervalId);
    }, isDetached ? 8000 : 800);

    const cleanupFns: (() => void)[] = [];

    // Ocultación en ventana principal
    if (!isDetached) {
      const unlistenGlobalHidePromise = listen("quicklook://hide", () => {
        requestVersionRef.current++;
        if (disposed) return;
        handleStopComparing();
        window.setTimeout(() => {
          setPayload(null);
          setImageDimensions(null);
          setPaletteStyle(undefined);
        }, 120);
      });

      cleanupFns.push(() => {
        unlistenGlobalHidePromise.then((unlisten) => unlisten());
      });
    }

    // Único listener oficial a nivel de ventana para eventos de previsualización
    const unlistenWindowPreviewPromise = getCurrentWebviewWindow().listen<QuickLookPayload>(
      "quicklook://preview",
      (event) => {
        if (!disposed && event.payload) {
          requestVersionRef.current++;
          const next = event.payload;
          setPayload((prev) => {
            if (
              prev &&
              prev.path === next.path &&
              prev.modifiedMillis === next.modifiedMillis &&
              prev.fileSizeBytes === next.fileSizeBytes &&
              prev.selectionIndex === next.selectionIndex &&
              prev.selectionTotal === next.selectionTotal
            ) {
              return prev;
            }
            setImageDimensions(null);
            return next;
          });
          handleStopComparing();
        }
      }
    );
    cleanupFns.push(() => {
      unlistenWindowPreviewPromise.then((unlisten) => unlisten());
    });

    const handleFocus = () => void refreshCurrent();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshCurrent();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disposed = true;
      requestVersionRef.current++;
      window.clearInterval(startupIntervalId);
      window.clearTimeout(startupTimeoutId);
      cleanupFns.forEach((fn) => fn());
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isDetached, refreshCurrent, handleStopComparing]);

  // Atajos locales de teclado (Esc cierra siempre; Espacio solo la vista previa principal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isComparing) return;
      if (e.key !== "Escape" && e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [role="slider"], [contenteditable="true"]')) return;
      const isCloseKey =
        e.key === "Escape" || (!isDetached && (e.code === "Space" || e.key === " "));
      if (isCloseKey) {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      } else if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r")) {
        e.preventDefault();
        void refreshCurrent();
      } else if (
        e.key.toLowerCase() === "c" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        payload?.mediaType === "image"
      ) {
        e.preventDefault();
        setIsComparing(true);
      } else if (
        e.key === "ArrowRight" ||
        e.key === "ArrowDown" ||
        e.key === "PageDown"
      ) {
        // En vistas de texto con scroll (código, markdown, txt), permitir flechas arriba/abajo para scroll normal
        const isTextView = [
          "text",
          "markdown",
          "html",
          "lyrics",
        ].includes(payload?.mediaType || "");
        if (isTextView && (e.key === "ArrowDown" || e.key === "PageDown")) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        void quickLookClient.stepSelection(true);
      } else if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowUp" ||
        e.key === "PageUp"
      ) {
        const isTextView = [
          "text",
          "markdown",
          "html",
          "lyrics",
        ].includes(payload?.mediaType || "");
        if (isTextView && (e.key === "ArrowUp" || e.key === "PageUp")) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        void quickLookClient.stepSelection(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDetached, isComparing, payload, refreshCurrent]);

  // Seguimiento en tiempo real del estado de maximizado / tamaño de ventana
  useEffect(() => {
    const updateWindowState = async () => {
      try {
        const max = await invoke<boolean>("quick_look_is_maximized");
        setIsMaximized(max);
      } catch {
        try {
          const max = await getCurrentWebviewWindow().isMaximized();
          setIsMaximized(max);
        } catch {}
      }
    };

    updateWindowState();
    const unlistenResizePromise = getCurrentWebviewWindow().onResized(updateWindowState);

    return () => {
      unlistenResizePromise.then((u) => u());
    };
  }, []);

  const handleToggleMaximize = async () => {
    try {
      const nowMaximized = await invoke<boolean>("quick_look_toggle_maximize");
      setIsMaximized(nowMaximized);
    } catch {
      try {
        const win = getCurrentWebviewWindow();
        const max = await win.isMaximized();
        if (max) {
          await win.unmaximize();
          setIsMaximized(false);
        } else {
          await win.maximize();
          setIsMaximized(true);
        }
      } catch {}
    }
  };

  const playbackTimeRef = useRef<number>(0);

  const handleOpenInMain = () => {
    if (!payload) return;
    const targetPath = payload.path;
    const targetTime = playbackTimeRef.current;
    // Cortar inmediatamente la reproducción local en QuickLook antes de transferir a la ventana principal
    setPayload(null);
    setPaletteStyle(undefined);
    setIsMaximized(false);
    void quickLookClient.openInMain(targetPath, targetTime);
    if (isDetached) {
      handleClose();
    }
  };

  const handleEdit = () => {
    if (!payload) return;
    const targetPath = payload.path;
    setPayload(null);
    setPaletteStyle(undefined);
    setIsMaximized(false);
    void quickLookClient.openInMain(targetPath, undefined, true);
    if (isDetached) {
      handleClose();
    }
  };

  const handleClose = () => {
    handleStopComparing();
    setIsPinned(false);
    void quickLookClient.setPinned(false).catch(() => {});
    playbackTimeRef.current = 0;
    // Ocultar la ventana nativa de forma inmediata para que no parpadee ningún fallback
    void getCurrentWebviewWindow().hide().catch(() => {});
    void quickLookClient.hide().catch(() => {});
    if (isDetached) {
      void getCurrentWebviewWindow().close().catch(() => {});
      void quickLookClient.closeWindow().catch(() => {});
      return;
    }
    window.setTimeout(() => {
      setPayload(null);
      setPaletteStyle(undefined);
      setIsMaximized(false);
    }, 150);
  };

  return (
    <div
      className="quicklook-root"
      onContextMenu={(e) => {
        const selection = window.getSelection()?.toString();
        if (selection && selection.trim().length > 0) return;
        const target = e.target as HTMLElement | null;
        if (
          target?.closest(
            ".quicklook-markdown-body, .quicklook-code-content, .quicklook-text-viewport, .quicklook-lyrics-content, .quicklook-html-container, input, textarea",
          )
        ) {
          return;
        }
        e.preventDefault();
      }}
    >
      <div
        className={`quicklook-card ${paletteStyle ? "has-palette" : ""} ${isMaximized ? "is-maximized" : ""}`}
        style={paletteStyle}
      >
        {payload ? (
          <>
            <QuickLookHeader
              imageDimensions={imageDimensions}
              isMaximized={isMaximized}
              isPinned={isPinned}
              onClose={handleClose}
              onCompare={handleStartComparing}
              onEdit={["markdown", "text", "html", "lyrics", "generic", "project"].includes(payload.mediaType) ? handleEdit : undefined}
              onOpenInMain={handleOpenInMain}
              onStepSelection={(forward) => void quickLookClient.stepSelection(forward)}
              onToggleMaximize={handleToggleMaximize}
              onTogglePin={handleTogglePin}
              payload={payload}
            />

            {isComparing && (
              <ImageComparisonModal
                initialItem={{
                  path: payload.path,
                  title: payload.fileName,
                  sourcePath: payload.path,
                  relativeFolder: "",
                  kind: "image",
                  modifiedAtMillis: Date.now(),
                  sizeBytes: 0,
                }}
                onClose={handleStopComparing}
              />
            )}

            <div className="quicklook-body">
              {/* Botones flotantes de navegación lateral */}
              {payload.selectionTotal && payload.selectionTotal > 1 && (
                <>
                  <button
                    type="button"
                    className="quicklook-floating-nav-btn quicklook-floating-nav-prev"
                    onClick={(e) => {
                      e.stopPropagation();
                      void quickLookClient.stepSelection(false);
                    }}
                    title="Elemento anterior (Flecha izquierda)"
                    aria-label="Elemento anterior"
                  >
                    <Icon name="chevron-left" />
                  </button>
                  <button
                    type="button"
                    className="quicklook-floating-nav-btn quicklook-floating-nav-next"
                    onClick={(e) => {
                      e.stopPropagation();
                      void quickLookClient.stepSelection(true);
                    }}
                    title="Elemento siguiente (Flecha derecha)"
                    aria-label="Elemento siguiente"
                  >
                    <Icon name="chevron-right" />
                  </button>
                </>
              )}

              <QuickLookErrorBoundary
                fileName={payload.fileName}
                onOpenInMain={handleOpenInMain}
                onRetry={() => void refreshCurrent()}
                resetKey={`${payload.path}-${payload.modifiedMillis || payload.fileSizeBytes || ""}`}
              >
                {payload.mediaType === "audio" ? (
                  <QuickLookMusic
                    key={`${payload.path}-${payload.modifiedMillis || payload.fileSizeBytes || ""}`}
                    onPaletteChange={setPaletteStyle}
                    onTimeUpdate={(t) => {
                      playbackTimeRef.current = t;
                    }}
                    payload={payload}
                  />
                ) : payload.mediaType === "image" ? (
                  <QuickLookImage
                    key={`${payload.path}-${payload.modifiedMillis || payload.fileSizeBytes || ""}`}
                    onDimensionsLoad={setImageDimensions}
                    payload={payload}
                  />
                ) : payload.mediaType === "video" ? (
                  <QuickLookVideo
                    key={`${payload.path}-${payload.modifiedMillis || payload.fileSizeBytes || ""}`}
                    onDimensionsLoad={setImageDimensions}
                    onOpenInMain={handleOpenInMain}
                    onTimeUpdate={(t) => {
                      playbackTimeRef.current = t;
                    }}
                    payload={payload}
                  />
                ) : payload.mediaType === "pdf" ? (
                  <QuickLookPdf key={payload.path} payload={payload} />
                ) : payload.mediaType === "archive" ? (
                  <QuickLookArchive key={payload.path} payload={payload} />
                ) : payload.mediaType === "epub" ? (
                  <QuickLookEpub key={payload.path} payload={payload} />
                ) : payload.mediaType === "html" ? (
                  <QuickLookHtml key={payload.path} payload={payload} />
                ) : payload.mediaType === "lyrics" ? (
                  <QuickLookLyrics key={payload.path} payload={payload} />
                ) : payload.mediaType === "markdown" ? (
                  <QuickLookMarkdown key={payload.path} onEdit={handleEdit} payload={payload} />
                ) : payload.mediaType === "text" ? (
                  <QuickLookText key={payload.path} onEdit={handleEdit} payload={payload} />
                ) : payload.mediaType === "folder" ? (
                  <QuickLookFolder key={payload.path} payload={payload} />
                ) : payload.mediaType === "project" ? (
                  <QuickLookProject key={payload.path} onClose={handleClose} payload={payload} />
                ) : payload.mediaType === "playlist" ? (
                  <QuickLookPlaylist key={payload.path} payload={payload} />
                ) : (
                  <QuickLookFallback key={payload.path} onClose={handleClose} payload={payload} />
                )}
              </QuickLookErrorBoundary>
            </div>
          </>
        ) : (
          <div className="quicklook-empty">
            <Icon name="disc" />
            <span>Listo para previsualizar</span>
          </div>
        )}
      </div>
    </div>
  );
}
