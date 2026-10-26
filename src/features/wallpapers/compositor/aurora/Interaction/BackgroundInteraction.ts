// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from 'three';
import { DEFAULT_BACKGROUND_CONTROLS, type BackgroundControls } from '../controls';
import { ClickEffects } from './ClickEffects';

const INTERACTIVE = 'button,input,select,textarea,a,summary,nav,header,aside,[role="dialog"],[role="tab"],[role="switch"],[role="slider"],[contenteditable="true"],.vcp,.avatar-drag-handle,.prop-drag-handle,[data-no-background-interaction]';

/** Un único gesto por escena; no captura punteros ni intercepta avatar o controles. */
export class BackgroundInteraction {
    readonly effects = new ClickEffects();
    strength = 0;
    private controls: Readonly<BackgroundControls> = DEFAULT_BACKGROUND_CONTROLS;
    private enabled = true;
    private gesture: { id: number; x: number; y: number; moved: boolean; lastTrail: number } | null = null;
    private readonly ray = new THREE.Raycaster();
    private readonly plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    private readonly pointer = new THREE.Vector2();
    private readonly point = new THREE.Vector3();

    constructor(private readonly camera: THREE.Camera, private readonly canvas: HTMLCanvasElement, private readonly onClick: (point: THREE.Vector3) => void) {
        window.addEventListener('pointerdown', this.down);
        window.addEventListener('pointermove', this.move);
        window.addEventListener('pointerup', this.up);
        window.addEventListener('pointercancel', this.cancel);
    }

    update(delta: number, controls: Readonly<BackgroundControls>, enabled: boolean): void {
        this.controls = controls;
        this.enabled = enabled && !controls.paused && controls.clickEffect !== 'off';
        if (!this.enabled) this.gesture = null;
        this.strength = Math.max(0, this.strength - delta * 2);
        if (controls.clickEffect === 'off') this.effects.clear();
        this.effects.update(delta);
    }

    private accepts(event: PointerEvent): boolean {
        return this.enabled && event.isPrimary && event.button === 0 && !(event.target instanceof Element && event.target.closest(INTERACTIVE));
    }

    private worldPoint(event: PointerEvent): THREE.Vector3 | null {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return null;
        this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
        this.camera.updateMatrixWorld();
        this.ray.setFromCamera(this.pointer, this.camera);
        return this.ray.ray.intersectPlane(this.plane, this.point);
    }

    private readonly down = (event: PointerEvent) => {
        // Un segundo dedo cancela el gesto: el pinch nunca produce un clic tardío.
        if (!event.isPrimary) { this.gesture = null; return; }
        if (!this.accepts(event) || !this.worldPoint(event)) return;
        this.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, lastTrail: 0 };
    };

    private readonly move = (event: PointerEvent) => {
        const gesture = this.gesture;
        if (!gesture || gesture.id !== event.pointerId) return;
        gesture.moved ||= Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 6;
        if (!gesture.moved || !this.controls.clickTrail || (event.target instanceof Element && event.target.closest(INTERACTIVE))) return;
        if (event.timeStamp - gesture.lastTrail < 95) return;
        const point = this.worldPoint(event);
        if (!point) return;
        gesture.lastTrail = event.timeStamp;
        this.effects.spawn(point, this.controls.clickEffect, true);
    };

    private readonly up = (event: PointerEvent) => {
        const gesture = this.gesture;
        this.gesture = null;
        if (!gesture || gesture.id !== event.pointerId || gesture.moved || !this.accepts(event)) return;
        if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 6) return;
        const point = this.worldPoint(event);
        if (!point) return;
        this.strength = 1;
        this.onClick(point);
        this.effects.spawn(point, this.controls.clickEffect);
    };

    private readonly cancel = () => { this.gesture = null; };

    dispose(): void {
        window.removeEventListener('pointerdown', this.down);
        window.removeEventListener('pointermove', this.move);
        window.removeEventListener('pointerup', this.up);
        window.removeEventListener('pointercancel', this.cancel);
        this.gesture = null;
        this.effects.dispose();
    }
}
