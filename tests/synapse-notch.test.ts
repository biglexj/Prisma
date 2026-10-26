import { expect, test } from "bun:test";
import { actionAt, itemAtSlot, type VaultItem } from "../src/app/ui/synapse-notch/model";

test("casillas estables conservan huecos y admiten estados anteriores", () => {
  const item: VaultItem = { id: "texto", name: "Texto.txt", kind: "text", text: "Contenido", slot: 4, size: 9, pinned: false, addedAt: 1 };
  expect(itemAtSlot([item], 0)).toBeUndefined();
  expect(itemAtSlot([item], 4)?.text).toBe("Contenido");
  expect(itemAtSlot([{ ...item, slot: undefined }], 0)?.id).toBe("texto");
});

test("el selector distribuye fijar, temporal y teléfono y respeta DPI", () => {
  expect(actionAt(100, 30, 600)).toBe("pin");
  expect(actionAt(300, 30, 600)).toBe("temporary");
  expect(actionAt(500, 30, 600)).toBe("phone");
  expect(actionAt(750, 45, 600, 1.5)).toBe("phone");
  expect(actionAt(900, 60, 600, 2)).toBe("phone");
});

test("soltar sobre las tarjetas conserva el destino temporal", () => {
  expect(actionAt(5, 100, 600)).toBe("temporary");
  expect(actionAt(590, 100, 600)).toBe("temporary");
});

test("durante el arrastre cada destino ocupa toda la altura desplegada", () => {
  expect(actionAt(5, 115, 600, 1, true)).toBe("pin");
  expect(actionAt(300, 115, 600, 1, true)).toBe("temporary");
  expect(actionAt(590, 115, 600, 1, true)).toBe("phone");
  expect(actionAt(885, 170, 600, 1.5, true)).toBe("phone");
});
