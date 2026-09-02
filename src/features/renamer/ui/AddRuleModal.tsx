import React from "react";
import { Icon, type IconName } from "../../../shared/ui/Icon";
import type { RuleType } from "../model/types";

interface AddRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: RuleType) => void;
}

interface StepOption {
  type: RuleType;
  title: string;
  desc: string;
  icon: IconName;
  color: string;
  badge: string;
}

const STEP_OPTIONS: StepOption[] = [
  {
    type: "template",
    title: "Reemplazar con Plantilla",
    desc: "Sustituye el nombre completo usando tokens dinámicos ([Nombre], [Contador], [Fecha], [Carpeta]).",
    icon: "sparkles",
    color: "var(--accent-indigo, #6366f1)",
    badge: "Plantilla",
  },
  {
    type: "replace",
    title: "Buscar y Reemplazar",
    desc: "Encuentra palabras, símbolos o expresiones regulares y sustitúyelos por otro texto.",
    icon: "search",
    color: "var(--accent-blue, #3b82f6)",
    badge: "Reemplazo",
  },
  {
    type: "add",
    title: "Añadir Texto (Prefijo / Sufijo)",
    desc: "Agrega texto al inicio, al final o en una posición específica de caracteres.",
    icon: "plus",
    color: "var(--accent-emerald, #10b981)",
    badge: "Insertar",
  },
  {
    type: "counter",
    title: "Añadir Contador / Numeración",
    desc: "Inserta una secuencia numérica con número inicial, incremento y relleno de ceros (01, 001).",
    icon: "list",
    color: "var(--accent-amber, #f59e0b)",
    badge: "Contador",
  },
  {
    type: "case",
    title: "Mayúsculas / Minúsculas",
    desc: "Transforma a Title Case, Sentence case, minúsculas, MAYÚSCULAS, kebab-case o snake_case.",
    icon: "edit",
    color: "var(--accent-purple, #8b5cf6)",
    badge: "Formato",
  },
  {
    type: "remove",
    title: "Eliminar / Recortar",
    desc: "Borra primeros/últimos N caracteres, números, corchetes [...], símbolos o limpia espacios.",
    icon: "trash",
    color: "var(--accent-rose, #f43f5e)",
    badge: "Eliminar",
  },
  {
    type: "extension",
    title: "Gestionar Extensión",
    desc: "Fuerza la extensión a minúsculas, mayúsculas o cambia la extensión de los archivos.",
    icon: "file-code",
    color: "var(--accent-cyan, #06b6d4)",
    badge: "Extensión",
  },
];

export function AddRuleModal({ isOpen, onClose, onSelectType }: AddRuleModalProps) {
  if (!isOpen) return null;

  return (
    <div className="add-rule-backdrop" onClick={onClose} role="presentation">
      <div
        className="add-rule-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="add-rule-title"
      >
        <header className="add-rule-header">
          <div className="add-rule-title-group">
            <span className="add-rule-header-icon">
              <Icon name="sliders" />
            </span>
            <div>
              <h2 id="add-rule-title">Añadir Regla de Renombrado</h2>
              <p>Selecciona el tipo de transformación que deseas encadenar</p>
            </div>
          </div>
          <button
            type="button"
            className="add-rule-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="add-rule-grid">
          {STEP_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              className="add-rule-option-btn"
              onClick={() => {
                onSelectType(opt.type);
                onClose();
              }}
            >
              <div className="add-rule-opt-header">
                <span className="add-rule-opt-icon" style={{ color: opt.color, backgroundColor: `color-mix(in srgb, ${opt.color} 15%, transparent)` }}>
                  <Icon name={opt.icon} />
                </span>
                <span className="add-rule-opt-badge" style={{ color: opt.color, borderColor: `color-mix(in srgb, ${opt.color} 30%, transparent)` }}>
                  {opt.badge}
                </span>
              </div>
              <strong className="add-rule-opt-title">{opt.title}</strong>
              <p className="add-rule-opt-desc">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
