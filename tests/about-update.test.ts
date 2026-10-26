import { expect, test } from "bun:test";
import { compareVersions, isNewerVersion, parseVersion } from "../src/shared/semver";
import { checkForAppUpdate, stripMarkdown } from "../src/shared/appUpdate";

/** Respuesta falsa de fetch, suficiente para lo que usa el servicio. */
function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function failResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
  } as unknown as Response;
}

const AURORA_URL = "https://biglexj.com/api/v1/apps/prisma/latest";
const GITHUB_URL = "https://api.github.com/repos/biglexj/Prisma/releases/latest";

function auroraBody(versionName: string, extra: Record<string, unknown> = {}) {
  return {
    success: true,
    app: { id: "f5c6e834", slug: "prisma", title: "Prisma" },
    latestRelease: {
      versionName,
      versionCode: 10200,
      isMandatory: false,
      status: "published",
      downloadUrl: `https://github.com/biglexj/Prisma/releases/download/v${versionName}/Prisma_${versionName}-setup.exe`,
      sha256Checksum: "4bca0563",
      releaseNotes: `# ✨ Prisma ${versionName}\n\n- **Nuevo** capturador\n- Otra cosa`,
      createdAt: "2026-10-22T00:00:00Z",
      ...extra,
    },
  };
}

function githubBody(tag: string, extra: Record<string, unknown> = {}) {
  const version = tag.replace(/^v/, "");
  return {
    tag_name: tag,
    name: `Prisma ${version}`,
    body: "Notas de la versión",
    published_at: "2026-10-22T00:00:00Z",
    html_url: `https://github.com/biglexj/Prisma/releases/tag/${tag}`,
    assets: [
      { name: "SHA256SUMS.txt", browser_download_url: "https://example.invalid/sums.txt", size: 10 },
      {
        name: `Prisma_${version}-setup.exe`,
        browser_download_url: `https://github.com/biglexj/Prisma/releases/download/${tag}/Prisma_${version}-setup.exe`,
        size: 100,
      },
    ],
    ...extra,
  };
}

/** Fetch falso que responde por URL y permite simular fallos. */
function fakeFetch(handlers: Record<string, () => Response | Promise<Response>>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const handler = handlers[url];
    if (!handler) throw new Error(`URL inesperada: ${url}`);
    return handler();
  }) as unknown as typeof fetch;
}

// ─────────────────────────── SemVer ───────────────────────────

test("parseVersion acepta las formas habituales de una versión", () => {
  expect(parseVersion("1.2.0")).toEqual({ major: 1, minor: 2, patch: 0, prerelease: null });
  expect(parseVersion("v1.2.0")).toEqual({ major: 1, minor: 2, patch: 0, prerelease: null });
  expect(parseVersion("V1.2.0")).toEqual({ major: 1, minor: 2, patch: 0, prerelease: null });
  expect(parseVersion("1.2")).toEqual({ major: 1, minor: 2, patch: 0, prerelease: null });
  expect(parseVersion("1.2.0-beta.1")).toEqual({ major: 1, minor: 2, patch: 0, prerelease: "beta.1" });
  expect(parseVersion("1.2.0+build7")).toEqual({ major: 1, minor: 2, patch: 0, prerelease: null });
});

test("parseVersion rechaza lo que no es una versión", () => {
  expect(parseVersion("abc")).toBeNull();
  expect(parseVersion("")).toBeNull();
  expect(parseVersion(null)).toBeNull();
  expect(parseVersion(undefined)).toBeNull();
  expect(parseVersion("1.2.x")).toBeNull();
  expect(parseVersion("1..2")).toBeNull();
});

test("compareVersions compara los segmentos numéricamente", () => {
  expect(compareVersions("1.2.0", "1.1.7")).toBe(1);
  expect(compareVersions("1.1.7", "1.2.0")).toBe(-1);
  expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
  expect(compareVersions("2.0.0", "1.99.99")).toBe(1);
});

