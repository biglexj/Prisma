import { afterEach, describe, expect, test } from "bun:test";
import { buildContribution, getContribution, searchPublicLyrics, submitContribution } from "../src/features/playback/services/publicLyricsClient";
import { loadContributions, prepareContribution, saveContribution } from "../src/features/playback/services/lyricsContributions";
import { parseLrc } from "../src/features/playback/model/lrcParser";

const originalFetch = globalThis.fetch;
const originalStorage = globalThis.localStorage;
afterEach(() => { globalThis.fetch = originalFetch; Object.defineProperty(globalThis, "localStorage", { value: originalStorage, configurable: true }); });
function storage() {
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
  } });
}
function respond(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = ((url: string | URL | Request, init: RequestInit = {}) => Promise.resolve(handler(String(url), init))) as typeof fetch;
}

describe("contrato público de letras", () => {
  test("busca candidatos por título y artista sin audio, ruta ni identidad y conserva las versiones", async () => {
    const signal = new AbortController().signal;
    respond((url, init) => {
      const parsed = new URL(url);
      expect(parsed.searchParams.get("title")).toBe("Canción & tú");
      expect(parsed.searchParams.get("artist")).toBe("Artista");
      expect(parsed.searchParams.get("offset")).toBe("20");
      expect(init.credentials).toBe("omit");
      expect(init.headers).toBeUndefined();
      return Response.json({ items: [{ id: "obra", match: "candidate", syncedLyrics: null,
        recordings: [{ id: "live", label: "En vivo", syncedLyrics: "[00:10]Vivo" }, { id: "studio", label: "Estudio", syncedLyrics: "[00:01]Vivo" }] }], nextOffset: 40 });
    });
    const result = await searchPublicLyrics(" Canción & tú ", "Artista", 20, signal);
    expect(result.items[0].recordings.map(item => item.id)).toEqual(["live", "studio"]);
    expect(result.nextOffset).toBe(40);
  });
  test("tolera un error HTTP sin JSON", async () => {
    respond(() => new Response("proxy unavailable", { status: 503 }));
    await expect(searchPublicLyrics("A", "B", 0, new AbortController().signal)).rejects.toThrow("503");
  });
  test("propaga la cancelación", async () => {
    respond((_url, init) => { init.signal!.throwIfAborted(); return Response.json({ items: [] }); });
    const controller = new AbortController(); controller.abort();
    await expect(searchPublicLyrics("A", "B", 0, controller.signal)).rejects.toThrow();
  });
  test("conserva cuerpo, clave y comprobante para reintentos y seguimiento privado", async () => {
    storage();
    const body = buildContribution("Canción", "Artista", undefined, "Hola", "", 0);
    const first = prepareContribution(body);
    const receipt = { id: "recibo", status: "pending" as const, lyricId: null, receiptToken: "privado" };
    respond((url, init) => {
      if (init.method === "POST") {
        expect(init.body).toBe(JSON.stringify(body));
        expect(new Headers(init.headers).get("Idempotency-Key")).toBe(first.key);
        expect(new Headers(init.headers).has("Authorization")).toBe(false);
        return Response.json(receipt, { status: 202 });
      }
      expect(url).not.toContain("privado");
      expect(new Headers(init.headers).get("X-Contribution-Token")).toBe("privado");
      return Response.json({ id: "recibo", status: "approved", lyricId: "publicado" });
    });
    const result = await submitContribution(first.body, first.key, new AbortController().signal);
    expect(result.status).toBe("pending");
    saveContribution({ ...first, receipt: result });
    expect(prepareContribution(body).key).toBe(first.key);
    const otherUser = prepareContribution(body, "other-user");
    expect(otherUser.key).not.toBe(first.key);
    expect(prepareContribution(body, "other-user").key).toBe(otherUser.key);
    expect(prepareContribution({ ...body, plainLyrics: "Cambio" }).key).not.toBe(first.key);
    expect(loadContributions()[0].receipt?.receiptToken).toBe("privado");
    expect((await getContribution(receipt, new AbortController().signal)).status).toBe("approved");
  });
  test("no prepara un envío si falla la persistencia", () => {
    storage();
    localStorage.setItem = () => { throw new Error("Sin espacio"); };
    expect(() => prepareContribution({ title: "A", artist: "B", plainLyrics: "C" })).toThrow("Sin espacio");
  });
  test("valida versión, orden, duración, tamaño y frases sin marca", () => {
    const build = (text: string, label = "Estudio", duration = 10) => buildContribution("A", "B", undefined, text, label, duration);
    expect(() => build("[00:01]Hola", "")).toThrow("nombre de versión");
    expect(() => build("[00:02]A\n[00:01]B")).toThrow("orden");
    expect(() => build("[00:11]A")).toThrow("duración");
    expect(() => build("[00:01]A\nB")).toThrow("Cada línea");
    expect(() => build("a".repeat(100001))).toThrow("100000");
    expect(() => build("[00:99]A")).toThrow("inválidas");
    expect(build("[00:01.1]A\n[00:03.123]B").recording?.durationSeconds).toBe(10);
    expect(build("A\nB").plainLyrics).toBe("A\nB");
  });
  test("conserva procedencia local y no la aporta como parte de la letra", () => {
    const text = "[source:LRCLIB · Estudio]\n[00:01]Hola";
    const parsed = parseLrc(text);
    expect(parsed.source).toBe("LRCLIB · Estudio");
    expect(parsed.lines).toHaveLength(1);
    expect(buildContribution("A", "B", undefined, text, "Estudio", 10).syncedLyrics).toBe("[00:01]Hola");
  });
  test("respeta Retry-After e impide consultas durante el límite", async () => {
    let calls = 0;
    respond(() => { calls++; return new Response("limited", { status: 429, headers: { "Retry-After": "60" } }); });
    await expect(searchPublicLyrics("A", "B", 0, new AbortController().signal)).rejects.toThrow("minuto");
    await expect(searchPublicLyrics("A", "B", 0, new AbortController().signal)).rejects.toThrow("Espera");
    expect(calls).toBe(1);
  });
});
