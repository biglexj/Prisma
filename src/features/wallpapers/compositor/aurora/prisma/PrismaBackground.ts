// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from 'three';
import type { DynamicBackground } from '../index';

/** Facetas cromáticas suaves: cámara virtual, sin cámara física ni destellos blancos. */
export class PrismaBackground implements DynamicBackground {
    private mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
    init(scene: THREE.Scene): void {
        const material = new THREE.ShaderMaterial({
            uniforms: { time: { value: 0 }, activity: { value: 0.5 }, aspect: { value: window.innerWidth / window.innerHeight }, overlay: { value: 0 } },
            vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.999,1.0);}',
            fragmentShader: `
                varying vec2 vUv;
                uniform float time, activity, aspect, overlay;
                vec3 palette(float t) { return 0.42 + 0.36*cos(6.28318*(vec3(0.0,0.32,0.65)+t)); }
                void main() {
                    vec2 p = (vUv-0.5)*vec2(aspect,1.0);
                    float drift=time*0.035;
                    float facets=sin(p.x*4.0+drift)+cos(p.y*5.0-drift)+sin((p.x+p.y)*3.0-drift);
                    float glow=0.5+0.5*sin(facets*1.8+drift);
                    vec3 color=palette(facets*0.09+drift*0.15)*(0.23+glow*0.47+activity*0.10);
                    float vignette=1.0-smoothstep(0.1,1.5,length(p))*0.45;
                    gl_FragColor=vec4(color*vignette,mix(1.0,0.45,overlay));
                }`,
            transparent: true, depthTest: false, depthWrite: false,
        });
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -100;
        scene.add(this.mesh);
    }
    update(_delta: number, intensity: number, time: number, transparent = false): void {
        if (!this.mesh) return;
        this.mesh.material.uniforms.time.value = time;
        this.mesh.material.uniforms.activity.value = THREE.MathUtils.clamp(intensity, 0, 1);
        this.mesh.material.uniforms.overlay.value = transparent ? 1 : 0;
    }
    onResize(width: number, height: number): void { if (this.mesh) this.mesh.material.uniforms.aspect.value = width / Math.max(1, height); }
    dispose(): void { this.mesh?.removeFromParent(); this.mesh?.geometry.dispose(); this.mesh?.material.dispose(); this.mesh = null; }
}
