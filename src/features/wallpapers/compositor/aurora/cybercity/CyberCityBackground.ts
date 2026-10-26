// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import { ParticleBackground } from '../ParticleBackground';
import createCityScene from './createCityScene.js';

export class CyberCityBackground extends ParticleBackground {
    constructor() { super(createCityScene); }
}
