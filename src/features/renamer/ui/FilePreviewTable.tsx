import React from "react";
import { Icon, type IconName } from "../../../shared/ui/Icon";
import type { PreviewItem, PreviewStatus } from "../model/types";

interface FilePreviewTableProps {
  items: PreviewItem[];
  totalCount: number;
  selectedCount: number;
  searchQuery: string;
  isScanning: boolean;
  onSearchChange: (q: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleItem: (path: string) => void;
}

function getItemIcon(extension: string, isDir: boolean): IconName {
  if (isDir) return "folder";
  const ext = extension.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "avif", "gif", "bmp", "svg", "ico"].includes(ext)) {
    return "image";
  }
  if (["mp4", "mkv", "webm", "avi", "mov", "wmv", "flv", "ts", "m4v"].includes(ext)) {
    return "video";
  }
  if (["mp3", "flac", "wav", "ogg", "aac", "m4a", "opus", "wma"].includes(ext)) {
    return "music";
  }
  if (["txt", "md", "markdown", "pdf", "docx", "doc", "epub", "log", "rtf"].includes(ext)) {
    return "file-text";
  }
  if (["json", "yaml", "yml", "xml", "csv", "js", "ts", "html", "css", "rs", "py"].includes(ext)) {
    return "file-code";
  }
  return "file";
}

function renderStatusBadge(status: PreviewStatus, error?: string) {
  switch (status) {
    case "ready":
      return (
        <span className="renamer-status-badge is-ready" title="Listo para renombrar">
          <Icon name="check" />
          <span>Listo</span>
        </span>
      );
    case "unchanged":
      return (
        <span className="renamer-status-badge is-unchanged" title="El nuevo nombre es idéntico al original">
          <Icon name="minus" />
          <span>Sin cambios</span>
        </span>
      );
    case "conflict":
      return (
        <span className="renamer-status-badge is-conflict" title={error || "Conflicto de nombre duplicado"}>
          <Icon name="close" />
          <span>Conflicto</span>
        </span>
      );
    case "invalid":
      return (
        <span className="renamer-status-badge is-invalid" title={error || "Nombre no permitido por el sistema operativo"}>
          <Icon name="close" />
          <span>Inválido</span>
        </span>
      );
    case "excluded":
      return (
        <span className="renamer-status-badge is-excluded" title="Elemento desmarcado del lote">
          <Icon name="eye-slash" />
          <span>Excluido</span>
        </span>
      );
  }
}

export function FilePreviewTable({
  items,
  totalCount,
  selectedCount,
  searchQuery,
  isScanning,
  onSearchChange,
  onToggleSelectAll,
  onToggleItem,
}: FilePreviewTableProps) {
  const isAllSelected = totalCount > 0 && selectedCount === totalCount;
  const isIndeterminate = selectedCount > 0 && selectedCount < totalCount;

  return (
    <div className="renamer-preview-container">
      {/* Barra de cabecera de la tabla */}
      <div className="renamer-table-header-bar">
        <div className="renamer-table-selection-info">
          <label className="renamer-checkbox-label" title="Seleccionar / Deseleccionar todos">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(el) => {
                if (el) el.indeterminate = isIndeterminate;
              }}
              onChange={(e) => onToggleSelectAll(e.target.checked)}
            />
            <span className="renamer-count-text">
              {selectedCount} de {totalCount} seleccionados
            </span>
          </label>
        </div>

        <div className="renamer-table-search">
          <Icon name="search" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filtrar archivos..."
          />
          {searchQuery && (
            <button
              type="button"
              className="renamer-search-clear"
              onClick={() => onSearchChange("")}
              aria-label="Limpiar búsqueda"
            >
              <Icon name="close" />
            </button>
          )}
        </div>
      </div>

      {/* Cuerpo de la tabla con scroll */}
      <div className="renamer-table-wrapper">
        {isScanning ? (
          <div className="renamer-table-empty">
            <div className="renamer-spinner-icon">
              <Icon name="refresh" className="is-spinning" />
            </div>
            <p>Escaneando carpeta y generando vista previa...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="renamer-table-empty">
            <div className="renamer-empty-icon">
              <Icon name="edit" />
            </div>
            <h3>Sin elementos en la vista previa</h3>
            <p>
              {totalCount === 0
                ? "Selecciona una carpeta o arrastra archivos aquí para comenzar."
                : "Ningún archivo coincide con el filtro de búsqueda actual."}
            </p>
          </div>
        ) : (
          <table className="renamer-table">
            <thead>
              <tr>
                <th className="th-checkbox"></th>
                <th className="th-original">Nombre Original</th>
                <th className="th-arrow"></th>
                <th className="th-new">Nuevo Nombre</th>
                <th className="th-status">Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const icon = getItemIcon(item.original.extension, item.original.isDir);
                return (
                  <tr
                    key={item.original.path}
                    className={`renamer-table-row is-status-${item.status} ${
                      !item.selected ? "is-unselected" : ""
                    }`}
                    onClick={() => onToggleItem(item.original.path)}
                  >
                    <td className="td-checkbox" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => onToggleItem(item.original.path)}
                      />
                    </td>

                    <td className="td-original" title={item.original.path}>
                      <div className="file-name-cell">
                        <span className="file-icon">
                          <Icon name={icon} />
                        </span>
                        <span className="file-text-original">{item.original.name}</span>
                      </div>
                    </td>

                    <td className="td-arrow">
                      <span className="renamer-arrow-icon">→</span>
                    </td>

                    <td className="td-new" title={item.newName}>
                      <span className={`file-text-new ${item.hasChanged ? "has-change" : ""}`}>
                        {item.newName}
                      </span>
                    </td>

                    <td className="td-status">{renderStatusBadge(item.status, item.error)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
