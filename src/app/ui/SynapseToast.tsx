import { useEffect } from "react";
import "./synapse-toast.css";

export interface SynapseReceivedFile {
  fileName: string;
  savedPath: string;
  mediaType: string;
  sizeBytes: number;
}

interface SynapseToastProps {
  file: SynapseReceivedFile | null;
  onClose: () => void;
  onOpenFile: (path: string) => void;
}

export function SynapseToast({ file, onClose, onOpenFile }: SynapseToastProps) {
  useEffect(() => {
    if (!file) return;
    const timer = setTimeout(() => {
      onClose();
    }, 7000);
    return () => clearTimeout(timer);
  }, [file, onClose]);

  if (!file) return null;

  const sizeMb = (file.sizeBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="synapse-toast-container" role="status" aria-live="polite">
      <div className="synapse-toast-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </div>
      <div className="synapse-toast-body">
        <span className="synapse-toast-header">Aurora Synapse · LAN</span>
        <span className="synapse-toast-title" title={file.fileName}>
          {file.fileName} {file.sizeBytes > 0 ? `(${sizeMb} MB)` : ""}
        </span>
      </div>
      <div className="synapse-toast-actions">
        <button
          type="button"
          className="synapse-toast-action-btn"
          onClick={() => {
            onOpenFile(file.savedPath);
            onClose();
          }}
        >
          Abrir
        </button>
        <button
          type="button"
          className="synapse-toast-close-btn"
          onClick={onClose}
          aria-label="Cerrar notificación"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
