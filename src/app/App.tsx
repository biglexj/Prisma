import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTheme } from "./useTheme";
import "../features/music_library/ui/music-library.css";
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

const VIEW_TITLES: Record<AppView, string> = {
  home: "Inicio",
  player: "Escuchar",
  music: "Música",
  video_player: "Vídeo",
  folders: "Carpetas",
  images: "Imágenes",
  videos: "Vídeos",
  settings: "Configuración",
};

export function App() {
  const [activeView, setActiveView] = useState<AppView>("home");
  const [activeVideoPath, setActiveVideoPath] = useState<string | null>(null);
  const [activeVideoSessionItems, setActiveVideoSessionItems] = useState<VisualLibraryItem[]>([]);
  const { theme, setTheme } = useTheme();
  const playback = usePlaybackController();
  const library = useMusicLibrary();
  const imageLibrary = useVisualLibrary("image");
  const videoLibrary = useVisualLibrary("video");

  const playMusicItem = (path: string) => {
    setActiveView("player");
    const foundIdx = library.items.findIndex((it) => it.path === path);
    if (foundIdx >= 0) {
      const queueItems = library.items.map((it) => ({
        id: it.path,
        path: it.path,
        title: it.title,
        artist: it.relativeFolder,
        folder: it.relativeFolder,
        sizeBytes: it.sizeBytes,
      }));
      playback.playQueue(queueItems, foundIdx, "Música");
    } else {
      void playback.loadPath(path);
    }
  };

  const playVideoItem = (path: string, sessionItems?: VisualLibraryItem[]) => {
    if (!playback.snapshot.paused) {
      void playback.toggle();
    }
    setActiveVideoPath(path);
    setActiveVideoSessionItems(sessionItems && sessionItems.length > 0 ? sessionItems : videoLibrary.items);
    setActiveView("video_player");
  };

  useEffect(() => {
    invoke<string | null>("get_initial_file")
      .then((filePath) => {
        if (!filePath) return;
        const lower = filePath.toLowerCase();
        const isAudio = /\.(mp3|flac|wav|aac|m4a|ogg|opus|wma|m3u|m3u8)$/.test(lower);
        const isVideo = /\.(mp4|mkv|avi|mov|webm|flv|wmv|m4v)$/.test(lower);
        if (isAudio) {
          playMusicItem(filePath);
        } else if (isVideo) {
          playVideoItem(filePath);
        } else {
          setActiveView("images");
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="studio-shell">
      <AppSidebar
        activeView={activeView}
        backend={playback.capabilities?.backend ?? "Conectando…"}
        enabled={playback.enabled}
        onNavigate={setActiveView}
      />

      <div className="studio-workspace">
        <header className="workspace-header">
          <div><span className="workspace-kicker">PRISMA</span><strong>{VIEW_TITLES[activeView]}</strong></div>
          <span className={`connection-pill ${playback.enabled ? "is-ready" : ""}`}>
            <i /> {playback.enabled ? "Motor listo" : "Comprobando motor"}
          </span>
        </header>

        <main className="studio-content">
          {activeView === "home" ? (
            <HomeDashboard
              musicFolders={library.folders}
              musicItems={library.items}
              imageFolders={imageLibrary.folders}
              images={imageLibrary.items}
              videoFolders={videoLibrary.folders}
              videos={videoLibrary.items}
              loading={library.loading || imageLibrary.loading || videoLibrary.loading}
              error={library.error ?? imageLibrary.error ?? videoLibrary.error}
              onOpenFolders={() => setActiveView("folders")}
              onOpenImages={() => setActiveView("images")}
              onOpenVideos={() => setActiveView("videos")}
              onPlayMusic={playMusicItem}
              onPlayVideo={playVideoItem}
            />
          ) : null}

          {activeView === "folders" ? (
            <LibrarySources
              music={library}
              images={imageLibrary}
              videos={videoLibrary}
              onPlay={playMusicItem}
            />
          ) : null}

          {activeView === "music" ? (
            <MusicLibrary
              folders={library.folders}
              items={library.items}
              loading={library.loading}
              error={library.error}
              onAdd={library.addFolder}
              onPlay={playMusicItem}
              onPlayQueue={(items, idx, name) => {
                setActiveView("player");
                playback.playQueue(items, idx, name);
              }}
              onAddToQueue={(items) => playback.queue.addToQueue(items)}
              onOpenFolders={() => setActiveView("folders")}
            />
          ) : null}

          {activeView === "images" ? (
            <VisualLibrary
              kind="image"
              folders={imageLibrary.folders}
              items={imageLibrary.items}
              loading={imageLibrary.loading}
              error={imageLibrary.error}
              onAdd={imageLibrary.addFolder}
              onOpenVideo={playVideoItem}
              onOpenFolders={() => setActiveView("folders")}
            />
          ) : null}

          {activeView === "videos" ? (
            <VisualLibrary
              kind="video"
              folders={videoLibrary.folders}
              items={videoLibrary.items}
              loading={videoLibrary.loading}
              error={videoLibrary.error}
              onAdd={videoLibrary.addFolder}
              onOpenVideo={playVideoItem}
              onOpenFolders={() => setActiveView("folders")}
            />
          ) : null}

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
                capabilities={playback.capabilities}
                snapshot={playback.snapshot}
                busy={playback.busy}
                enabled={playback.enabled}
                queueState={playback.queue}
                onOpen={() => void playback.chooseFile()}
                onPrevious={() => void playback.previous()}
                onToggle={() => void playback.toggle()}
                onNext={() => void playback.next()}
                onSeek={(seconds) => void playback.seek(seconds)}
                onVolume={(volume) => void playback.setVolume(volume)}
                onSelectQueueIndex={playback.playQueueAt}
              />
            </>
          ) : null}

          {activeView === "video_player" ? (
            <VideoPlayer
              onBack={() => setActiveView("videos")}
              onSelectVideo={(path) => setActiveVideoPath(path)}
              path={activeVideoPath}
              videoItems={activeVideoSessionItems.length > 0 ? activeVideoSessionItems : videoLibrary.items}
            />
          ) : null}

          {activeView === "settings" ? (
            <AppSettings
              images={imageLibrary}
              music={library}
              onPlay={playMusicItem}
              videos={videoLibrary}
              theme={theme}
              onThemeChange={setTheme}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
