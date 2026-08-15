import type { PlaybackSnapshot } from "../model/types";

export function mediaTitle(path: string | null) {
  if (!path) return "Nada reproduciéndose";
  const name = path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
  return name.replace(/\.[^/.]+$/, "");
}

export function folderName(path: string) {
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments.at(-2) ?? "Carpeta local";
}

export function familyLabel(family: "audio" | "image" | "video" | undefined) {
  if (!family) return "Sin familia detectada";
  return { audio: "Audio local", image: "Imágenes locales", video: "Vídeos locales" }[family];
}

export function formatSession(session: PlaybackSnapshot["session"]) {
  if (!session) return "Sin sesión";
  return `${session.currentIndex + 1} de ${session.totalItems}`;
}

export function formatTime(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "--:--";
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function cleanPath(path: string | null): string {
  if (!path) return "";
  return path.replace(/^\\\\\?\\/, "").replace(/^[a-zA-Z]:[/\\]{1,2}/, (match) => match.replace(/\//g, "\\"));
}

