import { join } from "node:path";

const projectRoot = process.cwd();
const sourcePath = join(projectRoot, "public", "icon", "Icon.png");
const iconsDirectory = join(projectRoot, "src-tauri", "icons");
const fingerprintPath = join(iconsDirectory, ".icon-source.sha256");
const requiredOutputs = [
  "32x32.png",
  "64x64.png",
  "128x128.png",
  "128x128@2x.png",
  "icon.png",
  "icon.ico",
  "icon.icns",
];

async function sha256(path: string): Promise<string> {
  const bytes = await Bun.file(path).arrayBuffer();
  return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

if (!(await Bun.file(sourcePath).exists())) {
  console.error(`No se encontró la fuente canónica del icono: ${sourcePath}`);
  process.exit(1);
}

const sourceFingerprint = await sha256(sourcePath);
const savedFingerprint = (await Bun.file(fingerprintPath).exists())
  ? (await Bun.file(fingerprintPath).text()).trim()
  : "";
const outputsExist = (
  await Promise.all(
    requiredOutputs.map((output) => Bun.file(join(iconsDirectory, output)).exists()),
  )
).every(Boolean);

if (savedFingerprint === sourceFingerprint && outputsExist) {
  console.log("✓ Iconos nativos actualizados; no es necesario regenerarlos.");
  process.exit(0);
}

console.log("La fuente del icono cambió. Regenerando recursos nativos...");
const generation = Bun.spawnSync(
  ["bunx", "tauri", "icon", sourcePath, "--output", iconsDirectory],
  {
    cwd: projectRoot,
    stdout: "inherit",
    stderr: "pipe",
  },
);
const errorOutput = generation.stderr.toString();

if (errorOutput) {
  process.stderr.write(errorOutput);
}

if (generation.exitCode !== 0) {
  if (process.platform === "win32" && /os error 1224|sección asignada a usuario/i.test(errorOutput)) {
    console.error(
      "Windows mantiene un icono nativo abierto. Cierra Prisma y cualquier vista previa de la carpeta src-tauri/icons; después ejecuta de nuevo `bun run icons:generate`.",
    );
  }
  process.exit(generation.exitCode || 1);
}

await Bun.write(fingerprintPath, `${sourceFingerprint}\n`);
console.log("✓ Iconos nativos regenerados desde public/icon/Icon.png.");
