import { describe, expect, it } from "bun:test";

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

describe("Fondos Vivos — Lógica de colas y ordenación", () => {
  it("orden natural clasifica números secuencialmente (2 antes de 10)", () => {
    const files = ["video_10.mp4", "video_2.mp4", "video_1.mp4", "video_20.mp4"];
    files.sort(naturalCompare);
    expect(files).toEqual(["video_1.mp4", "video_2.mp4", "video_10.mp4", "video_20.mp4"]);
  });

  it("cola combinada de carpetas respeta el orden A -> B -> C", () => {
    const folderA = ["C:/A/2.mp4", "C:/A/10.mp4"];
    const folderB = ["C:/B/1.mp4", "C:/B/5.mp4"];
    folderA.sort(naturalCompare);
    folderB.sort(naturalCompare);

    const combinedQueue = [...folderA, ...folderB];
    expect(combinedQueue).toEqual([
      "C:/A/2.mp4",
      "C:/A/10.mp4",
      "C:/B/1.mp4",
      "C:/B/5.mp4",
    ]);
  });

  it("deduplica rutas canónicas idénticas sin perder el orden", () => {
    const raw = ["C:/Videos/1.mp4", "C:/Videos/2.mp4", "C:/Videos/1.mp4", "C:/Videos/3.mp4"];
    const unique: string[] = [];
    for (const path of raw) {
      if (!unique.includes(path)) {
        unique.push(path);
      }
    }
    expect(unique).toEqual(["C:/Videos/1.mp4", "C:/Videos/2.mp4", "C:/Videos/3.mp4"]);
  });

  it("desactivar una carpeta excluye sus vídeos de la cola activa", () => {
    const sources = [
      { id: "A", enabled: true, videos: ["A1.mp4", "A2.mp4"] },
      { id: "B", enabled: false, videos: ["B1.mp4", "B2.mp4"] },
      { id: "C", enabled: true, videos: ["C1.mp4"] },
    ];

    const activeVideos = sources
      .filter((s) => s.enabled)
      .flatMap((s) => s.videos);

    expect(activeVideos).toEqual(["A1.mp4", "A2.mp4", "C1.mp4"]);
    expect(activeVideos.includes("B1.mp4")).toBe(false);
  });
});
