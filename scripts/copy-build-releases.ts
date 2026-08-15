import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const bundleDir = join(rootDir, "src-tauri", "target", "release", "bundle");
const releasesDir = join(rootDir, "releases");

if (!existsSync(bundleDir)) {
  console.log("⚠️ No se encontró la carpeta de bundle en:", bundleDir);
  process.exit(0);
}

if (!existsSync(releasesDir)) {
  mkdirSync(releasesDir, { recursive: true });
}

function findArtifacts(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findArtifacts(fullPath));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".exe") ||
        entry.name.endsWith(".msi") ||
        entry.name.endsWith(".AppImage") ||
        entry.name.endsWith(".dmg") ||
        entry.name.endsWith(".deb"))
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

const artifacts = findArtifacts(bundleDir);

if (artifacts.length === 0) {
  console.log("ℹ️ No se encontraron instaladores en el directorio de bundle.");
} else {
  console.log("\n🚀 Copiando instaladores a la carpeta 'releases' en la raíz...");
  for (const artifact of artifacts) {
    const fileName = artifact.split(/[\/\\]/).pop()!;
    const destPath = join(releasesDir, fileName);
    copyFileSync(artifact, destPath);
    console.log(`  ✅ Copiado: releases/${fileName}`);
  }
  console.log(`\n🎉 ¡Listo! Instaladores disponibles en: ${releasesDir}\n`);
}
