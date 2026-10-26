// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import { AMBIENT_BACKGROUNDS, type AmbientTheme } from './Backgrounds/themes';

export const CLICK_EFFECTS = [
    { value: 'off', label: 'Desactivados' }, { value: 'wave', label: 'Onda física' },
    { value: 'binary', label: 'Código binario' }, { value: 'cyberring', label: 'Anillos Cyber Hex' },
    { value: 'starburst', label: 'Supernova estelar' },
] as const;
export type ClickEffect = typeof CLICK_EFFECTS[number]['value'];

export const BACKGROUND_MOTIONS = [
    { value: 'none', label: 'Quieto' }, { value: 'spinAxis', label: 'Giro en su eje' },
    { value: 'auto', label: 'Auto suave' }, { value: 'cam360', label: 'Cámara 360°' },
    { value: 'leftright', label: 'Izquierda ↔ derecha' }, { value: 'updown', label: 'Arriba ↕ abajo' },
    { value: 'random', label: 'Deriva libre' },
] as const;
export const BACKGROUND_VIEWS = [
    { value: 'front', label: 'Frente' }, { value: 'top', label: 'Arriba' },
    { value: 'bottom', label: 'Abajo' }, { value: 'corner', label: 'Esquina ¾' },
] as const;
export interface BackgroundControls {
    motion: typeof BACKGROUND_MOTIONS[number]['value'];
    view: typeof BACKGROUND_VIEWS[number]['value'];
    speed: number;
    zoom: number;
    panX: number;
    panY: number;
    yaw: number;
    pitch: number;
    paused: boolean;
    colorCycle: boolean;
    ambient: AmbientTheme;
    clickEffect: ClickEffect;
    clickTrail: boolean;
    quality: 0 | 1 | 2;
}
export const DEFAULT_BACKGROUND_CONTROLS: Readonly<BackgroundControls> = Object.freeze({
    motion: 'spinAxis', view: 'front', speed: 0.5, zoom: 1,
    panX: 0, panY: 0, yaw: 0, pitch: 0, paused: false, colorCycle: false,
    ambient: 'original', clickEffect: 'wave', clickTrail: false, quality: 1,
});
