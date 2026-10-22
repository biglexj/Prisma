import { expect, test } from "bun:test";
import { folderForLibrary } from "../src/shared/dropRouter";

test("la carpeta de biblioteca es la que contiene el archivo", () => {
  expect(folderForLibrary("C:\\Users\\biglexj\\Video.mp4")).toBe("C:\\Users\\biglexj");
  expect(folderForLibrary("C:\\Users\\biglexj\\Música\\cancion.mp3")).toBe("C:\\Users\\biglexj\\Música");
});

test("las barras oblicuas se normalizan", () => {
  expect(folderForLibrary("C:/Users/biglexj/Video.mp4")).toBe("C:\\Users\\biglexj");
});

test("un archivo sin carpeta no rompe la zona", () => {
  expect(folderForLibrary("Video.mp4")).toBe("Video.mp4");
});
