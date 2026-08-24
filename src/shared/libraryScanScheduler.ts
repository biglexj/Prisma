const MAX_CONCURRENT_LIBRARY_SCANS = 1;

interface ScheduledScan {
  run: () => void;
}

const scanQueue: ScheduledScan[] = [];
let activeScans = 0;

function pumpScanQueue() {
  while (activeScans < MAX_CONCURRENT_LIBRARY_SCANS && scanQueue.length > 0) {
    const scheduled = scanQueue.shift();
    if (!scheduled) return;
    activeScans += 1;
    scheduled.run();
  }
}

/**
 * Evita que las bibliotecas locales recorran el disco en paralelo durante el
 * arranque. Las lecturas ligeras de fuentes continúan siendo concurrentes.
 */
export function scheduleLibraryScan<T>(scan: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    scanQueue.push({
      run: () => {
        void Promise.resolve()
          .then(scan)
          .then(resolve, reject)
          .finally(() => {
            activeScans -= 1;
            pumpScanQueue();
          });
      },
    });
    pumpScanQueue();
  });
}
