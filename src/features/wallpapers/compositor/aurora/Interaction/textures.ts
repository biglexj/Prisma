// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from 'three';

function textureCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear la textura interactiva');
    return { canvas, ctx };
}

export function createBinaryGlyphTexture(char: '0' | '1'): THREE.CanvasTexture {
    const { canvas, ctx } = textureCanvas();
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 58);
    grad.addColorStop(0, 'rgba(20,184,166,0.32)');
    grad.addColorStop(0.6, 'rgba(16,185,129,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    ctx.font = 'bold 76px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#2dd4bf';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#34d399';
    ctx.fillText(char, 64, 66);
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#ecfdf5';
    ctx.fillText(char, 64, 66);
    return new THREE.CanvasTexture(canvas);
}

export function createHexRingTexture(): THREE.CanvasTexture {
    const { canvas, ctx } = textureCanvas();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#2dd4bf';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const x = 64 + Math.cos(a) * 44, y = 64 + Math.sin(a) * 44;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    return new THREE.CanvasTexture(canvas);
}

export function createSquareTexture(): THREE.CanvasTexture {
    const { canvas, ctx } = textureCanvas();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.fillRect(28, 28, 72, 72);
    return new THREE.CanvasTexture(canvas);
}
