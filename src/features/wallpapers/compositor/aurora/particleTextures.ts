// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from 'three';

export function createGlowTexture(innerColor = '#ffffff', midColor = 'rgba(255,255,255,0.45)', sharpFlare = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear la textura de partículas');
    const center = 64;

    const grad = ctx.createRadialGradient(center, center, 0, center, center, center * 0.88);
    grad.addColorStop(0.0, innerColor);
    grad.addColorStop(0.2, midColor);
    grad.addColorStop(0.5, 'rgba(255,255,255,0.04)');
    grad.addColorStop(0.82, 'rgba(0,0,0,0)');
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    if (sharpFlare) {
        const hGrad = ctx.createLinearGradient(14, center, 114, center);
        hGrad.addColorStop(0.0, 'rgba(0,0,0,0)');
        hGrad.addColorStop(0.5, innerColor);
        hGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
        ctx.strokeStyle = hGrad;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(14, center);
        ctx.lineTo(114, center);
        ctx.stroke();

        const vGrad = ctx.createLinearGradient(center, 14, center, 114);
        vGrad.addColorStop(0.0, 'rgba(0,0,0,0)');
        vGrad.addColorStop(0.5, innerColor);
        vGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
        ctx.strokeStyle = vGrad;
        ctx.beginPath();
        ctx.moveTo(center, 14);
        ctx.lineTo(center, 114);
        ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
}

export function createCosmos(bgStarsGroup: THREE.Group, softGlowTex: THREE.Texture, starFlareTex: THREE.Texture) {
    const starCount = 4500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);

    const palette = [
        new THREE.Color(0x38bdf8),
        new THREE.Color(0xc084fc),
        new THREE.Color(0xfde047),
        new THREE.Color(0xf472b6),
        new THREE.Color(0xffffff)
    ];

    for (let i = 0; i < starCount; i++) {
        const r = 65 + Math.random() * 140;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i * 3 + 2] = r * Math.cos(phi);

        const c = palette[Math.floor(Math.random() * palette.length)];
        const b = 0.35 + Math.random() * 0.65;
        col[i * 3] = c.r * b;
        col[i * 3 + 1] = c.g * b;
        col[i * 3 + 2] = c.b * b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
        size: 0.9,
        map: starFlareTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    bgStarsGroup.add(new THREE.Points(geo, mat));

    // Distant soft nebula clouds around the 360 horizon
    const nebColors = [0x3b0764, 0x0f172a, 0x064e3b, 0x4c1d95, 0x1e1b4b];
    for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const dist = 85 + Math.random() * 30;
        const spMat = new THREE.SpriteMaterial({
            map: softGlowTex,
            color: nebColors[i % nebColors.length],
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const sp = new THREE.Sprite(spMat);
        sp.position.set(
            Math.cos(angle) * dist,
            (Math.random() - 0.5) * 55,
            Math.sin(angle) * dist
        );
        const s = 45 + Math.random() * 35;
        sp.scale.set(s, s, 1);
        bgStarsGroup.add(sp);
    }
}
