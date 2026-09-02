import type {
  PreviewItem,
  PreviewStatus,
  RenamerFileItem,
  RuleStep,
  TemplateRuleConfig,
  ReplaceRuleConfig,
  AddRuleConfig,
  CounterRuleConfig,
  CaseRuleConfig,
  RemoveRuleConfig,
  ExtensionRuleConfig,
  CaseMode,
} from "./types";

const INVALID_CHARS_REGEX = /[<>:"/\\|?*\x00-\x1F]/;

export function splitFileName(fullName: string, isDir: boolean): { base: string; ext: string } {
  if (isDir) {
    return { base: fullName, ext: "" };
  }
  const lastDot = fullName.lastIndexOf(".");
  if (lastDot <= 0) {
    return { base: fullName, ext: "" };
  }
  return {
    base: fullName.slice(0, lastDot),
    ext: fullName.slice(lastDot + 1),
  };
}

export function formatCounter(val: number, padding: number): string {
  const s = String(val);
  if (s.length >= padding) return s;
  return s.padStart(padding, "0");
}

export function toCaseMode(text: string, mode: CaseMode): string {
  switch (mode) {
    case "lowercase":
      return text.toLowerCase();
    case "uppercase":
      return text.toUpperCase();
    case "titlecase":
      return text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    case "sentencecase":
      return text.charAt(0).toUpperCase() + text.substring(1).toLowerCase();
    case "camelcase": {
      const words = text.replace(/[-_.\s]+/g, " ").trim().split(" ");
      return words
        .map((w, idx) => (idx === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.substring(1).toLowerCase()))
        .join("");
    }
    case "kebabcase":
      return text
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_.]+/g, "-")
        .toLowerCase();
    case "snakecase":
      return text
        .replace(/([a-z])([A-Z])/g, "$1_$2")
        .replace(/[\s\-.]+/g, "_")
        .toLowerCase();
    default:
      return text;
  }
}

