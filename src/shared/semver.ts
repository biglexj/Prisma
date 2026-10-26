/**
 * Comparación de versiones tipo SemVer, sin dependencias externas.
 *
 * El objetivo es sencillo: nunca afirmar que hay una actualización cuando la
 * versión publicada no se puede leer. Una versión ilegible se descarta y la
 * comparación devuelve "iguales", de modo que el usuario nunca recibe un
 * aviso falso por culpa de un dato mal formado.
 */

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  /** Identificadores de pre-release separados por punto, o null si es una versión final. */
  prerelease: string | null;
}

const NUMERIC = /^\d+$/;

/**
 * Parsea una versión de forma defensiva.
 *
 * Acepta "1.2.0", "v1.2.0", "1.2", "1.2.0-beta.1" y "1.2.0+build".
 * Devuelve null cuando la cadena no representa una versión legible.
 */
export function parseVersion(raw: string | null | undefined): ParsedVersion | null {
  if (typeof raw !== "string") return null;

  let value = raw.trim();
  if (!value) return null;

  // Prefijo de etiqueta de Git: "v1.2.0" o "V1.2.0".
  if (value[0] === "v" || value[0] === "V") value = value.slice(1).trim();
  if (!value) return null;

  // Metadatos de build: no afectan al orden.
  const plusIndex = value.indexOf("+");
  if (plusIndex >= 0) value = value.slice(0, plusIndex);

  // Pre-release: se separa en el primer guion.
  let prerelease: string | null = null;
  const dashIndex = value.indexOf("-");
  if (dashIndex >= 0) {
    prerelease = value.slice(dashIndex + 1) || null;
    value = value.slice(0, dashIndex);
  }

  const segments = value.split(".");
  if (segments.length === 0 || segments.length > 3) return null;

  const numbers: number[] = [];
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) {
      // "1..2" no es una versión legible.
      return null;
    }
    if (!NUMERIC.test(trimmed)) return null;
    numbers.push(Number.parseInt(trimmed, 10));
  }

  return {
    major: numbers[0] ?? 0,
    minor: numbers[1] ?? 0,
    patch: numbers[2] ?? 0,
    prerelease,
  };
}

/** Compara dos identificadores de pre-release según las reglas de SemVer. */
function comparePrerelease(a: string, b: string): number {
  const left = a.split(".").filter(Boolean);
  const right = b.split(".").filter(Boolean);
  const length = Math.min(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === rightPart) continue;

    const leftNumeric = NUMERIC.test(leftPart);
    const rightNumeric = NUMERIC.test(rightPart);

    if (leftNumeric && rightNumeric) {
      return Number.parseInt(leftPart, 10) - Number.parseInt(rightPart, 10);
    }
    // Un identificador numérico siempre es menor que uno alfanumérico.
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return leftPart < rightPart ? -1 : 1;
  }

  // Una lista que es prefijo de la otra es la menor.
  return left.length - right.length;
}

/**
 * Compara dos versiones.
 *
 * Devuelve -1 si `a` es anterior, 0 si son equivalentes y 1 si `a` es
 * posterior. Si alguna de las dos no se puede leer devuelve 0: es preferible
 * callar a mentir.
 */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;

  if (left.major !== right.major) return left.major > right.major ? 1 : -1;
  if (left.minor !== right.minor) return left.minor > right.minor ? 1 : -1;
  if (left.patch !== right.patch) return left.patch > right.patch ? 1 : -1;

  if (left.prerelease === right.prerelease) return 0;
  // Una versión final siempre es mayor que su pre-release.
  if (!left.prerelease) return 1;
  if (!right.prerelease) return -1;

  return comparePrerelease(left.prerelease, right.prerelease);
}

/** Indica si `candidate` es estrictamente posterior a `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0;
}
