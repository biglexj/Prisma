#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(import.meta.dir, "..");

function readJson(path: string): any {
    return JSON.parse(readFileSync(path, "utf-8"));
}

function sha256(filePath: string): string {
    const buffer = readFileSync(filePath);
    return createHash("sha256").update(buffer).digest("hex");
}

function runCmdSync(cmd: string[], cwd = root): { stdout: string; stderr: string; code: number } {
    const res = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
    return {
        stdout: res.stdout.toString().trim(),
        stderr: res.stderr.toString().trim(),
        code: res.exitCode ?? 0,
    };
}

const pkg = readJson(join(root, "package.json"));
const appVersion = pkg.version;
const appName = "Prisma";
const repository = "biglexj/Prisma";

const help = `Prisma: mise <dev|build|release|publish> [opciones]
  dev      Ejecutar en modo desarrollo (Tauri v2 + Vite).
  build    Compilar frontend y binario de escritorio sin generar instalador.
  release  Generar instalador Inno Setup y artefactos locales en release/.
  publish  [github|all] Publicar en GitHub y sincronizar ficha en Aurora.
  --plan   Mostrar los comandos o el plan sin ejecutar acciones ni escribir.
  --check  Para publish: verificar requisitos locales y remotos sin escribir.

Ejemplos:
  mise dev
  mise dev --plan
  mise build --plan
  mise release --plan
  mise publish --plan
  mise publish github --plan
  mise publish --check
`;

async function handlePublish(args: string[]): Promise<number> {
    const isPlan = args.includes("--plan");
    const isCheck = args.includes("--check");
    const positional = args.filter((arg) => !arg.startsWith("-"));
    const channel = positional[0] ?? "all";

    if (!["all", "github"].includes(channel)) {
        throw new Error(`Canal desconocido: ${channel}. Usa 'github' o 'all'.`);
    }

    const effectiveChannels = channel === "github" ? ["GitHub Releases"] : ["GitHub Releases", "Aurora Web (biglexj.com)"];

    console.log(`\n=== Publicación: ${appName} v${appVersion} ===`);
    console.log(`Repositorio : ${repository}`);
    console.log(`Canales     : ${effectiveChannels.join(" + ")}`);

    if (isPlan) {
        console.log("\n[Plan de publicación]");
        console.log("1. Verificar que el repositorio esté en rama preview limpia y commit en remoto.");
        console.log(`2. Comprobar instalador local: release/Prisma_${appVersion}-setup.exe.`);
        console.log("3. Validar RELEASE_MESSAGE.md (notas de versión públicas sin secretos).");
        console.log(`4. Crear tag git v${appVersion} y GitHub Release vía gh.`);
        if (channel === "all") {
            console.log("5. Sincronizar metadatos y enlace de descarga en Aurora (https://www.biglexj.com).");
        } else {
            console.log("5. Sincronización con Aurora omitida (canal explícito: github).");
        }
        console.log("\n(--plan completado: no se realizaron cambios ni consultas de red)");
        return 0;
    }

    if (isCheck) {
        console.log("\n[Comprobación de preparación (--check)]");
        let hasErrors = false;

        // 1. Git status & branch
        const branchCheck = runCmdSync(["git", "branch", "--show-current"]);
        const currentBranch = branchCheck.stdout;
        if (currentBranch !== "preview") {
            console.warn(`⚠️  Aviso: La rama actual es '${currentBranch}'. El estándar de Prisma publica desde 'preview'.`);
        } else {
            console.log("✅ Rama 'preview' seleccionada.");
        }

        const gitStatus = runCmdSync(["git", "status", "--porcelain"]);
        if (gitStatus.stdout) {
            console.warn("⚠️  Aviso: El repositorio tiene cambios locales sin confirmar.");
        } else {
            console.log("✅ Árbol Git limpio.");
        }

        // 2. Git tag
        const tagCheck = runCmdSync(["git", "tag", "-l", `v${appVersion}`]);
        if (tagCheck.stdout.includes(`v${appVersion}`)) {
            console.warn(`⚠️  El tag v${appVersion} ya existe localmente.`);
        } else {
            console.log(`✅ Tag v${appVersion} libre localmente.`);
        }

        // 3. Artefactos en release/
        const installerName = `Prisma_${appVersion}-setup.exe`;
        const installerPath = join(root, "release", installerName);
        if (existsSync(installerPath)) {
            const st = statSync(installerPath);
            const hash = sha256(installerPath);
            console.log(`✅ Instalador presente: ${installerName} (${(st.size / 1024 / 1024).toFixed(2)} MB)`);
            console.log(`   SHA-256: ${hash}`);
        } else {
            console.warn(`❌ Instalador no encontrado en release/${installerName}. Ejecuta 'mise release' antes de publicar.`);
            hasErrors = true;
        }

        // 4. Notas de versión
        const notesPath = join(root, "RELEASE_MESSAGE.md");
        if (existsSync(notesPath)) {
            const notes = readFileSync(notesPath, "utf-8");
            if (notes.includes(`Prisma ${appVersion}`)) {
                console.log(`✅ RELEASE_MESSAGE.md presente y encabeza la versión ${appVersion}.`);
            } else {
                console.warn(`⚠️  RELEASE_MESSAGE.md no menciona la versión ${appVersion}.`);
            }
        } else {
            console.warn("⚠️  RELEASE_MESSAGE.md no encontrado en la raíz.");
        }

        console.log("\n(--check completado: modo solo lectura sin escrituras)");
        return hasErrors ? 1 : 0;
    }

    console.error("\n❌ Publicación bloqueada: Requiere confirmación y autorización explícita para publicar en producción.");
    console.error("   Usa --plan para revisar los pasos previstos o --check para verificar el estado de los artefactos.");
    return 1;
}

