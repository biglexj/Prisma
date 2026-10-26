// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from 'three';
import type { DynamicBackground } from './index';
import { DEFAULT_BACKGROUND_CONTROLS, type BackgroundControls } from './controls';
import { BackgroundProjection } from './BackgroundProjection';
import { resolveAmbientTheme } from './Backgrounds/themes';
import { AmbientBackground } from './Backgrounds/AmbientBackground';
import { BackgroundInteraction } from './Interaction/BackgroundInteraction';
import { isParticleBackground, supportsAmbientBackground } from './catalog';

/** Ambiente y escenario comparten renderizador y reloj, con visibilidad independiente. */
export class BackgroundLayer implements DynamicBackground {
    readonly group = new THREE.Group();
    private readonly scenarioGroup = new THREE.Group();
    private ambientVisible = true;
    private scenarioVisible = true;
    private stageCamera: THREE.Camera | null = null;
    private controls: Readonly<BackgroundControls> = DEFAULT_BACKGROUND_CONTROLS;
    private projection: BackgroundProjection | null = null;
    private ambient: AmbientBackground | null = null;
    private interaction: BackgroundInteraction | null = null;
    private reducedMotion: MediaQueryList | null = null;

    constructor(private readonly effect: DynamicBackground, private readonly type: string) {
        this.group.name = `vtuber-background:${type}`;
    }

    init(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.stageCamera = camera;
        const existing = new Set(scene.children);
        this.effect.setControls?.(this.controls);
        this.effect.init(scene, camera, renderer);
        const objects = scene.children.filter(object => !existing.has(object));
        if (objects.length && this.effect.setControls) this.scenarioGroup.add(...objects);
        else if (objects.length) {
            this.projection = new BackgroundProjection(objects, camera, this.type);
            this.scenarioGroup.add(this.projection.group);
        }
        this.group.add(this.scenarioGroup);
        if (supportsAmbientBackground(this.type) && !this.effect.handlesAmbientBackground) {
            this.ambient = new AmbientBackground(camera);
            this.group.add(this.ambient.group);
        }
        this.interaction = new BackgroundInteraction(camera, renderer.domElement, point => {
            if (this.scenarioVisible) this.effect.onClick?.(point);
        });
        this.group.add(this.interaction.effects.group);
        scene.add(this.group);
    }

    update(delta: number, intensity: number, time: number, transparent = false): void {
        if (!this.group.visible) {
            this.interaction?.update(0, this.controls, false);
            return;
        }
        const reduced = this.reducedMotion?.matches;
        const dt = reduced || this.controls.paused || !this.group.visible ? 0 : delta;
        const energy = reduced ? 0 : intensity;
        const settings = reduced || (this.type === 'tunnel' && this.controls.motion === 'spinAxis')
            ? { ...this.controls, motion: 'none' as const } : this.controls;
        this.scenarioGroup.visible = this.scenarioVisible;
        this.interaction?.update(dt, settings, this.group.visible && !reduced && !settings.paused);
        const ambientTheme = resolveAmbientTheme(this.type, settings.ambient);
        // A native sky is replaced by the shared ambient when its scenario is hidden.
        if (!this.scenarioVisible && this.ambientVisible && !this.ambient && this.stageCamera) {
            this.ambient = new AmbientBackground(this.stageCamera);
            this.group.add(this.ambient.group);
        }
        const hasAmbient = this.ambientVisible && !!this.ambient &&
            (!this.scenarioVisible || (!this.effect.handlesAmbientBackground && !transparent)) &&
            (isParticleBackground(this.type) || ambientTheme !== 'original');
        if (this.ambient) {
            this.ambient.group.visible = hasAmbient;
            if (hasAmbient) this.ambient.update({ ...settings, ambient: ambientTheme }, time, dt, energy, this.interaction?.strength ?? 0);
        }
        if (!this.scenarioVisible) return;
        this.projection?.update(settings, time, dt);
        this.effect.setControls?.(this.ambientVisible ? settings : { ...settings, ambient: 'original' });
        const effectEnergy = this.effect.onClick ? energy : Math.min(1, energy + (this.interaction?.strength ?? 0) * 0.55);
        this.effect.update(dt, effectEnergy, time, transparent || !this.ambientVisible || (hasAmbient && ambientTheme !== 'original'));
    }

    setControls(controls: Readonly<BackgroundControls>): void { this.controls = controls; }
    setLayerVisibility(ambient: boolean, scenario: boolean): void {
        this.ambientVisible = ambient;
        this.scenarioVisible = scenario;
        this.group.visible = ambient || scenario;
    }
    onResize(width: number, height: number): void { this.effect.onResize?.(width, height); }
    onMouseMove(x: number, y: number): void { this.effect.onMouseMove?.(x, y); }

    dispose(): void {
        this.interaction?.dispose();
        this.ambient?.dispose();
        this.effect.dispose();
        this.group.removeFromParent();
        this.group.clear();
        this.interaction = null;
        this.ambient = null;
        this.projection = null;
        this.stageCamera = null;
    }
}