export function formatTimestamp(millis: number): {
  date: string;
  time: string;
  year: string;
  month: string;
  day: string;
} {
  const d = millis > 0 ? new Date(millis) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = String(d.getFullYear());
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}-${mins}-${secs}`,
    year,
    month,
    day,
  };
}

export function applyTemplate(
  base: string,
  ext: string,
  fileItem: RenamerFileItem,
  config: TemplateRuleConfig,
  counterValue: number,
  totalItems: number = 0
): string {
  if (!config.pattern || !config.pattern.trim()) {
    return base;
  }
  let result = config.pattern;
  const counterStr = formatCounter(counterValue, config.counterPadding);
  const { date, time, year, month, day } = formatTimestamp(fileItem.modifiedAtMillis);

  // Extraer nombre de carpeta contenedora
  const parentFolder = (() => {
    const norm = fileItem.path.replace(/\\/g, "/");
    const parts = norm.split("/");
    return parts.length > 1 ? parts[parts.length - 2] : "";
  })();

  // 1. Tokens de Nombre Original
  result = result.replace(/\[(Nombre|Name)\]/gi, base);

  // 2. Tokens de Contador / Numeración
  result = result.replace(/\[(Contador|Counter|Numero|Número|Num)\]/gi, counterStr);
  result = result.replace(/\[01\]/gi, formatCounter(counterValue, 2));
  result = result.replace(/\[001\]/gi, formatCounter(counterValue, 3));
  result = result.replace(/\[0001\]/gi, formatCounter(counterValue, 4));

  // 3. Tokens de Carpeta / Directorio
  result = result.replace(/\[(Carpeta|Parent|Folder|Directorio)\]/gi, parentFolder);

  // 4. Tokens de Fecha y Tiempo
  result = result.replace(/\[(Fecha|Date)\]/gi, date);
  result = result.replace(/\[(Hora|Time|Tiempo)\]/gi, time);
  result = result.replace(/\[(Año|Year|Anio)\]/gi, year);
  result = result.replace(/\[(Mes|Month)\]/gi, month);
  result = result.replace(/\[(Dia|Day|Día)\]/gi, day);

  // 5. Token de Extensión
  result = result.replace(/\[(Ext|Extension|Extensión)\]/gi, ext);

  // 6. Token Total
  result = result.replace(/\[(Total|Cantidad)\]/gi, String(totalItems || ""));

  return result;
}

export function applyReplace(text: string, config: ReplaceRuleConfig): string {
  if (!config.find) return text;

  if (config.useRegex) {
    try {
      const flags = (config.matchCase ? "" : "i") + (config.replaceAll ? "g" : "");
      const rx = new RegExp(config.find, flags);
      return text.replace(rx, config.replace);
    } catch {
      return text;
    }
  }

  if (config.matchCase) {
    if (config.replaceAll) {
      return text.split(config.find).join(config.replace);
    }
    return text.replace(config.find, config.replace);
  }

  // Case insensitive plain replace
  const flags = config.replaceAll ? "gi" : "i";
  const escaped = config.find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, flags), config.replace);
}

export function applyAdd(text: string, config: AddRuleConfig): string {
  if (!config.text) return text;

  switch (config.position) {
    case "start":
      return config.text + text;
    case "end":
      return text + config.text;
    case "position": {
      const idx = Math.max(0, Math.min(text.length, config.customIndex ?? 0));
      return text.slice(0, idx) + config.text + text.slice(idx);
    }
    case "before_match": {
      if (!config.matchText) return text;
      const idx = text.indexOf(config.matchText);
      if (idx === -1) return text;
      return text.slice(0, idx) + config.text + text.slice(idx);
    }
    case "after_match": {
      if (!config.matchText) return text;
      const idx = text.indexOf(config.matchText);
      if (idx === -1) return text;
      const insertAt = idx + config.matchText.length;
      return text.slice(0, insertAt) + config.text + text.slice(insertAt);
    }
    default:
      return text;
  }
}

export function applyCounter(
  text: string,
  config: CounterRuleConfig,
  counterValue: number
): string {
  const counterStr = `${config.prefix || ""}${formatCounter(
    counterValue,
    config.padding
  )}${config.suffix || ""}`;

  switch (config.position) {
    case "start":
      return counterStr + text;
    case "end":
      return text + counterStr;
    case "custom_pos": {
      const idx = Math.max(0, Math.min(text.length, config.customIndex ?? 0));
      return text.slice(0, idx) + counterStr + text.slice(idx);
    }
    default:
      return text + counterStr;
  }
}

export function applyRemove(text: string, config: RemoveRuleConfig): string {
  switch (config.removeType) {
    case "first_n": {
      const n = Math.max(0, config.count ?? 1);
      return text.slice(n);
    }
    case "last_n": {
      const n = Math.max(0, config.count ?? 1);
      return text.slice(0, Math.max(0, text.length - n));
    }
    case "numbers":
      return text.replace(/\d+/g, "");
    case "symbols":
      return text.replace(/[^\p{L}\p{N}\s._-]/gu, "");
    case "brackets":
      return text
        .replace(/\[.*?\]/g, "")
        .replace(/\(.*?\)/g, "")
        .replace(/\{.*?\}/g, "");
    case "spaces":
      return text.replace(/\s+/g, " ").trim();
    case "custom": {
      if (!config.customText) return text;
      return text.split(config.customText).join("");
    }
    default:
      return text;
  }
}

/**
 * Calcula la vista previa de renombrado para todos los elementos recibidos.
 */
export function computeRenamingPreview(
  items: RenamerFileItem[],
  steps: RuleStep[],
  selectedPaths: Set<string>
): PreviewItem[] {
  const enabledSteps = steps.filter((s) => s.enabled);
  let selectedCounter = 0;

  // Paso 1: Transformar cada archivo individualmente
  const initialResults: Array<{
    original: RenamerFileItem;
    base: string;
    ext: string;
    selected: boolean;
  }> = [];

  for (const item of items) {
    const isSelected = selectedPaths.has(item.path);
    const { base: initialBase, ext: initialExt } = splitFileName(item.name, item.isDir);

    if (!isSelected || enabledSteps.length === 0) {
      initialResults.push({
        original: item,
        base: initialBase,
        ext: initialExt,
        selected: isSelected,
      });
      continue;
    }

    let currentBase = initialBase;
    let currentExt = initialExt;
    selectedCounter += 1;
    const currentSeqIndex = selectedCounter;

    for (const step of enabledSteps) {
      switch (step.type) {
        case "template": {
          const cfg = step.config as TemplateRuleConfig;
          const val = (cfg.counterStart ?? 1) + (currentSeqIndex - 1) * (cfg.counterStep ?? 1);
          currentBase = applyTemplate(currentBase, currentExt, item, cfg, val, items.length);
          break;
        }
        case "replace": {
          const cfg = step.config as ReplaceRuleConfig;
          currentBase = applyReplace(currentBase, cfg);
          break;
        }
        case "add": {
          const cfg = step.config as AddRuleConfig;
          currentBase = applyAdd(currentBase, cfg);
          break;
        }
        case "counter": {
          const cfg = step.config as CounterRuleConfig;
          const val = (cfg.start ?? 1) + (currentSeqIndex - 1) * (cfg.step ?? 1);
          currentBase = applyCounter(currentBase, cfg, val);
          break;
        }
        case "case": {
          const cfg = step.config as CaseRuleConfig;
          if (cfg.target === "name" || cfg.target === "all") {
            currentBase = toCaseMode(currentBase, cfg.mode);
          }
          if ((cfg.target === "extension" || cfg.target === "all") && currentExt) {
            currentExt = toCaseMode(currentExt, cfg.mode);
          }
          break;
        }
        case "remove": {
          const cfg = step.config as RemoveRuleConfig;
          currentBase = applyRemove(currentBase, cfg);
          break;
        }
        case "extension": {
          const cfg = step.config as ExtensionRuleConfig;
          if (!item.isDir) {
            if (cfg.mode === "lowercase") {
              currentExt = currentExt.toLowerCase();
            } else if (cfg.mode === "uppercase") {
              currentExt = currentExt.toUpperCase();
            } else if (cfg.mode === "custom" && cfg.customExt) {
              currentExt = cfg.customExt.replace(/^\./, "");
            }
          }
          break;
        }
      }
    }

    initialResults.push({
      original: item,
      base: currentBase,
      ext: currentExt,
      selected: isSelected,
    });
  }

  // Paso 2: Reconstruir nombre completo, calcular newPath y detectar conflictos
  const parentFolderMap = new Map<string, Map<string, number>>();

  const intermediateItems = initialResults.map((res) => {
    let finalFullName = res.base.trim();
    if (res.ext && !res.original.isDir) {
      finalFullName = `${finalFullName}.${res.ext}`;
    }

    const normPath = res.original.path.replace(/\\/g, "/");
    const lastSlash = normPath.lastIndexOf("/");
    const parentDir = lastSlash >= 0 ? normPath.slice(0, lastSlash) : "";
    const isWindows = res.original.path.includes("\\");
    const sep = isWindows ? "\\" : "/";
    const newPath = parentDir ? `${parentDir}${sep}${finalFullName}` : finalFullName;

    // Registrar en mapa de duplicados si está seleccionado
    if (res.selected) {
      if (!parentFolderMap.has(parentDir)) {
        parentFolderMap.set(parentDir, new Map());
      }
      const dirMap = parentFolderMap.get(parentDir)!;
      const lowerName = finalFullName.toLowerCase();
      dirMap.set(lowerName, (dirMap.get(lowerName) || 0) + 1);
    }

    return {
      original: res.original,
      newName: finalFullName,
      newPath,
      parentDir,
      selected: res.selected,
      hasChanged: finalFullName !== res.original.name,
    };
  });

  // Paso 3: Asignar estados (Ready, Unchanged, Conflict, Invalid, Excluded)
  return intermediateItems.map((item) => {
    if (!item.selected) {
      return {
        original: item.original,
        newName: item.original.name,
        newPath: item.original.path,
        hasChanged: false,
        selected: false,
        status: "excluded" as PreviewStatus,
      };
    }

    if (!item.newName || item.newName.trim().length === 0) {
      return {
        original: item.original,
        newName: item.newName,
        newPath: item.newPath,
        hasChanged: item.hasChanged,
        selected: true,
        status: "invalid" as PreviewStatus,
        error: "El nombre resultante no puede estar vacío.",
      };
    }

    if (INVALID_CHARS_REGEX.test(item.newName)) {
      return {
        original: item.original,
        newName: item.newName,
        newPath: item.newPath,
        hasChanged: item.hasChanged,
        selected: true,
        status: "invalid" as PreviewStatus,
        error: "Contiene caracteres no permitidos (< > : \" / \\ | ? *)",
      };
    }

    const dirMap = parentFolderMap.get(item.parentDir);
    const count = dirMap?.get(item.newName.toLowerCase()) || 0;
    if (count > 1) {
      return {
        original: item.original,
        newName: item.newName,
        newPath: item.newPath,
        hasChanged: item.hasChanged,
        selected: true,
        status: "conflict" as PreviewStatus,
        error: "Conflicto: Varios archivos tendrían este mismo nombre.",
      };
    }

    if (!item.hasChanged) {
      return {
        original: item.original,
        newName: item.newName,
        newPath: item.newPath,
        hasChanged: false,
        selected: true,
        status: "unchanged" as PreviewStatus,
      };
    }

    return {
      original: item.original,
      newName: item.newName,
      newPath: item.newPath,
      hasChanged: true,
      selected: true,
      status: "ready" as PreviewStatus,
    };
  });
}
