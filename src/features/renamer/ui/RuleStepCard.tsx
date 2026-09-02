import React from "react";
import { Icon, type IconName } from "../../../shared/ui/Icon";
import { CustomSelect } from "./CustomSelect";
import type {
  AddRuleConfig,
  CaseMode,
  CaseRuleConfig,
  CounterRuleConfig,
  ExtensionRuleConfig,
  RemoveRuleConfig,
  RemoveType,
  ReplaceRuleConfig,
  RuleStep,
  TemplateRuleConfig,
} from "../model/types";

interface RuleStepCardProps {
  step: RuleStep;
  index: number;
  totalSteps: number;
  onUpdate: (id: string, config: any) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}

const RULE_ICONS: Record<string, IconName> = {
  template: "sparkles",
  replace: "search",
  add: "plus",
  counter: "list",
  case: "edit",
  remove: "trash",
  extension: "file-code",
};

const RULE_BADGE_COLORS: Record<string, string> = {
  template: "var(--accent-indigo, #6366f1)",
  replace: "var(--accent-blue, #3b82f6)",
  add: "var(--accent-emerald, #10b981)",
  counter: "var(--accent-amber, #f59e0b)",
  case: "var(--accent-purple, #8b5cf6)",
  remove: "var(--accent-rose, #f43f5e)",
  extension: "var(--accent-cyan, #06b6d4)",
};

const PADDING_OPTIONS = [
  { value: 1, label: "1 dígito (1, 2, 3...)" },
  { value: 2, label: "2 dígitos (01, 02, 03...)" },
  { value: 3, label: "3 dígitos (001, 002...)" },
  { value: 4, label: "4 dígitos (0001, 0002...)" },
];

const ADD_POSITION_OPTIONS = [
  { value: "start", label: "Al Inicio (Prefijo)" },
  { value: "end", label: "Al Final (Sufijo)" },
  { value: "position", label: "En Posición de Carácter..." },
];

const COUNTER_POSITION_OPTIONS = [
  { value: "end", label: "Al Final del Nombre" },
  { value: "start", label: "Al Inicio del Nombre" },
];

const CASE_MODE_OPTIONS = [
  { value: "titlecase", label: "Title Case (Cada Palabra En Mayúscula)" },
  { value: "sentencecase", label: "Sentence case (Primera letra en mayúscula)" },
  { value: "lowercase", label: "minúsculas (todo en minúsculas)" },
  { value: "uppercase", label: "MAYÚSCULAS (TODO EN MAYÚSCULAS)" },
  { value: "kebabcase", label: "kebab-case (separado-con-guiones)" },
  { value: "snakecase", label: "snake_case (separado_con_guion_bajo)" },
  { value: "camelcase", label: "camelCase (estiloCamello)" },
];

const CASE_TARGET_OPTIONS = [
  { value: "name", label: "Solo Nombre Base" },
  { value: "extension", label: "Solo Extensión" },
  { value: "all", label: "Nombre y Extensión" },
];

const REMOVE_TYPE_OPTIONS = [
  { value: "first_n", label: "Eliminar Primeros N Caracteres" },
  { value: "last_n", label: "Eliminar Últimos N Caracteres" },
  { value: "numbers", label: "Eliminar Todos los Números (0-9)" },
  { value: "brackets", label: "Eliminar Corchetes y Contenido ([...], (...))" },
  { value: "symbols", label: "Eliminar Símbolos Especiales" },
  { value: "spaces", label: "Recortar y Limpiar Espacios" },
  { value: "custom", label: "Eliminar Texto Específico" },
];

const EXTENSION_MODE_OPTIONS = [
  { value: "lowercase", label: "Forzar Minúsculas (ej. .JPG → .jpg)" },
  { value: "uppercase", label: "Forzar Mayúsculas (ej. .jpg → .JPG)" },
  { value: "custom", label: "Cambiar Extensión a..." },
  { value: "keep", label: "Mantener Original" },
];

