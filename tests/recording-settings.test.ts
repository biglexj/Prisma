import { expect, test } from "bun:test";
import {
  DEFAULT_RECORDING_PREFERENCES,
  RECORDING_FPS_OPTIONS,
  loadRecordingPreferences,
} from "../src/features/screen_capture/model/recordingSettings";

test("sin almacenamiento disponible se usan los valores por defecto", () => {
  const preferences = loadRecordingPreferences();
  expect(preferences.fps).toBe(DEFAULT_RECORDING_PREFERENCES.fps);
  expect(preferences.audioDevice).toBeNull();
});

test("las opciones de fotogramas están dentro del rango soportado", () => {
  for (const fps of RECORDING_FPS_OPTIONS) {
    expect(fps).toBeGreaterThanOrEqual(5);
    expect(fps).toBeLessThanOrEqual(60);
  }
});
