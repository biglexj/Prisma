import { createRoot } from "react-dom/client";
import { mockConvertFileSrc, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { SystemDropZone } from "../../src/app/ui/SystemDropZone";
import type { VaultItem } from "../../src/app/ui/synapse-notch/model";
import "../../src/app/styles.css";

let items: VaultItem[] = [
  { id: "capture", name: "Captura.png", path: "cache/Captura.png", locationPath: null, kind: "image", size: 100, pinned: false, addedAt: 1 },
  { id: "a", name: "Foto A.png", path: "cache/a.png", locationPath: "D:\\A\\Foto.png", kind: "image", size: 100, pinned: false, addedAt: 2 },
  { id: "b", name: "Foto B.png", path: "cache/b.png", locationPath: "D:\\B\\Foto.png", kind: "image", size: 100, pinned: false, addedAt: 3 },
];
const status = document.createElement("output");
status.style.cssText = "position:fixed;left:24px;bottom:24px;white-space:pre-wrap";
status.textContent = "Prueba con IPC simulado · No abre el Explorador ni copia archivos";
document.body.append(status);
mockWindows("system_drop_zone");
mockConvertFileSrc("windows");
const fullText = new Map<string, string>();
mockIPC((command, args) => {
  if (command === "vault_list") return items;
  if (command === "drop_zone_pointer_inside") return true;
  if (command === "vault_import") {
    items = items.map((item, index) => ({ ...item, slot: item.slot ?? index }));
    const text = String(args?.text || "");
    const slot = typeof args?.targetSlot === "number" ? args.targetSlot : [0,1,2,3,4].find(slot => !items.some(item => item.slot === slot)) ?? 0;
    const id = `paste-${Date.now()}`;
    const link = /^https?:\/\/\S+$/.test(text);
    const item: VaultItem = { id, slot, path: `cache/${id}.${link ? "url" : "txt"}`, name: link ? "Enlace.url" : "Texto.txt", text, url: link ? text : null, kind: link ? "link" : "text", size: text.length, addedAt: Date.now(), pinned: false };
    items = [...items.filter(item => item.slot !== slot), item];
    fullText.set(id, text);
    status.textContent = `Pegado en casilla ${slot + 1}: ${text}\nclipboard=${args?.clipboard}`;
    return { items, path: item.path };
  }
  if (command === "vault_read_text") return fullText.get(String(args?.id));
  if (command === "media_get_default_capture_folders") return { images: "D:\\Imágenes\\Prisma", videos: "D:\\Vídeos\\Prisma" };
  if (command === "vault_save_item") {
    items = items.map(item => item.id === args?.id ? { ...item, locationPath: `${args.folder}\\Captura.png` } : item);
    status.textContent = `Guardado: ${items.find(item => item.id === args?.id)?.locationPath}`;
    return items;
  }
  if (command === "show_in_file_manager") status.textContent = `Ubicación solicitada: ${args?.path}`;
  return null;
}, { shouldMockEvents: true });
document.documentElement.classList.add("is-system-drop-zone");
document.getElementById("root")!.style.cssText = "position:fixed;top:24px;left:24px;width:600px;height:155px";
createRoot(document.getElementById("root")!).render(<SystemDropZone />);