export function RuleStepCard({
  step,
  index,
  totalSteps,
  onUpdate,
  onToggle,
  onRemove,
  onMove,
}: RuleStepCardProps) {
  const icon = RULE_ICONS[step.type] || "sliders";
  const badgeColor = RULE_BADGE_COLORS[step.type] || "var(--accent-color, #6366f1)";

  return (
    <div className={`rule-step-card ${step.enabled ? "is-enabled" : "is-disabled"}`}>
      <div className="rule-step-header">
        <div className="rule-step-left">
          <label className="rule-step-toggle" title={step.enabled ? "Desactivar paso" : "Activar paso"}>
            <input
              type="checkbox"
              checked={step.enabled}
              onChange={() => onToggle(step.id)}
            />
            <span className="rule-step-index" style={{ backgroundColor: badgeColor }}>
              {String(index + 1).padStart(2, "0")}
            </span>
          </label>
          <div className="rule-step-title-group">
            <span className="rule-step-icon" style={{ color: badgeColor }}>
              <Icon name={icon} />
            </span>
            <strong className="rule-step-title">{step.title}</strong>
          </div>
        </div>

        <div className="rule-step-actions">
          <button
            type="button"
            className="rule-action-btn"
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            title="Mover arriba"
            aria-label="Mover paso arriba"
          >
            <Icon name="chevron-left" />
          </button>
          <button
            type="button"
            className="rule-action-btn"
            disabled={index === totalSteps - 1}
            onClick={() => onMove(index, 1)}
            title="Mover abajo"
            aria-label="Mover paso abajo"
          >
            <Icon name="chevron-down" />
          </button>
          <button
            type="button"
            className="rule-action-btn is-delete"
            onClick={() => onRemove(step.id)}
            title="Eliminar este paso"
            aria-label="Eliminar paso"
          >
            <Icon name="trash" />
          </button>
        </div>
      </div>

      <div className="rule-step-body">
        {step.type === "template" && (
          <TemplateRuleEditor
            config={step.config as TemplateRuleConfig}
            onChange={(cfg) => onUpdate(step.id, cfg)}
          />
        )}
        {step.type === "replace" && (
          <ReplaceRuleEditor
            config={step.config as ReplaceRuleConfig}
            onChange={(cfg) => onUpdate(step.id, cfg)}
          />
        )}
        {step.type === "add" && (
          <AddRuleEditor
            config={step.config as AddRuleConfig}
            onChange={(cfg) => onUpdate(step.id, cfg)}
          />
        )}
        {step.type === "counter" && (
          <CounterRuleEditor
            config={step.config as CounterRuleConfig}
            onChange={(cfg) => onUpdate(step.id, cfg)}
          />
        )}
        {step.type === "case" && (
          <CaseRuleEditor
            config={step.config as CaseRuleConfig}
            onChange={(cfg) => onUpdate(step.id, cfg)}
          />
        )}
        {step.type === "remove" && (
          <RemoveRuleEditor
            config={step.config as RemoveRuleConfig}
            onChange={(cfg) => onUpdate(step.id, cfg)}
          />
        )}
        {step.type === "extension" && (
          <ExtensionRuleEditor
            config={step.config as ExtensionRuleConfig}
            onChange={(cfg) => onUpdate(step.id, cfg)}
          />
        )}
      </div>
    </div>
  );
}

// ── Editores Específicos por Tipo de Regla ──

