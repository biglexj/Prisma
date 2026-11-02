import { describe, expect, test } from "bun:test";
import { ecosystemServices, resolveEcosystemServices } from "../src/shared/ecosystemServices";

describe("servicios independientes del ecosistema", () => {
  test("no conecta servicios al migrar una preferencia antigua desactivada", () => {
    expect(resolveEcosystemServices({ auroraOnlineServicesEnabled: false, auroraWallpapersEnabled: true }))
      .toEqual(ecosystemServices(false, false));
    expect(resolveEcosystemServices({})).toEqual(ecosystemServices(false, false));
  });
  test("conserva letras y la elección previa de wallpapers", () => {
    expect(resolveEcosystemServices({ auroraOnlineServicesEnabled: true })).toEqual(ecosystemServices(true, true));
    expect(resolveEcosystemServices({ auroraOnlineServicesEnabled: true, auroraWallpapersEnabled: false })).toEqual(ecosystemServices(true, false));
  });
  test("activar un servicio no activa el otro", () => {
    expect(resolveEcosystemServices({ auroraLyricsEnabled: false, auroraWallpapersEnabled: true, auroraOnlineServicesEnabled: false }))
      .toEqual(ecosystemServices(false, true));
    expect(resolveEcosystemServices({ auroraLyricsEnabled: true, auroraWallpapersEnabled: false }))
      .toEqual(ecosystemServices(true, false));
  });
});
