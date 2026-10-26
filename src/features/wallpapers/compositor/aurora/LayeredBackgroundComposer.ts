// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from 'three';
import { createBackgroundEffect, type DynamicBackground } from './index';
import type { BackgroundControls } from './controls';
import { AmbientBackground } from './Backgrounds/AmbientBackground';
import { BackgroundProjection, bindBackgroundHue } from './BackgroundProjection';
import { BackgroundInteraction } from './Interaction/BackgroundInteraction';

export interface BackgroundLayerFrame {
    ambient: Readonly<BackgroundControls>;
    scenario: Readonly<BackgroundControls>;
    ambientVisible: boolean;
    scenarioVisible: boolean;
    reducedMotion: boolean;
    intensity: number;
    /** Optional desktop/ElyVerso composition; existing VTuber consumers stay fused. */
    fusion?: boolean;
}

/** Capa 1 en DOM; capas 2 y 3 independientes; escenografía en capa 4. */
export class LayeredBackgroundComposer {
    readonly ambientScene = new THREE.Scene();
    readonly scenarioScene = new THREE.Scene();
    private readonly interactionScene = new THREE.Scene();
    private readonly interaction: BackgroundInteraction;
    private ambient: AmbientBackground | null = null;
    private effect: DynamicBackground | null = null;
    private projection: BackgroundProjection | null = null;
    private ambientTime = 0;
    private scenarioTime = 0;
    private readonly ambientHue = { value: 0 };
    private readonly scenarioHue = { value: 0 };
    private requested = '';
    private version = 0;
    private disposed = false;

    constructor(private readonly camera: THREE.Camera, private readonly renderer: THREE.WebGLRenderer,
        private readonly loadEffect = createBackgroundEffect) {
        renderer.autoClear = false;
        this.ambientScene.name = 'vtuber-layer-2-ambient';
        this.scenarioScene.name = 'vtuber-layer-3-scenario';
        this.interaction = new BackgroundInteraction(camera, renderer.domElement, point => {
            if (this.scenarioScene.visible) this.effect?.onClick?.(point);
        });
        this.interactionScene.add(this.interaction.effects.group);
    }

    async selectScenario(type: string, controls: Readonly<BackgroundControls>): Promise<void> {
        if (this.disposed || this.requested === type) return;
        this.requested = type;
        const version = ++this.version;
        const previous = this.effect;
        if (!type || type === 'none' || type === 'ambient') {
            previous?.dispose();
            this.effect = null;
            this.projection?.group.removeFromParent();
            this.projection = null;
            this.scenarioScene.clear();
            this.scenarioTime = 0;
            delete this.renderer.domElement.dataset.dynamicBackground;
            return;
        }
        const effect = await this.loadEffect(type);
        if (!effect) return;
        if (this.disposed || version !== this.version) { effect.dispose(); return; }
        try {
            effect.setControls?.({ ...controls, ambient: 'original' });
            effect.init(this.scenarioScene, this.camera, this.renderer);
            // El efecto saliente se libera cuando el entrante ya está listo: liberarlo
            // antes deja la capa de escenario vacía durante la carga y asoma el fondo
            // estático (o un vacío) mientras se cambia de escenario.
            previous?.dispose();
            this.projection?.group.removeFromParent();
            this.projection = null;
            if (!effect.setControls) this.projection = new BackgroundProjection([...this.scenarioScene.children], this.camera, type);
            if (this.projection) this.scenarioScene.add(this.projection.group);
            bindBackgroundHue(this.scenarioScene.children, this.scenarioHue);
            const size = this.renderer.getSize(new THREE.Vector2());
            effect.onResize?.(size.x, size.y);
            this.effect = effect;
            this.scenarioTime = 0;
            this.renderer.domElement.dataset.dynamicBackground = type;
        } catch (error) {
            effect.dispose();
            this.scenarioScene.clear();
            throw error;
        }
    }

    update(delta: number, frame: BackgroundLayerFrame): void {
        if (this.disposed) return;
        const { ambient, scenario, reducedMotion, intensity } = frame;
        const ambientVisible = frame.ambientVisible && ambient.ambient !== 'original';
        const scenarioVisible = frame.scenarioVisible && this.effect !== null;
        this.ambientScene.visible = ambientVisible;
        this.scenarioScene.visible = scenarioVisible;
        const dt = Math.min(Math.max(delta, 0), 0.1);
        const ambientDelta = ambientVisible && !ambient.paused && !reducedMotion ? dt * ambient.speed : 0;
        const scenarioDelta = scenarioVisible && !scenario.paused && !reducedMotion ? dt * scenario.speed : 0;
        this.ambientTime += ambientDelta;
        this.scenarioTime += scenarioDelta;
        const interactionControls = scenarioVisible ? scenario : ambient;
        this.interaction.update(Math.max(ambientDelta, scenarioDelta), interactionControls,
            (scenarioVisible || ambientVisible) && !reducedMotion);
        if (ambientVisible) {
            if (!this.ambient) {
                this.ambient = new AmbientBackground(this.camera);
                this.ambientScene.add(this.ambient.group);
                bindBackgroundHue(this.ambientScene.children, this.ambientHue);
            }
            this.ambientHue.value = ambient.colorCycle ? this.ambientTime * 0.55 : 0;
            this.ambient.update(reducedMotion ? { ...ambient, motion: 'none' } : ambient,
                this.ambientTime, ambientDelta, reducedMotion ? 0 : intensity, this.interaction.strength);
        }
        if (scenarioVisible) {
            const settings = { ...scenario, ambient: 'original' as const,
                ...(reducedMotion ? { motion: 'none' as const } : {}) };
            this.scenarioHue.value = scenario.colorCycle ? this.scenarioTime * 0.55 : 0;
            this.projection?.update(settings, this.scenarioTime, scenarioDelta);
            this.effect!.setControls?.(settings);
            this.effect!.update(scenarioDelta, reducedMotion ? 0 : intensity, this.scenarioTime, frame.fusion ?? true);
        }
    }

    render(foreground: THREE.Scene): void {
        if (this.disposed) return;
        this.renderer.clear();
        if (this.ambientScene.visible && this.ambient) this.renderer.render(this.ambientScene, this.camera);
        this.renderer.clearDepth();
        if (this.scenarioScene.visible && this.effect) this.renderer.render(this.scenarioScene, this.camera);
        this.renderer.clearDepth();
        this.renderer.render(foreground, this.camera);
        this.renderer.clearDepth();
        this.renderer.render(this.interactionScene, this.camera);
    }

    onResize(width: number, height: number): void { this.effect?.onResize?.(width, height); }
    onMouseMove(x: number, y: number): void { if (this.scenarioScene.visible) this.effect?.onMouseMove?.(x, y); }

    dispose(): void {
        this.disposed = true;
        this.version++;
        this.effect?.dispose();
        this.ambient?.dispose();
        this.interaction.dispose();
        this.effect = null;
        this.ambient = null;
        this.ambientScene.clear();
        this.scenarioScene.clear();
        this.interactionScene.clear();
    }
}
