// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from 'three';
import { createCosmos, createGlowTexture } from '../particleTextures';
import { applyBackgroundCamera } from '../BackgroundCamera';
import type { BackgroundControls } from '../controls';
import { disposeBackgroundObjects } from '../resources';
import { SKY_THEME } from './themes';
import { skyFragmentShader } from './sky.frag';

/** Capa ambiental independiente: cuatro paletas GLSL y estrellas sobre negro. */
export class AmbientBackground {
    readonly group = new THREE.Group();
    private readonly cosmos = new THREE.Group();
    private readonly soft = createGlowTexture();
    private readonly flare = createGlowTexture('#ffffff', 'rgba(200,240,255,0.55)', true);
    private readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    private readonly scale = new THREE.Vector3(5 / 28, 5 / 28, 5 / 28);
    private sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> | null = null;
    private readonly dir = new THREE.Vector3();
    private readonly up = new THREE.Vector3();
    private readonly right = new THREE.Vector3();

    constructor(private readonly stageCamera: THREE.Camera) {
        this.group.matrixAutoUpdate = false;
        this.camera.position.z = 5;
        createCosmos(this.cosmos, this.soft, this.flare);
        this.cosmos.name = 'vtuber-ambient-stars';
        this.group.add(this.cosmos);
        this.ensureSky();
        this.sky!.visible = false;
        this.group.traverse(object => {
            if (!(object instanceof THREE.Points)) return;
            const material = object.material as THREE.PointsMaterial;
            material.onBeforeCompile = shader => {
                shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * (5.0 / 28.0);');
            };
        });
    }

    private ensureSky(): THREE.ShaderMaterial {
        if (this.sky) return this.sky.material;
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 }, uIntensity: { value: 0.85 }, uEnergy: { value: 0 }, uClick: { value: 0 }, uTheme: { value: 0 },
                uCamDir: { value: new THREE.Vector3() }, uCamRight: { value: new THREE.Vector3() }, uCamUp: { value: new THREE.Vector3() },
            },
            vertexShader: 'varying vec3 vWorldDir; void main(){vWorldDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
            fragmentShader: skyFragmentShader,
            side: THREE.BackSide, depthWrite: false, depthTest: false,
        });
        this.sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 48, 48), material);
        this.sky.name = 'vtuber-ambient-sky';
        this.sky.frustumCulled = false;
        this.sky.renderOrder = -200;
        this.group.add(this.sky);
        return material;
    }

    update(controls: Readonly<BackgroundControls>, time: number, delta: number, energy: number, click: number): void {
        applyBackgroundCamera(this.camera, controls, time, 5, delta > 0 ? 1 - Math.exp(-delta * 6) : 1);
        this.stageCamera.updateMatrixWorld();
        this.group.matrix.multiplyMatrices(this.stageCamera.matrixWorld, this.camera.matrixWorldInverse).scale(this.scale);
        this.group.matrixWorldNeedsUpdate = true;
        const theme = controls.ambient;
        const procedural = theme !== 'original' && theme !== 'stars';
        if (this.sky) this.sky.visible = procedural;
        for (const object of this.cosmos.children) {
            if (object instanceof THREE.Sprite) object.visible = theme === 'original';
            if (object instanceof THREE.Points) {
                const material = object.material as THREE.PointsMaterial;
                material.opacity = theme === 'stars' ? 0.92 : theme === 'original' ? 0.78 : 0.72;
                material.size = theme === 'stars' ? 1.05 : 0.85;
            }
        }
        if (!procedural) return;
        const material = this.ensureSky();
        this.sky!.visible = true;
        this.camera.getWorldDirection(this.dir);
        this.up.copy(this.camera.up).transformDirection(this.camera.matrixWorld);
        this.right.crossVectors(this.dir, this.up).normalize();
        const u = material.uniforms;
        u.uTime.value = time;
        u.uIntensity.value = 0.85;
        u.uEnergy.value = energy;
        u.uClick.value = click;
        u.uTheme.value = SKY_THEME[theme];
        u.uCamDir.value.copy(this.dir);
        u.uCamUp.value.copy(this.up);
        u.uCamRight.value.copy(this.right);
    }

    dispose(): void {
        disposeBackgroundObjects(this.group);
        this.soft.dispose();
        this.flare.dispose();
        this.sky = null;
    }
}
