import { expect, test } from "bun:test";
import { brushWidthInImage, fitCropToAspect, previewPointToImage } from "../src/features/visual_library/ui/editor/cropGeometry";
import type { AspectRatioOption } from "../src/features/visual_library/ui/editor/editorTypes";

test.each([
  ["1:1", 430, 800],
  ["16:9", 430, 800],
  ["9:16", 430, 800],
  ["4:3", 1600, 900],
  ["3:4", 1600, 900],
] as [AspectRatioOption, number, number][])("%s fills the limiting image edge", (option, width, height) => {
  const crop = fitCropToAspect(option, width, height)!;
  const [targetWidth, targetHeight] = option.split(":").map(Number);
  expect(crop.width === 1 || crop.height === 1).toBe(true);
  expect((crop.width * width) / (crop.height * height)).toBeCloseTo(targetWidth / targetHeight);
  expect(crop.x).toBeCloseTo((1 - crop.width) / 2);
  expect(crop.y).toBeCloseTo((1 - crop.height) / 2);
});

test("the cropped preview maps brush points and thickness back to the source image", () => {
  const crop = { x: 0.1, y: 0.2, width: 0.5, height: 0.4 };
  expect(previewPointToImage(0.25, 0.75, crop)).toEqual({ x: 0.225, y: 0.5 });
  const normalizedWidth = brushWidthInImage(8, 400, crop);
  expect(normalizedWidth * (400 / crop.width)).toBeCloseTo(8);
  expect(normalizedWidth * 2000).toBeCloseTo(20);
});

test("free aspect leaves an existing crop unchanged", () => {
  expect(fitCropToAspect("free", 430, 800)).toBeNull();
  expect(previewPointToImage(0.25, 0.75, null)).toEqual({ x: 0.25, y: 0.75 });
});
