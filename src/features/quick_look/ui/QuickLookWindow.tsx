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
import { QuickLookFallback } from "./QuickLookFallback";
import "./quick-look.css";

export function QuickLookWindow() {
  useTheme();
  const [payload, setPayload] = useState<QuickLookPayload | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [paletteStyle, setPaletteStyle] = useState<CSSProperties | undefined>(undefined);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const refreshCurrent = () => {
      quickLookClient.getCurrent().then((res) => {
        if (res) {
          setPayload(res);
          setImageDimensions(null);
        }
      }).catch(() => {});
    };

    refreshCurrent();

    const startupIntervalId = window.setInterval(refreshCurrent, 200);
    const startupTimeoutId = window.setTimeout(() => {
      window.clearInterval(startupIntervalId);
    }, 1200);

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

    const unlistenWindowPreviewPromise = getCurrentWebviewWindow().listen<QuickLookPayload>(
      "quicklook://preview",
      (event) => {
        if (event.payload) {
          setPayload(event.payload);
          setImageDimensions(null);
        }
      }
    );

    const handleFocus = () => refreshCurrent();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshCurrent();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      unlistenGlobalPreviewPromise.then((unlisten) => unlisten());
      unlistenGlobalHidePromise.then((unlisten) => unlisten());
      unlistenWindowPreviewPromise.then((unlisten) => unlisten());
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // Atajos locales de teclado (Esc y Espacio para cerrar la vista previa)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.code === "Space" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
    void quickLookClient.openInMain(payload.path, playbackTimeRef.current);
  };

  const handleClose = () => {
    setPayload(null);
    setPaletteStyle(undefined);
    setIsMaximized(false);
    playbackTimeRef.current = 0;
    try {
      void getCurrentWebviewWindow().hide();
    } catch {}
    void quickLookClient.hide();
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
              onOpenInMain={handleOpenInMain}
              onToggleMaximize={handleToggleMaximize}
              payload={payload}
            />

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
