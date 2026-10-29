interface PointerTarget {
  setPointerCapture(id: number): void;
  hasPointerCapture(id: number): boolean;
  releasePointerCapture(id: number): void;
}

/** Un contacto nuevo sustituye al anterior aunque el SO pierda pointerup. */
export class PointerContact {
  private contact: { id: number; target: PointerTarget } | null = null;
  begin(event: { pointerId: number; button: number; isPrimary: boolean; pointerType?: string; currentTarget: PointerTarget }) {
    if (event.button !== 0 || (!event.isPrimary && event.pointerType !== "pen")) return false;
    this.release();
    this.contact = { id: event.pointerId, target: event.currentTarget };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {
      // Algunos controladores no permiten captura explícita.
    }
    return true;
  }
  matches(id: number) { return this.contact?.id === id; }
  release() {
    const contact = this.contact;
    this.contact = null;
    if (!contact) return;
    try {
      if (contact.target.hasPointerCapture(contact.id)) contact.target.releasePointerCapture(contact.id);
    } catch {
      // La superficie o el contacto pueden desaparecer al ocultarse la ventana.
    }
  }
}
