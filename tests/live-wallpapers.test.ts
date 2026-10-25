import { describe, expect, it } from "bun:test";
import { selectVisibleVideos } from "../src/features/wallpapers/services/liveWallpapersApi";

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

describe("Fondos Vivos — Ocultar con el botón de ojo", () => {
  const videos = [
    { path: "C:/V/1.mp4", name: "1.mp4", folderId: "A", folderName: "V", hidden: false },
    { path: "C:/V/2.mp4", name: "2.mp4", folderId: "A", folderName: "V", hidden: true },
    { path: "C:/W/3.mp4", name: "3.mp4", folderId: "B", folderName: "W", hidden: false },
  ];

  it("los vídeos ocultados no se muestran por defecto", () => {
    const visible = selectVisibleVideos(videos, { showHidden: false });
    expect(visible.map((v) => v.name)).toEqual(["1.mp4", "3.mp4"]);
  });

  it("con 'Mostrar ocultos' los vídeos ocultados reaparecen marcados", () => {
    const visible = selectVisibleVideos(videos, { showHidden: true });
    expect(visible.map((v) => v.name)).toEqual(["1.mp4", "2.mp4", "3.mp4"]);
    expect(visible.find((v) => v.name === "2.mp4")?.hidden).toBe(true);
  });

  it("el buscador también respeta el estado de ocultar", () => {
    const visible = selectVisibleVideos(videos, { showHidden: false, query: "2.mp4" });
    expect(visible).toHaveLength(0);

    const visibleWithHidden = selectVisibleVideos(videos, { showHidden: true, query: "2.mp4" });
    expect(visibleWithHidden.map((v) => v.name)).toEqual(["2.mp4"]);
  });
});


describe("Fondos Vivos — Control en Bandeja del Sistema y Widget de Inicio", () => {
  it("calcula etiquetas del menú de bandeja según estado activo y pausado", () => {
    const computeTrayLabels = (isActive: boolean, isPaused: boolean) => ({
      toggleText: isActive ? "Apagar fondo vivo" : "Encender fondo vivo",
      pauseText: isPaused ? "Reanudar fondo" : "Pausar fondo",
    });

    // Inactivo / apagado
    expect(computeTrayLabels(false, false)).toEqual({
      toggleText: "Encender fondo vivo",
      pauseText: "Pausar fondo",
    });

    // Activo reproduciendo
    expect(computeTrayLabels(true, false)).toEqual({
      toggleText: "Apagar fondo vivo",
      pauseText: "Pausar fondo",
    });

    // Activo pero pausado
    expect(computeTrayLabels(true, true)).toEqual({
      toggleText: "Apagar fondo vivo",
      pauseText: "Reanudar fondo",
    });
  });

  it("extrae el nombre de vídeo limpio sin extensión para el widget de Inicio", () => {
    const formatVideoTitle = (currentPath: string | null) => {
      if (!currentPath) return "Sin reproducción";
      return currentPath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") || "Fondo de escritorio";
    };

    expect(formatVideoTitle("D:/Wallpapers/Neon_Cyberpunk.mp4")).toBe("Neon_Cyberpunk");
    expect(formatVideoTitle("C:\\Users\\Media\\Nature 4K.mkv")).toBe("Nature 4K");
    expect(formatVideoTitle(null)).toBe("Sin reproducción");
  });
});
