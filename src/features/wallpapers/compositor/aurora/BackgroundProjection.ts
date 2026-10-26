// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from 'three';
import { applyBackgroundCamera } from './BackgroundCamera';
import type { BackgroundControls } from './controls';
import { supportsBackgroundCamera } from './catalog';

export function bindBackgroundHue(objects: THREE.Object3D[], hue: { value: number }): void {
    const materials = new Set<THREE.Material>();
    for (const root of objects) root.traverse(object => {
        const drawable = object as THREE.Mesh;
        if (!drawable.material) return;
        for (const material of Array.isArray(drawable.material) ? drawable.material : [drawable.material]) materials.add(material);
    });
    for (const material of materials) {
        const compile = material.onBeforeCompile;
        material.onBeforeCompile = (shader, renderer) => {
            compile.call(material, shader, renderer);
            shader.uniforms.vtuberBackgroundHue = hue;
            shader.fragmentShader = 'uniform float vtuberBackgroundHue;\n' + shader.fragmentShader.replace(/}\s*$/, `
                if (abs(vtuberBackgroundHue) > 0.0001) {
                    vec3 axis = normalize(vec3(1.0));
                    vec3 original = gl_FragColor.rgb;
                    float c = cos(vtuberBackgroundHue), s = sin(vtuberBackgroundHue);
                    gl_FragColor.rgb = max(vec3(0.0), original * c + cross(axis, original) * s + axis * dot(axis, original) * (1.0 - c));
                }
            }`);
        };
        material.needsUpdate = true;
    }
}

/** Adapta los fondos previos sin cambiar sus geometrías ni la cámara del escenario. */
export class BackgroundProjection {
    readonly group = new THREE.Group();
    private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    private readonly transform = { value: new THREE.Vector3(1, 0, 0) };
    private readonly spatial: boolean;
    /** Escala mínima para que un fondo plano siga cubriendo el viewport. */
    private readonly minScale: number = 1;

    constructor(objects: THREE.Object3D[], private readonly stageCamera: THREE.Camera, type: string) {
        this.spatial = supportsBackgroundCamera(type);
        this.camera.position.z = 5;
        this.group.matrixAutoUpdate = false;
        this.group.add(...objects);
        if (this.spatial) return;
        this.minScale = this.computeCoverScale(objects, stageCamera);
        this.group.traverse(object => {
            const drawable = object as THREE.Mesh;
            if (!drawable.material) return;
            for (const material of Array.isArray(drawable.material) ? drawable.material : [drawable.material]) {
                const compile = material.onBeforeCompile;
                material.onBeforeCompile = (shader, renderer) => {
                    compile.call(material, shader, renderer);
                    shader.uniforms.vtuberBackgroundTransform = this.transform;
                    shader.vertexShader = 'uniform vec3 vtuberBackgroundTransform;\n' + shader.vertexShader.replace(/gl_Position\s*=\s*[^;]+;/g, '$& gl_Position.xy = gl_Position.xy * vtuberBackgroundTransform.x + vtuberBackgroundTransform.yz * gl_Position.w;');
                };
                material.needsUpdate = true;
            }
        });
    }

    /** Escala con la que el objeto todavía cubre el frustum en la posición actual. */
    private computeCoverScale(objects: THREE.Object3D[], camera: THREE.Camera): number {
        const box = new THREE.Box3();
        for (const object of objects) box.expandByObject(object);
        const size = box.getSize(new THREE.Vector3());
        if (size.x <= 0 || size.y <= 0) return 1;
        const center = box.getCenter(new THREE.Vector3());
        const perspective = camera as THREE.PerspectiveCamera;
        const fov = perspective.fov || 60;
        const aspect = perspective.aspect || 1;
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        const distance = Math.max(0.1, new THREE.Vector3().subVectors(center, camera.position).dot(forward));
        const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
        const visibleWidth = visibleHeight * aspect;
        return Math.max(visibleHeight / size.y, visibleWidth / size.x);
    }

    update(controls: Readonly<BackgroundControls>, time: number, delta = 0): void {
        if (!this.spatial) {
            // Un fondo plano no puede mostrar su borde: el zoom se detiene al llegar al borde.
            const margin = Math.max(1 + Math.abs(controls.panX) / 10, 1 + Math.abs(controls.panY) / 10);
            this.transform.value.set(Math.max(controls.zoom, this.minScale * margin), controls.panX / 10, controls.panY / 10);
            return;
        }
        this.transform.value.set(controls.zoom, controls.panX / 10, controls.panY / 10);
        applyBackgroundCamera(this.camera, controls, time, 5, delta > 0 ? 1 - Math.exp(-delta * 6) : 1);
        this.stageCamera.updateMatrixWorld();
        this.group.matrix.multiplyMatrices(this.stageCamera.matrixWorld, this.camera.matrixWorldInverse);
        this.group.matrixWorldNeedsUpdate = true;
    }
}
