import { describe, expect, test } from "bun:test";
import type { FolderSource, MediaKindMode } from "../src/features/wallpapers/services/liveWallpapersApi";

function filterDisplayedSources(
  sources: FolderSource[],
  isMixed: boolean,
  activeTab: "video" | "image"
): FolderSource[] {
  if (isMixed) return sources;
  if (activeTab === "image") {
    return sources.filter(
      (s) => (s.imageCount ?? 0) > 0 || (s.videoCount ?? 0) === 0
    );
  }
  return sources.filter(
    (s) => (s.videoCount ?? s.mediaCount) > 0 || (s.imageCount ?? 0) === 0
  );
}

function getSourceDisplayCount(
  source: FolderSource,
  isMixed: boolean,
  activeTab: "video" | "image"
): number {
  if (isMixed) return source.mediaCount;
  if (activeTab === "image") return source.imageCount ?? 0;
  return source.videoCount ?? source.mediaCount;
}

function computeTargetCombineMode(
  combine: boolean,
  activeTab: "video" | "image"
): MediaKindMode {
  return combine ? "mixed" : activeTab === "image" ? "image" : "video";
}

describe("Separación lógica de vídeos e imágenes en Fondos Vivos", () => {
  const sampleSources: FolderSource[] = [
    {
      id: "src_1",
      path: "C:\\Videos\\Gaming",
      name: "Gaming",
      enabled: true,
      videoCount: 15,
      imageCount: 0,
      mediaCount: 15,
      available: true,
      hidden: false,
    },
    {
      id: "src_2",
      path: "C:\\Wallpapers\\Anime",
      name: "Anime Wallpapers",
      enabled: true,
      videoCount: 0,
      imageCount: 42,
      mediaCount: 42,
      available: true,
      hidden: false,
    },
    {
      id: "src_3",
      path: "C:\\Media\\Mixed",
      name: "Mixto",
      enabled: true,
      videoCount: 8,
      imageCount: 12,
      mediaCount: 20,
      available: true,
      hidden: false,
    },
    {
      id: "src_4",
      path: "C:\\Empty\\NewFolder",
      name: "Nueva Carpeta",
      enabled: true,
      videoCount: 0,
      imageCount: 0,
      mediaCount: 0,
      available: true,
      hidden: false,
    },
  ];

  test("Pestaña de vídeos: puro vídeos (excluye carpetas que son exclusivamente de imágenes)", () => {
    const displayed = filterDisplayedSources(sampleSources, false, "video");
    const names = displayed.map((s) => s.name);

    expect(names).toContain("Gaming");
    expect(names).toContain("Mixto");
    expect(names).toContain("Nueva Carpeta"); // Carpeta vacía recién añadida se preserva
    expect(names).not.toContain("Anime Wallpapers"); // 0 vídeos y 42 imágenes queda excluida
  });

  test("Pestaña de imágenes: puro imágenes (excluye carpetas que son exclusivamente de vídeos)", () => {
    const displayed = filterDisplayedSources(sampleSources, false, "image");
    const names = displayed.map((s) => s.name);

    expect(names).toContain("Anime Wallpapers");
    expect(names).toContain("Mixto");
    expect(names).toContain("Nueva Carpeta");
    expect(names).not.toContain("Gaming"); // 15 vídeos y 0 imágenes queda excluida
  });

  test("Modo Mezcla / Combinar: incluye todas las carpetas", () => {
    const displayed = filterDisplayedSources(sampleSources, true, "video");
    expect(displayed.length).toBe(sampleSources.length);
  });

  test("Recuento mostrado en chip es contextual al modo", () => {
    const mixedFolder = sampleSources.find((s) => s.name === "Mixto")!;

    // En vídeos: muestra solo videoCount (8)
    expect(getSourceDisplayCount(mixedFolder, false, "video")).toBe(8);

    // En imágenes: muestra solo imageCount (12)
    expect(getSourceDisplayCount(mixedFolder, false, "image")).toBe(12);

    // En combinar: muestra mediaCount total (20)
    expect(getSourceDisplayCount(mixedFolder, true, "video")).toBe(20);
  });

  test("Por defecto Mezcla está apagada (Separado) y conmuta correctamente", () => {
    // Por defecto apagado: targetMode es el modo de la pestaña actual
    expect(computeTargetCombineMode(false, "video")).toBe("video");
    expect(computeTargetCombineMode(false, "image")).toBe("image");

    // Al pulsar Combinar: pasa a 'mixed'
    expect(computeTargetCombineMode(true, "video")).toBe("mixed");
    expect(computeTargetCombineMode(true, "image")).toBe("mixed");
  });
});
