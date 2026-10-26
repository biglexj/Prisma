// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import { ParticleBackground } from '../ParticleBackground';
import createTunnelScene from './createTunnelScene.js';

export class SpaceWormholeBackground extends ParticleBackground {
    constructor() { super(createTunnelScene); }
}
