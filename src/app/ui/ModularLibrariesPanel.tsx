import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { Icon } from "../../shared/ui/Icon";
import { useCustomLibraries } from "../../features/custom_libraries/hooks/useCustomLibraries";
import type { CustomLibraryDefinition } from "../../features/custom_libraries/model/types";
import "./modular-libraries-panel.css";

const AVAILABLE_ICONS = [
  "folder",
  "folder-open",
  "file-text",
  "book-open",
  "palette",
  "layers",
  "film",
  "image",
  "music",
  "code",
  "box",
  "disc",
  "star",
  "heart",
  "sparkles",
];

export function ModularLibrariesPanel() {
  const {
    libraries,
    toggleActive,
    saveLibrary,
    deleteLibrary,
    addFolder,
    removeFolder,
    loading,
  } = useCustomLibraries();

  const [isCreating, setIsCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("folder");
  const [newExtensions, setNewExtensions] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !newExtensions.trim()) return;

    const exts = newExtensions
      .split(",")
      .map((s) => s.trim().toLowerCase().replace(/^\./, ""))
      .filter(Boolean);

    const id = `custom_${Date.now()}`;
    const newLib: CustomLibraryDefinition = {
      id,
      label: newLabel.trim(),
      icon: newIcon,
      extensions: exts,
      externalAppCommand: newCommand.trim() ? newCommand.trim() : null,
      folderPaths: [],
      isPreset: false,
      isActive: true,
      description: newDescription.trim() ? newDescription.trim() : null,
    };

    await saveLibrary(newLib);
    setNewLabel("");
    setNewExtensions("");
    setNewCommand("");
    setNewDescription("");
    setIsCreating(false);
  };

  const handleAddFolder = async (libId: string) => {
    const selected = await open({
      multiple: false,
      directory: true,
      title: "Seleccionar carpeta para la biblioteca modular",
    });
    if (typeof selected === "string") {
      await addFolder(libId, selected);
    }
  };

  return (
    <div className="modular-libraries-panel">
      <div className="modular-header-banner">
        <div className="modular-header-text">
          <h2>Bibliotecas Modulares Personalizables</h2>
          <p>
            Activa secciones especializadas para tus documentos, libros, proyectos creativos (Krita, Affinity, DaVinci) o crea tus propios módulos personalizados por tipo de archivo.
          </p>
        </div>
        <button
          className="filled-button"
          onClick={() => setIsCreating(!isCreating)}
          type="button"
        >
          <Icon name={isCreating ? "x" : "plus"} />
          <span>{isCreating ? "Cancelar creación" : "Crear módulo personalizado"}</span>
        </button>
      </div>

      {isCreating ? (
        <form className="modular-create-form" onSubmit={handleCreate}>
          <h3>Nuevo Módulo Personalizado</h3>
          <div className="modular-form-grid">
            <div className="modular-field">
              <label>Nombre de la pestaña</label>
              <input
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ej. Proyectos Blender, Modelos 3D, Audio Reaper"
                required
                type="text"
                value={newLabel}
              />
            </div>

            <div className="modular-field">
              <label>Extensiones de archivo (separadas por comas)</label>
              <input
                onChange={(e) => setNewExtensions(e.target.value)}
                placeholder="Ej. blend, obj, fbx, rpp"
                required
                type="text"
                value={newExtensions}
              />
            </div>

            <div className="modular-field">
              <label>Comando o aplicación externa (opcional)</label>
              <input
                onChange={(e) => setNewCommand(e.target.value)}
                placeholder="Ej. blender, code, reaper"
                type="text"
                value={newCommand}
              />
            </div>

            <div className="modular-field">
              <label>Descripción corta (opcional)</label>
              <input
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Ej. Modelos y escenas tridimensionales locales."
                type="text"
                value={newDescription}
              />
            </div>
          </div>

          <div className="modular-icon-selector-section">
            <label>Seleccionar icono</label>
            <div className="modular-icon-picker">
              {AVAILABLE_ICONS.map((iconName) => (
                <button
                  className={`modular-icon-option ${newIcon === iconName ? "is-selected" : ""}`}
                  key={iconName}
                  onClick={() => setNewIcon(iconName)}
                  type="button"
                >
                  <Icon name={iconName as any} />
                </button>
              ))}
            </div>
          </div>

          <div className="modular-form-actions">
            <button className="filled-button" type="submit">
              <Icon name="check" /> Guardar y activar módulo
            </button>
          </div>
        </form>
      ) : null}

      <div className="modular-cards-grid">
        {libraries.map((lib) => (
          <div
            className={`modular-card ${lib.isActive ? "is-active" : ""}`}
            key={lib.id}
          >
            <div
              className="modular-card-top"
              onClick={() => void toggleActive(lib.id, !lib.isActive)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void toggleActive(lib.id, !lib.isActive);
                }
              }}
              title={lib.isActive ? "Deshabilitar biblioteca" : "Habilitar biblioteca"}
            >
              <div className="modular-card-icon-title">
                <div className="modular-card-icon">
                  <Icon name={lib.icon as any} />
                </div>
                <div>
                  <h4>{lib.label}</h4>
                  <span className={`modular-card-tag ${lib.isActive ? "is-active-tag" : ""}`}>
                    {lib.isActive ? "● Habilitada" : "○ Deshabilitada"}
                  </span>
                </div>
              </div>

              <label
                className="modular-toggle-switch"
                onClick={(e) => e.stopPropagation()}
                title={lib.isActive ? "Desactivar de la barra lateral" : "Activar en la barra lateral"}
              >
                <input
                  checked={lib.isActive}
                  onChange={(e) => void toggleActive(lib.id, e.target.checked)}
                  type="checkbox"
                />
                <span className="modular-slider" />
              </label>
            </div>

            <p
              className="modular-card-desc"
              onClick={() => void toggleActive(lib.id, !lib.isActive)}
            >
              {lib.description || `Archivos: ${lib.extensions.map((e) => `.${e}`).join(", ")}`}
            </p>

            <div className="modular-card-exts-pills">
              {lib.extensions.map((ext) => (
                <span className="modular-ext-pill" key={ext}>
                  .{ext}
                </span>
              ))}
            </div>

            {!lib.isPreset ? (
              <div className="modular-card-footer">
                <button
                  className="modular-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteLibrary(lib.id);
                  }}
                  type="button"
                >
                  <Icon name="trash" /> Eliminar módulo
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
