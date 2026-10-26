import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { Icon } from "../../shared/ui/Icon";
import { handleNativeDragPointerDown } from "../../shared/useNativeFileDrag";
import { quickLookClient } from "../../features/quick_look/tauri/client";
import { loadDropZonePreferences } from "../useSystemSettings";
import { resolveCaptureFolder } from "../../shared/captureFolders";
import { PhoneTransfer } from "./synapse-notch/PhoneTransfer";
import { useNotch } from "./synapse-notch/useNotch";
import { useClipboardPaste } from "./synapse-notch/useClipboardPaste";
import { SLOT_COUNT, itemAtSlot, textFromTransfer, type DropAction, type VaultItem } from "./synapse-notch/model";
import "./file-drop-zone.css";

export { SYSTEM_DROP_EVENT, VAULT_SEND_EVENT, VAULT_OPEN_EVENT } from "./synapse-notch/model";
export type { VaultItem } from "./synapse-notch/model";

const destinations: { action: DropAction; label: string; icon: "pin" | "clock" | "smartphone" }[] = [
  { action: "pin", label: "Fijar", icon: "pin" },
  { action: "temporary", label: "Temporal", icon: "clock" },
  { action: "phone", label: "Enviar al teléfono", icon: "smartphone" },
];

/** Ventana independiente: notch de 100×3 px, cinco espacios y envío directo LAN. */
export function SystemDropZone() {
  const vault = useNotch();
  const [hoverHint, setHoverHint] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const savingRef = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  const { setError, setMessage, setItems } = vault;
  const hoveredSlot = useRef<number | null>(null);
  const getPasteSlot = useCallback(() => (hoveredSlot.current !== null ? hoveredSlot.current : undefined), []);
  useClipboardPaste(vault.importContent, setError, getPasteSlot, vault.open);
  const preview = async (item: VaultItem) => {
    if ((item.kind === "text" || item.kind === "link") && item.path) {
      try {
        const text = await invoke<string>("vault_read_text", { id: item.id });
        await navigator.clipboard.writeText(text);
        setError(""); setMessage("Copiado"); setHoverHint("Copiado");
        clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => { setMessage(""); setHoverHint(value => value === "Copiado" ? "" : value); }, 1600);
      }
      catch (err) { setError(String(err)); }
      return;
    }
    if (item.kind !== "image" || !item.path) return;
    try {
      if (!await quickLookClient.showFile(item.path)) throw new Error("No se pudo abrir esta imagen en Quick Look");
      setError("");
      vault.hide();
    } catch (err) { setError(String(err)); }
  };
  const save = useCallback(async (item: VaultItem) => {
    if (savingRef.current) return;
    if (item.locationPath) {
      try {
        await invoke("show_in_file_manager", { path: item.locationPath });
        setError(""); setMessage(item.locationPath);
      } catch (err) { setError(String(err)); }
      return;
    }
    if (!item.path) return;
    savingRef.current = true;
    setSavingId(item.id);
    try {
    const folder = loadDropZonePreferences().folder || (!["image", "video"].includes(item.kind)
        ? await invoke<string>("drop_zone_default_folder")
        : await resolveCaptureFolder(item.kind === "video" ? "video" : "image"));
      const items = await invoke<VaultItem[]>("vault_save_item", { id: item.id, folder });
      setItems(items);
      const location = items.find((entry) => entry.id === item.id)?.locationPath;
      setError(""); setMessage(location ? `Guardado en ${location}` : "Archivo guardado");
      setHoverHint(location || "Archivo guardado");
    } catch (err) { setError(String(err)); }
    finally { savingRef.current = false; setSavingId(null); }
  }, [setError, setMessage, setItems]);

  const mutate = async (command: string, id: string) => {
    try { setItems(await invoke<VaultItem[]>(command, { id })); setError(""); }
    catch (err) { setError(String(err)); }
  };

  // Etiqueta del destino señalado: se anuncia en la barra de estado mientras arrastras.
  const targetLabel = destinations.find((item) => item.action === vault.action)?.label ?? "Temporal";

  return <div className={`vault-shelf ${vault.open ? "is-open" : ""} ${vault.revealed ? "is-revealed" : ""} ${vault.busy || savingId !== null ? "is-busy" : ""} ${vault.dragging ? "is-drag-over" : ""}`}
    onPointerEnter={vault.show}
    onPointerLeave={() => { hoveredSlot.current = null; }}
    onKeyDown={(event) => { if (event.key === "Escape" && !vault.pendingPaths.length && !vault.busy) vault.hide(); }}
    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; vault.setDrag(true); }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) vault.setDrag(false); }}
    onDrop={(event) => {
      event.preventDefault(); vault.setDrag(false);
      const text = textFromTransfer(event.dataTransfer);
      if (text) void vault.importContent([], text, vault.action);
    }}
  >
    <button type="button" className="vault-strip" onClick={vault.show} onFocus={vault.show}
      aria-label="Abrir barra Synapse" aria-expanded={vault.open} />
    {vault.expanded && <div className="vault-panel" ref={vault.panelRef} style={{ width: vault.width }} aria-label="Barra superior Synapse" aria-busy={vault.busy || savingId !== null}>
      <div className="vault-destinations" aria-label="Destino al soltar">
        {vault.dragging && destinations.map(({ action, label, icon }) => <button key={action} type="button"
          className={`vault-destination ${vault.action === action ? "is-target" : ""}`}
          onDragEnter={() => vault.setAction(action)}
          onClick={() => { vault.setAction(action); setMessage(`Arrastra aquí para ${label.toLowerCase()}`); }}>
          <Icon name={icon} width={18} height={18} /><span>{label}</span>
        </button>)}
      </div>
      {vault.pendingPaths.length ? <PhoneTransfer paths={vault.pendingPaths} onClose={() => vault.setPendingPaths([])} /> : <div className="vault-items">
        {Array.from({ length: SLOT_COUNT }, (_, index) => {
          const item = itemAtSlot(vault.items, index);
          if (!item) return <div key={`empty-${index}`} className="vault-card vault-empty" aria-label={`Espacio ${index + 1} vacío`}
            onMouseEnter={() => { hoveredSlot.current = index; setHoverHint("Ctrl+V para pegar en esta casilla"); }}
            onMouseLeave={() => { hoveredSlot.current = null; setHoverHint(""); }}><Icon name="plus" width={24} height={24} /><span>Ctrl+V</span></div>;
          return <div key={item.id} className={`vault-card ${item.pinned ? "is-pinned" : ""}`}
            onDoubleClick={(event) => {
              if (event.defaultPrevented || event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
              void preview(item);
            }}
            onPointerDown={(event) => { if (item.path) handleNativeDragPointerDown(event, item.path, { mode: "copy" }); }}
            onMouseEnter={() => { hoveredSlot.current = index; setHoverHint(item.text || item.name); }}
            onMouseLeave={() => { hoveredSlot.current = null; setHoverHint(""); }}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHoverHint(""); }}
            aria-label={item.name}>
            <div className="vault-card-preview">
              {item.kind === "text" || item.kind === "link" ? <div className="vault-text-preview"><Icon name={item.kind === "link" ? "link" : "file-text"} width={16} height={16} /><span>{item.text}</span></div>
                : item.kind === "image" && item.path ? <img src={convertFileSrc(item.path)} alt="" draggable={false} onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <Icon name={item.kind === "video" ? "film" : "file"} width={28} height={28} />}
              {item.pinned && <span className="vault-card-pin" aria-label="Fijado"><Icon name="pin" width={12} height={12} /></span>}
            </div>
            <span className="vault-card-name">{item.name}</span>
            <div className="vault-card-actions" onMouseLeave={() => setHoverHint(item.name)}>
              <button type="button" onClick={() => { if (item.path) vault.setPendingPaths([item.path]); }} onMouseEnter={() => setHoverHint("Enviar al teléfono")} onFocus={() => setHoverHint("Enviar al teléfono")} aria-label={`Enviar ${item.name} al teléfono`}><Icon name="smartphone" width={15} height={15} /></button>
              <button type="button" onClick={() => void save(item)} disabled={savingId !== null || !item.path}
                onMouseEnter={() => setHoverHint(item.locationPath || "Guardar en carpeta")}
                onFocus={() => setHoverHint(item.locationPath || "Guardar en carpeta")}
                aria-label={item.locationPath ? `Mostrar ${item.name} en su carpeta` : `Guardar ${item.name}`}>
                <Icon name={item.locationPath ? "folder" : "save"} width={15} height={15} />
              </button>
              <button type="button" onClick={() => void mutate("vault_toggle_pin", item.id)} onMouseEnter={() => setHoverHint(item.pinned ? "Desfijar" : "Fijar")} onFocus={() => setHoverHint(item.pinned ? "Desfijar" : "Fijar")} aria-label={`${item.pinned ? "Desfijar" : "Fijar"} ${item.name}`} aria-pressed={item.pinned}><Icon name="pin" width={15} height={15} /></button>
              <button type="button" onClick={() => void mutate("vault_remove", item.id)} onMouseEnter={() => setHoverHint("Quitar de la barra")} onFocus={() => setHoverHint("Quitar de la barra")} aria-label={`Quitar ${item.name}`}><Icon name="close" width={15} height={15} /></button>
            </div>
          </div>;
        })}
      </div>}
      <div className={`vault-status ${vault.error ? "vault-error" : ""}`} role={vault.error ? "alert" : "status"}>
        {vault.error || (vault.busy || savingId !== null ? "Guardando…" : vault.dragging ? `Suelta para ${targetLabel.toLowerCase()}` : hoverHint || vault.message) || "Arrastra archivos, imágenes o texto · Ctrl+V para pegar"}
      </div>
    </div>}
  </div>;
}
