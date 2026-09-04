export interface DspBandConfig {
  freq: number;
  gainDb: number;
}

export interface DspEffectsConfig {
  clarity: number;       // 0 a 10
  ambience: number;      // 0 a 10
  surround: number;      // 0 a 10
  dynamicBoost: number;  // 0 a 10
  bassBoost: number;     // 0 a 10
}

export interface DspConfig {
  enabled: boolean;
  preampDb: number;
  bands: DspBandConfig[];
  effects: DspEffectsConfig;
}

export interface AudioDeviceItem {
  name: string;
  description: string;
  isActive: boolean;
}

export interface AudioEndpointInfo {
  id: string;
  name: string;
  isDefault: boolean;
  isVirtual: boolean;
}

export interface GlobalPassthruStatus {
  isRunning: boolean;
  hasSignal?: boolean;
  volume?: number;
  activeCaptureDevice?: string | null;
  activeRenderDevice?: string | null;
  sampleRate: number;
  latencyMs: number;
}

export interface DspPreset {
  id: string;
  name: string;
  isBuiltIn?: boolean;
  preampDb?: number;
  bands: number[]; // 10 valores de ganancia en dB (-12 a +12)
  effects: DspEffectsConfig;
}

export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export const EQ_BAND_RANGES: readonly [min: number, max: number][] = [
  [20, 50],       // Banda 0 (base 31 Hz)
  [45, 95],       // Banda 1 (base 62 Hz)
  [90, 190],      // Banda 2 (base 125 Hz)
  [180, 380],     // Banda 3 (base 250 Hz)
  [350, 750],     // Banda 4 (base 500 Hz)
  [700, 1500],    // Banda 5 (base 1000 Hz)
  [1400, 3200],   // Banda 6 (base 2000 Hz)
  [2800, 6500],   // Banda 7 (base 4000 Hz)
  [5500, 12500],  // Banda 8 (base 8000 Hz)
  [11000, 20000], // Banda 9 (base 16000 Hz)
] as const;

export const DEFAULT_PRESETS: DspPreset[] = [
  {
    id: "prisma",
    name: "Prisma ★",
    isBuiltIn: true,
    preampDb: 0.0,
    bands: [0, 2, 2, 1, 0, 0, 0, -1, 0, 2],
    effects: {
      clarity: 4.0,
      ambience: 3.0,
      surround: 3.0,
      dynamicBoost: 2.0,
      bassBoost: 3.0,
    },
  },
  {
    id: "bass_boost",
    name: "Graves Potentes",
    isBuiltIn: true,
    preampDb: -2.0,
    bands: [3, 4, 3, 2, 0, 0, 0, -1, 0, 1],
    effects: {
      clarity: 3,
      ambience: 2,
      surround: 2,
      dynamicBoost: 3,
      bassBoost: 7,
    },
  },
  {
    id: "vocal_podcast",
    name: "Voces y Podcast",
    isBuiltIn: true,
    preampDb: 0,
    bands: [-2, -1, 0, 2, 4, 5, 4, 2, 1, 0],
    effects: {
      clarity: 7,
      ambience: 2,
      surround: 1,
      dynamicBoost: 3,
      bassBoost: 1,
    },
  },
  {
    id: "gaming_3d",
    name: "Gaming e Inmersión 3D",
    isBuiltIn: true,
    preampDb: -1.5,
    bands: [2, 3, 1, -1, 0, 2, 4, 3, 4, 3],
    effects: {
      clarity: 5,
      ambience: 4,
      surround: 8,
      dynamicBoost: 5,
      bassBoost: 4,
    },
  },
  {
    id: "cinema",
    name: "Cine y Películas",
    isBuiltIn: true,
    preampDb: -2.0,
    bands: [4, 3, 1, 0, 2, 3, 3, 2, 3, 4],
    effects: {
      clarity: 4,
      ambience: 5,
      surround: 6,
      dynamicBoost: 4,
      bassBoost: 5,
    },
  },
  {
    id: "acoustic",
    name: "Acústico y En Vivo",
    isBuiltIn: true,
    preampDb: 0,
    bands: [1, 2, 2, 1, 1, 2, 3, 3, 2, 2],
    effects: {
      clarity: 5,
      ambience: 5,
      surround: 3,
      dynamicBoost: 1,
      bassBoost: 2,
    },
  },
  {
    id: "flat",
    name: "Plano / Neutral",
    isBuiltIn: true,
    preampDb: 0,
    bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    effects: {
      clarity: 0,
      ambience: 0,
      surround: 0,
      dynamicBoost: 0,
      bassBoost: 0,
    },
  },
];
