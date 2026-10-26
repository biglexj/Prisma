# Edición directa y atajos de captura

Biglex solicita un ajuste en la interacción tras realizar una selección en la capturadora:
- **Ctrl+C**: Copia directa al instante y cierra el overlay, sin abrir herramientas ni editar.
- **Enter**: Habilita las herramientas de edición in-situ sobre la selección actual, como si se hubiera hecho un garabato pero sin necesidad de garabatear.
- **Garabato directo (rallar en medio)**: Al pasar el ratón en medio de la selección e intentar rayar/escribir algo, se toma directamente como dibujo/escritura sin esperar doble clic. Se entra a la fase de anotación con el trazo ya capturado y las herramientas habilitadas.
- **Doble clic**: Se retira la necesidad del doble clic (ya no es necesario para editar).

## Interacción de selección viva

| Gesto | Modo Imagen | Modo Vídeo |
| --- | --- | --- |
| `Ctrl+C` | Copia directa al portapapeles y a Synapse; overlay cerrado sin herramientas. | No aplica (la captura es una grabación). |
| `Enter` | Habilita herramientas in-situ sobre la selección actual (sin garabato previo). | Inicia cuenta atrás y grabación. |
| Arrastre en medio (garabato) | Habilita herramientas in-situ y traza el garabato de inmediato sobre el recorte. | Desplaza el marco de grabación. |
| Clic en medio | Habilita herramientas in-situ sobre la selección actual (sin trazo accidental). | Confirmar / Iniciar grabación. |
| Tiradores de redimensionamiento | Ajusta el marco rectangular (`selectionRect`). | Ajusta el marco rectangular. |
| `Esc` | Cancela la captura. | Cancela la captura. |

## Detalles de implementación

1. **Retiro de doble clic**: Eliminar `onDoubleClick` en `.capture-target-box` y actualizar los textos informativos del badge para eliminar «Doble clic».
2. **Cursor del marco rectangular**: Cambiar `.capture-target-box` a `cursor: crosshair` en sesiones de imagen para indicar que el área está lista para dibujar directamente.
3. **Trazo directo (garabato)**:
   - Al recibir `onPointerDown` en el interior de `capture-target-box` (fuera de los tiradores de redimensionamiento):
     - Iniciar en paralelo la confirmación de recorte `confirmCapture(rect)` en Rust.
     - Registrar los puntos del garabato en tiempo real (`pointermove`) con visualización reactiva (SVG polyline con `activeColor` y `strokeWidth`).
   - Al soltar (`onPointerUp`):
     - Si hubo arrastre (`points.length > 1`), registrar el trazo inicial en el historial de anotaciones (`annotations = [initialStroke]`).
     - Si solo fue un clic sin arrastre, entrar en modo edición con `annotations = []`.
     - Pasar a `phase = "annotating"` con las herramientas habilitadas en `CaptureAnnotationBar`.
4. **Enter**:
   - Mantiene la apertura de edición sobre la selección activa (`handleConfirmToAnnotate`), habilitando la barra de herramientas.
5. **Ctrl+C**:
   - Mantiene la copia directa (`handleQuickCopy`) sin tocar el disco ni mostrar herramientas.
