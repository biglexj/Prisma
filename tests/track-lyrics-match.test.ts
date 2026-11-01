import { expect, test } from "bun:test";
import { matchingTrackLyric, publicLyricText } from "../src/features/playback/services/trackLyricsMatch";
import type { PublicLyric } from "../src/features/playback/services/publicLyricsClient";
import { parseLrc } from "../src/features/playback/model/lrcParser";

const lyric: PublicLyric = { id: "work", title: "Y Que Pasó", artist: "Orquesta La Bella Luz", album: null,
  plainLyrics: "Frase de prueba", revision: null, webUrl: "https://biglexj.com/letras/test",
  recordings: [{ id: "live", label: "En vivo", durationSeconds: 233, youtubeId: null, syncedLyrics: "[00:03]Frase de prueba" }] };

test("encuentra la obra de la captura con artista abreviado y diferencias de tildes", () => {
  expect(matchingTrackLyric([lyric], "Y Que Paso", "La bella luz")?.id).toBe("work");
});
test("no identifica otra versión o artista, ni resuelve resultados ambiguos", () => {
  expect(matchingTrackLyric([lyric], "Y Que Pasó (En Vivo)", "La bella luz")).toBeNull();
  expect(matchingTrackLyric([lyric], "Y Que Pasó", "Otro Artista")).toBeNull();
  expect(matchingTrackLyric([lyric, { ...lyric, id: "duplicate" }], "Y Que Pasó", "La bella luz")).toBeNull();
  expect(matchingTrackLyric([lyric], "Y Que Pasó", "")).toBeNull();
});
test("la coincidencia de obra muestra texto y procedencia sin adoptar tiempos de una grabación", () => {
  const parsed = parseLrc(publicLyricText(lyric)!);
  expect(parsed.isSynced).toBe(false);
  expect(parsed.source).toBe("Biglex J");
  expect(parsed.lines[0].text).toBe("Frase de prueba");
  expect(publicLyricText({ ...lyric, plainLyrics: null })).toBeNull();
});