function TemplateRuleEditor({
  config,
  onChange,
}: {
  config: TemplateRuleConfig;
  onChange: (cfg: Partial<TemplateRuleConfig>) => void;
}) {
  const insertToken = (token: string) => {
    onChange({ pattern: (config.pattern || "") + token });
  };

  return (
    <div className="rule-editor-stack">
      <div className="rule-input-group">
        <div className="rule-label-with-action">
          <label>Patrón de Plantilla</label>
          {config.pattern ? (
            <button
              type="button"
              className="rule-clear-label-btn"
              onClick={() => onChange({ pattern: "" })}
              title="Limpiar patrón"
              aria-label="Limpiar patrón"
            >
              <Icon name="broom" />
              <span>Limpiar</span>
            </button>
          ) : null}
        </div>
        <input
          type="text"
          className="rule-text-input"
          value={config.pattern}
          onChange={(e) => onChange({ pattern: e.target.value })}
          placeholder="ej. [Carpeta] - [Contador] o [Nombre]"
        />
      </div>

      <div className="rule-token-chips">
        <span className="rule-token-label">Tokens:</span>
        <button type="button" className="rule-token-btn" onClick={() => insertToken("[Nombre]")} title="Nombre original del archivo sin extensión">
          [Nombre]
        </button>
        <button type="button" className="rule-token-btn" onClick={() => insertToken("[Contador]")} title="Contador numérico secuencial">
          [Contador]
        </button>
        <button type="button" className="rule-token-btn" onClick={() => insertToken("[Carpeta]")} title="Nombre de carpeta contenedora">
          [Carpeta]
        </button>
        <button type="button" className="rule-token-btn" onClick={() => insertToken("[Fecha]")} title="Fecha de modificación (YYYY-MM-DD)">
          [Fecha]
        </button>
        <button type="button" className="rule-token-btn" onClick={() => insertToken("[Año]")} title="Año (YYYY)">
          [Año]
        </button>
        <button type="button" className="rule-token-btn" onClick={() => insertToken("[Mes]")} title="Mes (MM)">
          [Mes]
        </button>
        <button type="button" className="rule-token-btn" onClick={() => insertToken("[Hora]")} title="Hora (HH-MM-SS)">
          [Hora]
        </button>
        <button type="button" className="rule-token-btn" onClick={() => insertToken("[Total]")} title="Cantidad total de archivos">
          [Total]
        </button>
        <button type="button" className="rule-token-btn" onClick={() => insertToken("[Ext]")} title="Extensión del archivo">
          [Ext]
        </button>
      </div>

      <div className="rule-input-group">
        <label>Iniciar en</label>
        <input
          type="number"
          className="rule-number-input"
          value={config.counterStart}
          onChange={(e) => onChange({ counterStart: parseInt(e.target.value, 10) || 1 })}
        />
      </div>

      <div className="rule-input-group">
        <label>Relleno de Ceros</label>
        <CustomSelect
          value={config.counterPadding}
          onChange={(val) => onChange({ counterPadding: val })}
          options={PADDING_OPTIONS}
        />
      </div>
    </div>
  );
}

function ReplaceRuleEditor({
  config,
  onChange,
}: {
  config: ReplaceRuleConfig;
  onChange: (cfg: Partial<ReplaceRuleConfig>) => void;
}) {
  return (
    <div className="rule-editor-stack">
      <div className="rule-input-group">
        <div className="rule-label-with-action">
          <label>Buscar Texto</label>
          {config.find ? (
            <button
              type="button"
              className="rule-clear-label-btn"
              onClick={() => onChange({ find: "" })}
              title="Limpiar búsqueda"
              aria-label="Limpiar búsqueda"
            >
              <Icon name="broom" />
              <span>Limpiar</span>
            </button>
          ) : null}
        </div>
        <input
          type="text"
          className="rule-text-input"
          value={config.find}
          onChange={(e) => onChange({ find: e.target.value })}
          placeholder="Texto o patrón a buscar"
        />
      </div>

      <div className="rule-input-group">
        <div className="rule-label-with-action">
          <label>Reemplazar Por</label>
          {config.replace ? (
            <button
              type="button"
              className="rule-clear-label-btn"
              onClick={() => onChange({ replace: "" })}
              title="Limpiar reemplazo"
              aria-label="Limpiar reemplazo"
            >
              <Icon name="broom" />
              <span>Limpiar</span>
            </button>
          ) : null}
        </div>
        <input
          type="text"
          className="rule-text-input"
          value={config.replace}
          onChange={(e) => onChange({ replace: e.target.value })}
          placeholder="Texto de sustitución"
        />
      </div>

      <div className="rule-checkbox-row">
        <label className="rule-checkbox-item">
          <input
            type="checkbox"
            checked={config.matchCase}
            onChange={(e) => onChange({ matchCase: e.target.checked })}
          />
          <span>Distinguir Mayúsculas/Minúsculas</span>
        </label>
        <label className="rule-checkbox-item">
          <input
            type="checkbox"
            checked={config.useRegex}
            onChange={(e) => onChange({ useRegex: e.target.checked })}
          />
          <span>Expresión Regular (Regex)</span>
        </label>
        <label className="rule-checkbox-item">
          <input
            type="checkbox"
            checked={config.replaceAll}
            onChange={(e) => onChange({ replaceAll: e.target.checked })}
          />
          <span>Reemplazar Todas</span>
        </label>
      </div>
    </div>
  );
}

