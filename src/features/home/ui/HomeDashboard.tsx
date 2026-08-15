import type { MusicFolderSource, MusicLibraryItem } from "../../music_library/model/types";
import { MusicArtwork } from "../../music_library/ui/MusicArtwork";
import type { VisualFolderSource, VisualLibraryItem } from "../../visual_library/model/types";
import { VisualThumbnail } from "../../visual_library/ui/VisualThumbnail";
import { VideoThumbnail } from "../../visual_library/ui/VideoThumbnail";
import { Icon } from "../../../shared/ui/Icon";
import "./home-dashboard.css";

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
  onPlayMusic: (path: string) => void;
  onPlayVideo: (path: string) => void;
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
  onPlayMusic,
  onPlayVideo,
}: HomeDashboardProps) {
  const totalFolders = musicFolders.length + imageFolders.length + videoFolders.length;
  const totalItems = musicItems.length + images.length + videos.length;
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
        <button onClick={onOpenFolders}><span><Icon name="folder" /></span><strong>{totalFolders}</strong><small>Carpetas</small></button>
        <button onClick={() => musicItems[0] && onPlayMusic(musicItems[0].path)}><span><Icon name="music" /></span><strong>{musicItems.length}</strong><small>Canciones</small></button>
        <button onClick={onOpenImages}><span><Icon name="image" /></span><strong>{images.length}</strong><small>Imágenes</small></button>
        <button onClick={onOpenVideos}><span><Icon name="video" /></span><strong>{videos.length}</strong><small>Vídeos</small></button>
      </div>

      {!hasLibrary ? (
        <section className="home-first-step">
          <div><span>PRIMER PASO</span><h2>Construye tu biblioteca a tu manera</h2><p>Añade una carpeta para cada tipo. Prisma guarda únicamente sus rutas y vuelve a leer el contenido cuando lo necesitas.</p></div>
          <button className="filled-button" onClick={onOpenFolders}><Icon name="plus" /> Añadir carpetas</button>
        </section>
      ) : null}

      {images.length > 0 ? (
        <MediaShelf title="Imágenes recientes" kicker="IMÁGENES" onOpen={onOpenImages}>
          <div className="home-media-row">
            {images.slice(0, 8).map((item) => (
              <button className="home-media-card" key={item.path} onClick={onOpenImages} title={item.title}>
                <span className="home-media-frame">
                  <VisualThumbnail path={item.path} alt={item.title} className="home-media-thumbnail" />
                </span>
                <strong>{item.title}</strong>
                <small>{item.relativeFolder}</small>
              </button>
            ))}
          </div>
        </MediaShelf>
      ) : null}

      {musicItems.length > 0 ? (
        <MediaShelf title="Volver a escuchar" kicker="MÚSICA" onOpen={() => onPlayMusic(musicItems[0].path)}>
          <div className="home-media-row">
            {musicItems.slice(0, 8).map((item) => (
              <button className="home-media-card" key={item.path} onClick={() => onPlayMusic(item.path)} title={item.title}>
                <span className="home-media-frame">
                  <Icon name="music" />
                  <MusicArtwork className="home-media-thumbnail" path={item.path} alt={`Carátula de ${item.title}`} />
                  <i className="home-media-play-btn"><Icon name="play" /></i>
                </span>
                <strong>{item.title}</strong>
                <small>{item.relativeFolder}</small>
              </button>
            ))}
          </div>
        </MediaShelf>
      ) : null}

      {videos.length > 0 ? (
        <MediaShelf title="Vídeos recientes" kicker="VÍDEOS" onOpen={onOpenVideos}>
          <div className="home-media-row">
            {videos.slice(0, 8).map((item) => (
              <button className="home-media-card" key={item.path} onClick={() => onPlayVideo(item.path)} title={item.title}>
                <span className="home-media-frame">
                  <VideoThumbnail path={item.path} title={item.title} className="home-media-thumbnail" />
                  <i className="home-media-play-btn"><Icon name="play" /></i>
                </span>
                <strong>{item.title}</strong>
                <small>{item.relativeFolder}</small>
              </button>
            ))}
          </div>
        </MediaShelf>
      ) : null}

      {hasLibrary && totalItems === 0 && !loading ? <p className="home-no-media">Las carpetas están registradas, pero no contienen archivos compatibles por ahora.</p> : null}
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
