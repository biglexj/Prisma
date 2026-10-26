import { OFFICIAL_AURORA_ORIGIN } from "./auroraServer";
import { isNewerVersion } from "./semver";

/**
 * Comprobación de actualizaciones de Prisma.
 *
 * Fuente primaria: la API de Aurora (`/api/v1/apps/prisma/latest`), que es
 * donde el script de publicación registra cada release con su URL de descarga
 * y su checksum. Fuente secundaria: GitHub Releases.
 *
 * Se consulta SIEMPRE el origen oficial sin "www": el host con "www" responde
 * 307 sin cabeceras CORS y el navegador bloquearía la petición. Es el mismo
 * motivo por el que la app de escritorio se quedaba sin wallpapers.
 *
 * No se consulta el servidor Aurora personalizado de Preferencias: es un
 * servidor de desarrollo y no publica releases.
 */

export type UpdateSource = "aurora" | "github";

export interface AppUpdateInfo {
  /** Versión publicada, sin prefijo "v". */
  version: string;
  /** Etiqueta de Git, con prefijo "v". */
  tag: string;
  source: UpdateSource;
  /** URL directa del instalador, si se conoce. */
  downloadUrl: string | null;
  /** Página de la release, para consultar las notas completas. */
  releasePageUrl: string | null;
  /** Notas de la versión en markdown, tal cual las publica el origen. */
  releaseNotes: string | null;
  /** Notas saneadas y recortadas, para mostrar en una línea. */
  notesExcerpt: string;
  publishedAt: string | null;
  /** El origen marca la actualización como obligatoria. */
  mandatory: boolean;
  /** Nombre del asset del instalador, si se conoce. */
  assetName: string | null;
}

export type UpdateCheckOutcome =
  | { kind: "up-to-date"; currentVersion: string; latestVersion: string; source: UpdateSource }
  | { kind: "update-available"; currentVersion: string; latest: AppUpdateInfo }
  | { kind: "failed"; currentVersion: string; message: string; attempted: UpdateSource[] };

export interface CheckOptions {
  currentVersion: string;
  /** Inyectable para las pruebas. */
  fetchImpl?: typeof fetch;
  /** Tiempo máximo por fuente, en milisegundos. */
  timeoutMs?: number;
  signal?: AbortSignal;
}

const AURORA_LATEST_PATH = "/api/v1/apps/prisma/latest";
const GITHUB_LATEST_URL = "https://api.github.com/repos/biglexj/Prisma/releases/latest";
const GITHUB_REPO_URL = "https://github.com/biglexj/Prisma";
const DEFAULT_TIMEOUT_MS = 6000;
const NOTES_EXCERPT_LENGTH = 160;

interface AuroraLatestPayload {
  success?: boolean;
  app?: { id?: string; slug?: string; title?: string };
  latestRelease?: {
    versionName?: string;
    versionCode?: number;
    isMandatory?: boolean;
    status?: string;
    downloadUrl?: string | null;
    fileSizeBytes?: number | null;
    sha256Checksum?: string | null;
    releaseNotes?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    publishedAt?: string | null;
  };
}

interface GitHubLatestPayload {
  tag_name?: string;
  name?: string | null;
  body?: string | null;
  published_at?: string | null;
  html_url?: string | null;
  assets?: { name?: string; browser_download_url?: string; size?: number; digest?: string }[];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Quita el marcado markdown para poder mostrar las notas como texto plano.
 *
 * El proyecto no usa librería de markdown y no se va a añadir una: las notas
 * se muestran saneadas en una línea y el texto completo vive en la página de
 * la release, que se abre en el navegador.
 */
export function stripMarkdown(markdown: string): string {
  if (!markdown) return "";

  return markdown
    // Bloques de código cercados, con su contenido.
    .replace(/```[\s\S]*?```/g, " ")
    // Imágenes antes que enlaces: "![alt](url)" → "alt".
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Enlaces: "[texto](url)" → "texto".
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Encabezados, citas y separadores.
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}([-*_]\s*){3,}$/gm, "")
    // Listas con viñeta o numeradas.
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/^\s{0,3}\d+[.)]\s+/gm, "")
    // Énfasis: negrita, cursiva y tachado.
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/~~([^~]+)~~/g, "$1")
    // Enlaces sueltos en ángulo.
    .replace(/<([^>\s]+@[^>\s]+)>/g, "$1")
    .replace(/<(https?:\/\/[^>\s]+)>/g, "$1")
    // Espacios y saltos de línea sueltos.
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

