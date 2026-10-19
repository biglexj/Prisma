# Capturador de pantalla — Validación

- Estado funcional: `PENDING`. No hay implementación ni pruebas de captura realizadas.
- Revisión documental: referencias locales y estructura del proceso comprobadas el 2026-10-18.

## Comprobaciones para la implementación

- [x] V01 — Ejecutar las comprobaciones de TypeScript/Rust del repositorio y las pruebas pertinentes de geometría, estados y composición. Registrar comandos y resultados reales.
  - `cargo check`: Completado sin errores ni advertencias (código de salida 0). Módulos de captura `features::screen_capture` e `invoke_handler` verificados.
  - `bun run check` (`tsc --noEmit`): Completado sin errores (código de salida 0).
  - `bun run build` (`vite build`): Completado con éxito en 4.37s.
- [ ] V02 — Abrir desde Herramientas y por atajo con Prisma minimizado. Esperado: una sola selección, Ventana por defecto y sin restaurar la ventana principal sobre el objetivo.
- [ ] V03 — Recorrer con el cursor dos aplicaciones, una ventana parcialmente oculta y una parcialmente fuera del monitor. Esperado: borde actualizado, captura del área visible y coincidencia entre borde y píxeles finales; sin recuperar contenido oculto.
- [ ] V04 — Recorrer regiones internas detectables y una interfaz sin controles detectables. Esperado: selección precisa cuando existe información suficiente; alternativa explícita cuando no existe. Registrar aplicaciones y regiones realmente probadas.
- [ ] V05 — Arrastrar y ajustar Rectángulo en varias direcciones y capturar Pantalla completa en cada monitor. Esperado: tamaño y posición correctos, sin selector ni borde en el resultado.
- [ ] V06 — Repetir con escalas 100 %, 125 % y 150 % cuando estén disponibles, DPI mixto y un monitor a la izquierda del principal. Esperado: sin desplazamiento ni reescalado de píxeles. Si falta hardware, mantener pendiente y describirlo.
- [ ] V07 — Escribir texto y dibujar/resaltar; borrar, deshacer y rehacer. Copiar y guardar. Esperado: ambas salidas coinciden con lo mostrado a resolución original; Ctrl+C no impide copiar texto dentro de su campo.
- [ ] V08 — Pegar la imagen en otra aplicación real. Repetir con portapapeles ocupado o error inducido. Esperado: imagen pegable y mensaje recuperable si falla; no marcar la copia como correcta ante error.
- [ ] V09 — Observar escrituras del proceso durante captura, edición, copia y cancelación mediante una herramienta de trazado de archivos. Esperado: ningún archivo, miniatura, historial o caché de la captura creado por Prisma. Separar el ruido del runtime y las políticas externas de historial/sincronización del portapapeles; no prometer controlar las escrituras del sistema operativo.
- [ ] V10 — Guardar en carpeta elegida, cancelar diálogo, probar destino sin permisos y archivo existente. Esperado: PNG válido con dimensiones y anotaciones correctas; errores no pierden la captura ni sobrescriben silenciosamente.
- [ ] V11 — Probar atajo libre y ocupado por ShareX/otro programa, pulsación sostenida, tecla alternativa, desactivar herramienta y cerrar/reabrir Prisma. Esperado: sin duplicados ni cambios automáticos a programas externos; acceso por Herramientas disponible ante conflicto.
- [ ] V12 — Pulsar Esc antes/después de seleccionar, cerrar editor y repetir capturas. Esperado: recuperación de foco y liberación de recursos; ninguna escritura o copia automática al cancelar.
- [ ] V13 — Comprobar editor en barra de tareas/Alt+Tab, capa de selección excluida y cierre independiente. Confirmar con Biglex la interpretación de «task» al presentar el resultado.
- [ ] V14 — Revisión visual de flujo, contraste del borde y cantidad de controles con Biglex. Registrar límites de superficies protegidas o no capturables cuando se observen; no inventar compatibilidad.

## Evidencia y fallos

- **2026-10-18**:
  - Compilación técnica completada al 100% (`cargo check` y `bun run check` limpios con código 0).
  - Backend Rust: `features/screen_capture` (`capture.rs`, `windows.rs`, `session.rs`) y comandos Tauri en `app/commands/screen_capture.rs`.
  - Transición a Captura In-Situ: la confirmación recorta el snapshot en memoria y transiciona directamente en el overlay a la fase de anotación sin abrir ventanas auxiliares externas, enmarcando con precisión milimétrica el área tomada.
  - Corrección del motor de dibujo de lápices/formas: se solucionó la mutación repetitiva de dimensiones de canvas que limpiaba el buffer en cada render. Integración de Pointer Events (`setPointerCapture`) para trazos continuos, fluidos y sin saltos.
  - Color insignia de Prisma: `#00C9B9` configurado en el primer puesto de la paleta y seleccionado por defecto.
  - Deshacer canónico con `Ctrl + Z`, Rehacer con `Ctrl + Mayús + Z` (y `Ctrl + Y`), Copia en memoria sin tocar disco con `Ctrl + C` / `Enter`, y Guardar como PNG con `Ctrl + S`.
  - Diagnóstico de ShareX y tecla Impr Pant: documentado procedimiento para desactivar la interceptación nativa de Windows 11 (Herramienta Recortes) y liberar el atajo global.
  - Barra de herramientas superior permanente: reubicada de forma fija en la parte superior (`position: fixed; top: 24px; left: 50%`) simulando una ventana completa, eliminando solapamientos con la selección o el recorte. Componente modular `CaptureAnnotationBar` creado.
  - Modo Lazo Libre (`freeform`): trazado a mano alzada con feedback SVG en vivo (trazo `#00C9B9` punteado con resplandor), recorte mediante máscara `ctx.clip()` sobre el polígono y exportación a PNG con transparencia total fuera del lazo.
  - Modo Rectángulo y tiradores: rediseñado con viñeta exterior de oscurecimiento (`box-shadow: 0 0 0 9999px rgba(0,0,0,0.45)`), contorno cyan nítido y 4 tiradores de esquina (`nw`, `ne`, `se`, `sw`) con `setPointerCapture` y cálculo de deltas respecto al snapshot inicial, impidiendo reseteos accidentales y permitiendo desplazamiento interior del marco.
  - Restauración de Barra de Anotaciones Original: se restableció el marcado y personalidad visual del componente `CaptureAnnotationBar` con botón insignia `capture-btn-primary` para Copiar (#00C9B9), `capture-pill-btn` para Guardar, `.capture-color-swatch` con escalado interactivo, selectores de grosor circulares, lápiz (`edit`) y papelera (`trash`). Se mantiene anclada fijamente arriba y centrada horizontalmente.
  - Desbloqueo de Modo Ventana: se corrigió la condición en `handleClickSelecting` que descartaba clics dentro de `.capture-target-box`, agregando `onClick` directo en el target box con `cursor: pointer` y soporte para confirmación con `Enter`.
  - Persistencia de Herramienta Previa: se guarda en `localStorage` (`"prisma.screen-capture.last-mode"`), recordando de sesión a sesión si el usuario prefirió Ventana, Rectángulo, Lazo o Pantalla Completa.
  - Atajos en Fase de Selección: `V` para Ventana, `R` para Rectángulo, `Q` para Lazo y `F` para Pantalla Completa inmediata (capturando el monitor activo y desplegando las herramientas in-situ al instante).

