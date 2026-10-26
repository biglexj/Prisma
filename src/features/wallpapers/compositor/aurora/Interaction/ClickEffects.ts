// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import * as THREE from 'three';
import type { ClickEffect } from '../controls';
import { createGlowTexture } from '../particleTextures';
import { createBinaryGlyphTexture, createHexRingTexture } from './textures';

interface ClickSprite {
    sprite: THREE.Sprite;
    velocity: THREE.Vector3;
    baseScale: number;
    life: number;
    maxLife: number;
    binary: boolean;
}

/** Emisores del HTML, limitados a 220 sprites y con amortiguamiento por segundo. */
export class ClickEffects {
    readonly group = new THREE.Group();
    private sprites: ClickSprite[] = [];
    private textures: { zero: THREE.Texture; one: THREE.Texture; hex: THREE.Texture; flare: THREE.Texture } | null = null;

    constructor() {
        this.group.name = 'vtuber-click-effects';
        this.group.scale.setScalar(5 / 28);
    }

    private getTextures() {
        this.textures ??= {
            zero: createBinaryGlyphTexture('0'), one: createBinaryGlyphTexture('1'), hex: createHexRingTexture(),
            flare: createGlowTexture('#ffffff', 'rgba(200,240,255,0.55)', true),
        };
        return this.textures;
    }

    spawn(point: THREE.Vector3, mode: ClickEffect, trail = false): void {
        if (mode === 'wave' || mode === 'off') return;
        const textures = this.getTextures();
        const count = trail ? 4 : mode === 'binary' ? 26 : mode === 'cyberring' ? 14 : 32;
        this.group.updateWorldMatrix(true, false);
        const origin = this.group.worldToLocal(point.clone());
        for (let i = 0; i < count; i++) {
            let map = textures.flare, scale = 1.1;
            const color = new THREE.Color();
            const velocity = new THREE.Vector3();
            if (mode === 'binary') {
                map = i % 2 === 0 ? textures.zero : textures.one;
                color.setHSL(0.42 + i % 5 * 0.03, 0.95, 0.68);
                scale = trail ? 0.85 + Math.random() * 0.5 : 0.95 + Math.random() * 0.85;
                const angle = i / count * Math.PI * 2 + Math.random() * 0.25;
                const speed = trail ? 1.2 + Math.random() * 2 : 2.8 + i % 3 * 2.2;
                velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed + (trail ? 1.5 : 2.2), (Math.random() - 0.5) * 3);
            } else if (mode === 'cyberring') {
                map = i % 3 === 0 ? textures.hex : textures.flare;
                color.setHSL(0.52 + i / count * 0.35, 0.95, 0.65);
                scale = i % 3 === 0 ? 1.8 : 0.9;
                const angle = i / count * Math.PI * 2, speed = 4.5 + i % 2 * 2.5;
                velocity.set(Math.cos(angle) * speed, Math.sin(angle) * speed, (Math.random() - 0.5) * 2);
            } else {
                color.setHSL(Math.random(), 0.95, 0.7);
                scale = 0.75 + Math.random() * 0.9;
                const theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1), speed = 3.5 + Math.random() * 7.5;
                velocity.set(Math.sin(phi) * Math.cos(theta) * speed, Math.sin(phi) * Math.sin(theta) * speed, Math.cos(phi) * speed);
            }
            const material = new THREE.SpriteMaterial({ map, color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
            const sprite = new THREE.Sprite(material);
            sprite.position.copy(origin);
            sprite.position.x += (Math.random() - 0.5) * (trail ? 0.8 : 1.4);
            sprite.position.y += (Math.random() - 0.5) * (trail ? 0.8 : 1.4);
            sprite.scale.setScalar(scale);
            sprite.renderOrder = 100;
            this.group.add(sprite);
            this.sprites.push({ sprite, velocity, baseScale: scale, life: 0, maxLife: trail ? 0.65 + Math.random() * 0.4 : 1.05 + Math.random() * 0.65, binary: mode === 'binary' });
        }
        while (this.sprites.length > 220) this.remove(0);
    }

    private remove(index: number): void {
        const [{ sprite }] = this.sprites.splice(index, 1);
        sprite.removeFromParent();
        (sprite.material as THREE.SpriteMaterial).dispose();
    }

    update(delta: number): void {
        const damping = Math.pow(0.94, delta * 60);
        // Integral de la velocidad amortiguada; misma trayectoria a 30, 60 y 120 FPS.
        const travel = (1 - damping) / (-60 * Math.log(0.94));
        for (let i = this.sprites.length - 1; i >= 0; i--) {
            const item = this.sprites[i];
            item.life += delta;
            const progress = item.life / item.maxLife;
            if (progress >= 1) { this.remove(i); continue; }
            item.sprite.position.addScaledVector(item.velocity, travel);
            item.velocity.multiplyScalar(damping);
            if (item.binary) item.sprite.position.y += delta * 1.35;
            item.sprite.material.opacity = (1 - Math.pow(progress, 1.6)) * 0.95;
            item.sprite.scale.setScalar(item.baseScale * (1 + progress * 0.35));
        }
    }

    clear(): void { while (this.sprites.length) this.remove(this.sprites.length - 1); }

    dispose(): void {
        this.clear();
        Object.values(this.textures ?? {}).forEach(texture => texture.dispose());
        this.textures = null;
        this.group.removeFromParent();
    }
}
