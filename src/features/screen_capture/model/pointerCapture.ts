interface PointerTarget {
  setPointerCapture(id: number): void;
  hasPointerCapture(id: number): boolean;
  releasePointerCapture(id: number): void;
}

/** Un contacto nuevo de dibujo sustituye al anterior, aunque el SO haya perdido pointerup. */
export class CapturePointer {
  private contact: { id: number; target: PointerTarget } | null = null;

  begin(event: { pointerId: number; button: number; isPrimary: boolean; pointerType?: string; currentTarget: PointerTarget }) {
    // isPrimary distingue contactos simultáneos del mismo tipo, no la intención
    // de dibujar. Un lápiz sigue siendo válido aunque el navegador lo marque secundario.
    if (event.button !== 0 || (!event.isPrimary && event.pointerType !== "pen")) return false;
    this.release();
    this.contact = { id: event.pointerId, target: event.currentTarget };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {
      // Algunos controladores no permiten captura explícita; los eventos siguen siendo utilizables.
    }
    return true;
  }

  matches(id: number) {
    return this.contact?.id === id;
  }

  release() {
    const contact = this.contact;
    this.contact = null;
    if (!contact) return;
    try {
      if (contact.target.hasPointerCapture(contact.id)) contact.target.releasePointerCapture(contact.id);
    } catch {
      // El elemento o el contacto pueden haber desaparecido al ocultarse la ventana.
    }
  }
}
