export interface EcosystemServices {
  auroraOnlineServicesEnabled: boolean;
  auroraLyricsEnabled: boolean;
  auroraWallpapersEnabled: boolean;
}

export function ecosystemServices(lyrics: boolean, wallpapers: boolean): EcosystemServices {
  return { auroraLyricsEnabled: lyrics, auroraWallpapersEnabled: wallpapers, auroraOnlineServicesEnabled: lyrics || wallpapers };
}

/** Conserva la decisión de conexión de las versiones con interruptor maestro. */
export function resolveEcosystemServices(stored: Partial<EcosystemServices>): EcosystemServices {
  if (typeof stored.auroraLyricsEnabled === "boolean") {
    return ecosystemServices(stored.auroraLyricsEnabled, stored.auroraWallpapersEnabled === true);
  }
  const enabled = stored.auroraOnlineServicesEnabled === true;
  return ecosystemServices(enabled, enabled && stored.auroraWallpapersEnabled !== false);
}
