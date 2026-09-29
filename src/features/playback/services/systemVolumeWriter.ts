export interface SystemVolumeState {
  volume: number;
  isMuted: boolean;
}

/** Serialize native writes and coalesce slider movement while IPC is pending. */
export function createSystemVolumeWriter(
  write: (state: SystemVolumeState) => Promise<SystemVolumeState>,
  confirmed: (state: SystemVolumeState) => void,
  failed: (error: unknown) => void,
) {
  let pending: SystemVolumeState | null = null;
  let busy = false;
  let disposed = false;

  async function drain() {
    if (busy || disposed) return;
    busy = true;
    try {
      while (pending && !disposed) {
        const target = pending;
        pending = null;
        try {
          const actual = await write(target);
          if (!pending && !disposed) confirmed(actual);
        } catch (error) {
          if (!pending && !disposed) failed(error);
        }
      }
    } finally {
      busy = false;
    }
  }

  return {
    get busy() { return busy; },
    set(state: SystemVolumeState) { pending = state; void drain(); },
    dispose() { disposed = true; pending = null; },
  };
}
