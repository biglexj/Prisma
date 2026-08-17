import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useTheme } from "./useTheme";
import { useSystemSettings } from "./useSystemSettings";

import { HomeDashboard } from "../features/home/ui/HomeDashboard";
import { useMusicLibrary } from "../features/music_library/useMusicLibrary";
import { usePlaybackController } from "../features/playback/usePlaybackController";
import { PlaybackPreview } from "../features/playback/ui/components/PlaybackPreview";
import { MusicLibrary } from "../features/music_library/ui/MusicLibrary";
import { VisualLibrary } from "../features/visual_library/ui/VisualLibrary";
import { VideoPlayer } from "../features/visual_library/ui/VideoPlayer";
import { useVisualLibrary } from "../features/visual_library/useVisualLibrary";
import type { VisualLibraryItem } from "../features/visual_library/model/types";
import { AppSettings } from "./ui/AppSettings";
import { AppSidebar, type AppView } from "./ui/AppSidebar";
import { LibrarySources } from "./ui/LibrarySources";
import { parseTrackInfo } from "../features/music_library/model/trackInfo";
import { FavoritesView } from "../features/collections/ui/FavoritesView";
import { HistoryView } from "../features/collections/ui/HistoryView";
import { PlaylistsView } from "../features/collections/ui/PlaylistsView";
import { AboutView } from "./ui/AboutView";
import { SynapseToast, type SynapseReceivedFile } from "./ui/SynapseToast";
import { addToHistory } from "../shared/useHistory";
import { CustomLibraryView } from "../features/custom_libraries/ui/CustomLibraryView";
import { useCustomLibraries } from "../features/custom_libraries/hooks/useCustomLibraries";
import "../features/music_library/ui/music-library.css";
import "../features/visual_library/ui/visual-library.css";
import "../features/visual_library/ui/video-player.css";

const VIEW_TITLES: Record<AppView, string> = {
  home: "Inicio",
  player: "Escuchar",
  music: "Música",
  video_player: "Vídeo",
  folders: "Carpetas",
  images: "Imágenes",
  videos: "Vídeos",
  settings: "Configuración",
  about: "Acerca de",
  favorites: "Favoritos",
  history: "Historial",
  playlists: "Listas de reproducción",
};

