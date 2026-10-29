import { expect, test } from "bun:test";
import { sendBrowserFileDrop } from "../src/app/ui/synapse-notch/useBrowserFileDrag";

test("la entrada entrega File a WebView2 sin leer sus bytes ni inventar rutas", () => {
  const originalWindow = globalThis.window;
  let message = "";
  let objects: File[] = [];
  Object.assign(globalThis, {window: {chrome: {webview: {
    postMessageWithAdditionalObjects: (value: string, files: File[]) => { message = value; objects = files; },
  }}}});
  try {
    const file = new File(["texto"], "archivo.txt");
    sendBrowserFileDrop([file], "pin");
    expect(JSON.parse(message)).toEqual({kind: "prisma-synapse-drop", action: "pin"});
    expect(objects[0]).toBe(file);
  } finally { Object.assign(globalThis, {window: originalWindow}); }
});
