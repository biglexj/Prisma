// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
export const AMBIENT_BACKGROUNDS = [
    { value: 'original', label: 'Original', colors: 'linear-gradient(135deg,#101827,#354354)' },
    { value: 'violet', label: 'Halo Violeta', colors: 'linear-gradient(135deg,#27133c,#713a9b,#297ca8)' },
    { value: 'warm', label: 'Gargantúa cálido', colors: 'linear-gradient(135deg,#291524,#8c471f,#613378)' },
    { value: 'bio', label: 'Cian / Bio', colors: 'linear-gradient(135deg,#062438,#14858f,#bf6b24)' },
    { value: 'deep', label: 'Profundo', colors: 'linear-gradient(135deg,#050814,#241a3d,#0f2440)' },
    { value: 'stars', label: 'Negro Puntos', colors: 'radial-gradient(circle at 30% 40%,#fff 0 1px,transparent 2px),#05050a' },
] as const;

export type AmbientTheme = typeof AMBIENT_BACKGROUNDS[number]['value'];
export const SKY_THEME: Record<Exclude<AmbientTheme, 'original' | 'stars'>, number> = { violet: 0, warm: 1, bio: 2, deep: 3 };

/** Original follows the scene's palette; black-hole scenes start on black with stars. */
export function resolveAmbientTheme(type: string, theme: AmbientTheme): AmbientTheme {
    return theme === 'original' && ['blackhole', 'blackholepro', 'binarybh'].includes(type) ? 'stars' : theme;
}
