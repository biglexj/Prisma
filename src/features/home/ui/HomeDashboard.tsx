import { useState } from "react";
import type { MusicFolderSource, MusicLibraryItem } from "../../music_library/model/types";
import { MusicArtwork } from "../../music_library/ui/MusicArtwork";
import { parseTrackInfo } from "../../music_library/model/trackInfo";
import type { VisualFolderSource, VisualLibraryItem } from "../../visual_library/model/types";
import { VisualThumbnail } from "../../visual_library/ui/VisualThumbnail";
import { VideoThumbnail } from "../../visual_library/ui/VideoThumbnail";
import { ImageViewer } from "../../visual_library/ui/ImageViewer";
import { Icon } from "../../../shared/ui/Icon";
import { cleanPath } from "../../../shared/mediaTree";
import { useScrollRestoration } from "../../../shared/useScrollRestoration";
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
  error: string | null;
  onOpenFolders: () => void;
  onOpenImages: () => void;
  onOpenVideos: () => void;
  onOpenImage?: (path: string) => void;
  onPlayMusic: (path: string) => void;
  onPlayVideo: (path: string, sessionItems?: VisualLibraryItem[]) => void;
  confirmDeletion: boolean;
  onRefreshImages: () => void | Promise<void>;
}

export function HomeDashboard({
  musicFolders,
  musicItems,
  imageFolders,
  images,
  videoFolders,
  videos,
  loading,
  error,
  onOpenFolders,
  onOpenImages,
  onOpenVideos,
  onOpenImage,
  onPlayMusic,
  onPlayVideo,
  confirmDeletion,
  onRefreshImages,
}: HomeDashboardProps) {
  useScrollRestoration("view:home", !loading);
  const [selectedImage, setSelectedImage] = useState<VisualLibraryItem | null>(null);

  const nonExcludedMusic = musicItems.filter((it) => !it.isExcluded);
  const nonExcludedImages = images.filter((it) => !it.isExcluded);
  const nonExcludedVideos = videos.filter((it) => !it.isExcluded);

  const totalFolders = musicFolders.length + imageFolders.length + videoFolders.length;
  const totalItems = nonExcludedMusic.length + nonExcludedImages.length + nonExcludedVideos.length;
  const hasLibrary = totalFolders > 0;

  return (
    <section className="home-dashboard">
      <header className="home-welcome">
        <div className="section-heading">
          <span className="preview-kicker">LIENZO MULTIMEDIA LOCAL</span>
          <h1>Tu biblioteca,<br />en un solo lugar</h1>
          <p>Música, imágenes y vídeos organizados desde tus propias carpetas, sin subir nada a la nube.</p>
        </div>
        <div className="home-orbit" aria-hidden="true"><i /><i /><i /><Icon name="layout" /></div>
      </header>

      {error ? <div className="error-banner" role="alert"><strong>No se pudo completar la biblioteca</strong><span>{error}</span></div> : null}

      <div className="home-stat-row" aria-busy={loading}>
        <button onClick={() => nonExcludedMusic[0] && onPlayMusic(nonExcludedMusic[0].path)}>
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

      {/* 1. MÚSICA */}
      {musicFolders.length > 0 ? (
        <MediaShelf title="Volver a escuchar" kicker="MÚSICA" onOpen={() => nonExcludedMusic[0] ? onPlayMusic(nonExcludedMusic[0].path) : onOpenFolders()}>
          <div className="home-media-row">
            {nonExcludedMusic.length > 0 ? (
              nonExcludedMusic.slice(0, HOME_ROW_ITEMS_LIMIT).map((item) => {
                const { title, artist } = parseTrackInfo(item.title);
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
            ) : loading ? (
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
      ) : null}

      {/* 2. VÍDEOS */}
      {videoFolders.length > 0 ? (
        <MediaShelf title="Vídeos recientes" kicker="VÍDEOS" onOpen={onOpenVideos}>
          <div className="home-media-row is-video-row">
            {nonExcludedVideos.length > 0 ? (
              nonExcludedVideos.slice(0, HOME_VIDEO_ROW_LIMIT).map((item) => (
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
            ) : loading ? (
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
      ) : null}

      {/* 3. IMÁGENES */}
      {imageFolders.length > 0 ? (
        <MediaShelf title="Imágenes recientes" kicker="IMÁGENES" onOpen={onOpenImages}>
          <div className="home-media-row">
            {nonExcludedImages.length > 0 ? (
              nonExcludedImages.slice(0, HOME_ROW_ITEMS_LIMIT).map((item) => (
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
            ) : loading ? (
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
      ) : null}

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
