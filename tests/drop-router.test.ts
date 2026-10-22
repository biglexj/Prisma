import { expect, test } from "bun:test";
import {
  armDropZone,
  claimDropPaths,
  disarmDropZone,
  isClaimedDrop,
  isDropZoneArmed,
} from "../src/shared/dropRouter";

test("la zona de recepción desactiva al manejador global de arrastre", () => {
  disarmDropZone();
  expect(isDropZoneArmed()).toBe(false);

  armDropZone();
  expect(isDropZoneArmed()).toBe(true);

  disarmDropZone();
  expect(isDropZoneArmed()).toBe(false);
});

test("las rutas ya atendidas por la zona no se procesan dos veces", () => {
  claimDropPaths(["C:\\Users\\biglexj\\Video.mp4"]);

  // La comparación normaliza separadores y mayúsculas: el mismo archivo.
  expect(isClaimedDrop(["c:/users/biglexj/video.mp4"])).toBe(true);
  expect(isClaimedDrop(["C:\\Otros\\otro.mp4"])).toBe(false);
  expect(isClaimedDrop([])).toBe(false);
});
