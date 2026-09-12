import { useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
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
  // Prevenir que Windows Explorer muestre el cursor 🚫 ("no disponible / no soportado")
  // al arrastrar archivos o carpetas sobre la ventana de Prisma.
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, []);

  // Escucha nativa de soltado en las bibliotecas principales (Música, Imágenes, Vídeos)
  useEffect(() => {
    // Si la vista activa es una herramienta con receptor dedicado, no duplicar la acción
    if (activeView === "duplicates" || activeView === "renamer" || activeView === "converter") {
      return;
    }

    let unlistenPromise: Promise<() => void> | undefined;

    try {
      const appWindow = getCurrentWebviewWindow();
      unlistenPromise = appWindow.onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          const rawPaths = event.payload.paths;
          if (!rawPaths || rawPaths.length === 0) return;
          const firstPath = cleanPath(rawPaths[0]);

          if (activeView === "music") {
            void onAddMusicFolder(firstPath);
          } else if (activeView === "images") {
            void onAddImageFolder(firstPath);
          } else if (activeView === "videos") {
            void onAddVideoFolder(firstPath);
          }
        }
      });
    } catch (err) {
      console.warn("No se pudo iniciar listener de drop en App:", err);
    }

    return () => {
      if (unlistenPromise) {
        unlistenPromise.then((u) => u()).catch(() => {});
      }
    };
  }, [activeView, onAddMusicFolder, onAddImageFolder, onAddVideoFolder]);
}
