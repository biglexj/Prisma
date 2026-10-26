// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from 'three';
import type { DynamicBackground } from '../index';
import { DEFAULT_BACKGROUND_CONTROLS, type BackgroundControls } from '../controls';
import { applyBackgroundCamera } from '../BackgroundCamera';
import { SKY_THEME } from '../Backgrounds/themes';
import { vertexShader } from './shaders/blackhole.vert';
import { fragmentShader } from './shaders/blackhole.frag';

/** Centro y encuadre del prototipo; cielo procedural de Gargantúa actual. */
export class GargantuaScene implements DynamicBackground {
    readonly handlesAmbientBackground = true;
    readonly group = new THREE.Group();
    private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 1000);
    private readonly dir = new THREE.Vector3();
    private readonly up = new THREE.Vector3();
    private readonly right = new THREE.Vector3();
    private material: THREE.ShaderMaterial | null = null;
    private quad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
    private renderer: THREE.WebGLRenderer | null = null;
    private controls: Readonly<BackgroundControls> = DEFAULT_BACKGROUND_CONTROLS;
    private clickStrength = 0;

    init(scene: THREE.Scene, _camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
        this.renderer = renderer;
        this.camera.position.set(0, 6.6, 23);
        this.camera.lookAt(0, 0, 0);
        this.material = new THREE.ShaderMaterial({
            vertexShader, fragmentShader,
            uniforms: {
                resolution: { value: renderer.getDrawingBufferSize(new THREE.Vector2()) }, time: { value: 0 },
                cameraPos: { value: new THREE.Vector3() }, cameraDir: { value: new THREE.Vector3() },
                cameraUp: { value: new THREE.Vector3() }, cameraRight: { value: new THREE.Vector3() },
                fov: { value: Math.tan(46 * Math.PI / 360) }, quality: { value: this.controls.quality }, debugView: { value: 0 },
                ambientTheme: { value: -1 }, ambientTime: { value: 0 }, ambientEnergy: { value: 0 }, ambientClick: { value: 0 },
                overlay: { value: false },
                p_accretionDiskInner: { value: 2.75 }, p_accretionDiskOuter: { value: 38 },
                p_accretionDiskTemperature: { value: 1 }, p_dopplerIntensity: { value: 1.85 }, p_bloomIntensity: { value: 1.1 },
            },
            depthWrite: false, depthTest: false, transparent: true,
        });
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        this.quad.name = 'vtuber-gargantua-core';
        this.quad.frustumCulled = false;
        this.quad.renderOrder = -100;
        this.group.add(this.quad);
        scene.add(this.group);
        this.update(0, 0, 0);
    }

    update(delta: number, intensity: number, time: number, transparent = false): void {
        if (!this.material) return;
        const settings = this.controls;
        const cameraSettings = { ...settings, yaw: settings.yaw + 30, pitch: settings.pitch + (settings.view === 'front' ? 16 : 0) };
        applyBackgroundCamera(this.camera, cameraSettings, time, 24, delta > 0 ? 1 - Math.exp(-delta * 6) : 1);
        this.camera.getWorldDirection(this.dir);
        this.up.copy(this.camera.up).transformDirection(this.camera.matrixWorld);
        this.right.crossVectors(this.dir, this.up).normalize();
        this.clickStrength = Math.max(0, this.clickStrength - delta * 2);
        const boost = this.clickStrength * 0.55, energy = THREE.MathUtils.clamp(intensity, 0, 1);
        const u = this.material.uniforms;
        u.overlay.value = transparent;
        u.time.value = time * 1.35;
        u.ambientTheme.value = settings.ambient === 'original' ? -1 : settings.ambient === 'stars' ? 4 : SKY_THEME[settings.ambient];
        u.ambientTime.value = time;
        u.ambientEnergy.value = energy;
        u.ambientClick.value = this.clickStrength;
        u.cameraPos.value.copy(this.camera.position);
        u.cameraDir.value.copy(this.dir);
        u.cameraUp.value.copy(this.up);
        u.cameraRight.value.copy(this.right);
        u.quality.value = settings.quality;
        u.p_bloomIntensity.value = 1.1 + energy * 0.75 + boost;
        u.p_accretionDiskTemperature.value = 1 + energy * 0.28 + boost * 0.35;
        u.p_dopplerIntensity.value = 1.85 + boost * 0.4;
    }

    setControls(controls: Readonly<BackgroundControls>): void { this.controls = controls; }
    onClick(): void { this.clickStrength = 1; }
    onResize(): void { if (this.material && this.renderer) this.renderer.getDrawingBufferSize(this.material.uniforms.resolution.value); }

    dispose(): void {
        this.quad?.geometry.dispose();
        this.material?.dispose();
        this.group.removeFromParent();
        this.group.clear();
        this.material = null;
        this.quad = null;
        this.renderer = null;
    }
}