test("compareVersions trata el prefijo v y los parches faltantes como equivalentes", () => {
  expect(compareVersions("v1.2.0", "1.2.0")).toBe(0);
  expect(compareVersions("1.2", "1.2.0")).toBe(0);
});

test("compareVersions aplica la regla de pre-release", () => {
  expect(compareVersions("1.2.0-beta", "1.2.0")).toBe(-1);
  expect(compareVersions("1.2.0", "1.2.0-beta")).toBe(1);
  expect(compareVersions("1.2.0-alpha.1", "1.2.0-alpha")).toBe(1);
  expect(compareVersions("1.2.0-alpha", "1.2.0-alpha.1")).toBe(-1);
});

test("una versión ilegible nunca se considera más nueva", () => {
  expect(compareVersions("abc", "1.2.0")).toBe(0);
  expect(isNewerVersion("abc", "1.2.0")).toBe(false);
  expect(isNewerVersion("1.2.1", "1.2.0")).toBe(true);
  expect(isNewerVersion("1.1.7", "1.2.0")).toBe(false);
});

// ─────────────────────── stripMarkdown ───────────────────────

test("stripMarkdown quita el marcado y deja el texto", () => {
  expect(stripMarkdown("# Título\n\n- **Negrita** y [enlace](https://x)")).toBe("Título Negrita y enlace");
  expect(stripMarkdown("```bash\nls -la\n```")).not.toContain("ls -la");
  expect(stripMarkdown("1. Primero\n2. Segundo")).toBe("Primero Segundo");
  expect(stripMarkdown("> Cita")).toBe("Cita");
  expect(stripMarkdown("![alt](https://x.png)")).toBe("alt");
});

test("stripMarkdown conserva los emojis", () => {
  expect(stripMarkdown("✨ Prisma 1.2.0")).toBe("✨ Prisma 1.2.0");
});

// ─────────────────── Servicio de actualizaciones ───────────────────

test("detecta una versión nueva publicada en Aurora", async () => {
  const outcome = await checkForAppUpdate({
    currentVersion: "1.2.0",
    fetchImpl: fakeFetch({
      [AURORA_URL]: () => okResponse(auroraBody("1.3.0")),
      [GITHUB_URL]: () => okResponse(githubBody("v1.3.0")),
    }),
  });

  expect(outcome.kind).toBe("update-available");
  if (outcome.kind !== "update-available") return;
  expect(outcome.latest.source).toBe("aurora");
  expect(outcome.latest.version).toBe("1.3.0");
  expect(outcome.latest.downloadUrl).toContain("Prisma_1.3.0-setup.exe");
  expect(outcome.latest.notesExcerpt).not.toContain("#");
  expect(outcome.latest.notesExcerpt).not.toContain("**");
});

test("cae en GitHub cuando Aurora no responde", async () => {
  const outcome = await checkForAppUpdate({
    currentVersion: "1.2.0",
    fetchImpl: fakeFetch({
      [AURORA_URL]: () => failResponse(503),
      [GITHUB_URL]: () => okResponse(githubBody("v1.3.0")),
    }),
  });

  expect(outcome.kind).toBe("update-available");
  if (outcome.kind !== "update-available") return;
  expect(outcome.latest.source).toBe("github");
  expect(outcome.latest.downloadUrl).toContain("Prisma_1.3.0-setup.exe");
  expect(outcome.latest.assetName).toBe("Prisma_1.3.0-setup.exe");
});

test("informa de que no hay actualización cuando ambas fuentes están al día", async () => {
  const outcome = await checkForAppUpdate({
    currentVersion: "1.2.0",
    fetchImpl: fakeFetch({
      [AURORA_URL]: () => okResponse(auroraBody("1.1.7")),
      [GITHUB_URL]: () => okResponse(githubBody("v1.1.7")),
    }),
  });

  expect(outcome.kind).toBe("up-to-date");
});

