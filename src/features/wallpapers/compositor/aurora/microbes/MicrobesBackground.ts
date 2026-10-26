// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/**
 * Escena extraída del prototipo de temp, sin UI ni bucle de render propios.
 * @param {import('three').Group} root
 * @param {import('./ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup }) {
    const organisms = [];
    const orgCount = 18;
    const baseGeo = new THREE.SphereGeometry(1.15, 36, 36);

    for (let i = 0; i < orgCount; i++) {
        const cellGroup = new THREE.Group();
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uPhase: { value: i * 1.7 },
                uIntensity: { value: 1.0 },
                uFade: { value: 1.0 },
                uColor: { value: new THREE.Color(i % 2 === 0 ? 0x10b981 : 0x06b6d4) }
            },
            vertexShader: `
                uniform float uTime;
                uniform float uPhase;
                varying vec3 vNormal;
                varying vec3 vViewPos;
                void main() {
                    vec3 p = position;
                    float pulse = sin(uTime * 3.0 + uPhase + p.y * 2.5) * 0.14
                                + cos(uTime * 2.2 + uPhase + p.x * 2.5) * 0.1;
                    p += normal * pulse;
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
                    vViewPos = -mvPos.xyz;
                    gl_Position = projectionMatrix * mvPos;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uIntensity;
                uniform float uFade;
                varying vec3 vNormal;
                varying vec3 vViewPos;
                void main() {
                    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPos))), 2.1);
                    vec3 col = uColor * (rim * 2.2 + 0.18) * uIntensity;
                    gl_FragColor = vec4(col, (rim * 0.85 + 0.12) * uFade);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const membrane = new THREE.Mesh(baseGeo, mat);
        cellGroup.add(membrane);

        const nucSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: softGlowTex,
            color: i % 2 === 0 ? 0x2dd4bf : 0x38bdf8,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        nucSprite.scale.set(1.1, 1.1, 1);
        cellGroup.add(nucSprite);

        cellGroup.position.set(
            (Math.random() - 0.5) * 24,
            (Math.random() - 0.5) * 14,
            (Math.random() - 0.5) * 12
        );
        root.add(cellGroup);

        organisms.push({
            group: cellGroup,
            mat,
            phase: i * 1.3,
            basePos: cellGroup.position.clone()
        });
    }

    const planktonCount = 4500;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(planktonCount * 3);
    const pCol = new Float32Array(planktonCount * 3);

    for (let i = 0; i < planktonCount; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 32;
        pPos[i * 3 + 1] = (Math.random() - 0.5) * 20;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 18;

        const c = new THREE.Color().setHSL(0.45 + Math.random() * 0.12, 0.9, 0.6);
        pCol[i * 3] = c.r;
        pCol[i * 3 + 1] = c.g;
        pCol[i * 3 + 2] = c.b;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));

    const pMat = new THREE.PointsMaterial({
        size: 0.35,
        map: softGlowTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    root.add(new THREE.Points(pGeo, pMat));

    return function updateMicrobes(dt, elapsed, energy) {
        pMat.size = (0.35 + energy * 0.25) * state.intensity;
        organisms.forEach(o => {
            o.mat.uniforms.uTime.value = elapsed;
            o.mat.uniforms.uIntensity.value = state.intensity + energy * 0.7;
            o.group.position.x = o.basePos.x + Math.sin(elapsed * 0.6 + o.phase) * 2.2;
            o.group.position.y = o.basePos.y + Math.cos(elapsed * 0.5 + o.phase) * 1.8;
            const s = 1.0 + energy * 0.28 + state.clickStrength * 0.3;
            o.group.scale.setScalar(s);
        });
    };
}
