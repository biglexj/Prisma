import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import catalog from "../src/features/wallpapers/compositor/catalog.json";
import { DYNAMIC_BACKGROUND_GROUPS } from "../src/features/wallpapers/compositor/aurora/catalog";

const VENDOR_DIR = resolve(import.meta.dir, "../src/features/wallpapers/compositor/aurora");
const UPSTREAM_DIR = resolve(
  import.meta.dir,
  "../../Aurora---Blog/frontend/src/features/Comunidad/EspacioVtuber/islands/three/dynamic-backgrounds",
);

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256Lf(buffer: Buffer): string {
  return createHash("sha256")
    .update(buffer.toString("utf8").replace(/\r\n/g, "\n"))
    .digest("hex");
}

/** Deriva entre el archivo de origen en Aurora y el hash registrado. Es informativo. */
function driftAgainstUpstream(file: string, recorded: string): boolean {
  const upstream = resolve(UPSTREAM_DIR, file);
  if (!existsSync(upstream)) return false;
  const raw = readFileSync(upstream);
  return ![sha256(raw), sha256Lf(raw)].includes(recorded);
}

describe("Subconjunto Aurora distribuido por Prisma", () => {
  test("la galería conserva los grupos y el orden del catálogo Aurora", () => {
    for (const group of DYNAMIC_BACKGROUND_GROUPS) {
      const label=group.label === "Escenas principales" ? "Escenarios 3D" : "Efectos 3D";
      expect(catalog.filter(item=>item.uiGroup===label).map(item=>item.type)).toEqual(group.backgrounds.map(item=>item.type));
    }
  });

  test("cada archivo vendorizado es verificable sin el repositorio vecino", () => {
    const provenance = JSON.parse(readFileSync(resolve(VENDOR_DIR, "provenance.json"), "utf8"));
    expect(Object.keys(provenance.sha256).length).toBeGreaterThan(10);

    for (const [file, vendoredSha] of Object.entries(provenance.vendoredSha256 as Record<string, string>)) {
      const localPath = resolve(VENDOR_DIR, file.endsWith(".js") ? file.replace(/\.js$/, ".ts") : file);
      expect(existsSync(localPath)).toBe(true);
      const raw = readFileSync(localPath);
      expect([sha256(raw), sha256Lf(raw)]).toContain(vendoredSha);
    }

    for (const [file, entry] of Object.entries(provenance.external ?? {}) as [string,{sha256:string;vendoredSha256:string}][]) {
      const localPath = resolve(VENDOR_DIR, file);
      expect(existsSync(localPath)).toBe(true);
      const raw = readFileSync(localPath);
      expect([sha256(raw), sha256Lf(raw)]).toContain(entry.vendoredSha256);
    }
  });

  test("la deriva del origen en Aurora se informa sin depender de ella", () => {
    const provenance = JSON.parse(readFileSync(resolve(VENDOR_DIR, "provenance.json"), "utf8"));
    const drifted: string[] = [];

    for (const [file, upstreamSha] of Object.entries(provenance.sha256 as Record<string, string>)) {
      if (driftAgainstUpstream(file, upstreamSha)) drifted.push(file);
    }
    for (const [file, entry] of Object.entries(provenance.external ?? {}) as [string,{source:string;sha256:string}][]) {
      const upstream = resolve(UPSTREAM_DIR, entry.source);
      if (existsSync(upstream) && sha256(readFileSync(upstream)) !== entry.sha256) drifted.push(file);
    }

    // Aurora evoluciona por su cuenta: la deriva se informa y no invalida la copia de Prisma.
    if (drifted.length > 0) {
      console.warn(
        `[wallpaper-compositor] ${drifted.length} archivo(s) de origen cambiaron en Aurora; revisa si conviene re-vendorizar: ${drifted.join(", ")}`,
      );
    }
    expect(Array.isArray(drifted)).toBe(true);
  });
});
