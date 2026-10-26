/** Contrato ligero: la interfaz principal no importa Three.js. */
export const SCENARIOS = [
  { value: "none", label: "Sin escenario" },
  { value: "prisma", label: "Prisma" },
  { value: "borealis", label: "Aurora Boreal" },
  { value: "cybercity", label: "Holo Ciudad 3D" },
] as const;
export const AMBIENTS = [
  { value: "original", label: "Sin ambiente" },
  { value: "violet", label: "Halo violeta" },
  { value: "warm", label: "Cálido" },
  { value: "bio", label: "Cian / Bio" },
  { value: "deep", label: "Profundo" },
  { value: "stars", label: "Estrellas" },
] as const;
export interface CompositionConfig {
  scenario: string;
  ambient: string;
  intensity: number;
  audioLevel: number;
  paused: boolean;
  enabled: boolean;
}
