import { describe, expect, test } from "bun:test";
import { isFlyoutMediaShortcut } from "../src/features/playback/services/flyoutTriggers";

const keyEvent = (key: string, overrides = {}) => ({ key, code: key, ctrlKey: false, altKey: false, metaKey: false, ...overrides });

describe("manual flyout transport shortcuts", () => {
  test("previous, play/pause and next function keys are eligible", () => {
    for (const key of ["F6", "F7", "F8"]) expect(isFlyoutMediaShortcut(keyEvent(key))).toBe(true);
  });
  test("hardware transport keys are eligible even when key is unidentified", () => {
    for (const code of ["MediaTrackPrevious", "MediaPlayPause", "MediaTrackNext"])
      expect(isFlyoutMediaShortcut(keyEvent("Unidentified", { code }))).toBe(true);
  });
  test("modified function keys and unrelated playback keys do not present the panel", () => {
    for (const modifier of ["ctrlKey", "altKey", "metaKey"])
      for (const key of ["F6", "F7", "F8"])
        expect(isFlyoutMediaShortcut(keyEvent(key, { [modifier]: true }))).toBe(false);
    for (const key of [" ", "k", "ArrowRight", "MediaStop", "F5", "Unidentified"])
      expect(isFlyoutMediaShortcut(keyEvent(key))).toBe(false);
  });
});
