import { useEffect } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { cleanPath } from "../../shared/mediaTree";
import type { AppView } from "../ui/AppSidebar";

interface UseGlobalFileDropProps {
  activeView: AppView;
  onAddMusicFolder: (path: string) => void | Promise<void>;
  onAddImageFolder: (path: string) => void | Promise<void>;
  onAddVideoFolder: (path: string) => void | Promise<void>;
}

export function useGlobalFileDrop({
  activeView,
  onAddMusicFolder,
  onAddImageFolder,
  onAddVideoFolder,
}: UseGlobalFileDropProps) {
  // Prevenir rechazo de cursor (icono 🚫 de Windows) de forma global en cualquier vista
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragenter", handleDragEnter);
    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragenter", handleDragEnter);
    };
  }, []);

  // Escucha nativa de soltado en las bibliotecas principales (Música, Imágenes, Vídeos)
  useEffect(() => {
    // Si la vista activa es una herramienta con receptor dedicado, no duplicar la acción
    if (activeView === "duplicates" || activeView === "renamer" || activeView === "converter") {
      return;
    }

    const unlistens: UnlistenFn[] = [];
    let isCancelled = false;

    const handleDroppedPaths = (paths: string[]) => {
      if (!paths || paths.length === 0) return;
      const firstPath = cleanPath(paths[0]);

      if (activeView === "music") {
        void onAddMusicFolder(firstPath);
      } else if (activeView === "images") {
        void onAddImageFolder(firstPath);
      } else if (activeView === "videos") {
        void onAddVideoFolder(firstPath);
      }
    };

    // 1. Escucha directa mediante canal de eventos global de Tauri v2
    listen<{ paths?: string[] }>("tauri://drag-drop", (event) => {
      if (isCancelled) return;
      if (event.payload?.paths && event.payload.paths.length > 0) {
        handleDroppedPaths(event.payload.paths);
      }
    }).then((unlisten) => {
      if (isCancelled) unlisten();
      else unlistens.push(unlisten);
    }).catch(() => {});

    // 2. Escucha secundaria mediante API nativa de Webview en Tauri v2
    try {
      const webview = getCurrentWebview();
      webview.onDragDropEvent((event) => {
        if (isCancelled) return;
        if (event.payload.type === "drop" && event.payload.paths) {
          handleDroppedPaths(event.payload.paths);
        }
      }).then((unlisten) => {
        if (isCancelled) unlisten();
        else unlistens.push(unlisten);
      }).catch(() => {});
    } catch {
      // Ignorar si el contexto no es webview
    }

    return () => {
      isCancelled = true;
      for (const u of unlistens) {
        try {
          u();
        } catch {}
      }
    };
  }, [activeView, onAddMusicFolder, onAddImageFolder, onAddVideoFolder]);
}