/** Recorta un texto plano a la medida de una línea, con puntos suspensivos. */
export function excerpt(text: string, maxLength: number = NOTES_EXCERPT_LENGTH): string {
  const clean = text.trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

async function fetchJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

/** Lee la release publicada en Aurora. */
async function fetchAurora(
  fetchImpl: typeof fetch,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<AppUpdateInfo> {
  const url = `${OFFICIAL_AURORA_ORIGIN}${AURORA_LATEST_PATH}`;
  const payload = await fetchJson<AuroraLatestPayload>(
    fetchImpl,
    url,
    { headers: { Accept: "application/json" } },
    timeoutMs,
    signal,
  );

  if (!payload || payload.success === false) {
    throw new Error("Aurora devolvió una respuesta no válida");
  }

  const release = payload.latestRelease;
  if (!release || typeof release !== "object") {
    throw new Error("Aurora no tiene ninguna release publicada");
  }

  const version = asString(release.versionName);
  if (!version) {
    throw new Error("Aurora publicó una release sin número de versión");
  }

  // Sólo se consideran las releases publicadas.
  if (release.status && release.status !== "published") {
    throw new Error(`La release de Aurora está en estado "${release.status}"`);
  }

  const notes = asString(release.releaseNotes);
  const downloadUrl = asString(release.downloadUrl);

  return {
    version: version.replace(/^[vV]/, ""),
    tag: `v${version.replace(/^[vV]/, "")}`,
    source: "aurora",
    downloadUrl,
    releasePageUrl: `${GITHUB_REPO_URL}/releases/tag/v${version.replace(/^[vV]/, "")}`,
    releaseNotes: notes,
    notesExcerpt: excerpt(stripMarkdown(notes ?? "")),
    publishedAt: asString(release.publishedAt) ?? asString(release.createdAt) ?? asString(release.updatedAt),
    mandatory: release.isMandatory === true,
    assetName: downloadUrl ? downloadUrl.split("/").pop() ?? null : null,
  };
}

/** Lee la última release publicada en GitHub. */
async function fetchGitHub(
  fetchImpl: typeof fetch,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<AppUpdateInfo> {
  const payload = await fetchJson<GitHubLatestPayload>(
    fetchImpl,
    GITHUB_LATEST_URL,
    { headers: { Accept: "application/vnd.github+json" } },
    timeoutMs,
    signal,
  );

  const tag = asString(payload?.tag_name);
  if (!tag) {
    throw new Error("GitHub no devolvió una release válida");
  }

  const version = tag.replace(/^[vV]/, "");

  // Se prefiere el asset del instalador de Windows x64. El nombre actual no
  // lleva el sufijo "_x64"; el patrón viejo se acepta por compatibilidad con
  // releases ya publicadas.
  const assets = Array.isArray(payload.assets) ? payload.assets : [];
  const installer =
    assets.find((asset) => /(?:_x64)?-setup\.exe$/i.test(asset.name ?? "")) ??
    assets.find((asset) => /\.exe$/i.test(asset.name ?? ""));

  const notes = asString(payload.body);

  return {
    version,
    tag: tag.startsWith("v") || tag.startsWith("V") ? tag : `v${version}`,
    source: "github",
    downloadUrl: asString(installer?.browser_download_url),
    releasePageUrl: asString(payload.html_url) ?? `${GITHUB_REPO_URL}/releases/tag/v${version}`,
    releaseNotes: notes,
    notesExcerpt: excerpt(stripMarkdown(notes ?? "")),
    publishedAt: asString(payload.published_at),
    mandatory: false,
    assetName: asString(installer?.name),
  };
}

/** Si Aurora sabe la versión pero no el instalador, se busca en GitHub. */
async function completeDownloadUrl(
  info: AppUpdateInfo,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<AppUpdateInfo> {
  if (info.downloadUrl) return info;

  try {
    const github = await fetchGitHub(fetchImpl, timeoutMs, signal);
    if (github.version === info.version && github.downloadUrl) {
      return { ...info, downloadUrl: github.downloadUrl, assetName: github.assetName };
    }
  } catch {
    // Sin asset se cae a la página de la release, que ya estáinformada.
  }

  return info;
}

/**
 * Consulta si hay una versión nueva.
 *
 * Nunca lanza: cualquier fallo se convierte en el desenlace "failed" con un
 * mensaje en español. La única excepción controlable es la cancelación
 * externa, que también se reporta como fallo sincrónico.
 */
export async function checkForAppUpdate(options: CheckOptions): Promise<UpdateCheckOutcome> {
  const {
    currentVersion,
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
  } = options;

  const attempted: UpdateSource[] = [];

  // ── Fuente primaria: Aurora ──
  attempted.push("aurora");
  let aurora: AppUpdateInfo | null = null;
  try {
    aurora = await fetchAurora(fetchImpl, timeoutMs, signal);
  } catch {
    aurora = null;
  }

  if (aurora) {
    if (isNewerVersion(aurora.version, currentVersion)) {
      const complete = await completeDownloadUrl(aurora, fetchImpl, timeoutMs, signal);
      return { kind: "update-available", currentVersion, latest: complete };
    }
  }

  // ── Fuente secundaria: GitHub ──
  //
  // Se consulta también cuando Aurora ya respondió, y no sólo como recurso
  // de emergencia: el defecto que se corrige es precisamente mentir al
  // usuario, y un "estás al día" basado en una única fuente puede ser falso.
  attempted.push("github");
  let github: AppUpdateInfo | null = null;
  try {
    github = await fetchGitHub(fetchImpl, timeoutMs, signal);
  } catch {
    github = null;
  }

  if (github && isNewerVersion(github.version, currentVersion)) {
    return { kind: "update-available", currentVersion, latest: github };
  }

  if (aurora || github) {
    const winner = aurora ?? github!;
    return {
      kind: "up-to-date",
      currentVersion,
      latestVersion: winner.version,
      source: winner.source,
    };
  }

  return {
    kind: "failed",
    currentVersion,
    message: "No se pudo comprobar si hay actualizaciones. Revisa tu conexión a internet e inténtalo de nuevo.",
    attempted,
  };
}

/** Texto en español para el desenlace de la comprobación. */
export function formatUpdateMessage(outcome: UpdateCheckOutcome): string {
  switch (outcome.kind) {
    case "up-to-date": {
      const source = outcome.source === "aurora" ? "Aurora" : "GitHub";
      return `Estás en la última versión oficial (v${outcome.currentVersion}). Comprobado en ${source}.`;
    }
    case "update-available": {
      const prefix = outcome.latest.mandatory ? "Actualización obligatoria" : "Hay una versión nueva disponible";
      return `${prefix}: v${outcome.latest.version}.`;
    }
    case "failed":
      return outcome.message;
  }
}
