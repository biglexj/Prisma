export const SYSTEM_DROP_EVENT = "prisma:system-drop";
export const VAULT_SEND_EVENT = "prisma:vault-send";
export const VAULT_OPEN_EVENT = "prisma:vault-open";
export const VAULT_CHANGED_EVENT = "prisma:vault-changed";
export const SLOT_COUNT = 5;

export interface VaultItem {
  id: string;
  name: string;
  path?: string | null;
  locationPath?: string | null;
  url?: string | null;
  kind: "image" | "video" | "file" | "text" | "link";
  text?: string | null;
  slot?: number | null;
  size: number;
  pinned: boolean;
  addedAt: number;
}

export type DropAction = "pin" | "temporary" | "phone";
export interface VaultDrag { paths: string[]; text?: string | null; position: { x: number; y: number } }
export interface ImportedItem { items: VaultItem[]; path: string }
export interface ImportOptions { clipboard?: boolean; targetSlot?: number }

export function itemAtSlot(items: VaultItem[], slot: number): VaultItem | undefined {
  return items.find((item, index) => (item.slot ?? index) === slot);
}

/**
 * Coordenadas físicas del receptor OLE, relativas a la ventana actual.
 *
 * Con `bandOnly` solo cuenta la franja de destinos: durante el arrastre la
 * barra muestra únicamente los tres botones, así que el destino depende
 * siempre de la posición horizontal.
 */
export function actionAt(x: number, y: number, width: number, scale = 1, bandOnly = false): DropAction {
  if (!bandOnly && y / scale > 62) return "temporary";
  const fraction = x / scale / width;
  return fraction < 1 / 3 ? "pin" : fraction > 2 / 3 ? "phone" : "temporary";
}

export function textFromTransfer(data: DataTransfer): string {
  const html = data.getData("text/html");
  if (html) {
    const document = new DOMParser().parseFromString(html, "text/html");
    const image = document.querySelector("img")?.getAttribute("src");
    if (image && /^(https?:|data:image\/)/i.test(image)) return image;
  }
  return data.getData("text/uri-list").split(/\r?\n/).find((line) => line && !line.startsWith("#"))
    || data.getData("text/plain");
}
