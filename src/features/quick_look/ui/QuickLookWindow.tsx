import { listen } from "@tauri-apps/api/event";
import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";
import { quickLookClient } from "../tauri/client";
import { QuickLookHeader } from "./QuickLookHeader";
import { QuickLookImage } from "./QuickLookImage";
import { QuickLookMusic } from "./QuickLookMusic";
import { QuickLookVideo } from "./QuickLookVideo";
import "./quick-look.css";

export function QuickLookWindow() {
  const [payload, setPayload] = useState<QuickLookPayload | null>(null);
  const [paletteStyle, setPaletteStyle] = useState<CSSProperties | undefined>(undefined);

  useEffect(() => {
    // Cargar payload actual si existe
    quickLookClient.getCurrent().then((res) => {
      if (res) setPayload(res);
    }).catch(() => {});

    // Escuchar eventos de previsualización emitidos desde Rust
    const unlistenPreviewPromise = listen<QuickLookPayload>("quicklook://preview", (event) => {
      setPayload(event.payload);
    });

    // Escuchar eventos de ocultación
    const unlistenHidePromise = listen("quicklook://hide", () => {
      setPayload(null);
      setPaletteStyle(undefined);
    });

    return () => {
      unlistenPreviewPromise.then((unlisten) => unlisten());
      unlistenHidePromise.then((unlisten) => unlisten());
    };
  }, []);

  // Atajos locales de teclado (Esc para cerrar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void quickLookClient.hide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleOpenInMain = () => {
    if (!payload) return;
    void quickLookClient.openInMain(payload.path);
  };

  const handleClose = () => {
    void quickLookClient.hide();
  };

  return (
    <div className="quicklook-root">
      <div
        className={`quicklook-card ${paletteStyle ? "has-palette" : ""}`}
        style={paletteStyle}
      >
        {payload ? (
          <>
            <QuickLookHeader
              onClose={handleClose}
              onOpenInMain={handleOpenInMain}
              payload={payload}
            />

            <div className="quicklook-body">
              {payload.mediaType === "audio" ? (
                <QuickLookMusic
                  key={payload.path}
                  onPaletteChange={setPaletteStyle}
                  payload={payload}
                />
              ) : payload.mediaType === "image" ? (
                <QuickLookImage key={payload.path} payload={payload} />
              ) : payload.mediaType === "video" ? (
                <QuickLookVideo key={payload.path} payload={payload} />
              ) : null}
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
