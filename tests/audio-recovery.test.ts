import { expect, test } from "bun:test";
import { reconcileGlobalAudio, type AudioIntent } from "../src/features/dsp/reconcileGlobalAudio";
const stopped = { isRunning: false, volume: 1, sampleRate: 48000, latencyMs: 0, activeCaptureDevice: null, activeRenderDevice: null };

test("recupera un motor detenido y cambia de salida sin perder la intención", async () => {
  const calls: unknown[] = [];
  const client = { globalPassthruGetStatus: async () => stopped, globalPassthruToggle: async (...args: unknown[]) => { calls.push(args); return { ...stopped, isRunning: true }; } };
  const intent: AudioIntent = { enabled: true, capture: null, render: "auriculares" };
  await reconcileGlobalAudio(client, () => intent);
  intent.render = "altavoces";
  await reconcileGlobalAudio(client, () => intent);
  expect(calls).toEqual([[true, null, "auriculares"], [true, null, "altavoces"]]);
  expect(intent.enabled).toBe(true);
});

test("una desactivación durante la consulta no vuelve a encender el audio", async () => {
  let intent: AudioIntent = { enabled: true, capture: null, render: "auriculares" };
  const calls: unknown[] = [];
  const client = { globalPassthruGetStatus: async () => { intent = { ...intent, enabled: false }; return { ...stopped, isRunning: true }; }, globalPassthruToggle: async (...args: unknown[]) => { calls.push(args); return stopped; } };
  await reconcileGlobalAudio(client, () => intent);
  expect(calls).toEqual([[false, null, null]]);
});

test("espera sin salida y vuelve a conectar cuando reaparece", async () => {
  const calls: unknown[] = [];
  const client = { globalPassthruGetStatus: async () => stopped, globalPassthruToggle: async (...args: unknown[]) => { calls.push(args); return stopped; } };
  const intent: AudioIntent = { enabled: true, capture: null, render: null };
  await reconcileGlobalAudio(client, () => intent);
  expect(calls).toEqual([[false, null, null]]);
  intent.render = "auriculares";
  await reconcileGlobalAudio(client, () => intent);
  expect(calls).toEqual([[false, null, null], [true, null, "auriculares"]]);
});

test("una consulta cancelada al desmontar no detiene una sesión nueva", async () => {
  let called = false;
  const client = { globalPassthruGetStatus: async () => ({ ...stopped, isRunning: true }), globalPassthruToggle: async () => { called = true; return stopped; } };
  await reconcileGlobalAudio(client, () => ({ enabled: false, capture: null, render: null }), () => true);
  expect(called).toBe(false);
});
