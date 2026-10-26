type AudioShortcutEvent = Pick<KeyboardEvent, "key" | "code" | "shiftKey" | "ctrlKey" | "altKey" | "metaKey" | "repeat" | "isComposing">;

export function isMobileAudioShortcut(event: AudioShortcutEvent): boolean {
  return event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey &&
    !event.repeat && !event.isComposing && (event.code === "KeyT" || event.key.toLowerCase() === "t");
}