export function App() {
  const [activeView, setActiveView] = useState<AppView>("home");
  const [activeVideoPath, setActiveVideoPath] = useState<string | null>(null);
  const [activeVideoInitialTime, setActiveVideoInitialTime] = useState<number | undefined>(undefined);
  const [activeVideoSessionItems, setActiveVideoSessionItems] = useState<VisualLibraryItem[]>([]);
  const [videoReturnView, setVideoReturnView] = useState<AppView>("videos");
  const [activeInitialImagePath, setActiveInitialImagePath] = useState<string | null>(null);
  const [isPip, setIsPip] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [synapseToastFile, setSynapseToastFile] = useState<SynapseReceivedFile | null>(null);
  const { theme, setTheme } = useTheme();
  const { confirmDeletion } = useSystemSettings();
  const playback = usePlaybackController();
  const library = useMusicLibrary();
  const imageLibrary = useVisualLibrary("image");
  const videoLibrary = useVisualLibrary("video");
  const { libraries: customLibrariesList } = useCustomLibraries();

  const playMusicItem = useCallback((path: string, navigate = true, initialTime?: number) => {
    addToHistory(path, "music");

    // Detener y limpiar cualquier vídeo previo activo para evitar audio simultáneo
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => {});
    }
    setActiveVideoPath(null);
    setActiveVideoSessionItems([]);
    setIsPip(false);

    if (navigate) {
      setActiveView("player");
    }
    const foundIdx = library.items.findIndex((it) => it.path === path);
    if (foundIdx >= 0) {
      const queueItems = library.items.map((it) => {
        const { title, artist } = parseTrackInfo(it.title);
        return {
          id: it.path,
          path: it.path,
          title,
          artist: artist || null,
          folder: it.relativeFolder,
          sizeBytes: it.sizeBytes,
        };
      });
      playback.playQueue(queueItems, foundIdx, "Árbol de Música");
    } else {
      void playback.loadPath(path);
    }

    if (initialTime && initialTime > 0) {
      setTimeout(() => {
        void playback.seek(initialTime);
      }, 350);
    }
  }, [library.items, playback]);

  const playVideoItem = useCallback((path: string, sessionItems?: VisualLibraryItem[], initialTime?: number) => {
    addToHistory(path, "video");
    if (!playback.snapshot.paused) {
      void playback.toggle();
    }
    setActiveVideoInitialTime(initialTime);
    setVideoReturnView(activeView);
    setActiveVideoPath(path);
    const itemsToUse = sessionItems && sessionItems.length > 0 ? sessionItems : videoLibrary.items;
    const hasPath = itemsToUse.some((it) => it.path === path);
    if (!hasPath) {
      const fileName = path.replace(/\\/g, "/").split("/").pop() || "Vídeo";
      setActiveVideoSessionItems([
        {
          path,
          title: fileName,
          sourcePath: "",
          relativeFolder: "",
          kind: "video" as const,
          modifiedAtMillis: Date.now(),
          sizeBytes: 0,
        },
        ...itemsToUse,
      ]);
    } else {
      setActiveVideoSessionItems(itemsToUse);
    }
    
    // Si ya estamos en PiP, mantenerse en la vista actual (ej. galería) y reemplazar el vídeo en la ventana flotante.
    // Si no estamos en PiP, navegar a la pantalla completa del reproductor.
    if (!isPip) {
      setActiveView("video_player");
    }
  }, [activeView, isPip, playback, videoLibrary.items]);

  const handleOpenFile = useCallback((filePath: string, initialTime?: number) => {
    const lower = filePath.toLowerCase();
    const isAudio = /\.(mp3|flac|wav|aac|m4a|ogg|opus|wma|m3u|m3u8)$/.test(lower);
    const isVideo = /\.(mp4|mkv|avi|mov|webm|flv|wmv|m4v)$/.test(lower);
    const isImage = /\.(png|jpe?g|webp|gif|bmp|ico|svg|avif|tiff?)$/.test(lower);
    const isDocumentOrProject = /\.(pdf|md|markdown|epub|mobi|cbz|cbr|kra|krz|ora|af|afphoto|afdesign|afpub|psd|psb|ai|blend|drp)$/.test(lower);

    if (isAudio) {
      if (document.pictureInPictureElement) {
        void document.exitPictureInPicture().catch(() => {});
      }
      setActiveVideoPath(null);
      setActiveVideoSessionItems([]);
      setIsPip(false);
      setActiveInitialImagePath(null);
      playMusicItem(filePath, true, initialTime);
    } else if (isVideo) {
      if (!playback.snapshot.paused) {
        void playback.toggle();
      }
      setActiveInitialImagePath(null);
      playVideoItem(filePath, undefined, initialTime);
    } else if (isImage) {
      if (document.pictureInPictureElement) {
        void document.exitPictureInPicture().catch(() => {});
      }
      setActiveVideoPath(null);
      setActiveVideoSessionItems([]);
      setIsPip(false);
      setActiveInitialImagePath(filePath);
      setActiveView("images");
    } else if (isDocumentOrProject) {
      void invoke("quick_look_show_file", { path: filePath }).catch(() => {});
    } else {
      if (document.pictureInPictureElement) {
        void document.exitPictureInPicture().catch(() => {});
      }
      setActiveVideoPath(null);
      setActiveVideoSessionItems([]);
      setIsPip(false);
      setActiveInitialImagePath(filePath);
      setActiveView("images");
    }
  }, [playback, playMusicItem, playVideoItem]);

  /**
   * Gestiona el ciclo de vida de Picture-in-Picture desde App:
   * - Al activar PiP: muestra la vista de origen (ej. galería) para que el usuario explore la biblioteca.
   * - Al salir de PiP por 'Volver a la pestaña' o botón PiP: retorna a pantalla completa ("video_player").
   * - Al salir de PiP por la '✕' (Cerrar): limpia la sesión activa y se queda en la galería ("muere ahí").
   */
  const handlePipChange = (active: boolean, reason?: "restore" | "close") => {
    setIsPip(active);
    if (active) {
      // Entró a PiP: llevar a la vista donde estaba el usuario (ej. galería)
      setActiveView(videoReturnView);
    } else {
      if (reason === "close") {
        // El usuario pulsó la '✕': cerrar el PiP y morir ahí (quedarse en la galería sin abrir la pantalla completa)
        setActiveVideoPath(null);
        setActiveVideoSessionItems([]);
      } else {
        // El usuario pulsó 'Volver a la pestaña' o toggle PiP: restaurar siempre el reproductor a pantalla completa y traer al frente
        setActiveView("video_player");
        try {
          const win = getCurrentWebviewWindow();
          void win.unminimize().catch(() => {});
          void win.show().catch(() => {});
          void win.setFocus().catch(() => {});
          // Solicitar atención y asegurar foco de ventana nativa de Windows
          void win.requestUserAttention(1).catch(() => {});
        } catch {}
        if (typeof window !== "undefined") {
          window.focus();
        }
      }
    }
  };

  useEffect(() => {
    invoke<string | null>("get_initial_file")
      .then((filePath) => {
        if (filePath) handleOpenFile(filePath);
      })
      .catch(() => {});

    const unlistenPromise = listen<string | { path: string; currentTime?: number }>("prisma://open-media", (event) => {
      if (event.payload) {
        if (typeof event.payload === "string") {
          handleOpenFile(event.payload);
        } else if (typeof event.payload === "object" && event.payload.path) {
          handleOpenFile(event.payload.path, event.payload.currentTime);
        }
      }
    });

    const unlistenFileReceivedPromise = listen<SynapseReceivedFile>("prisma://file-received", (event) => {
      if (event.payload) {
        setSynapseToastFile(event.payload);
        library.refresh();
        imageLibrary.refresh();
        videoLibrary.refresh();
      }
    });

    const unlistenNavigatePromise = listen<string>("prisma://navigate", (event) => {
      if (event.payload && event.payload in VIEW_TITLES) {
        setActiveView(event.payload as AppView);
      }
    });

    const unlistenRemotePromise = listen<{ command: string; value?: number }>("prisma://remote-command", (event) => {
      const { command, value } = event.payload || {};
      const videoEl = document.querySelector<HTMLVideoElement>("video.video-player-media, video");

      switch (command) {
        case "play_pause": {
          if (activeView === "video_player") {
            window.dispatchEvent(new CustomEvent("prisma-video-toggle-play"));
          } else {
            void playback.toggle();
          }
          break;
        }
        case "seek_backward": {
          if (activeView === "video_player") {
            window.dispatchEvent(new CustomEvent("prisma-video-seek", { detail: { delta: -10 } }));
          } else {
            const current = playback.snapshot.positionSeconds ?? 0;
            void playback.seek(Math.max(0, current - 10));
          }
          break;
        }
        case "seek_forward": {
          if (activeView === "video_player") {
            window.dispatchEvent(new CustomEvent("prisma-video-seek", { detail: { delta: 10 } }));
          } else {
            const current = playback.snapshot.positionSeconds ?? 0;
            void playback.seek(current + 10);
          }
          break;
        }
        case "previous": {
          window.dispatchEvent(new CustomEvent("prisma-video-prev"));
          window.dispatchEvent(new CustomEvent("prisma-gallery-prev"));
          if (activeView !== "video_player" && activeView !== "images") {
            playback.previous();
          }
          break;
        }
        case "next": {
          window.dispatchEvent(new CustomEvent("prisma-video-next"));
          window.dispatchEvent(new CustomEvent("prisma-gallery-next"));
          if (activeView !== "video_player" && activeView !== "images") {
            playback.next();
          }
          break;
        }
        case "shuffle": {
          if (activeView === "video_player") {
            window.dispatchEvent(new CustomEvent("prisma-video-shuffle"));
          } else {
            window.dispatchEvent(new CustomEvent("prisma-playback-shuffle"));
          }
          break;
        }
        case "volume_up": {
          if (activeView === "video_player") {
            window.dispatchEvent(new CustomEvent("prisma-video-volume", { detail: { delta: 5 } }));
          } else {
            const currentVol = playback.snapshot.volume ?? 70;
            void playback.setVolume(Math.min(100, currentVol + 5));
          }
          break;
        }
        case "volume_down": {
          if (activeView === "video_player") {
            window.dispatchEvent(new CustomEvent("prisma-video-volume", { detail: { delta: -5 } }));
          } else {
            const currentVol = playback.snapshot.volume ?? 70;
            void playback.setVolume(Math.max(0, currentVol - 5));
          }
          break;
        }
        case "toggle_mute": {
          if (activeView === "video_player") {
            window.dispatchEvent(new CustomEvent("prisma-video-mute"));
          } else {
            const currentVol = playback.snapshot.volume ?? 70;
            if (currentVol > 0) {
              void playback.setVolume(0);
            } else {
              void playback.setVolume(70);
            }
          }
          break;
        }
        case "toggle_subtitles": {
          window.dispatchEvent(new CustomEvent("prisma-video-toggle-subtitles"));
          break;
        }
        case "toggle_audio_track": {
          window.dispatchEvent(new CustomEvent("prisma-video-toggle-audio-track"));
          break;
        }
        case "fullscreen": {
          if (activeView === "video_player") {
            window.dispatchEvent(new CustomEvent("prisma-video-fullscreen"));
          } else if (activeView === "images") {
            window.dispatchEvent(new CustomEvent("prisma-gallery-fullscreen"));
          } else if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {});
          } else {
            void document.documentElement.requestFullscreen().catch(() => {});
          }
          break;
        }
        case "escape": {
          window.dispatchEvent(new CustomEvent("prisma-gallery-escape"));
          if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {});
          } else if (activeView === "video_player") {
            setActiveView(videoReturnView);
          }
          break;
        }
        case "quick_look": {
          void invoke("quick_look_toggle").catch(() => {});
          break;
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
      unlistenFileReceivedPromise.then((unlisten) => unlisten());
      unlistenNavigatePromise.then((unlisten) => unlisten());
      unlistenRemotePromise.then((unlisten) => unlisten());
    };
  }, [handleOpenFile, library, imageLibrary, videoLibrary, activeView, playback, videoReturnView]);

  // Coordinación de reproducción entre QuickLook y la aplicación principal
  const wasPlayingBeforeQuickLookRef = useRef<boolean>(false);
  const wasVideoPlayingBeforeQuickLookRef = useRef<boolean>(false);

  useEffect(() => {
    const unlistenPreviewPromise = listen("quicklook://preview", () => {
      // Si la música de Prisma estaba reproduciéndose, pausarla y recordar estado
      if (!playback.snapshot.paused && playback.snapshot.path) {
        wasPlayingBeforeQuickLookRef.current = true;
        void playback.toggle();
      }

      // Si el reproductor de vídeo de Prisma está activo y reproduciéndose, pausarlo
      const videoEl = document.querySelector<HTMLVideoElement>("video.video-player-media, video");
      if (videoEl && !videoEl.paused) {
        wasVideoPlayingBeforeQuickLookRef.current = true;
        videoEl.pause();
      }
    });

    const unlistenHidePromise = listen("quicklook://hide", () => {
      // Al cerrar QuickLook, si la música de Prisma estaba sonando antes, reanudarla
      if (wasPlayingBeforeQuickLookRef.current) {
        wasPlayingBeforeQuickLookRef.current = false;
        if (playback.snapshot.paused && playback.snapshot.path) {
          void playback.toggle();
        }
      }

      // Al cerrar QuickLook, si el vídeo de Prisma estaba sonando antes, reanudarlo
      if (wasVideoPlayingBeforeQuickLookRef.current) {
        wasVideoPlayingBeforeQuickLookRef.current = false;
        const videoEl = document.querySelector<HTMLVideoElement>("video.video-player-media, video");
        if (videoEl && videoEl.paused) {
          void videoEl.play().catch(() => {});
        }
      }
    });

    return () => {
      unlistenPreviewPromise.then((u) => u());
      unlistenHidePromise.then((u) => u());
    };
  }, [playback.snapshot.paused, playback.snapshot.path, playback.toggle]);

  return (
    <div className={`studio-shell ${activeView === "video_player" ? "is-cinema-mode" : ""}`}>
      {activeView !== "video_player" ? (
        <AppSidebar
          activeView={activeView}
          backend={playback.capabilities?.backend ?? "Conectando…"}
          enabled={playback.enabled}
          onNavigate={(view) => {
            setActiveView(view);
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      ) : null}

      <div className="studio-workspace">
        {activeView !== "video_player" ? (
          <header className="workspace-header">
            <div>
              <span className="workspace-kicker">PRISMA</span>
              <strong>
                {VIEW_TITLES[activeView] ||
                  (activeView.startsWith("custom_")
                    ? customLibrariesList.find((l) => l.id === activeView.replace("custom_", ""))?.label ?? ""
                    : "")}
              </strong>
            </div>
            <span className={`connection-pill ${playback.enabled ? "is-ready" : ""}`}>
              <i /> {playback.enabled ? "Motor listo" : "Comprobando motor"}
            </span>
          </header>
        ) : null}

        <main className={`studio-content ${activeView === "video_player" ? "is-cinema-mode" : ""}`}>
          {activeView === "home" ? (
            <HomeDashboard
              error={library.error ?? imageLibrary.error ?? videoLibrary.error}
              imageFolders={imageLibrary.folders}
              images={imageLibrary.items}
              loading={library.loading || imageLibrary.loading || videoLibrary.loading}
              musicFolders={library.folders}
              musicItems={library.items}
              onOpenFolders={() => setActiveView("folders")}
              onOpenImages={() => setActiveView("images")}
              onOpenVideos={() => setActiveView("videos")}
              onOpenPlaylists={() => setActiveView("playlists")}
              onPlayMusic={(path) => playMusicItem(path, false)}
              onPlayVideo={playVideoItem}
              onPlayPlaylist={(path) => {
                addToHistory(path, "playlist");
                setActiveView("playlists");
              }}
              videoFolders={videoLibrary.folders}
              videos={videoLibrary.items}
              confirmDeletion={confirmDeletion}
              onRefreshImages={() => imageLibrary.refresh()}
            />
          ) : null}

          {activeView === "folders" ? (
            <LibrarySources
              images={imageLibrary}
              music={library}
              onPlay={playMusicItem}
              videos={videoLibrary}
            />
          ) : null}

          {activeView === "music" ? (
            <MusicLibrary
              error={library.error}
              folders={library.folders}
              items={library.items}
              loading={library.loading}
              currentPlayingPath={playback.snapshot.path}
              isPlaying={!playback.snapshot.paused}
              onAdd={library.addFolder}
              onAddToQueue={(items) => playback.queue.addToQueue(items)}
              onOpenFolders={() => setActiveView("folders")}
              onPlay={playMusicItem}
              onPlayQueue={(items, idx, name) => {
                setActiveView("player");
                playback.playQueue(items, idx, name);
              }}
              onPlayFolder={(folderName, items, idx) => {
                setActiveView("player");
                playback.playFolder(folderName, items, idx);
              }}
              confirmDeletion={confirmDeletion}
              onRefresh={() => library.refresh()}
              searchQuery={searchQuery}
            />
          ) : null}

          {activeView === "images" ? (
            <VisualLibrary
              error={imageLibrary.error}
              folders={imageLibrary.folders}
              initialSelectedImagePath={activeInitialImagePath}
              items={imageLibrary.items}
              kind="image"
              loading={imageLibrary.loading}
              onAdd={imageLibrary.addFolder}
              onClearInitialSelectedImage={() => setActiveInitialImagePath(null)}
              onOpenFolders={() => setActiveView("folders")}
              onOpenVideo={playVideoItem}
              confirmDeletion={confirmDeletion}
              onRefresh={() => imageLibrary.refresh()}
              searchQuery={searchQuery}
            />
          ) : null}

          {activeView === "videos" ? (
            <VisualLibrary
              error={videoLibrary.error}
              folders={videoLibrary.folders}
              items={videoLibrary.items}
              kind="video"
              loading={videoLibrary.loading}
              onAdd={videoLibrary.addFolder}
              onOpenFolders={() => setActiveView("folders")}
              onOpenVideo={playVideoItem}
              confirmDeletion={confirmDeletion}
              onRefresh={() => videoLibrary.refresh()}
              searchQuery={searchQuery}
            />
          ) : null}

          {activeView.startsWith("custom_") ? (() => {
            const customId = activeView.replace("custom_", "");
            const def = customLibrariesList.find((l) => l.id === customId);
            if (!def) return null;
            return (
              <CustomLibraryView
                confirmDeletion={confirmDeletion}
                definition={def}
                key={def.id}
                onOpenFolders={() => setActiveView("folders")}
                searchQuery={searchQuery}
              />
            );
          })() : null}

          {activeView === "player" ? (
            <>
              {playback.error ? (
                <div className="error-banner" role="alert">
                  <strong>No se pudo completar la acción</strong><span>{playback.error}</span>
                </div>
              ) : null}
              {!playback.enabled && playback.capabilities?.reason ? (
                <div className="error-banner" role="status">
                  <strong>Backend multimedia no disponible</strong><span>{playback.capabilities.reason}</span>
                </div>
              ) : null}
              <PlaybackPreview
                busy={playback.busy}
                capabilities={playback.capabilities}
                enabled={playback.enabled}
                onNext={() => void playback.next()}
                onOpen={() => void playback.chooseFile()}
                onPrevious={() => void playback.previous()}
                onSeek={(seconds) => void playback.seek(seconds)}
                onSelectQueueIndex={playback.playQueueAt}
                onSwitchQueue={playback.switchQueueAndPlay}
                onToggle={() => void playback.toggle()}
                onVolume={(volume) => void playback.setVolume(volume)}
                queueState={playback.queue}
                snapshot={playback.snapshot}
              />
            </>
          ) : null}

          {/*
            VideoPlayer se mantiene montado mientras haya un vídeo activo (incluido modo PiP).
            En modo PiP se mantiene fuera del flujo visual (con position fixed / off-screen)
            para que el elemento <video> siga vivo en el compositor de Chromium sin interrupciones.
          */}
          {activeVideoPath ? (
            <div
              style={
                activeView === "video_player"
                  ? { display: "contents" }
                  : {
                      position: "fixed",
                      top: "-9999px",
                      left: "-9999px",
                      width: "1px",
                      height: "1px",
                      opacity: 0,
                      pointerEvents: "none",
                      zIndex: -1,
                    }
              }
            >
              <VideoPlayer
                confirmDeletion={confirmDeletion}
                initialTime={activeVideoInitialTime}
                onBack={() => {
                  // Limpiar sesión completamente al volver (Esc): desmonta el <video> y detiene el audio
                  setIsPip(false);
                  setActiveVideoPath(null);
                  setActiveVideoInitialTime(undefined);
                  setActiveVideoSessionItems([]);
                  setActiveView(videoReturnView);
                }}
                onPipChange={handlePipChange}
                onRefresh={() => videoLibrary.refresh()}
                onSelectVideo={(path) => {
                  setActiveVideoPath(path);
                  setActiveVideoInitialTime(undefined);
                }}
                path={activeVideoPath}
                videoItems={activeVideoSessionItems.length > 0 ? activeVideoSessionItems : videoLibrary.items}
              />
            </div>
          ) : null}

          {activeView === "settings" ? (
            <AppSettings
              images={imageLibrary}
              music={library}
              onPlay={playMusicItem}
              onThemeChange={setTheme}
              theme={theme}
              videos={videoLibrary}
            />
          ) : null}

          {activeView === "about" ? (
            <AboutView />
          ) : null}

          {activeView === "favorites" ? (
            <FavoritesView
              images={imageLibrary.items}
              musicItems={library.items}
              onOpenImage={(path) => {
                setActiveInitialImagePath(path);
                setActiveView("images");
              }}
              onPlayMusic={playMusicItem}
              onPlayVideo={playVideoItem}
              videos={videoLibrary.items}
            />
          ) : null}

          {activeView === "history" ? (
            <HistoryView
              images={imageLibrary.items}
              musicItems={library.items}
              onOpenImage={(path) => {
                setActiveInitialImagePath(path);
                setActiveView("images");
              }}
              onPlayMusic={playMusicItem}
              onPlayVideo={playVideoItem}
              videos={videoLibrary.items}
            />
          ) : null}
          {activeView === "playlists" ? (
            <PlaylistsView
              onPlayMusic={playMusicItem}
              onPlayQueue={(items, idx, name) => {
                setActiveView("player");
                playback.playQueue(items, idx, name);
              }}
              onPlayVideo={playVideoItem}
            />
          ) : null}
        </main>
      </div>

      <SynapseToast
        file={synapseToastFile}
        onClose={() => setSynapseToastFile(null)}
        onOpenFile={handleOpenFile}
      />
    </div>
  );
}

