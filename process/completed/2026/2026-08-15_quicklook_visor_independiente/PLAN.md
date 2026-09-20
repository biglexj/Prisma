# Plan — Corrección de Quick Look y Visor Multimedia Rápido e Independiente

## Diagnóstico y Objetivos

### 1. Diagnóstico del problema con Quick Look (Tecla Espacio / Atajo)
- **Bloqueo por falso positivo en `is_text_edit_focused`**: En `keyboard_hook.rs`, la comprobación de campos de texto incluía `"breadcrumb"`. En Windows Explorer, la barra superior de rutas contiene la clase `"Breadcrumb Parent"`. Como resultado, al estar en el Explorador, `is_text_edit_focused()` devolvía `true` y el hook de teclado descartaba silenciosamente la pulsación de la tecla `Espacio`.
- **Condición de carrera al mostrar la ventana (`Focused(false)`)**: En `lib.rs`, el evento `WindowEvent::Focused(false)` en la ventana `quicklook` cerraba inmediatamente la ventana sin darle tiempo a recibir el foco tras el `window.show()`.
- **Detección COM de selección en Windows 11 (Pestañas del Explorador y Escritorio)**: En `shell_selection.rs`, la jerarquía de ventanas de Explorer con pestañas no validaba si la vista estaba visible o pertenecía a la misma ventana raíz (`GetAncestor`), provocando fallos al obtener la ruta seleccionada.
- **Persistencia del atajo en configuración**: La sincronización inicial del atajo no comunicaba el valor de `localStorage` al backend de Rust en el arranque.

### 2. Diagnóstico del problema al abrir archivos desde el Explorador ("Abrir con Prisma")
- Al hacer doble clic o «Abrir con Prisma» en una imagen/vídeo/canción desde el Explorador de Windows, Prisma abría la ventana principal completa (`main`), ejecutaba el escaneo completo de carpetas, cargaba todas las miniaturas y bibliotecas pesadas en memoria, y solo entonces mostraba la imagen.
- **Solución requerida**: Si Prisma se ejecuta con la ruta de un archivo multimedia (o recibe un archivo mediante `single-instance`), la ventana principal pesada permanece oculta y se abre directamente la ventana **Quick Look / Visor Independiente** ultraligera en milisegundos, permitiendo visualizar la imagen, reproducir el vídeo o escuchar el audio de inmediato sin cargar la biblioteca, con el botón «Abrir en Prisma» disponible si el usuario desea pasar a la aplicación completa.

---

## Cambios Propuestos

### Backend (Rust / Tauri)
1. **`src-tauri/src/features/quick_look/keyboard_hook.rs`**:
   - Eliminar el filtro erróneo `"breadcrumb"` en `is_text_edit_focused`.
   - Obtener el ID del hilo del foco en primer plano con `GetWindowThreadProcessId(GetForegroundWindow(), None)`.
2. **`src-tauri/src/features/quick_look/shell_selection.rs`**:
   - Soporte robusto de pestañas de Windows 11 mediante `GetAncestor(hwnd, GA_ROOT)` e inspección de visibilidad de `IShellView`.
   - Fallbacks seguros para Desktop (`SID_SSHELL_BROWSER`, `SIGDN_DESKTOPABSOLUTEPARSING`).
3. **`src-tauri/src/features/quick_look/service.rs`**:
   - Añadir método `show_file_path(&self, path: PathBuf)` para previsualizar cualquier archivo directamente (usado al abrir desde explorador o CLI).
   - Control de tiempo de visualización (`last_shown_time`) para evitar el cierre por carrera de foco.
4. **`src-tauri/src/lib.rs`**:
   - Registrar `tauri-plugin-single-instance` para redirigir archivos abiertos desde el explorador a la instancia activa de Prisma sin abrir instancias duplicadas.
   - En el arranque (`setup`): si se pasa un archivo multimedia como argumento, abrir inmediatamente el visor Quick Look y no mostrar la ventana principal pesada.
   - En `on_window_event`: ignorar eventos de pérdida de foco transitorios dentro de la ventana de gracia inicial (350ms).
5. **`src-tauri/src/app/commands/quick_look.rs`**:
   - Exponer comando `quick_look_show_file` para apertura programática desde frontend si es necesario.

### Frontend (React / TypeScript)
1. **`src/app/useSystemSettings.ts`**:
   - Al montar, inicializar el backend de Rust con la configuración persistida en `localStorage` mediante `quick_look_set_shortcut`.
2. **`src/features/quick_look/ui/QuickLookWindow.tsx`**:
   - Soporte completo para navegación fluida, cierre con `Esc` o botón de cierre, y botón de acción «Abrir en Prisma» para transferir el archivo a la aplicación principal cuando el usuario lo solicite.

---

## Plan de Validación
1. Compilar el backend con `cargo check` y `cargo test` para verificar ausencia de errores y advertencias.
2. Comprobar que al pulsar `Espacio` en Windows Explorer o Escritorio sobre una imagen, audio o vídeo se despliega instantáneamente la ventana Quick Look.
3. Comprobar que al ejecutar Prisma con la ruta de un archivo multimedia (simulando "Abrir con..." desde el explorador), se muestra de inmediato el visor rápido sin cargar la aplicación principal.
