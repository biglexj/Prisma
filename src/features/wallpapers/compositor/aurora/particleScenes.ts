// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.
import type { ParticleSceneFactory } from './ParticleBackground';

export const particleSceneLoaders: Record<string, () => Promise<{ default: ParticleSceneFactory }>> = {
    'blackholepro': () => import('./blackholepro/BlackHoleProBackground.js'),
    'interstellarparticles': () => import('./interstellarparticles/Interstellar3DBackground.js'),
    'milkyway': () => import('./milkyway/MilkyWayBackground.js'),
    'binarybh': () => import('./binarybh/BinaryBlackHoleBackground.js'),
    'morphclick': () => import('./morphclick/QuantumNexusBackground.js'),
    'nebula': () => import('./nebula/NebulaBackground.js'),
    'dnahelix': () => import('./dnahelix/DNAHelixBackground.js'),
    'wormhole': () => import('./wormhole/WormholeBackground.js'),
    'supernova': () => import('./supernova/SupernovaBackground.js'),
    'quasar': () => import('./quasar/QuasarBackground.js'),
    'bubbles': () => import('./bubbles/BubblesBackground.js'),
    'microbes': () => import('./microbes/MicrobesBackground.js'),
    'soundwave': () => import('./soundwave/SoundWaveBackground.js'),
    'jellyfish': () => import('./jellyfish/JellyfishBackground.js'),
    'synapse': () => import('./synapse/SynapseBackground.js'),
    'aurora': () => import('./aurora/AuroraCurtainsBackground.js'),
};

export const PARTICLE_BACKGROUNDS = [
    {
        "type": "blackholepro",
        "label": "Agujero Negro",
        "emoji": "🕳️",
        "desc": "Agujero Negro: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "interstellarparticles",
        "label": "Interestelar",
        "emoji": "🪐",
        "desc": "Interestelar: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "milkyway",
        "label": "Vía Láctea",
        "emoji": "🌌",
        "desc": "Vía Láctea: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "binarybh",
        "label": "Doble Abismo",
        "emoji": "🕳️",
        "desc": "Doble Abismo: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "morphclick",
        "label": "Nexo Cuántico",
        "emoji": "✨",
        "desc": "Nexo Cuántico: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "nebula",
        "label": "Nebulosa Orión",
        "emoji": "☁️",
        "desc": "Nebulosa Orión: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "dnahelix",
        "label": "ADN Cósmico",
        "emoji": "🧬",
        "desc": "ADN Cósmico: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "wormhole",
        "label": "Agujero de Gusano",
        "emoji": "🌀",
        "desc": "Agujero de Gusano: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "supernova",
        "label": "Supernova Púlsar",
        "emoji": "💥",
        "desc": "Supernova Púlsar: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "quasar",
        "label": "Cuásar Hiperluminoso",
        "emoji": "🌠",
        "desc": "Cuásar Hiperluminoso: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "bubbles",
        "label": "Burbujas Explosivas",
        "emoji": "🫧",
        "desc": "Burbujas Explosivas: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "microbes",
        "label": "Bio-Abisal",
        "emoji": "🦠",
        "desc": "Bio-Abisal: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "soundwave",
        "label": "Pulso Musical 3D",
        "emoji": "🎵",
        "desc": "Pulso Musical 3D: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "jellyfish",
        "label": "Medusas Bioluminiscentes",
        "emoji": "🪼",
        "desc": "Medusas Bioluminiscentes: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "synapse",
        "label": "Red Sinapsis Viva",
        "emoji": "⚡",
        "desc": "Red Sinapsis Viva: partículas volumétricas reactivas a la voz"
    },
    {
        "type": "aurora",
        "label": "Velos de Aurora",
        "emoji": "🌈",
        "desc": "Velos de Aurora: partículas volumétricas reactivas a la voz"
    }
];
