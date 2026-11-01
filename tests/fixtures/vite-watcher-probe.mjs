import { createServer } from "vite";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const server = await createServer({ root, configFile: resolve(root, "vite.config.ts"), cacheDir: resolve(root, "temp/vite-watch-test-cache"), logLevel: "silent", server: { host: "127.0.0.1", port: 0 } });
try {
  const errors = [];
  server.watcher.on("error", error => errors.push(error.message));
  const ready = new Promise(done => server.watcher.once("ready", done));
  await server.listen();
  await ready;
  // Solicitar explícitamente la vigilancia del archivo reproduce la detección
  // que antes acababa en fs.watch/EBUSY. La exclusión debe seguir aplicándose.
  server.watcher.add(process.argv[2]);
  await new Promise(done => setTimeout(done, 350));
  const source = await fetch(new URL("/src/main.tsx", server.resolvedUrls.local[0]));
  const watched = Object.keys(server.watcher.getWatched()).map(path => path.replaceAll("\\", "/"));
  console.log(JSON.stringify({
    sourceServed: source.ok,
    releaseWatched: watched.includes(resolve(root, "release").replaceAll("\\", "/")),
    errors,
  }));
} finally {
  await server.close();
}
