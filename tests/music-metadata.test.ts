import { expect, test } from "bun:test";
import { buildMetadataUpdate, cleanMetadataQuery, type MetadataCandidate, type MetadataOptions } from "../src/features/music_library/metadata/metadataSearch";
import type { AudioTagData } from "../src/features/tags/model/types";

const candidate: MetadataCandidate = { title: "Canción", artist: "Intérprete", album: "Álbum", coverUrl: "https://is1-ssl.mzstatic.com/1000x1000bb.jpg", source: "Apple Music" };
const options: MetadataOptions = { title: true, artist: true, album: true, cover: true, onlyMissing: true };
const current = { path: "song.flac", title: "Título propio", artist: " ", album: null, lyrics: "Letra propia", genre: "Folk", track_number: 3 } as AudioTagData;

test("limpia ruido de vídeo y canales Topic sin eliminar versiones musicales", () => {
  expect(cleanMetadataQuery("Intérprete - Topic Canción [Video Oficial] (HD)")).toBe("Intérprete Canción");
  expect(cleanMetadataQuery("Artist Song (Live Remix) [Official Music Video]")).toBe("Artist Song (Live Remix)");
  expect(cleanMetadataQuery("YOASOBI アイドル (Official Audio)")).toBe("YOASOBI アイドル");
});

test("completa únicamente campos vacíos y conserva título propio y demás etiquetas", () => {
  expect(buildMetadataUpdate(current, candidate, options)).toEqual({ path: "song.flac", artist: "Intérprete", album: "Álbum" });
});

test("reemplaza solo los campos activados y nunca vacía un dato por ausencia en catálogo", () => {
  expect(buildMetadataUpdate(current, { ...candidate, album: "" }, { ...options, title: false, onlyMissing: false }))
    .toEqual({ path: "song.flac", artist: "Intérprete" });
});

test("el modo de reemplazo incluye título, artista y álbum elegidos", () => {
  expect(buildMetadataUpdate(current, candidate, { ...options, onlyMissing: false }))
    .toEqual({ path: "song.flac", title: "Canción", artist: "Intérprete", album: "Álbum" });
});

test("seleccionar solo carátula no envía cambios de texto ni letras", () => {
  expect(buildMetadataUpdate(current, candidate, { ...options, title: false, artist: false, album: false }))
    .toEqual({ path: "song.flac" });
});
