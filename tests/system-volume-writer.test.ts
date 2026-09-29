import { describe, expect, test } from "bun:test";
import { createSystemVolumeWriter, type SystemVolumeState } from "../src/features/playback/services/systemVolumeWriter";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const state = (volume: number): SystemVolumeState => ({ volume, isMuted: false });

describe("global volume writes", () => {
  test("rapid slider movement is serialized and only the latest target is confirmed", async () => {
    const first = deferred<SystemVolumeState>();
    const last = deferred<SystemVolumeState>();
    const calls: SystemVolumeState[] = [];
    const confirmations: SystemVolumeState[] = [];
    const writer = createSystemVolumeWriter((target) => {
      calls.push(target);
      return calls.length === 1 ? first.promise : last.promise;
    }, (actual) => confirmations.push(actual), () => { throw new Error("unexpected failure"); });
    writer.set(state(54));
    writer.set(state(60));
    writer.set(state(68));
    expect(calls).toEqual([state(54)]);
    first.resolve(state(54));
    await flush();
    expect(calls).toEqual([state(54), state(68)]);
    expect(confirmations).toEqual([]);
    last.resolve(state(68));
    await flush();
    expect(confirmations).toEqual([state(68)]);
    expect(writer.busy).toBe(false);
  });

  test("failed older writes do not discard the newer slider target", async () => {
    const first = deferred<SystemVolumeState>();
    const actual: SystemVolumeState[] = [];
    const errors: unknown[] = [];
    let calls = 0;
    const writer = createSystemVolumeWriter((target) => ++calls === 1 ? first.promise : Promise.resolve(target),
      (value) => actual.push(value), (error) => errors.push(error));
    writer.set(state(15));
    writer.set({ volume: 20, isMuted: true });
    first.reject(new Error("endpoint changed"));
    await flush();
    expect(actual).toEqual([{ volume: 20, isMuted: true }]);
    expect(errors).toEqual([]);
    expect(writer.busy).toBe(false);
  });

  test("last failure is reported and the writer can retry", async () => {
    const errors: unknown[] = [];
    const actual: SystemVolumeState[] = [];
    let calls = 0;
    const writer = createSystemVolumeWriter((target) => ++calls === 1
      ? Promise.reject(new Error("unavailable")) : Promise.resolve(target),
    (value) => actual.push(value), (error) => errors.push(error));
    writer.set(state(12));
    await flush();
    expect(errors).toHaveLength(1);
    writer.set(state(18));
    await flush();
    expect(actual).toEqual([state(18)]);
  });

  test("unmount cancels queued writes and prevents late confirmations", async () => {
    const first = deferred<SystemVolumeState>();
    let writes = 0;
    let confirmations = 0;
    const writer = createSystemVolumeWriter(() => { writes++; return first.promise; },
      () => { confirmations++; }, () => {});
    writer.set(state(30));
    writer.set(state(50));
    writer.dispose();
    first.resolve(state(30));
    await flush();
    expect(writes).toBe(1);
    expect(confirmations).toBe(0);
  });
});
