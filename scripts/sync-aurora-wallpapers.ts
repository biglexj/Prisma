/** Sincronización explícita, nunca durante build. No modifica Aurora. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { createHash } from "node:crypto";

const source = resolve(import.meta.dir, "../../Aurora---Blog/frontend/src/features/Comunidad/EspacioVtuber/islands/three/dynamic-backgrounds");
const target = resolve(import.meta.dir, "../src/features/wallpapers/compositor/aurora");
const visited = new Set<string>();
const manifest: Record<string, string> = {};

// Subconjunto inicial: ambiente y dos efectos sin dependencias del sitio web.
const upstreamIndex = readFileSync(resolve(source, "index.ts"), "utf8");
const contract = upstreamIndex.slice(upstreamIndex.indexOf("export interface DynamicBackground"), upstreamIndex.indexOf("/** Carga"));
const index = `import type * as THREE from 'three';\nimport type { BackgroundControls } from './controls';\n${contract}
export async function createBackgroundEffect(type: string): Promise<DynamicBackground | null> {
  if (type === 'prisma') return new (await import('./prisma/PrismaBackground')).PrismaBackground();
  if (type === 'borealis') return new (await import('./borealis/BorealisBackground')).BorealisBackground();
  if (type === 'cybercity') return new (await import('./cybercity/CyberCityBackground')).CyberCityBackground();
  return null;
}\n`;

function copy(file: string) {
  if (visited.has(file)) return;
  visited.add(file);
  const original = readFileSync(resolve(source, file), "utf8");
  manifest[file] = createHash("sha256").update(original).digest("hex");
  let content = original;
  if (file === "index.ts") content = index;
  if (file === "catalog.ts") content = "export function supportsBackgroundCamera(type: string): boolean { return ['ambient', 'cybercity'].includes(type); }\n";
  if (file === "controls.ts") {
    content = original.slice(0, original.indexOf("const KEY ="))
      .replace(/^import .*from 'react';\r?\n/m, "")
      .replace(/^import .*from '\.\/catalog';\r?\n/m, "");
  }
  const destination = resolve(target, file.replace(/\.js$/, '.ts'));
  // Aurora mantiene algunas fábricas como JS sin checkJs. Se conserva su lógica.
  if (file.endsWith('.js')) content = '// @ts-nocheck — fábrica JavaScript original de Aurora\n' + content;
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.\n${content}`);
  for (const match of content.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)) {
    let dependency = resolve(dirname(resolve(source, file)), match[1]);
    if (dependency.endsWith(".js") && existsSync(dependency.slice(0, -3) + '.ts')) dependency = dependency.slice(0, -3) + ".ts";
    if (!/\.(ts|js)$/.test(dependency)) dependency += ".ts";
    if (!dependency.startsWith(source + "/") && !dependency.startsWith(source + "\\")) throw new Error("Import fuera de Aurora: " + dependency);
    if (!existsSync(dependency)) throw new Error("Import no resuelto: " + dependency);
    copy(relative(source, dependency).replaceAll("\\", "/"));
  }
}
copy("LayeredBackgroundComposer.ts");
writeFileSync(resolve(target, "provenance.json"), JSON.stringify({
  source: "Aurora---Blog/frontend/src/features/Comunidad/EspacioVtuber/islands/three/dynamic-backgrounds",
  adaptations: ["index.ts: Prisma, Borealis y CyberCity", "controls.ts: tipos y valores por defecto sin store React", "catalog.ts: capacidades del subconjunto importado", "fábricas JS: extensión TS sin checkJs; lógica original"],
  sha256: manifest,
}, null, 2) + "\n");
console.log(`Aurora: ${visited.size} archivos sincronizados.`);
