import { expect, test } from "bun:test";
import {
  ECOSYSTEM_APPS,
  appsForHost,
  HOST_APP_ID,
  countInstalledEcosystemApps,
  resolveEcosystemStatus,
  type EcosystemApp,
  type EcosystemAppState,
} from "../src/shared/ecosystemApps";

/** Identificadores que el backend detecta en el equipo (src-tauri/src/app/commands/ecosystem.rs). */
const BACKEND_APP_IDS = [
  "aurora-synapse",
  "ely-intelligence",
  "davinci-flow",
  "davinci-exportador",
  "luna-fetch",
  "gallery-dl-gui",
  "prisma-upscaler",
  "lyraflow",
  "ely-tesia",
  "wintts",
  "mouziflow",
  "nubix",
];

function state(partial: Partial<EcosystemAppState>): EcosystemAppState {
  return {
    id: "x",
    installed: false,
    path: null,
    hasSource: false,
    sourcePath: null,
    ...partial,
  };
}

const desktopApp: EcosystemApp = {
  id: "demo",
  name: "Demo",
  category: "Prueba",
  kind: "desktop",
  fallbackIcon: "sparkles",
  description: "Aplicación de prueba.",
  linkUrl: "https://example.invalid",
  linkLabel: "Detalles",
};

test("resolveEcosystemStatus distingue cada estado", () => {
  expect(resolveEcosystemStatus({ ...desktopApp, comingSoon: true })).toEqual({
    label: "Próximamente",
    tone: "soon",
  });

  expect(resolveEcosystemStatus({ ...desktopApp, kind: "mobile" })).toEqual({
    label: "Android",
    tone: "online",
  });

  expect(resolveEcosystemStatus({ ...desktopApp, synergy: true }, state({ installed: true }))).toEqual({
    label: "Sinergia Activa",
    tone: "active",
  });

  expect(resolveEcosystemStatus(desktopApp, state({ installed: true }))).toEqual({
    label: "Instalada",
    tone: "installed",
  });

  expect(resolveEcosystemStatus(desktopApp, state({ hasSource: true }))).toEqual({
    label: "Código local",
    tone: "source",
  });

  expect(resolveEcosystemStatus(desktopApp)).toEqual({
    label: "No instalada",
    tone: "missing",
  });
});

test("una app sin estado se muestra como no instalada", () => {
  expect(resolveEcosystemStatus(desktopApp, undefined).tone).toBe("missing");
});

test("el catálogo del ecosistema es coherente", () => {
  expect(HOST_APP_ID).toBe("prisma");
  expect(ECOSYSTEM_APPS.map(app => app.id)).not.toContain("prisma");
  expect(ECOSYSTEM_APPS.map(app => app.id)).not.toContain("aurora-hub");
  expect(ECOSYSTEM_APPS.length).toBe(13);

  const ids = ECOSYSTEM_APPS.map((app) => app.id);
  expect(new Set(ids).size).toBe(ids.length);

  for (const app of ECOSYSTEM_APPS) {
    expect(app.name.length).toBeGreaterThan(0);
    expect(app.category.length).toBeGreaterThan(0);
    expect(app.description.length).toBeGreaterThan(0);
    expect(app.linkUrl.startsWith("https://")).toBe(true);
    expect(app.linkLabel.length).toBeGreaterThan(0);
    if (app.iconPath) {
      expect(app.iconPath.startsWith("/icons/")).toBe(true);
    }
  }
});

test("el filtro sirve para cualquier anfitrión y excluye inventario interno", () => {
  const apps = [
    { id: "prisma", executable: true },
    { id: "aurora-synapse", executable: true },
    { id: "aurora-hub", executable: true, visibility: "internal" },
    { id: "legacy-internal", executable: true, status: "Interno" },
    { id: "library", executable: false },
  ];
  expect(appsForHost(apps, "prisma").map(app => app.id)).toEqual(["aurora-synapse"]);
  expect(appsForHost(apps, "aurora-synapse").map(app => app.id)).toEqual(["prisma"]);
});

test("el contador solo incluye aplicaciones visibles del catálogo", () => {
  expect(countInstalledEcosystemApps([{ id: "luna-fetch" }, { id: "super-gallery" }], {
    "luna-fetch": state({ id: "luna-fetch", installed: true }),
    prisma: state({ id: "prisma", installed: true }),
    "aurora-hub": state({ id: "aurora-hub", installed: true }),
  })).toBe(1);
});

test("los identificadores de escritorio coinciden con los que detecta el backend", () => {
  const desktopIds = ECOSYSTEM_APPS.filter((app) => app.kind === "desktop").map((app) => app.id);
  expect([...desktopIds].sort()).toEqual([...BACKEND_APP_IDS].sort());
});

test("Super Gallery es la única aplicación sin estado de backend", () => {
  const mobileIds = ECOSYSTEM_APPS.filter((app) => app.kind === "mobile").map((app) => app.id);
  expect(mobileIds).toEqual(["super-gallery"]);
  expect(BACKEND_APP_IDS).not.toContain("super-gallery");
});