test("una release más nueva en GitHub se detecta aunque Aurora esté al día", async () => {
  const outcome = await checkForAppUpdate({
    currentVersion: "1.2.0",
    fetchImpl: fakeFetch({
      [AURORA_URL]: () => okResponse(auroraBody("1.1.7")),
      [GITHUB_URL]: () => okResponse(githubBody("v1.3.0")),
    }),
  });

  expect(outcome.kind).toBe("update-available");
  if (outcome.kind !== "update-available") return;
  expect(outcome.latest.source).toBe("github");
  expect(outcome.latest.version).toBe("1.3.0");
});

test("informa del fallo cuando ninguna fuente responde", async () => {
  const outcome = await checkForAppUpdate({
    currentVersion: "1.2.0",
    fetchImpl: fakeFetch({
      [AURORA_URL]: () => failResponse(500),
      [GITHUB_URL]: () => failResponse(500),
    }),
  });

  expect(outcome.kind).toBe("failed");
  if (outcome.kind !== "failed") return;
  expect(outcome.message.length).toBeGreaterThan(0);
  expect(outcome.attempted).toEqual(["aurora", "github"]);
});

test("una cancelación no deja la comprobación colgada", async () => {
  const outcome = await checkForAppUpdate({
    currentVersion: "1.2.0",
    fetchImpl: fakeFetch({
      [AURORA_URL]: () => {
        throw new DOMException("aborted", "AbortError");
      },
      [GITHUB_URL]: () => {
        throw new DOMException("aborted", "AbortError");
      },
    }),
  });

  expect(outcome.kind).toBe("failed");
});

test("busca el instalador en GitHub cuando Aurora no trae la descarga", async () => {
  const outcome = await checkForAppUpdate({
    currentVersion: "1.2.0",
    fetchImpl: fakeFetch({
      [AURORA_URL]: () => okResponse(auroraBody("1.3.0", { downloadUrl: null })),
      [GITHUB_URL]: () => okResponse(githubBody("v1.3.0")),
    }),
  });

  expect(outcome.kind).toBe("update-available");
  if (outcome.kind !== "update-available") return;
  expect(outcome.latest.downloadUrl).toContain("Prisma_1.3.0-setup.exe");
});

test("sigue reconociendo el instalador con el nombre histórico _x64", async () => {
  const outcome = await checkForAppUpdate({
    currentVersion: "1.2.0",
    fetchImpl: fakeFetch({
      [AURORA_URL]: () => failResponse(503),
      [GITHUB_URL]: () => okResponse({
        tag_name: "v1.3.0",
        name: "Prisma 1.3.0",
        body: "Notas de la versión",
        published_at: "2026-10-22T00:00:00Z",
        html_url: "https://github.com/biglexj/Prisma/releases/tag/v1.3.0",
        assets: [
          {
            name: "Prisma_1.3.0_x64-setup.exe",
            browser_download_url:
              "https://github.com/biglexj/Prisma/releases/download/v1.3.0/Prisma_1.3.0_x64-setup.exe",
            size: 100,
          },
        ],
      }),
    }),
  });

  expect(outcome.kind).toBe("update-available");
  if (outcome.kind !== "update-available") return;
  expect(outcome.latest.assetName).toBe("Prisma_1.3.0_x64-setup.exe");
});

test("descarta una release de Aurora que no está publicada", async () => {
  const outcome = await checkForAppUpdate({
    currentVersion: "1.2.0",
    fetchImpl: fakeFetch({
      [AURORA_URL]: () => okResponse(auroraBody("1.3.0", { status: "draft" })),
      [GITHUB_URL]: () => okResponse(githubBody("v1.1.7")),
    }),
  });

  expect(outcome.kind).toBe("up-to-date");
});

test("no inventa una actualización cuando la versión publicada no se puede leer", async () => {
  const outcome = await checkForAppUpdate({
    currentVersion: "1.2.0",
    fetchImpl: fakeFetch({
      [AURORA_URL]: () => okResponse(auroraBody("no-se-leye")),
      [GITHUB_URL]: () => okResponse(githubBody("v1.1.7")),
    }),
  });

  expect(outcome.kind).toBe("up-to-date");
});
