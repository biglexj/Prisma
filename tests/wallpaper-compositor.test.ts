import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import catalog from "../src/features/wallpapers/compositor/catalog.json";
import { DYNAMIC_BACKGROUND_GROUPS } from "../src/features/wallpapers/compositor/aurora/catalog";

describe("Subconjunto Aurora distribuido por Prisma", () => {
  test("la galería conserva los grupos y el orden del catálogo Aurora", () => {
    for (const group of DYNAMIC_BACKGROUND_GROUPS) {
      const label=group.label === "Escenas principales" ? "Escenarios 3D" : "Efectos 3D";
      expect(catalog.filter(item=>item.uiGroup===label).map(item=>item.type)).toEqual(group.backgrounds.map(item=>item.type));
    }
  });
  test("el origen de cada archivo vendorizado es comprobable y no depende del repo vecino para el build", () => {
    const vendor = resolve(import.meta.dir, "../src/features/wallpapers/compositor/aurora");
    const provenance = JSON.parse(readFileSync(resolve(vendor, "provenance.json"), "utf8"));
    expect(Object.keys(provenance.sha256).length).toBeGreaterThan(10);
    for (const [file, sha] of Object.entries(provenance.sha256)) {
      expect(existsSync(resolve(vendor, file.replace(/\.js$/, '.ts')))).toBe(true);
      const upstream = resolve(import.meta.dir, "../../Aurora---Blog/frontend/src/features/Comunidad/EspacioVtuber/islands/three/dynamic-backgrounds", file);
      // Comprobar deriva cuando Aurora está disponible; la copia sigue siendo autónoma.
      if (existsSync(upstream)) {
        expect(createHash("sha256").update(readFileSync(upstream)).digest("hex")).toBe(sha);
      }
    }
    for (const [file, entry] of Object.entries(provenance.external ?? {}) as [string,{source:string;sha256:string}][]) {
      expect(existsSync(resolve(vendor,file))).toBe(true);
      const upstream=resolve(import.meta.dir,"../../Aurora---Blog/frontend/src/features/Comunidad/EspacioVtuber/islands/three/dynamic-backgrounds",entry.source);
      if(existsSync(upstream)) expect(createHash("sha256").update(readFileSync(upstream)).digest("hex")).toBe(entry.sha256);
    }
  });
});
