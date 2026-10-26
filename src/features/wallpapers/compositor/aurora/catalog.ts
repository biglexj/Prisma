// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import { PARTICLE_BACKGROUNDS, particleSceneLoaders } from './particleScenes';

export function supportsBackgroundCamera(type: string): boolean {
    return ['ambient', 'gargantua', 'cybercity', 'tunnel', 'deepsea'].includes(type) || Object.hasOwn(particleSceneLoaders, type);
}

/** Fondos que pueden componerse sobre una imagen o un ambiente independiente. */
export function supportsBackgroundFusion(type: string): boolean {
    return ['prisma', 'borealis', 'blackhole', 'tunnel', 'cybercity', 'matrix', 'deepsea'].includes(type) || Object.hasOwn(particleSceneLoaders, type);
}

/** An intrinsic color field has no independent sky. Native raytracers may still expose one. */
export function supportsAmbientBackground(type: string): boolean {
    return type === 'ambient' || type === 'gargantua' || (type !== 'prisma' && supportsBackgroundFusion(type));
}

export function isParticleBackground(type: string): boolean {
    return ['ambient', 'tunnel', 'cybercity'].includes(type) || Object.hasOwn(particleSceneLoaders, type);
}

/** Catálogo compartido por VTuber, Live, ElyVerso y Labs. */
export const DYNAMIC_BACKGROUNDS = [
    { type: 'prisma', label: 'Prisma', emoji: '🔷', desc: 'Facetas de color en movimiento suave' },
    { type: 'borealis', label: 'Aurora Boreal', emoji: '🌌', desc: 'Shaders fluidos de auroras cósmicas' },
    { type: 'blackhole', label: 'Lente Gravitacional', emoji: '🕳️', desc: 'Lente gravitacional y distorsión relativista' },
    { type: 'gargantua', label: 'Gargantúa', emoji: '🕳️', desc: 'Raytracer de Agujero Negro masivo' },
    { type: 'matrix', label: 'Código Matrix', emoji: '📟', desc: 'Lluvia de terminal retro de los 90' },
    { type: 'liquid', label: 'Flujo Líquido', emoji: '💧', desc: 'Fluido interactivo reactivo al ratón' },
    { type: 'tunnel', label: 'Túnel Neón', emoji: '🚀', desc: 'Warp-speed wireframe hiperespacial' },
    { type: 'cybercity', label: 'Holo Ciudad', emoji: '🏙️', desc: 'Ciudad de rascacielos wireframe 3D' },
    { type: 'deepsea', label: 'Abismo Marino', emoji: '🌊', desc: 'God rays oceánicos y plancton 3D' },
    ...PARTICLE_BACKGROUNDS,
];

/** Conserva las escenas antiguas sin ofrecer opciones que el motor no carga. */
export function resolveBackgroundType(value?: string): string {
    if (value === 'ambient') return 'ambient';
    const type = value === 'glow' ? 'borealis' : value === 'orbit' ? 'interstellarparticles' : value;
    return DYNAMIC_BACKGROUNDS.some(background => background.type === type) ? type! : 'none';
}

const INTERACTIVE_EFFECT_TYPES = new Set(['morphclick', 'dnahelix', 'bubbles', 'soundwave', 'jellyfish', 'microbes', 'synapse', 'aurora']);
export const DYNAMIC_BACKGROUND_GROUPS = [
    { label: 'Escenas principales', backgrounds: DYNAMIC_BACKGROUNDS.filter(background => !INTERACTIVE_EFFECT_TYPES.has(background.type)) },
    { label: 'Efectos tridimensionales', backgrounds: DYNAMIC_BACKGROUNDS.filter(background => INTERACTIVE_EFFECT_TYPES.has(background.type)) },
];
