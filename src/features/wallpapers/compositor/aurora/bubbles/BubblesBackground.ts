// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/**
 * Escena extraída del prototipo de temp, sin UI ni bucle de render propios.
 * @param {import('three').Group} root
 * @param {import('./ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup }) {
    const bubbles = [];
    const bubbleCount = 24;
    const sphereGeo = new THREE.SphereGeometry(1, 48, 48);

    const baseBubbleShader = {
        vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewPos;
            varying vec3 vWorldPos;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                vViewPos = -mvPos.xyz;
                vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                gl_Position = projectionMatrix * mvPos;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uIntensity;
            uniform float uFade;
            uniform float uHueOffset;
            uniform float uSwelling;
            varying vec3 vNormal;
            varying vec3 vViewPos;
            varying vec3 vWorldPos;

            vec3 iridescence(float t) {
                return 0.55 + 0.45 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67)));
            }

            void main() {
                vec3 N = normalize(vNormal);
                vec3 V = normalize(vViewPos);
                float ndotv = max(dot(N, V), 0.0);
                float fresnel = pow(1.0 - ndotv, 2.4 - uSwelling * 0.8);

                vec3 L1 = normalize(vec3(0.6, 0.8, 0.5));
                vec3 H1 = normalize(L1 + V);
                float spec1 = pow(max(dot(N, H1), 0.0), 72.0);

                vec3 L2 = normalize(vec3(-0.7, -0.5, 0.4));
                vec3 H2 = normalize(L2 + V);
                float spec2 = pow(max(dot(N, H2), 0.0), 40.0);

                vec3 filmCol = iridescence(fresnel * 1.5 + uHueOffset + uTime * 0.25 + vWorldPos.y * 0.04);
                vec3 finalColor = filmCol * fresnel * (1.65 + uSwelling * 1.4) * uIntensity + vec3(1.0, 0.98, 0.95) * (spec1 * 1.4 + spec2 * 0.6);
                float alpha = clamp((fresnel * 0.82 + spec1 + spec2 * 0.5 + 0.04) * uFade, 0.0, 0.95);
                gl_FragColor = vec4(finalColor, alpha);
            }
        `
    };

    // Popping micro-droplet particle pool
    const burstPoolCount = 2400;
    const burstGeo = new THREE.BufferGeometry();
    const burstPos = new Float32Array(burstPoolCount * 3);
    const burstCol = new Float32Array(burstPoolCount * 3);
    const burstMeta = [];

    for (let i = 0; i < burstPoolCount; i++) {
        burstPos[i * 3 + 1] = -9999;
        burstMeta.push({
            vel: new THREE.Vector3(),
            life: 0,
            maxLife: 1
        });
    }
    burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
    burstGeo.setAttribute('color', new THREE.BufferAttribute(burstCol, 3));

    const burstMat = new THREE.PointsMaterial({
        size: 0.42,
        map: starFlareTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    root.add(new THREE.Points(burstGeo, burstMat));

    let burstCursor = 0;
    function triggerBubblePop(center, radius, hueBase) {
        const droplets = 95;
        const posArr = burstGeo.attributes.position.array;
        const colArr = burstGeo.attributes.color.array;
        const c = new THREE.Color();

        for (let k = 0; k < droplets; k++) {
            const idx = burstCursor;
            burstCursor = (burstCursor + 1) % burstPoolCount;

            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const nx = Math.sin(phi) * Math.cos(theta);
            const ny = Math.sin(phi) * Math.sin(theta);
            const nz = Math.cos(phi);

            posArr[idx * 3] = center.x + nx * radius;
            posArr[idx * 3 + 1] = center.y + ny * radius;
            posArr[idx * 3 + 2] = center.z + nz * radius;

            const spd = (3.5 + Math.random() * 5.5) * (0.6 + radius * 0.35);
            burstMeta[idx].vel.set(nx * spd, ny * spd, nz * spd);
            burstMeta[idx].maxLife = 0.55 + Math.random() * 0.55;
            burstMeta[idx].life = burstMeta[idx].maxLife;

            c.setHSL((hueBase + Math.random() * 0.35) % 1.0, 0.95, 0.72);
            colArr[idx * 3] = c.r;
            colArr[idx * 3 + 1] = c.g;
            colArr[idx * 3 + 2] = c.b;
        }
        burstGeo.attributes.position.needsUpdate = true;
        burstGeo.attributes.color.needsUpdate = true;
    }

    for (let i = 0; i < bubbleCount; i++) {
        const baseRadius = 0.95 + Math.random() * 1.95;
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uIntensity: { value: 1.0 },
                uFade: { value: 1.0 },
                uHueOffset: { value: i / bubbleCount },
                uSwelling: { value: 0.0 }
            },
            vertexShader: baseBubbleShader.vertexShader,
            fragmentShader: baseBubbleShader.fragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(sphereGeo, mat);
        mesh.scale.setScalar(baseRadius);
        mesh.position.set(
            (Math.random() - 0.5) * 24,
            (Math.random() - 0.5) * 14,
            (Math.random() - 0.5) * 12
        );
        root.add(mesh);

        bubbles.push({
            mesh,
            mat,
            baseRadius,
            radius: baseRadius,
            age: Math.random() * 6.0,
            maxAge: 3.8 + Math.random() * 5.5,
            hueOffset: i / bubbleCount,
            vel: new THREE.Vector3(
                (Math.random() - 0.5) * 2.5,
                0.6 + Math.random() * 1.8,
                (Math.random() - 0.5) * 1.6
            )
        });
    }

    let lastClickCheck = 0;

    return function updateBubbles(dt, elapsed, energy) {
        const bounds = { x: 14, y: 9.5, z: 7 };
        const localClick = state.clickWorldPos.clone().sub(masterGroup.position);
        const freshClick = state.clickStrength > 0.88 && (elapsed - lastClickCheck > 0.18);
        if (freshClick) lastClickCheck = elapsed;

        for (let i = 0; i < bubbles.length; i++) {
            const b = bubbles[i];
            b.age += dt * (1.0 + energy * 0.7);
            b.mat.uniforms.uTime.value = elapsed;
            b.mat.uniforms.uIntensity.value = state.intensity + energy * 0.6;

            const lifeRatio = b.age / b.maxAge;
            const spawnScale = Math.min(1.0, b.age * 2.5);
            const swell = lifeRatio > 0.82 ? (lifeRatio - 0.82) / 0.18 : 0.0;
            b.mat.uniforms.uSwelling.value = swell;

            b.radius = b.baseRadius * spawnScale * (1.0 + swell * 0.35 + Math.sin(elapsed * 4.0 + i) * 0.04);
            b.mesh.scale.setScalar(Math.max(0.01, b.radius));

            // Pop if clicked nearby or when reaching maxAge
            const distToClick = b.mesh.position.distanceTo(localClick);
            if (b.age >= b.maxAge || (freshClick && distToClick < 7.5)) {
                triggerBubblePop(b.mesh.position, b.radius, (b.hueOffset + elapsed * 0.1) % 1.0);
                b.age = 0;
                b.maxAge = 3.2 + Math.random() * 5.0;
                b.hueOffset = Math.random();
                b.mat.uniforms.uHueOffset.value = b.hueOffset;
                b.mesh.position.set(
                    (Math.random() - 0.5) * 24,
                    -8.5 + Math.random() * 5.0,
                    (Math.random() - 0.5) * 11
                );
                b.mesh.scale.setScalar(0.01);
                continue;
            }

            b.mesh.position.addScaledVector(b.vel, dt * (1.0 + energy * 0.45));
            b.mesh.position.x += Math.sin(elapsed * 1.5 + i) * dt * 0.6;

            if (Math.abs(b.mesh.position.x) > bounds.x) {
                b.mesh.position.x = Math.sign(b.mesh.position.x) * bounds.x;
                b.vel.x *= -1;
            }
            if (b.mesh.position.y > bounds.y) {
                triggerBubblePop(b.mesh.position, b.radius, (b.hueOffset + elapsed * 0.1) % 1.0);
                b.age = 0;
                b.mesh.position.y = -bounds.y;
            }
            if (Math.abs(b.mesh.position.z) > bounds.z) {
                b.mesh.position.z = Math.sign(b.mesh.position.z) * bounds.z;
                b.vel.z *= -1;
            }
        }

        // Update burst micro-droplets
        burstMat.size = (0.42 + energy * 0.25) * state.intensity;
        const bArr = burstGeo.attributes.position.array;
        for (let i = 0; i < burstPoolCount; i++) {
            const m = burstMeta[i];
            if (m.life > 0) {
                m.life -= dt;
                m.vel.multiplyScalar(0.95);
                m.vel.y -= dt * 1.8; // Gentle gravity on droplets
                bArr[i * 3] += m.vel.x * dt;
                bArr[i * 3 + 1] += m.vel.y * dt;
                bArr[i * 3 + 2] += m.vel.z * dt;
                if (m.life <= 0) {
                    bArr[i * 3 + 1] = -9999;
                }
            }
        }
        burstGeo.attributes.position.needsUpdate = true;
    };
}
