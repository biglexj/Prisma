import type { ContributionBody, ContributionReceipt } from "./publicLyricsClient";

export interface SavedContribution {
  key: string;
  body: ContributionBody;
  receipt?: ContributionReceipt;
  actorId?: string;
}

const STORAGE_KEY = "prisma.lyrics.contributions.v1";
export function loadContributions(): SavedContribution[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(data) ? data.filter(item => item && typeof item.key === "string"
      && typeof item.body?.title === "string" && typeof item.body?.artist === "string") : [];
  } catch { return []; }
}

/** Persistir ANTES de enviar; si falla el almacenamiento, no enviar. Sin rutas ni audio. */
export function saveContribution(item: SavedContribution) {
  const saved = loadContributions();
  const index = saved.findIndex(entry => entry.key === item.key);
  if (index >= 0) saved[index] = item;
  else saved.push(item);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

export function prepareContribution(body: ContributionBody, actorId = "anonymous"): SavedContribution {
  const previous = loadContributions().find(item => (item.actorId ?? "anonymous") === actorId && JSON.stringify(item.body) === JSON.stringify(body));
  const item = previous ?? { key: crypto.randomUUID(), body, actorId };
  saveContribution(item);
  return item;
}
