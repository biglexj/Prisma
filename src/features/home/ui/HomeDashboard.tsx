import { useState, useMemo } from "react";
import type { MusicFolderSource, MusicLibraryItem } from "../../music_library/model/types";
import { MusicArtwork } from "../../music_library/ui/MusicArtwork";
import { resolveLibraryTrackInfo } from "../../music_library/model/trackInfo";
import type { VisualFolderSource, VisualLibraryItem } from "../../visual_library/model/types";
import { VisualThumbnail } from "../../visual_library/ui/VisualThumbnail";
import { VideoThumbnail } from "../../visual_library/ui/VideoThumbnail";
import { ImageViewer } from "../../visual_library/ui/ImageViewer";
import { Icon } from "../../../shared/ui/Icon";
import { cleanPath } from "../../../shared/mediaTree";
import { useScrollRestoration } from "../../../shared/useScrollRestoration";
import { useHistory, type HistoryCategory } from "../../../shared/useHistory";
import { usePlaylists } from "../../collections/usePlaylists";
import type { PlaylistMeta } from "../../collections/model/types";
import "./home-dashboard.css";

const HOME_ROW_ITEMS_LIMIT = 8;
const HOME_VIDEO_ROW_LIMIT = 4;

interface HomeDashboardProps {
  musicFolders: MusicFolderSource[];
  musicItems: MusicLibraryItem[];
  imageFolders: VisualFolderSource[];
  images: VisualLibraryItem[];
  videoFolders: VisualFolderSource[];
  videos: VisualLibraryItem[];
  loading: boolean;
  sourcesReady: boolean;
  error: string | null;
  onOpenFolders: () => void;
  onOpenImages: () => void;
  onOpenVideos: () => void;
  onOpenPlaylists?: () => void;
  onOpenImage?: (path: string) => void;
  onPlayMusic: (path: string) => void;
  onPlayVideo: (path: string, sessionItems?: VisualLibraryItem[]) => void;
  onPlayPlaylist?: (playlistPath: string) => void;
  confirmDeletion: boolean;
  onRefreshImages: () => void | Promise<void>;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
}

