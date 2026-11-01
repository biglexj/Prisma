import { expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const windowsTest = process.platform === "win32" ? test : test.skip;

windowsTest("Vite excluye un temporal de instalador bloqueado y sigue sirviendo el frontend", async () => {
  const root = resolve(import.meta.dir, "..");
  const lockedPath = resolve(root, "release", `.installer-watch-regression-${process.pid}.tmp`);
  await mkdir(resolve(root, "release"), { recursive: true });
  const script = `$stream = [IO.File]::Open('${lockedPath.replace(/'/g, "''")}', [IO.FileMode]::Create, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None); try { [Console]::WriteLine('LOCKED'); [Console]::ReadLine() | Out-Null } finally { $stream.Dispose() }`;
  const locker = Bun.spawn(["powershell", "-NoProfile", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], { stdin: "pipe", stdout: "pipe", stderr: "pipe", windowsHide: true });
  try {
    const reader = locker.stdout.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain("LOCKED");
    reader.releaseLock();
    // Usar Node, igual que el CLI de Vite/Tauri del entorno de desarrollo.
    const probe = Bun.spawn(["node", resolve(import.meta.dir, "fixtures/vite-watcher-probe.mjs"), lockedPath], { cwd: root, stdout: "pipe", stderr: "pipe", windowsHide: true });
    const [stdout, stderr, exitCode] = await Promise.all([new Response(probe.stdout).text(), new Response(probe.stderr).text(), probe.exited]);
    expect(stderr).not.toContain("EBUSY");
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ sourceServed: true, releaseWatched: false, errors: [] });
  } finally {
    locker.stdin.write("\n");
    locker.stdin.end();
    await locker.exited;
    await rm(lockedPath, { force: true });
  }
}, 30000);
