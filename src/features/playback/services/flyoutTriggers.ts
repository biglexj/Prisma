/** Transport shortcuts that may present the flyout when the player accepts them. */
export function isFlyoutMediaShortcut(event: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "altKey" | "metaKey">): boolean {
  const hardware = ["MediaPlayPause", "MediaTrackNext", "MediaTrackPrevious"];
  if (hardware.includes(event.key) || hardware.includes(event.code)) return true;
  return !event.ctrlKey && !event.altKey && !event.metaKey
    && (["F6", "F7", "F8"].includes(event.key) || ["F6", "F7", "F8"].includes(event.code));
}
