export interface FlyoutMediaState {
  isPlaying: boolean;
  title: string;
  artist: string;
  artworkUrl: string | null;
  mediaType: "audio" | "video";
}

export interface SystemMediaState extends FlyoutMediaState {
  sourceAppId: string;
  appName: string | null;
  appIconUrl: string | null;
  canToggle: boolean;
  canNext: boolean;
  canPrevious: boolean;
}

export interface FlyoutMediaSource extends FlyoutMediaState {
  sourceAppId: string | null;
  appName: string;
  appIconUrl: string | null;
  canToggle: boolean;
  canNext: boolean;
  canPrevious: boolean;
}

export function selectFlyoutMedia(prisma: FlyoutMediaState, external: SystemMediaState | null): FlyoutMediaSource | null {
  if (prisma.isPlaying && prisma.title.trim()) {
    return { ...prisma, sourceAppId: null, appName: "Prisma", appIconUrl: "/icon/icon.png",
      canToggle: true, canNext: true, canPrevious: true };
  }
  if (!external?.isPlaying || !external.title.trim()) return null;
  const appName = external.appName?.trim() || "Prisma";
  return { ...external, appName,
    appIconUrl: appName === "Prisma" ? "/icon/icon.png" : external.appIconUrl };
}

export function flyoutAppTarget(media: FlyoutMediaSource | null): string | null {
  return media?.appName === "Prisma" ? null : media?.sourceAppId ?? null;
}
