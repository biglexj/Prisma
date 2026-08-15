import type { MusicFolderSource, MusicLibraryItem } from "../../features/music_library/model/types";
import { FolderManager } from "../../features/music_library/ui/FolderManager";
import type { VisualFolderSource, VisualMediaKind } from "../../features/visual_library/model/types";
import { VisualSourceManager } from "../../features/visual_library/ui/VisualSourceManager";
import { Icon } from "../../shared/ui/Icon";
import "./library-sources.css";

interface MusicSourceState {
  folders: MusicFolderSource[];
  excludedFolders: MusicFolderSource[];
  items: MusicLibraryItem[];
  loading: boolean;
  busyPath: string | null;
  error: string | null;
  addFolder: (path: string) => Promise<void>;
  addExcludedFolder: (path: string) => Promise<void>;
  rescanFolder: (path: string) => Promise<void>;
  removeFolder: (path: string) => Promise<void>;
  removeExcludedFolder: (path: string) => Promise<void>;
}

interface VisualSourceState {
  kind: VisualMediaKind;
  folders: VisualFolderSource[];
  excludedFolders: VisualFolderSource[];
  loading: boolean;
  busyPath: string | null;
  error: string | null;
  addFolder: (path: string) => Promise<void>;
  addExcludedFolder: (path: string) => Promise<void>;
  rescanFolder: (path: string) => Promise<void>;
  removeFolder: (path: string) => Promise<void>;
  removeExcludedFolder: (path: string) => Promise<void>;
}

export function LibrarySources({
  music,
  images,
  videos,
  onPlay,
}: {
  music: MusicSourceState;
  images: VisualSourceState;
  videos: VisualSourceState;
  onPlay: (path: string) => void;
}) {
  const errors = [music.error, images.error, videos.error].filter(
    (error): error is string => Boolean(error),
  );

  return (
    <section className="library-sources">
      <header className="section-heading">
        <span className="preview-kicker">FUENTES DE LA BIBLIOTECA</span>
        <h1>Carpetas</h1>
        <p>Decide qué carpetas forman cada sección. Una misma ubicación puede registrarse para tipos diferentes.</p>
      </header>

      {errors.map((error) => (
        <div className="error-banner" key={error} role="alert">
          <strong>No se pudo actualizar una fuente</strong>
          <span>{error}</span>
        </div>
      ))}

      <div className="library-safety-note">
        <Icon name="folder" />
        <span>
          <strong>Tus archivos permanecen intactos.</strong> Quitar una fuente solo elimina su ruta guardada en Prisma.
        </span>
      </div>

      <div className="library-sources-three-columns">
        <FolderManager
          busyPath={music.busyPath}
          embedded
          error={null}
          folders={music.folders}
          items={music.items}
          loading={music.loading}
          onAdd={music.addFolder}
          onPlay={onPlay}
          onRemove={music.removeFolder}
          onRescan={music.rescanFolder}
        />
        <VisualSourceManager
          busyPath={images.busyPath}
          folders={images.folders}
          kind="image"
          loading={images.loading}
          onAdd={images.addFolder}
          onRemove={images.removeFolder}
          onRescan={images.rescanFolder}
        />
        <VisualSourceManager
          busyPath={videos.busyPath}
          folders={videos.folders}
          kind="video"
          loading={videos.loading}
          onAdd={videos.addFolder}
          onRemove={videos.removeFolder}
          onRescan={videos.rescanFolder}
        />
      </div>

      <header className="section-heading library-excluded-heading">
        <span className="preview-kicker">EXCLUSIONES DE LA BIBLIOTECA</span>
        <h2>Carpetas Excluidas</h2>
        <p>Especifica subcarpetas que Prisma ignorará durante el escaneo de música, imágenes o vídeos.</p>
      </header>

      <div className="library-sources-three-columns">
        <FolderManager
          busyPath={music.busyPath}
          embedded
          error={null}
          excluded
          folders={music.excludedFolders}
          items={[]}
          loading={music.loading}
          onAdd={music.addExcludedFolder}
          onPlay={onPlay}
          onRemove={music.removeExcludedFolder}
        />
        <VisualSourceManager
          busyPath={images.busyPath}
          excluded
          folders={images.excludedFolders}
          kind="image"
          loading={images.loading}
          onAdd={images.addExcludedFolder}
          onRemove={images.removeExcludedFolder}
        />
        <VisualSourceManager
          busyPath={videos.busyPath}
          excluded
          folders={videos.excludedFolders}
          kind="video"
          loading={videos.loading}
          onAdd={videos.addExcludedFolder}
          onRemove={videos.removeExcludedFolder}
        />
      </div>
    </section>
  );
}
