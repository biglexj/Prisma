// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from 'three';
import type { BackgroundControls } from './controls';

const VIEWS = { front: [0, 0], top: [1.22, 0], bottom: [-1.22, 0], corner: [0.62, 0.78] } as const;
const AUTO = ['spinAxis', 'cam360', 'leftright', 'updown', 'random'] as const;
const desiredPosition = new THREE.Vector3();
const previousRotation = new THREE.Quaternion();
const desiredRotation = new THREE.Quaternion();

/** Cámara virtual del fondo. No modifica la cámara del avatar ni la captura. */
export function applyBackgroundCamera(camera: THREE.PerspectiveCamera, controls: Readonly<BackgroundControls>, time: number, radius: number, blend = 1): void {
    const motion = controls.motion === 'auto' ? AUTO[Math.floor(time / 12) % AUTO.length] : controls.motion;
    const [viewPitch, viewYaw] = VIEWS[controls.view];
    const pitch = THREE.MathUtils.clamp(viewPitch + THREE.MathUtils.degToRad(controls.pitch), -1.48, 1.48);
    let yaw = viewYaw + THREE.MathUtils.degToRad(controls.yaw);
    let x = controls.panX * radius / 28, y = controls.panY * radius / 28;
    if (motion === 'spinAxis') yaw += time * 0.2;
    if (motion === 'cam360') yaw += time * 0.42;
    if (motion === 'leftright') x += Math.sin(time * 0.7) * radius * 0.24;
    if (motion === 'updown') y += Math.sin(time * 0.7) * radius * 0.16;
    if (motion === 'random') {
        x += (Math.sin(time * 0.27) + Math.sin(time * 0.43)) * radius * 0.1;
        y += Math.sin(time * 0.31) * radius * 0.12;
        yaw += Math.sin(time * 0.19) * 0.3;
    }
    const distance = radius / controls.zoom;
    desiredPosition.set(x + distance * Math.cos(pitch) * Math.sin(yaw), y + distance * Math.sin(pitch), distance * Math.cos(pitch) * Math.cos(yaw));
    previousRotation.copy(camera.quaternion);
    camera.position.lerp(desiredPosition, blend);
    camera.lookAt(x, y, 0);
    desiredRotation.copy(camera.quaternion);
    camera.quaternion.copy(previousRotation).slerp(desiredRotation, blend);
    camera.updateMatrixWorld();
}