export async function main(args = Bun.argv.slice(2)): Promise<number> {
    const [action, ...rest] = args;
    if (!action || action === "--help" || rest.includes("--help")) {
        console.log(help);
        return 0;
    }

    if (action === "publish") {
        return handlePublish(rest);
    }

    const isPlan = rest.includes("--plan");

    if (action === "dev") {
        const cmd = ["bun", "run", "tauri:dev"];
        console.log(`dev ${appName}\nDirectorio: ${root}\nComando: ${cmd.join(" ")}`);
        if (isPlan) return 0;
        const child = Bun.spawn(cmd, { cwd: root, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
        return (await child.exited) ?? 0;
    }

    if (action === "build") {
        const cmdFrontend = ["bun", "run", "build:web"];
        const cmdDesktop = ["bun", "run", "tauri", "build", "--no-bundle"];
        console.log(`build ${appName}\nDirectorio: ${root}\nComando: ${cmdFrontend.join(" ")} && ${cmdDesktop.join(" ")}`);
        if (isPlan) return 0;

        console.log("\n==> [1/2] Compilando frontend estático (Vite + TypeScript)...");
        const resFe = runCmdSync(cmdFrontend);
        if (resFe.code !== 0) {
            console.error(resFe.stderr || resFe.stdout);
            throw new Error(`Fallo compilando frontend (código ${resFe.code})`);
        }
        console.log("==> [2/2] Compilando binario de escritorio Tauri v2 (--no-bundle)...");
        const child = Bun.spawn(cmdDesktop, { cwd: root, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
        return (await child.exited) ?? 0;
    }

    if (action === "release") {
        const psArgs = [
            "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", "./scripts/release/build-release.ps1", "-LocalOnly",
        ];
        console.log(`release ${appName}\nDirectorio: ${root}\nComando: ${psArgs.join(" ")}`);
        if (isPlan) return 0;

        const child = Bun.spawn(psArgs, { cwd: root, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
        return (await child.exited) ?? 0;
    }

    throw new Error(`Acción desconocida: ${action}. Usa mise dev, mise build, mise release o mise publish.`);
}

if (import.meta.main) {
    const args = process.env.MISE_TASK_NAME
        ? [process.env.MISE_TASK_NAME, ...Bun.argv.slice(2)]
        : Bun.argv.slice(2);
    try {
        process.exit(await main(args));
    } catch (err: any) {
        console.error(err?.message ?? err);
        process.exit(1);
    }
}
