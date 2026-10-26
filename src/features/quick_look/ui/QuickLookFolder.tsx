import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "../../../shared/ui/Icon";
import type { QuickLookPayload } from "../model/types";

interface FolderStatistics {
  files: number; folders: number; bytes: number; images: number; videos: number;
  documents: number; createdMillis: number | null; incomplete: boolean;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
  return `${new Intl.NumberFormat("es", { maximumFractionDigits: 1 }).format(size)} ${units[unit]}`;
}

export function QuickLookFolder({ payload }: { payload: QuickLookPayload }) {
  const [result, setResult] = useState<{ path: string; stats: FolderStatistics | null } | null>(null);
  useEffect(() => {
    let active = true;
    invoke<FolderStatistics>("quick_look_folder_statistics", { path: payload.path })
      .then((stats) => { if (active) setResult({ path: payload.path, stats }); })
      .catch(() => { if (active) setResult({ path: payload.path, stats: null }); });
    return () => { active = false; };
  }, [payload.path]);
  const current = result?.path === payload.path ? result : null;
  const stats = current?.stats;
  const items = payload.folderPreviewItems ?? [];
  const count = payload.folderItemsCount ?? 0;
  const date = stats?.createdMillis == null ? "No disponible" : new Intl.DateTimeFormat("es", { dateStyle: "long", timeStyle: "short" }).format(new Date(stats.createdMillis));

  return (
    <div className="quicklook-folder-container">
      <div className="quicklook-folder-card">
        <div className="quicklook-folder-hero-icon"><Icon name="folder" /></div>
        <div className="quicklook-folder-details">
          <h2>{payload.fileName}</h2>
          <div className="quicklook-folder-meta"><span className="quicklook-badge"><Icon name="folder-open" /> {count} {count === 1 ? "elemento inmediato" : "elementos inmediatos"}</span></div>
        </div>
      </div>
      <div className="quicklook-folder-preview-list" aria-live="polite">
        <span className="quicklook-folder-preview-title">Información de la carpeta</span>
        {!current ? <span>Calculando contenido…</span> : !stats ? <span>No se pudo leer la información de la carpeta.</span> : <>
          <div className="quicklook-folder-stat-grid">
            <div><span>Contiene</span><strong>{stats.files} archivos · {stats.folders} carpetas</strong></div>
            <div><span>Tamaño</span><strong title={`${stats.bytes.toLocaleString("es")} bytes`}>{formatSize(stats.bytes)}</strong></div>
            <div><span>Contenido</span><strong>{stats.images} imágenes · {stats.videos} vídeos · {stats.documents} documentos</strong></div>
            <div><span>Creado</span><strong>{date}</strong></div>
          </div>
          <span className="quicklook-folder-stat-note">Incluye subcarpetas{stats.incomplete ? "; algunos elementos no se pudieron incluir" : ""}.</span>
        </>}
      </div>
      {items.length > 0 && <div className="quicklook-folder-preview-list">
        <span className="quicklook-folder-preview-title">Contenido inmediato</span>
        <div className="quicklook-folder-items-grid">{items.map((name, i) => <div className="quicklook-folder-item" key={i}><Icon name="file" /><span>{name}</span></div>)}</div>
      </div>}
      <div className="quicklook-folder-actions"><button className="quicklook-primary-action-btn" onClick={() => void invoke("open_in_file_manager", { path: payload.path })} type="button"><Icon name="folder-open" /><span>Abrir en el Explorador de archivos</span></button></div>
    </div>
  );
}