export function HomeDashboard({
  musicFolders,
  musicItems,
  imageFolders,
  images,
  videoFolders,
  videos,
  loading,
  sourcesReady,
  error,
  onOpenFolders,
  onOpenImages,
  onOpenVideos,
  onOpenPlaylists,
  onOpenImage,
  onPlayMusic,
  onPlayVideo,
  onPlayPlaylist,
  confirmDeletion,
  onRefreshImages,
}: HomeDashboardProps) {
  useScrollRestoration("view:home", !loading);
  const [selectedImage, setSelectedImage] = useState<VisualLibraryItem | null>(null);
  const { store: historyStore } = useHistory();
  const { playlists } = usePlaylists();

  const nonExcludedMusic = useMemo(() => musicItems.filter((it) => !it.isExcluded), [musicItems]);
  const nonExcludedImages = useMemo(() => images.filter((it) => !it.isExcluded), [images]);
  const nonExcludedVideos = useMemo(() => videos.filter((it) => !it.isExcluded), [videos]);
  const visiblePlaylists = useMemo(() => playlists.filter((p) => !p.isHidden), [playlists]);

  // ── Algoritmo Híbrido: Combina Historial (Recientes + Más reproducidas/vistas) con Archivos Nuevos/Entrantes ──
  const homeMusicItems = useMemo(() => {
    const musicMap = new Map(nonExcludedMusic.map((it) => [normalizePath(it.path), it]));
    const seen = new Set<string>();
    const result: MusicLibraryItem[] = [];

    const sortedHistory = [...historyStore.music].sort((a, b) => {
      const scoreA = (a.playCount || 1) * 0.4 + (a.playedAt / 1_000_000_000) * 0.6;
      const scoreB = (b.playCount || 1) * 0.4 + (b.playedAt / 1_000_000_000) * 0.6;
      return scoreB - scoreA;
    });

    for (const h of sortedHistory) {
      const item = musicMap.get(normalizePath(h.path));
      if (item && !seen.has(normalizePath(item.path))) {
        seen.add(normalizePath(item.path));
        result.push(item);
      }
    }

    const newItems = [...nonExcludedMusic]
      .filter((it) => !seen.has(normalizePath(it.path)))
      .sort((a, b) => (b.modifiedAtMillis || 0) - (a.modifiedAtMillis || 0));

    for (const item of newItems) {
      result.push(item);
    }

    return result.slice(0, HOME_ROW_ITEMS_LIMIT);
  }, [nonExcludedMusic, historyStore.music]);

  const homeVideoItems = useMemo(() => {
    const vidMap = new Map(nonExcludedVideos.map((it) => [normalizePath(it.path), it]));
    const seen = new Set<string>();
    const result: VisualLibraryItem[] = [];

    const sortedHistory = [...historyStore.videos].sort((a, b) => {
      const scoreA = (a.playCount || 1) * 0.4 + (a.playedAt / 1_000_000_000) * 0.6;
      const scoreB = (b.playCount || 1) * 0.4 + (b.playedAt / 1_000_000_000) * 0.6;
      return scoreB - scoreA;
    });

    for (const h of sortedHistory) {
      const item = vidMap.get(normalizePath(h.path));
      if (item && !seen.has(normalizePath(item.path))) {
        seen.add(normalizePath(item.path));
        result.push(item);
      }
    }

    const newItems = [...nonExcludedVideos]
      .filter((it) => !seen.has(normalizePath(it.path)))
      .sort((a, b) => (b.modifiedAtMillis || 0) - (a.modifiedAtMillis || 0));

    for (const item of newItems) {
      result.push(item);
    }

    return result.slice(0, HOME_VIDEO_ROW_LIMIT);
  }, [nonExcludedVideos, historyStore.videos]);

  const homeImageItems = useMemo(() => {
    const imgMap = new Map(nonExcludedImages.map((it) => [normalizePath(it.path), it]));
    const seen = new Set<string>();
    const result: VisualLibraryItem[] = [];

    const sortedHistory = [...historyStore.images].sort((a, b) => {
      const scoreA = (a.playCount || 1) * 0.4 + (a.playedAt / 1_000_000_000) * 0.6;
      const scoreB = (b.playCount || 1) * 0.4 + (b.playedAt / 1_000_000_000) * 0.6;
      return scoreB - scoreA;
    });

    for (const h of sortedHistory) {
      const item = imgMap.get(normalizePath(h.path));
      if (item && !seen.has(normalizePath(item.path))) {
        seen.add(normalizePath(item.path));
        result.push(item);
      }
    }

    const newItems = [...nonExcludedImages]
      .filter((it) => !seen.has(normalizePath(it.path)))
      .sort((a, b) => (b.modifiedAtMillis || 0) - (a.modifiedAtMillis || 0));

    for (const item of newItems) {
      result.push(item);
    }

    return result.slice(0, HOME_ROW_ITEMS_LIMIT);
  }, [nonExcludedImages, historyStore.images]);

  const homePlaylists = useMemo(() => {
    const plMap = new Map(visiblePlaylists.map((p) => [normalizePath(p.path), p]));
    const seen = new Set<string>();
    const result: PlaylistMeta[] = [];

    const sortedHistory = [...historyStore.playlists].sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0));
    for (const h of sortedHistory) {
      const p = plMap.get(normalizePath(h.path));
      if (p && !seen.has(normalizePath(p.path))) {
        seen.add(normalizePath(p.path));
        result.push(p);
      }
    }

    for (const p of visiblePlaylists) {
      if (!seen.has(normalizePath(p.path))) {
        seen.add(normalizePath(p.path));
        result.push(p);
      }
    }

    return result.slice(0, HOME_ROW_ITEMS_LIMIT);
  }, [visiblePlaylists, historyStore.playlists]);

  // ── Determinar el orden dinámico de los estantes según lo último visto/reproducido ──
  const shelvesOrder = useMemo(() => {
    const defaultOrder: HistoryCategory[] = ["music", "video", "image", "playlist"];
    const last = historyStore.lastPlayedKind;
    if (!last) return defaultOrder;
    return [last, ...defaultOrder.filter((k) => k !== last)];
  }, [historyStore.lastPlayedKind]);

  const totalFolders = musicFolders.length + imageFolders.length + videoFolders.length;
  const totalItems = nonExcludedMusic.length + nonExcludedImages.length + nonExcludedVideos.length;
  const hasLibrary = totalFolders > 0;

  return (
    <section className="home-dashboard">
      <header className="home-welcome">
        <div className="section-heading">
          <span className="preview-kicker">LIENZO MULTIMEDIA LOCAL</span>
          <h1>Tu biblioteca,<br />en un solo lugar</h1>
          <p>Música, imágenes y vídeos organizados desde tus propias carpetas, combinando lo más visto y nuevos descubrimientos.</p>
        </div>
        <div className="home-orbit" aria-hidden="true"><i /><i /><i /><Icon name="layout" /></div>
      </header>

      {error ? <div className="error-banner" role="alert"><strong>No se pudo completar la biblioteca</strong><span>{error}</span></div> : null}

      <div className="home-stat-row" aria-busy={loading}>
        <button onClick={() => homeMusicItems[0] && onPlayMusic(homeMusicItems[0].path)}>
          <span><Icon name="music" /></span>
          <strong>{nonExcludedMusic.length}</strong>
          <small>Canciones</small>
        </button>
        <button onClick={onOpenVideos}>
          <span><Icon name="video" /></span>
          <strong>{nonExcludedVideos.length}</strong>
          <small>Vídeos</small>
        </button>
        <button onClick={onOpenImages}>
          <span><Icon name="image" /></span>
          <strong>{nonExcludedImages.length}</strong>
          <small>Imágenes</small>
        </button>
      </div>

      {!hasLibrary ? (
        <section className="home-first-step">
          <div><span>PRIMER PASO</span><h2>Construye tu biblioteca a tu manera</h2><p>Añade una carpeta para cada tipo. Prisma guarda únicamente sus rutas y vuelve a leer el contenido cuando lo necesitas.</p></div>
          <button className="filled-button" onClick={onOpenFolders}><Icon name="plus" /> Añadir carpetas</button>
        </section>
      ) : null}

      {/* Renderizado Dinámico de Estantes según lo último reproducido/visto */}
      {shelvesOrder.map((category) => {
        if (category === "music" && (!sourcesReady || musicFolders.length > 0)) {
          return (
            <MediaShelf
              key="shelf-music"
              title="Música para ti"
              kicker="MÚSICA"
              onOpen={() => (homeMusicItems[0] ? onPlayMusic(homeMusicItems[0].path) : onOpenFolders())}
            >
              <div className="home-media-row">
                {homeMusicItems.length > 0 ? (
                  homeMusicItems.map((item) => {
                    const { title, artist } = resolveLibraryTrackInfo(item);
                    return (
                      <button
                        className="home-media-card"
                        key={item.path}
                        onClick={() => onPlayMusic(item.path)}
                        title={artist ? `${artist} — ${title}` : title}
                      >
                        <span className="home-media-frame">
                          <Icon name="music" />
                          <MusicArtwork className="home-media-thumbnail" path={item.path} alt={`Carátula de ${title}`} />
                          <i className="home-media-play-btn"><Icon name="play" /></i>
                        </span>
                        <strong>{title}</strong>
                        <small>{artist || "Pista local"}</small>
                      </button>
                    );
                  })
                ) : loading || !sourcesReady ? (
                  Array.from({ length: HOME_ROW_ITEMS_LIMIT }).map((_, i) => (
                    <div className="home-media-card is-skeleton" key={i}>
                      <span className="home-media-frame" />
                      <strong />
                      <small />
                    </div>
                  ))
                ) : null}
              </div>
            </MediaShelf>
          );
        }

        if (category === "video" && (!sourcesReady || videoFolders.length > 0)) {
          return (
            <MediaShelf
              key="shelf-video"
              title="Vídeos destacados"
              kicker="VÍDEOS"
              onOpen={onOpenVideos}
            >
              <div className="home-media-row is-video-row">
                {homeVideoItems.length > 0 ? (
                  homeVideoItems.map((item) => (
                    <button
                      className="home-media-card"
                      key={item.path}
                      onClick={() => onPlayVideo(item.path, nonExcludedVideos)}
                      title={item.title}
                    >
                      <span className="home-media-frame">
                        <VideoThumbnail path={item.path} title={item.title} className="home-media-thumbnail" />
                        <i className="home-media-play-btn"><Icon name="play" /></i>
                      </span>
                      <strong>{item.title}</strong>
                      <small>{cleanPath(item.relativeFolder)}</small>
                    </button>
                  ))
                ) : loading || !sourcesReady ? (
                  Array.from({ length: HOME_VIDEO_ROW_LIMIT }).map((_, i) => (
                    <div className="home-media-card is-skeleton" key={i}>
                      <span className="home-media-frame" />
                      <strong />
                      <small />
                    </div>
                  ))
                ) : null}
              </div>
            </MediaShelf>
          );
        }

        if (category === "image" && (!sourcesReady || imageFolders.length > 0)) {
          return (
            <MediaShelf
              key="shelf-image"
              title="Galería destacada"
              kicker="IMÁGENES"
              onOpen={onOpenImages}
            >
              <div className="home-media-row">
                {homeImageItems.length > 0 ? (
                  homeImageItems.map((item) => (
                    <button
                      className="home-media-card"
                      key={item.path}
                      onClick={() => {
                        if (onOpenImage) {
                          onOpenImage(item.path);
                        } else {
                          setSelectedImage(item);
                        }
                      }}
                      title={item.title}
                    >
                      <span className="home-media-frame">
                        <VisualThumbnail path={item.path} alt={item.title} className="home-media-thumbnail" />
                      </span>
                      <strong>{item.title}</strong>
                      <small>{cleanPath(item.relativeFolder)}</small>
                    </button>
                  ))
                ) : loading || !sourcesReady ? (
                  Array.from({ length: HOME_ROW_ITEMS_LIMIT }).map((_, i) => (
                    <div className="home-media-card is-skeleton" key={i}>
                      <span className="home-media-frame" />
                      <strong />
                      <small />
                    </div>
                  ))
                ) : null}
              </div>
            </MediaShelf>
          );
        }

        if (category === "playlist" && homePlaylists.length > 0) {
          return (
            <MediaShelf
              key="shelf-playlist"
              title="Listas de reproducción"
              kicker="COLECCIONES"
              onOpen={() => onOpenPlaylists?.()}
            >
              <div className="home-media-row">
                {homePlaylists.map((pl) => (
                  <button
                    className="home-media-card"
                    key={pl.path}
                    onClick={() => {
                      if (onPlayPlaylist) {
                        onPlayPlaylist(pl.path);
                      } else {
                        onOpenPlaylists?.();
                      }
                    }}
                    title={pl.name}
                  >
                    <span className="home-media-frame">
                      <Icon name="queue" />
                      <i className="home-media-play-btn"><Icon name="play" /></i>
                    </span>
                    <strong>{pl.name}</strong>
                    <small>{pl.itemCount} {pl.itemCount === 1 ? "elemento" : "elementos"}</small>
                  </button>
                ))}
              </div>
            </MediaShelf>
          );
        }

        return null;
      })}

      {hasLibrary && totalItems === 0 && !loading ? <p className="home-no-media">Las carpetas están registradas, pero no contienen archivos compatibles por ahora.</p> : null}

      {selectedImage ? (
        <ImageViewer
          confirmDeletion={confirmDeletion}
          item={selectedImage}
          itemsList={nonExcludedImages}
          onClose={() => setSelectedImage(null)}
          onRefresh={onRefreshImages}
          onSelectImage={setSelectedImage}
        />
      ) : null}
    </section>
  );
}

function MediaShelf({ title, kicker, onOpen, children }: { title: string; kicker: string; onOpen: () => void; children: React.ReactNode }) {
  return (
    <section className="home-media-shelf">
      <header><div><span className="preview-kicker">{kicker}</span><h2>{title}</h2></div><button className="text-button" onClick={onOpen}>Ver todo</button></header>
      {children}
    </section>
  );
}
