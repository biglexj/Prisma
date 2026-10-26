// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from 'three';
import type { DynamicBackground } from './index';
import { createGlowTexture } from './particleTextures';
import { createSquareTexture } from './Interaction/textures';
import { DEFAULT_BACKGROUND_CONTROLS, type BackgroundControls } from './controls';
import { applyBackgroundCamera } from './BackgroundCamera';
import { disposeBackgroundObjects } from './resources';

export interface ParticleContext {
    state: { intensity: number; clickStrength: number; clickWorldPos: THREE.Vector3; morphShapeIndex: number };
    softGlowTex: THREE.Texture;
    starFlareTex: THREE.Texture;
    squareTex: THREE.Texture;
    masterGroup: THREE.Group;
}
export type ParticleSceneFactory = (root: THREE.Group, context: ParticleContext) => (delta: number, elapsed: number, energy: number) => void;

/** Conserva las unidades del prototipo (cámara a 28) dentro del escenario a 5. */
export class ParticleBackground implements DynamicBackground {
    readonly group = new THREE.Group();
    private readonly masterGroup = new THREE.Group();
    private context: ParticleContext | null = null;
    private camera: THREE.Camera | null = null;
    private animateScene: ReturnType<ParticleSceneFactory> | null = null;
    private readonly virtualCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    private readonly sourceScale = new THREE.Vector3(5 / 28, 5 / 28, 5 / 28);
    private controls: Readonly<BackgroundControls> = DEFAULT_BACKGROUND_CONTROLS;

    constructor(private readonly factory: ParticleSceneFactory) {}

    init(scene: THREE.Scene, camera: THREE.Camera): void {
        this.camera = camera;
        this.virtualCamera.position.z = 5;
        this.group.matrixAutoUpdate = false;
        this.group.add(this.masterGroup);
        scene.add(this.group);
        this.context = {
            state: { intensity: 0.85, clickStrength: 0, clickWorldPos: new THREE.Vector3(), morphShapeIndex: 0 },
            softGlowTex: createGlowTexture(),
            starFlareTex: createGlowTexture('#ffffff', 'rgba(200,240,255,0.55)', true),
            squareTex: createSquareTexture(),
            masterGroup: this.masterGroup,
        };
        this.animateScene = this.factory(this.masterGroup, this.context);
        this.group.traverse(object => {
            if (!(object instanceof THREE.Points)) return;
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                material.onBeforeCompile = (shader: Parameters<THREE.Material['onBeforeCompile']>[0]) => {
                    shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * (5.0 / 28.0);');
                };
            }
        });
        this.update(0, 0, 0);
    }

    update(delta: number, intensity: number, time: number): void {
        if (!this.context || !this.animateScene || !this.camera) return;
        applyBackgroundCamera(this.virtualCamera, this.controls, time, 5, delta > 0 ? 1 - Math.exp(-delta * 6) : 1);
        this.camera.updateMatrixWorld();
        this.group.matrix.multiplyMatrices(this.camera.matrixWorld, this.virtualCamera.matrixWorldInverse).scale(this.sourceScale);
        this.group.matrixWorldNeedsUpdate = true;
        this.animateScene(delta, time, THREE.MathUtils.clamp(intensity, 0, 1));
        this.context.state.clickStrength = Math.max(0, this.context.state.clickStrength - delta * 2);
    }

    setControls(controls: Readonly<BackgroundControls>): void { this.controls = controls; }

    onClick(point: THREE.Vector3): void {
        if (!this.context) return;
        this.group.updateWorldMatrix(true, false);
        this.context.state.clickWorldPos.copy(this.group.worldToLocal(point.clone()));
        this.context.state.clickStrength = 1;
        this.context.state.morphShapeIndex++;
    }

    dispose(): void {
        disposeBackgroundObjects(this.group);
        this.context?.softGlowTex.dispose();
        this.context?.starFlareTex.dispose();
        this.context?.squareTex.dispose();
        this.context = null;
        this.animateScene = null;
        this.camera = null;
    }
}
