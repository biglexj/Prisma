/** Una sola consulta nativa en curso; conserva el último punto y descarta respuestas antiguas. */
export function latestTargetQuery<T>(
  resolve: (x: number, y: number) => Promise<T>,
  apply: (result: T) => void,
  interval = 60,
) {
  let revision = 0;
  let pending: { x: number; y: number; revision: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let lastStarted = -Infinity;
  let latestPosition: { x: number; y: number } | null = null;

  const schedule = () => {
    if (running || timer || !pending) return;
    timer = setTimeout(async () => {
      timer = null;
      const point = pending;
      if (!point) return;
      pending = null;
      running = true;
      lastStarted = Date.now();
      try {
        const result = await resolve(point.x, point.y);
        if (point.revision === revision) apply(result);
      } catch {
        // La siguiente posición vuelve a consultar; nunca se aplica una respuesta obsoleta.
      } finally {
        running = false;
        schedule();
      }
    }, Math.max(0, interval - (Date.now() - lastStarted)));
  };

  return {
    request(x: number, y: number) {
      // Los cambios del marco pueden generar movimientos sin cambio de posición.
      // No deben invalidar una consulta que ya está resolviendo ese mismo punto.
      if ((running || pending) && latestPosition?.x === x && latestPosition.y === y) return;
      latestPosition = { x, y };
      pending = { x, y, revision: ++revision };
      schedule();
    },
    cancel() {
      ++revision;
      pending = null;
      latestPosition = null;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
