import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const bundleDir = join(rootDir, "src-tauri", "target", "release", "bundle");
const targetDirs = [join(rootDir, "release")];

// Leer la versión actual desde package.json
const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf-8"));
const currentVersion = packageJson.version;

if (!existsSync(bundleDir)) {
  console.log("⚠️ No se encontró la carpeta de bundle en:", bundleDir);
  process.exit(0);
}

for (const targetDir of targetDirs) {
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Limpiar archivos desactualizados (.msi y versiones residuales)
  const existingFiles = readdirSync(targetDir);
  for (const file of existingFiles) {
    if (file.endsWith(".msi") || file.includes("0.6.0")) {
      try {
        unlinkSync(join(targetDir, file));
        console.log(`  🗑️ Eliminado residuo: ${targetDir.split(/[\\/]/).pop()}/${file}`);
      } catch {}
    }
  }
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
      entry.name.endsWith(".exe") &&
      entry.name.includes(`_${currentVersion}_`) &&
      !entry.name.includes("0.6.0")
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

const artifacts = findArtifacts(bundleDir);

if (artifacts.length === 0) {
  console.log(`ℹ️ No se encontraron instaladores para la versión v${currentVersion} en el bundle.`);
} else {
  console.log(`\n🚀 Copiando instalador v${currentVersion} a la carpeta 'release'...`);
  for (const artifact of artifacts) {
    const fileName = artifact.split(/[\/\\]/).pop()!;
    for (const targetDir of targetDirs) {
      const destPath = join(targetDir, fileName);
      copyFileSync(artifact, destPath);
      const folderName = targetDir.split(/[\\/]/).pop()!;
      console.log(`  ✅ Copiado: ${folderName}/${fileName}`);
    }
  }
  console.log(`\n🎉 ¡Listo! Instalador disponible en 'release/'.\n`);
}
