// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import { supportsAmbientBackground } from './catalog';
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
export function normalizeBackgroundControls(value: unknown): BackgroundControls {
    const input = value && typeof value === 'object' ? value as Partial<BackgroundControls> : {};
    const clamp = (key: keyof BackgroundControls, min: number, max: number): number => {
        const number = input[key];
        return typeof number === 'number' && Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : DEFAULT_BACKGROUND_CONTROLS[key] as number;
    };
    return {
        motion: BACKGROUND_MOTIONS.some(item => item.value === input.motion) ? input.motion! : 'spinAxis',
        view: BACKGROUND_VIEWS.some(item => item.value === input.view) ? input.view! : 'front',
        speed: clamp('speed', 0.1, 3), zoom: clamp('zoom', 0.1, 2.5),
        panX: clamp('panX', -10, 10), panY: clamp('panY', -10, 10),
        yaw: clamp('yaw', -180, 180), pitch: clamp('pitch', -80, 80),
        paused: input.paused === true, colorCycle: input.colorCycle === true,
        ambient: AMBIENT_BACKGROUNDS.some(item => item.value === input.ambient) ? input.ambient! : 'original',
        clickEffect: CLICK_EFFECTS.some(item => item.value === input.clickEffect) ? input.clickEffect! : 'wave',
        clickTrail: input.clickTrail === true,
        quality: input.quality === 0 || input.quality === 2 ? input.quality : 1,
    };
}
