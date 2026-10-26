import { describe, expect, test } from "bun:test";
import { isMobileAudioShortcut } from "../src/features/dsp/mobileAudioShortcut";

const press = { key: "T", code: "KeyT", shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, repeat: false, isComposing: false };
describe("Shift+T del altavoz", () => {
  test("acepta pulsaciones independientes y la tecla física con otra distribución", () => {
    expect(isMobileAudioShortcut(press)).toBe(true);
    expect(isMobileAudioShortcut(press)).toBe(true);
    expect(isMobileAudioShortcut({ ...press, key: "Е" })).toBe(true);
  });
  test("excluye atajo global, texto sin Shift, repetición y composición", () => {
    for (const change of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }, { shiftKey: false }, { repeat: true }, { isComposing: true }, { key: "R", code: "KeyR" }]) {
      expect(isMobileAudioShortcut({ ...press, ...change })).toBe(false);
    }
  });
});
