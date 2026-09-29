import { describe, expect, test } from "bun:test";
import { flyoutAppTarget, selectFlyoutMedia, type FlyoutMediaState, type SystemMediaState } from "../src/features/playback/services/flyoutMedia";

const prisma: FlyoutMediaState = { isPlaying: true, title: "Canción", artist: "Artista", artworkUrl: null, mediaType: "audio" };
const external: SystemMediaState = { ...prisma, title: "Otra canción", sourceAppId: "vlc.exe", appName: "VLC",
  appIconUrl: null, canToggle: true, canNext: false, canPrevious: false };

describe("origen de la tarjeta multimedia", () => {
  test("Prisma en reproducción conserva su nombre, destino y controles", () => {
    const media = selectFlyoutMedia(prisma, external);
    expect(media?.appName).toBe("Prisma");
    expect(media?.title).toBe("Canción");
    expect(media?.sourceAppId).toBeNull();
    expect(flyoutAppTarget(media)).toBeNull();
    expect(media?.canNext).toBe(true);
  });
  test("una sesión externa mantiene sus metadatos, destino y capacidades", () => {
    const media = selectFlyoutMedia({ ...prisma, isPlaying: false }, external);
    expect(media?.appName).toBe("VLC");
    expect(media?.title).toBe("Otra canción");
    expect(flyoutAppTarget(media)).toBe("vlc.exe");
    expect(media?.canNext).toBe(false);
  });
  test("sin nombre fiable el botón abre Prisma y el transporte conserva la sesión externa", () => {
    const media = selectFlyoutMedia({ ...prisma, isPlaying: false }, { ...external, appName: " " });
    expect(media?.appName).toBe("Prisma");
    expect(media?.appIconUrl).toBe("/icon/icon.png");
    expect(flyoutAppTarget(media)).toBeNull();
    expect(media?.sourceAppId).toBe("vlc.exe");
  });
  test("sin reproducción solo queda el volumen", () => {
    expect(selectFlyoutMedia({ ...prisma, isPlaying: false }, null)).toBeNull();
    expect(selectFlyoutMedia({ ...prisma, isPlaying: false }, { ...external, isPlaying: false })).toBeNull();
    expect(selectFlyoutMedia({ ...prisma, title: " " }, { ...external, title: "" })).toBeNull();
  });
  test("al desaparecer una sesión no se conserva su aplicación como destino", () => {
    const paused = { ...prisma, isPlaying: false };
    expect(flyoutAppTarget(selectFlyoutMedia(paused, external))).toBe("vlc.exe");
    expect(flyoutAppTarget(selectFlyoutMedia(paused, null))).toBeNull();
  });
});
