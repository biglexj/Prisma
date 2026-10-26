import type { IconName } from "./ui/Icon";
import catalog from "./ecosystem.json";

/**
 * Datos del ecosistema biglexj.
 *
 * Se alimentan directamente de ecosystem.json (la fuente central de verdad).
 * Al cambiar ecosystem.json y compilar, los datos se reflejan automáticamente
 * sin necesidad de modificar código internamente.
 */

export type EcosystemKind = "desktop" | "mobile";

export interface EcosystemApp {
  id: string;
  name: string;
  category: string;
  kind: EcosystemKind;
  iconPath?: string;
  fallbackIcon: IconName;
  description: string;
  longDescription?: string;
  linkUrl: string;
  linkLabel: string;
  /** Integrada con Aurora Synapse: pasa archivos y eventos entre aplicaciones. */
  synergy?: boolean;
  /** Aún no disponible en el ecosistema: se muestra como "Próximamente". */
  comingSoon?: boolean;
}

/** Estado local de una app del ecosistema, detectado por el backend. */
export interface EcosystemAppState {
  id: string;
  installed: boolean;
  path: string | null;
  hasSource: boolean;
  sourcePath: string | null;
}

export type EcosystemStatusTone = "active" | "installed" | "source" | "online" | "missing" | "soon";

export interface EcosystemStatus {
  label: string;
  tone: EcosystemStatusTone;
}

const FALLBACK_ICONS: Record<string, IconName> = {
  "aurora-synapse": "layers",
  "super-gallery": "smartphone",
  "luna-fetch": "download",
  "gallery-dl-gui": "image",
  "prisma-upscaler": "expand",
  "davinci-flow": "film",
  "davinci-exportador": "film",
  "lyraflow": "mic",
  "wintts": "subtitles",
  "ely-tesia": "list-music",
  "mouziflow": "folder",
  "ely-intelligence": "sparkles",
  "nubix": "hard-drive",
  "prisma": "disc",
  "aurora-hub": "layers",
};

/** Stable catalog identity; the Dev build is still Prisma. */
export const HOST_APP_ID = "prisma";

export function appsForHost<T extends { id: string; executable: boolean; visibility?: string; status?: string }>(apps: T[], hostAppId: string): T[] {
  return apps.filter((app) => app.executable && app.id !== hostAppId && app.visibility !== "internal" && app.status !== "Interno");
}

export function countInstalledEcosystemApps(apps: { id: string }[], states: Record<string, EcosystemAppState>): number {
  return apps.filter(app => states[app.id]?.installed).length;
}

export const ECOSYSTEM_APPS: EcosystemApp[] = appsForHost(catalog.apps, HOST_APP_ID)
  .map((app) => ({
    id: app.id,
    name: app.name,
    category: app.category,
    kind: (app.id === "super-gallery" ? "mobile" : "desktop") as EcosystemKind,
    iconPath: app.icon ? "/" + app.icon.replace(/^\/+/, "") : undefined,
    fallbackIcon: FALLBACK_ICONS[app.id] || "box",
    description: app.shortDescription || app.description,
    longDescription: app.longDescription || app.description,
    linkUrl: app.githubUrl || "https://www.biglexj.com/desarrollo",
    linkLabel: app.status === "Disponible" ? "Detalles" : (app.status === "Experimental" ? "Experimental" : "Ecosistema"),
    synergy: app.synergy,
    comingSoon: app.status === "Próximamente",
  }));

export const ECOSYSTEM_KIND_FILTERS: { id: EcosystemKind | "all"; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "desktop", label: "Escritorio" },
  { id: "mobile", label: "Móvil" },
];

/**
 * Traduce el estado de una app a la etiqueta y el tono que se muestran.
 *
 * El orden importa: una app marcada como "próximamente" no se considera
 * instalada aunque el backend la encuentre en disco.
 */
export function resolveEcosystemStatus(app: EcosystemApp, state?: EcosystemAppState): EcosystemStatus {
  if (app.comingSoon) return { label: "Próximamente", tone: "soon" };
  if (app.kind === "mobile") return { label: "Android", tone: "online" };
  if (state?.installed) {
    return app.synergy
      ? { label: "Sinergia Activa", tone: "active" }
      : { label: "Instalada", tone: "installed" };
  }
  if (state?.hasSource) return { label: "Código local", tone: "source" };
  return { label: "No instalada", tone: "missing" };
}
