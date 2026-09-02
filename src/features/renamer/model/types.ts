export interface RenamerFileItem {
  path: string;
  name: string;
  extension: string;
  isDir: boolean;
  sizeBytes: number;
  modifiedAtMillis: number;
}

export type RuleType =
  | "template"
  | "replace"
  | "add"
  | "counter"
  | "case"
  | "remove"
  | "extension";

export interface TemplateRuleConfig {
  pattern: string; // e.g. "[Name] - [Counter]"
  counterStart: number;
  counterPadding: number;
  counterStep: number;
}

export interface ReplaceRuleConfig {
  find: string;
  replace: string;
  matchCase: boolean;
  useRegex: boolean;
  replaceAll: boolean;
}

export interface AddRuleConfig {
  text: string;
  position: "start" | "end" | "position" | "before_match" | "after_match";
  customIndex?: number;
  matchText?: string;
}

export interface CounterRuleConfig {
  start: number;
  step: number;
  padding: number;
  position: "start" | "end" | "custom_pos";
  prefix: string;
  suffix: string;
  customIndex?: number;
}

export type CaseMode =
  | "lowercase"
  | "uppercase"
  | "titlecase"
  | "sentencecase"
  | "camelcase"
  | "kebabcase"
  | "snakecase";

export interface CaseRuleConfig {
  mode: CaseMode;
  target: "name" | "extension" | "all";
}

export type RemoveType =
  | "first_n"
  | "last_n"
  | "numbers"
  | "symbols"
  | "brackets"
  | "spaces"
  | "custom";

export interface RemoveRuleConfig {
  removeType: RemoveType;
  count?: number;
  customText?: string;
}

export interface ExtensionRuleConfig {
  mode: "keep" | "lowercase" | "uppercase" | "custom";
  customExt?: string;
}

export type RuleConfig =
  | { type: "template"; config: TemplateRuleConfig }
  | { type: "replace"; config: ReplaceRuleConfig }
  | { type: "add"; config: AddRuleConfig }
  | { type: "counter"; config: CounterRuleConfig }
  | { type: "case"; config: CaseRuleConfig }
  | { type: "remove"; config: RemoveRuleConfig }
  | { type: "extension"; config: ExtensionRuleConfig };

export interface RuleStep {
  id: string;
  title: string;
  enabled: boolean;
  type: RuleType;
  config:
    | TemplateRuleConfig
    | ReplaceRuleConfig
    | AddRuleConfig
    | CounterRuleConfig
    | CaseRuleConfig
    | RemoveRuleConfig
    | ExtensionRuleConfig;
}

export type PreviewStatus = "ready" | "unchanged" | "conflict" | "invalid" | "excluded";

export interface PreviewItem {
  original: RenamerFileItem;
  newName: string;
  newPath: string;
  hasChanged: boolean;
  selected: boolean;
  status: PreviewStatus;
  error?: string;
}

export interface RenameOperation {
  oldPath: string;
  newPath: string;
  originalName: string;
  newName: string;
}

export interface RenameBatchResult {
  renamedCount: number;
  errors: string[];
  canUndo: boolean;
  operations: RenameOperation[];
}

export type FilterMode = "all" | "image" | "video" | "audio" | "document" | "custom";

export interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  steps: RuleStep[];
}
