import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState, useRef, type CSSProperties } from "react";
import { useTheme } from "../../../app/useTheme";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";
import { quickLookClient } from "../tauri/client";
import { QuickLookHeader } from "./QuickLookHeader";
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
import { ImageComparisonModal } from "../../visual_library/ui/comparison/ImageComparisonModal";
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

  useEffect(() => {
    let resolved = false;
    const refreshCurrent = () => {
      const request = isDetached
        ? quickLookClient.getDetachedPayload(windowLabel)
        : quickLookClient.getCurrent();
      request.then((res) => {
        if (res) {
          resolved = true;
          setPayload(res);
          setImageDimensions(null);
        }
      }).catch(() => {});
    };

    refreshCurrent();

    // La ventana principal ya está cargada (oculta) y solo necesita un refresco
    // breve. Las instancias desacopladas se crean en frío, así que consultan su
    // payload hasta recibirlo (máx. 10 s) por si el montaje tarda más que el emit.
    const startupIntervalId = window.setInterval(() => {
      if (isDetached && resolved) {
        window.clearInterval(startupIntervalId);
        return;
      }
      refreshCurrent();
    }, 200);
    const startupTimeoutId = window.setTimeout(() => {
      window.clearInterval(startupIntervalId);
    }, isDetached ? 10000 : 1200);

    const cleanupFns: (() => void)[] = [];

    // Las instancias desacopladas no reaccionan a los eventos globales del
    // Quick Look principal: conservan su propio archivo para poder comparar.
    if (!isDetached) {
      const unlistenGlobalPreviewPromise = listen<QuickLookPayload>("quicklook://preview", (event) => {
        if (event.payload) {
          setPayload(event.payload);
          setImageDimensions(null);
        }
      });

      const unlistenGlobalHidePromise = listen("quicklook://hide", () => {
        setPayload(null);
        setImageDimensions(null);
        setPaletteStyle(undefined);
      });

      cleanupFns.push(() => {
        unlistenGlobalPreviewPromise.then((unlisten) => unlisten());
        unlistenGlobalHidePromise.then((unlisten) => unlisten());
      });
    }

    const unlistenWindowPreviewPromise = getCurrentWebviewWindow().listen<QuickLookPayload>(
      "quicklook://preview",
      (event) => {
        if (event.payload) {
          setPayload(event.payload);
          setImageDimensions(null);
        }
      }
    );
    cleanupFns.push(() => {
      unlistenWindowPreviewPromise.then((unlisten) => unlisten());
    });

    const handleFocus = () => refreshCurrent();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshCurrent();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cleanupFns.forEach((fn) => fn());
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isDetached, windowLabel]);

  // Atajos locales de teclado (Esc cierra siempre; Espacio solo la vista previa principal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isComparing) return;
      const isCloseKey =
        e.key === "Escape" || (!isDetached && (e.code === "Space" || e.key === " "));
      if (isCloseKey) {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
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
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "PageUp",
          "PageDown",
          "Home",
          "End",
        ].includes(e.key)
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDetached, isComparing, payload]);

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

  const handleOpenDetached = () => {
    if (!payload) return;
    void quickLookClient.openDetached(payload.path).catch(() => {});
  };

  const handleClose = () => {
    playbackTimeRef.current = 0;
    if (isDetached) {
      void quickLookClient.closeWindow().catch(() => {
        void getCurrentWebviewWindow().close().catch(() => {});
      });
      return;
    }
    setPayload(null);
    setPaletteStyle(undefined);
    setIsMaximized(false);
    void quickLookClient.hide().catch(() => {
      void getCurrentWebviewWindow().hide().catch(() => {});
    });
  };

  return (
    <div className="quicklook-root">
      <div
        className={`quicklook-card ${paletteStyle ? "has-palette" : ""} ${isMaximized ? "is-maximized" : ""}`}
        style={paletteStyle}
      >
        {payload ? (
          <>
            <QuickLookHeader
              imageDimensions={imageDimensions}
              isMaximized={isMaximized}
              onClose={handleClose}
              onCompare={() => setIsComparing(true)}
              onOpenDetached={handleOpenDetached}
              onOpenInMain={handleOpenInMain}
              onStepSelection={(forward) => void quickLookClient.stepSelection(forward)}
              onToggleMaximize={handleToggleMaximize}
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
                onClose={() => setIsComparing(false)}
              />
            )}

            <div className="quicklook-body">
              {payload.mediaType === "audio" ? (
                <QuickLookMusic
                  key={payload.path}
                  onPaletteChange={setPaletteStyle}
                  onTimeUpdate={(t) => {
                    playbackTimeRef.current = t;
                  }}
                  payload={payload}
                />
              ) : payload.mediaType === "image" ? (
                <QuickLookImage
                  key={payload.path}
                  onDimensionsLoad={setImageDimensions}
                  payload={payload}
                />
              ) : payload.mediaType === "video" ? (
                <QuickLookVideo
                  key={payload.path}
                  onDimensionsLoad={setImageDimensions}
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
                <QuickLookMarkdown key={payload.path} payload={payload} />
              ) : payload.mediaType === "text" ? (
                <QuickLookText key={payload.path} payload={payload} />
              ) : payload.mediaType === "folder" ? (
                <QuickLookFolder key={payload.path} payload={payload} />
              ) : payload.mediaType === "project" ? (
                <QuickLookProject key={payload.path} onClose={handleClose} payload={payload} />
              ) : payload.mediaType === "playlist" ? (
                <QuickLookPlaylist key={payload.path} payload={payload} />
              ) : (
                <QuickLookFallback key={payload.path} onClose={handleClose} payload={payload} />
              )}
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
