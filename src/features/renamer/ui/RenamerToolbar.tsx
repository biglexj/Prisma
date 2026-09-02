import React, { useState, useRef, useEffect } from "react";
import { Icon, type IconName } from "../../../shared/ui/Icon";
import { CustomSelect } from "./CustomSelect";
import { BUILTIN_PRESETS } from "../hooks/useRenamer";
import type { FilterMode, PresetTemplate } from "../model/types";

interface RenamerToolbarProps {
  currentFolder: string | null;
  filterMode: FilterMode;
  customExtensions: string;
  includeSubfolders: boolean;
  targetType: "files" | "folders" | "both";
  isScanning: boolean;
  onPickFolder: () => void;
  onRefresh: () => void;
  onFilterChange: (mode: FilterMode) => void;
  onCustomExtensionsChange: (exts: string) => void;
  onSubfoldersToggle: (enabled: boolean) => void;
  onTargetTypeChange: (target: "files" | "folders" | "both") => void;
  onLoadPreset: (preset: PresetTemplate) => void;
}

const FILTER_TABS: Array<{ id: FilterMode; label: string; icon: IconName }> = [
  { id: "all", label: "Todos", icon: "folder" },
  { id: "image", label: "Imágenes", icon: "image" },
  { id: "video", label: "Vídeos", icon: "video" },
  { id: "audio", label: "Música", icon: "music" },
  { id: "document", label: "Documentos", icon: "file-text" },
  { id: "custom", label: "Extensiones", icon: "file-code" },
];

const TARGET_TYPE_OPTIONS: Array<{ value: "files" | "folders" | "both"; label: string }> = [
  { value: "files", label: "Solo Archivos" },
  { value: "folders", label: "Solo Carpetas" },
  { value: "both", label: "Archivos y Carpetas" },
];

export function RenamerToolbar({
  currentFolder,
  filterMode,
  customExtensions,
  includeSubfolders,
  targetType,
  isScanning,
  onPickFolder,
  onRefresh,
  onFilterChange,
  onCustomExtensionsChange,
  onSubfoldersToggle,
  onTargetTypeChange,
  onLoadPreset,
}: RenamerToolbarProps) {
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setIsPresetsOpen(false);
      }
    };
    if (isPresetsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPresetsOpen]);

  return (
    <div className="renamer-toolbar-root">
      <div className="renamer-toolbar-main">
        {/* Selector de Carpeta */}
        <div className="renamer-folder-selector">
          <button
            type="button"
            className="renamer-browse-btn"
            onClick={onPickFolder}
            title="Seleccionar carpeta de trabajo"
          >
            <Icon name="folder-open" />
            <span>Examinar Carpeta...</span>
          </button>

          <div
            className={`renamer-folder-display ${currentFolder ? "has-folder" : "is-empty"}`}
            title={currentFolder || "Ninguna carpeta seleccionada"}
          >
            <Icon name="folder" />
            <span className="renamer-folder-path">
              {currentFolder ? currentFolder : "Arrastra una carpeta o haz clic en Examinar"}
            </span>
          </div>

          <button
            type="button"
            className="renamer-icon-action-btn"
            disabled={!currentFolder || isScanning}
            onClick={onRefresh}
            title="Recargar archivos de la carpeta"
            aria-label="Recargar carpeta"
          >
            <Icon name="refresh" className={isScanning ? "is-spinning" : ""} />
          </button>
        </div>

        {/* Selector de Presets / Plantillas */}
        <div className="renamer-presets-dropdown" ref={presetsRef}>
          <button
            type="button"
            className={`renamer-presets-btn ${isPresetsOpen ? "is-open" : ""}`}
            onClick={() => setIsPresetsOpen(!isPresetsOpen)}
          >
            <Icon name="sparkles" />
            <span>Plantillas Rápidas</span>
            <Icon name="chevron-down" />
          </button>

          {isPresetsOpen && (
            <div className="renamer-presets-menu" role="menu">
              <div className="renamer-presets-menu-header">
                <strong>Combinaciones y Recetas Rápidas</strong>
                <span>Aplica secuencias de reglas con un solo clic</span>
              </div>
              {BUILTIN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="renamer-preset-item"
                  onClick={() => {
                    onLoadPreset(preset);
                    setIsPresetsOpen(false);
                  }}
                  role="menuitem"
                >
                  <div className="renamer-preset-item-title-row">
                    <span className="renamer-preset-item-title">{preset.name}</span>
                    <span className="renamer-preset-item-badge">
                      {preset.steps.length} {preset.steps.length === 1 ? "paso" : "pasos"}
                    </span>
                  </div>
                  <div className="renamer-preset-item-desc">{preset.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Barra Secundaria de Filtros y Opciones */}
      <div className="renamer-toolbar-secondary">
        <div className="renamer-filter-tabs" role="tablist">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={filterMode === tab.id}
              className={`renamer-filter-tab ${filterMode === tab.id ? "is-active" : ""}`}
              onClick={() => onFilterChange(tab.id)}
            >
              <Icon name={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {filterMode === "custom" && (
          <div className="renamer-custom-exts-input">
            <input
              type="text"
              value={customExtensions}
              onChange={(e) => onCustomExtensionsChange(e.target.value)}
              placeholder="ej. png, jpg, gif, pdf"
              title="Extensiones separadas por comas"
            />
          </div>
        )}

        <div className="renamer-options-group">
          <label className="renamer-pill-checkbox" title="Buscar archivos dentro de todas las subcarpetas">
            <input
              type="checkbox"
              checked={includeSubfolders}
              onChange={(e) => onSubfoldersToggle(e.target.checked)}
            />
            <span>Incluir Subcarpetas</span>
          </label>

          <div className="renamer-target-select-wrapper">
            <span className="renamer-target-label">Objetivo:</span>
            <CustomSelect
              value={targetType}
              onChange={(val) => onTargetTypeChange(val)}
              options={TARGET_TYPE_OPTIONS}
              align="right"
              className="renamer-target-custom-select"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
