import { expect, mock, test } from "bun:test";

let contact: boolean | Error = false;
let starts = 0;
mock.module("@tauri-apps/api/core", () => ({convertFileSrc:(path:string) => path, invoke:async () => {
  if (contact instanceof Error) throw contact;
  return contact;
}}));
mock.module("@crabnebula/tauri-plugin-drag", () => ({startDrag:async () => { starts++; }}));
const { startNativeFileDrag, DEFAULT_DRAG_ICON_BASE64 } = await import("../src/shared/useNativeFileDrag");

test("el fallback no entra en OLE sin contacto compatible confirmado", async () => {
  const errors: string[] = [];
  for (contact of [false, new Error("Sin contacto")]) {
    await startNativeFileDrag("C:\\prueba.png", {pointerType:"pen",icon:DEFAULT_DRAG_ICON_BASE64,onError:error => errors.push(error)});
  }
  expect(starts).toBe(0);
  expect(errors).toHaveLength(2);
});
