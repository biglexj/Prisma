import { describe, expect, test } from "bun:test";
import { playbackAudioRoute } from "../src/features/dsp/playbackAudioRoute";

const endpoints = [
  { id: "virtual", name: "Prisma Audio Enhancer", isVirtual: true, isDefault: true },
  { id: "speakers", name: "Monitor", isVirtual: false, isDefault: false },
  { id: "headphones", name: "Auriculares", isVirtual: false, isDefault: false },
];
const devices = [{ name: "wasapi/Monitor", description: "Monitor", isActive: true }];
const route = (bridge: boolean, phone: boolean, capture: string | null = null) =>
  playbackAudioRoute(endpoints, devices, "Monitor", "speakers", bridge, "FXSound Speakers", phone, capture);

describe("internal playback enters the phone capture source", () => {
  test("global bridge receives music even without multiple outputs", () => {
    expect(route(true, true)).toMatchObject({ mpvDevice: "wasapi/virtual", throughGlobalDsp: true });
  });
  test("standalone phone capture follows Windows default instead of the saved physical output", () => {
    expect(route(false, true)).toMatchObject({ mpvDevice: "wasapi/virtual", throughGlobalDsp: false });
  });
  test("explicit phone source uses its ID, even when labels are identical", () => {
    expect(route(false, true, "headphones").mpvDevice).toBe("wasapi/headphones");
  });
  test("disabling the phone restores the physical choice and local DSP", () => {
    expect(route(false, false)).toMatchObject({ mpvDevice: "wasapi/speakers", throughGlobalDsp: false });
  });
  test("bridge stays authoritative when phone capture configuration differs", () => {
    expect(route(true, true, "headphones").mpvDevice).toBe("wasapi/virtual");
  });
  test("a missing explicit phone source does not silently reroute to an unrelated default", () => {
    expect(route(false, true, "disconnected").mpvDevice).toBeUndefined();
  });
});