function AddRuleEditor({
  config,
  onChange,
}: {
  config: AddRuleConfig;
  onChange: (cfg: Partial<AddRuleConfig>) => void;
}) {
  return (
    <div className="rule-editor-stack">
      <div className="rule-input-group">
        <div className="rule-label-with-action">
          <label>Texto a Añadir</label>
          {config.text ? (
            <button
              type="button"
              className="rule-clear-label-btn"
              onClick={() => onChange({ text: "" })}
              title="Limpiar texto"
              aria-label="Limpiar texto"
            >
              <Icon name="broom" />
              <span>Limpiar</span>
            </button>
          ) : null}
        </div>
        <input
          type="text"
          className="rule-text-input"
          value={config.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="ej. _4k o [Album]"
        />
      </div>

      <div className="rule-input-group">
        <label>Posición</label>
        <CustomSelect
          value={config.position}
          onChange={(val) => onChange({ position: val as any })}
          options={ADD_POSITION_OPTIONS}
        />
      </div>

      {config.position === "position" && (
        <div className="rule-input-group">
          <label>Índice de Carácter (0 = Inicio)</label>
          <input
            type="number"
            className="rule-number-input"
            value={config.customIndex ?? 0}
            onChange={(e) => onChange({ customIndex: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
      )}
    </div>
  );
}

function CounterRuleEditor({
  config,
  onChange,
}: {
  config: CounterRuleConfig;
  onChange: (cfg: Partial<CounterRuleConfig>) => void;
}) {
  return (
    <div className="rule-editor-stack">
      <div className="rule-input-group">
        <label>Iniciar en</label>
        <input
          type="number"
          className="rule-number-input"
          value={config.start}
          onChange={(e) => onChange({ start: parseInt(e.target.value, 10) || 1 })}
        />
      </div>

      <div className="rule-input-group">
        <label>Incremento</label>
        <input
          type="number"
          className="rule-number-input"
          value={config.step}
          onChange={(e) => onChange({ step: parseInt(e.target.value, 10) || 1 })}
        />
      </div>

      <div className="rule-input-group">
        <label>Relleno de Ceros</label>
        <CustomSelect
          value={config.padding}
          onChange={(val) => onChange({ padding: val })}
          options={PADDING_OPTIONS}
        />
      </div>

      <div className="rule-input-group">
        <div className="rule-label-with-action">
          <label>Prefijo del Contador</label>
          {config.prefix ? (
            <button
              type="button"
              className="rule-clear-label-btn"
              onClick={() => onChange({ prefix: "" })}
              title="Limpiar prefijo"
              aria-label="Limpiar prefijo"
            >
              <Icon name="broom" />
              <span>Limpiar</span>
            </button>
          ) : null}
        </div>
        <input
          type="text"
          className="rule-text-input"
          value={config.prefix}
          onChange={(e) => onChange({ prefix: e.target.value })}
          placeholder="ej. ' - ' o '_'"
        />
      </div>

      <div className="rule-input-group">
        <label>Posición</label>
        <CustomSelect
          value={config.position}
          onChange={(val) => onChange({ position: val as any })}
          options={COUNTER_POSITION_OPTIONS}
        />
      </div>
    </div>
  );
}

function CaseRuleEditor({
  config,
  onChange,
}: {
  config: CaseRuleConfig;
  onChange: (cfg: Partial<CaseRuleConfig>) => void;
}) {
  return (
    <div className="rule-editor-stack">
      <div className="rule-input-group">
        <label>Modo de Transformación</label>
        <CustomSelect
          value={config.mode}
          onChange={(val) => onChange({ mode: val as CaseMode })}
          options={CASE_MODE_OPTIONS}
        />
      </div>
      <div className="rule-input-group">
        <label>Aplicar A</label>
        <CustomSelect
          value={config.target}
          onChange={(val) => onChange({ target: val as any })}
          options={CASE_TARGET_OPTIONS}
        />
      </div>
    </div>
  );
}

function RemoveRuleEditor({
  config,
  onChange,
}: {
  config: RemoveRuleConfig;
  onChange: (cfg: Partial<RemoveRuleConfig>) => void;
}) {
  return (
    <div className="rule-editor-stack">
      <div className="rule-input-group">
        <label>Tipo de Eliminación</label>
        <CustomSelect
          value={config.removeType}
          onChange={(val) => onChange({ removeType: val as RemoveType })}
          options={REMOVE_TYPE_OPTIONS}
        />
      </div>

      {(config.removeType === "first_n" || config.removeType === "last_n") && (
        <div className="rule-input-group">
          <label>Cantidad de Caracteres</label>
          <input
            type="number"
            className="rule-number-input"
            value={config.count ?? 1}
            onChange={(e) => onChange({ count: parseInt(e.target.value, 10) || 1 })}
          />
        </div>
      )}

      {config.removeType === "custom" && (
        <div className="rule-input-group">
          <div className="rule-label-with-action">
            <label>Texto a Eliminar</label>
            {config.customText ? (
              <button
                type="button"
                className="rule-clear-label-btn"
                onClick={() => onChange({ customText: "" })}
                title="Limpiar texto"
                aria-label="Limpiar texto"
              >
                <Icon name="broom" />
                <span>Limpiar</span>
              </button>
            ) : null}
          </div>
          <input
            type="text"
            className="rule-text-input"
            value={config.customText ?? ""}
            onChange={(e) => onChange({ customText: e.target.value })}
            placeholder="Texto a remover del nombre"
          />
        </div>
      )}
    </div>
  );
}

function ExtensionRuleEditor({
  config,
  onChange,
}: {
  config: ExtensionRuleConfig;
  onChange: (cfg: Partial<ExtensionRuleConfig>) => void;
}) {
  return (
    <div className="rule-editor-stack">
      <div className="rule-input-group">
        <label>Tratamiento de Extensión</label>
        <CustomSelect
          value={config.mode}
          onChange={(val) => onChange({ mode: val as any })}
          options={EXTENSION_MODE_OPTIONS}
        />
      </div>

      {config.mode === "custom" && (
        <div className="rule-input-group">
          <div className="rule-label-with-action">
            <label>Nueva Extensión</label>
            {config.customExt ? (
              <button
                type="button"
                className="rule-clear-label-btn"
                onClick={() => onChange({ customExt: "" })}
                title="Limpiar extensión"
                aria-label="Limpiar extensión"
              >
                <Icon name="broom" />
                <span>Limpiar</span>
              </button>
            ) : null}
          </div>
          <input
            type="text"
            className="rule-text-input"
            value={config.customExt ?? ""}
            onChange={(e) => onChange({ customExt: e.target.value })}
            placeholder="ej. webp o mp4"
          />
        </div>
      )}
    </div>
  );
}
