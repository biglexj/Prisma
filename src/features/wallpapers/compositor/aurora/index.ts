// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import type * as THREE from 'three';
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


export async function createBackgroundEffect(type: string): Promise<DynamicBackground | null> {
  if (type === 'prisma') return new (await import('./prisma/PrismaBackground')).PrismaBackground();
  if (type === 'borealis') return new (await import('./borealis/BorealisBackground')).BorealisBackground();
  if (type === 'cybercity') return new (await import('./cybercity/CyberCityBackground')).CyberCityBackground();
  return null;
}
