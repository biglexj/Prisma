import { expect, test } from "bun:test";
import { selectAudioOutput } from "../src/features/dsp/selectAudioOutput";
const speaker = { id: "speaker", name: "Altavoces", isDefault: true, isVirtual: false };
const headphones = { id: "usb", name: "Auriculares USB", isDefault: false, isVirtual: false };

test("al iniciar restaura la selección sin tratar todos los dispositivos como nuevos", () => {
  expect(selectAudioOutput([speaker, headphones], null, "speaker", "speaker")?.id).toBe("speaker");
});
test("una salida recién conectada reemplaza automáticamente a la actual", () => {
  expect(selectAudioOutput([speaker, headphones], new Set(["speaker"]), "speaker", "speaker")?.id).toBe("usb");
});
test("no vuelve a la salida anterior en el siguiente sondeo", () => {
  expect(selectAudioOutput([speaker, headphones], new Set(["speaker", "usb"]), "usb", "speaker")?.id).toBe("usb");
});
test("desconectar la salida activa elige una disponible y reconectarla vuelve a seleccionarla", () => {
  expect(selectAudioOutput([speaker], new Set(["speaker", "usb"]), "usb", "usb")?.id).toBe("speaker");
  expect(selectAudioOutput([speaker, headphones], new Set(["speaker"]), "speaker", "usb")?.id).toBe("usb");
});
test("el canal de captura nunca se selecciona como salida recién conectada", () => {
  const capture = { ...headphones, id: "capture", name: "Prisma Audio Enhancer", isVirtual: true };
  expect(selectAudioOutput([speaker, capture], new Set(["speaker"]), "speaker", "speaker")?.id).toBe("speaker");
  expect(selectAudioOutput([], new Set(["speaker"]), "speaker", "speaker")).toBeNull();
});
