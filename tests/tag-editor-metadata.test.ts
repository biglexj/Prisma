import { expect, test } from "bun:test";
import { buildBatchTagRequests } from "../src/features/tags/model/metadataDraft";

test("mantiene las coincidencias individuales de cada canción al guardar el lote", () => {
  expect(buildBatchTagRequests(["a.flac", "b.mp3"], {
    "a.flac": { path: "a.flac", title: "Canción A", artist: "Artista A", artwork_base64: "cover-a" },
    "b.mp3": { path: "b.mp3", title: "Canción B", artist: "Artista B" },
  }, { artist: undefined, album: undefined })).toEqual([
    { path: "a.flac", title: "Canción A", artist: "Artista A", artwork_base64: "cover-a" },
    { path: "b.mp3", title: "Canción B", artist: "Artista B" },
  ]);
});

test("los campos comunes explícitos prevalecen sin copiar el título a otras pistas", () => {
  expect(buildBatchTagRequests(["a.flac", "b.mp3"], {
    "a.flac": { path: "a.flac", title: "Canción A", album: "Álbum sugerido", artwork_base64: "cover-a" },
  }, { album: "Álbum elegido", artwork_base64: undefined })).toEqual([
    { path: "a.flac", title: "Canción A", album: "Álbum elegido", artwork_base64: "cover-a" },
    { path: "b.mp3", album: "Álbum elegido" },
  ]);
});

test("descartar una carátula común es explícito y las letras no se añaden al lote", () => {
  expect(buildBatchTagRequests(["a.flac"], { "a.flac": { path: "a.flac", artwork_base64: "cover-a" } }, { artwork_base64: "" }))
    .toEqual([{ path: "a.flac", artwork_base64: "" }]);
});
