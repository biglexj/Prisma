import { describe, expect, test } from "bun:test";
import { includePrimaryOutput, outputErrorMessage } from "../src/features/dsp/multiOutputState";
import type { AudioEndpointInfo, MultiOutputDevice } from "../src/features/dsp/model/types";

const main: AudioEndpointInfo = { id: "main", name: "Altavoces", isDefault: true, isVirtual: false };
const saved: MultiOutputDevice[] = [{ id: "offline-bt", gain: 0.45, delayMs: 170 }, { id: "main", gain: 0.7, delayMs: 20 }];

describe("multi-output recovery", () => {
  test("main follows the base selector while absent outputs keep their gain and delay", () => {
    const next = includePrimaryOutput(saved, [main], main.id);
    expect(next[0]).toEqual({ id: "main", gain: 0.7, delayMs: 20 });
    expect(next[1]).toEqual(saved[0]);
    expect(saved[0].id).toBe("offline-bt");
    expect(includePrimaryOutput(next, [main], main.id)).toBe(next);
  });
  test("new main is included even before duplication is enabled", () => {
    expect(includePrimaryOutput([], [main], main.id)).toEqual([{ id: "main", gain: 1, delayMs: 0 }]);
  });
  test("empty or virtual hardware never clears remembered devices", () => {
    expect(includePrimaryOutput(saved, [], null)).toBe(saved);
    expect(includePrimaryOutput(saved, [{ ...main, isVirtual: true }], main.id)).toBe(saved);
  });
  test("technical endpoint IDs stay out of user messages", () => {
    expect(outputErrorMessage("Salida duplicada, virtual o desconectada: {0.0.0.00000000}.{device-guid}")).toBe("Esperando una salida de audio disponible…");
    expect(outputErrorMessage("HRESULT(0x88890004)")).toBe("No se pudo actualizar el audio. Vuelve a intentarlo.");
  });
});
