// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import type * as THREE from "three";
import { particleSceneLoaders } from './particleScenes';
import type { BackgroundControls } from './controls';

export interface DynamicBackground {
    readonly handlesAmbientBackground?: boolean;
    init(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void;
    update(delta: number, intensity: number, time: number, transparent?: boolean): void;
    dispose(): void;
    onResize?(width: number, height: number): void;
    onMouseMove?(x: number, y: number): void;
    setControls?(controls: Readonly<BackgroundControls>): void;
    setLayerVisibility?(ambient: boolean, scenario: boolean): void;
    onClick?(point: THREE.Vector3): void;
}

/** Carga únicamente el efecto seleccionado y su adaptador. */
export async function createDynamicBackground(type: string): Promise<DynamicBackground | null> {
    const [effect, { BackgroundLayer }] = await Promise.all([createBackgroundEffect(type), import('./BackgroundLayer')]);
    if (!effect) return null;
    return new BackgroundLayer(effect, type);
}

export async function createBackgroundEffect(type: string): Promise<DynamicBackground | null> {
    if (Object.hasOwn(particleSceneLoaders, type)) {
        const [{ default: factory }, { ParticleBackground }] = await Promise.all([
            particleSceneLoaders[type](),
            import('./ParticleBackground'),
        ]);
        return new ParticleBackground(factory);
    }
    switch (type) {
        case 'ambient':
            return { init() {}, update() {}, dispose() {} };
        case 'gargantua': {
            const { GargantuaScene } = await import('./Gargantua/GargantuaScene');
            return new GargantuaScene();
        }
        case "prisma": {
            const { PrismaBackground } = await import('./prisma/PrismaBackground');
            return new PrismaBackground();
        }
        case "borealis": {
            const { BorealisBackground } = await import("./borealis/BorealisBackground");
            return new BorealisBackground();
        }
        case "blackhole": {
            const { BlackHoleBackground } = await import("./blackhole/BlackHoleBackground");
            return new BlackHoleBackground();
        }
        case "matrix": {
            const { MatrixRainBackground } = await import("./matrix/MatrixRainBackground");
            return new MatrixRainBackground();
        }
        case "liquid": {
            const { LiquidVortexBackground } = await import("./liquid/LiquidVortexBackground");
            return new LiquidVortexBackground();
        }
        case "tunnel": {
            const { SpaceWormholeBackground } = await import("./tunnel/SpaceWormholeBackground");
            return new SpaceWormholeBackground();
        }
        case "cybercity": {
            const { CyberCityBackground } = await import("./cybercity/CyberCityBackground");
            return new CyberCityBackground();
        }
        case "deepsea": {
            const { DeepSeaBackground } = await import("./deepsea/DeepSeaBackground");
            return new DeepSeaBackground();
        }
        default:
            return null;
    }
}
