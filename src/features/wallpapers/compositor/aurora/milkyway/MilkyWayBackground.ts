// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
// @ts-nocheck — fábrica JavaScript original de Aurora
import * as THREE from 'three';

/**
 * Escena extraída del prototipo de temp, sin UI ni bucle de render propios.
 * @param {import('three').Group} root
 * @param {import('./ParticleBackground').ParticleContext} context
 */
export default function createScene(root, { state, softGlowTex, starFlareTex, masterGroup }) {
    const starCount = 12500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    const starData = [];

    const arms = 4;
    const cCore = new THREE.Color(0xfef08a);
    const cArmInner = new THREE.Color(0x38bdf8);
    const cArmOuter = new THREE.Color(0xa855f7);
    const cPinkHII = new THREE.Color(0xf43f5e);

    for (let i = 0; i < starCount; i++) {
        const r = Math.pow(Math.random(), 1.45) * 18.5;
        const armIndex = i % arms;
        const baseAngle = (armIndex / arms) * Math.PI * 2;
        const twist = r * 0.45;
        const scatter = (Math.random() - 0.5) * (0.55 + r * 0.08);
        const angle = baseAngle + twist + scatter;
        const y = (Math.random() - 0.5) * (1.6 * Math.exp(-r * 0.16));

        starData.push({ r, angle, y });

        const t = r / 18.5;
        const c = new THREE.Color();
        if (t < 0.18) c.lerpColors(cCore, cArmInner, t / 0.18);
        else if (Math.random() < 0.09) c.copy(cPinkHII);
        else c.lerpColors(cArmInner, cArmOuter, (t - 0.18) / 0.82);

        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.42,
        map: starFlareTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const galaxy = new THREE.Points(geo, mat);
    galaxy.rotation.x = 1.28;
    galaxy.rotation.z = -0.15;
    root.add(galaxy);

    const coreSpriteMat = new THREE.SpriteMaterial({
        map: softGlowTex,
        color: 0xfef08a,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const coreSprite = new THREE.Sprite(coreSpriteMat);
    coreSprite.scale.set(8.5, 8.5, 1);
    root.add(coreSprite);

    return function updateMilkyWay(dt, elapsed, energy) {
        mat.size = (0.42 + energy * 0.25) * state.intensity;
        const s = (8.2 + energy * 3.0) * state.intensity;
        coreSprite.scale.set(s, s, 1);

        const arr = geo.attributes.position.array;
        for (let i = 0; i < starCount; i++) {
            const st = starData[i];
            st.angle += (0.55 / (1.0 + st.r * 0.22)) * dt * (1.0 + energy * 0.5);
            const rMod = st.r * (1.0 - state.clickStrength * 0.25 * Math.sin(st.r));
            arr[i * 3] = Math.cos(st.angle) * rMod;
            arr[i * 3 + 1] = st.y;
            arr[i * 3 + 2] = Math.sin(st.angle) * rMod;
        }
        geo.attributes.position.needsUpdate = true;
    };
}
