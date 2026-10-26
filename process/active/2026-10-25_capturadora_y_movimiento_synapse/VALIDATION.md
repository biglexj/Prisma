# Validación

- `bun run build`: correcto (TypeScript y Vite). Aviso de tamaño de chunks; sin errores de compilación.
- `bun test tests/capture-pointer.test.ts tests/capture-target-query.test.ts tests/screen-capture-copy.test.ts tests/screen-capture-quick-copy.test.ts tests/synapse-notch.test.ts`: 26 pruebas correctas.
- `cargo test --manifest-path src-tauri/Cargo.toml features::screen_capture::session::tests --lib`: dos pruebas correctas. Incluye cambios de intención, píxeles originales y rechazo de sesiones caducadas.
- `tests/fixtures/synapse-notch-size.html`: `passed: true` para ciclos de apertura/cierre, alturas nativas y pegado de imagen/texto. IPC de Tauri simulado.
- `tests/fixtures/capture-toolbar.html`: barra real en StrictMode, desplegable de cuatro recortes en imagen y tres en vídeo; alternancia imagen/vídeo dentro de la sesión 1; desaparición del cuentagotas en vídeo; Esc durante la cuenta atrás deja cero grabaciones incluso tras esperar más de tres segundos. IPC simulado, sin grabar el escritorio.
- Recorrido de vídeo sin cancelar: selección de pantalla completa mediante F, confirmación, cuenta atrás y exactamente una llamada simulada a iniciar grabación. Estado final: `Cancelado · Grabaciones: 1` (el cierre posterior al inicio es el flujo del overlay).
- `git diff --check` acotado a los archivos modificados por este trabajo: correcto. La comprobación global detecta una línea vacía preexistente en `synapse-settings.css`, fuera del alcance.
- La herramienta de navegador devuelve `Unable to capture screenshot`; no se obtuvo verificación visual mediante capturas. Se comprobó el estado de los controles y el DOM.

La ausencia del zoom intermitente y la grabación física requieren comprobación nativa; no se dan por demostradas por compilar.

## Barra de grabación y rutas independientes

- `bun run build`: correcto tras modificar controles, guardado y ajustes.
- `bun test tests/capture-folders.test.ts tests/screen-capture-copy.test.ts tests/screen-capture-quick-copy.test.ts`: 18 pruebas correctas. Las cinco nuevas cubren rutas independientes, configuración antigua que no debe heredarse, bibliotecas redirigidas, restablecimiento y JSON dañado.
- `cargo test --manifest-path src-tauri/Cargo.toml la_barra_se_centra_abajo --lib`: una prueba correcta, con área útil, coordenadas negativas, escala 150 % y área muy pequeña. Compila el backend y la configuración de permisos.
- La primera compilación quedó bloqueada por DLL en uso en Prisma Dev. Se validó con recursos de empaquetado desactivados solo en el entorno de ese comando (`TAURI_CONFIG`) y se renombró la copia cargada de `target/debug/WebView2Loader.dll` dentro del directorio de build para permitir que Tauri copiara otra igual. No se cerró Prisma ni se cambió la configuración de publicación. El respaldo cargado permanece en el directorio ignorado de build hasta que termine el proceso que lo usa.
- `tests/fixtures/recorder-controls.html`: componente real con IPC simulado. Cronómetro y estado legibles; dos botones con iconos y nombres accesibles. Ancho medido ≈380 y alto ≈56; `scrollWidth === clientWidth === 378`. Probados pausa/reanudación, petición de arrastre, fallo de parada que conserva los controles y reintento satisfactorio.
- El destino de grabación usa `screenRecordingFolder`; capturas usan `screenCaptureFolder`; fotogramas conservan `videoSnapshotFolder`. No se migran ni sobrescriben carpetas personalizadas ni archivos existentes. Los valores predeterminados crean Imágenes/Prisma y Vídeos/Prisma mediante las bibliotecas reales de Windows.
- Cambios nativos pendientes de reiniciar Prisma Dev para prueba física: posición inferior centrada, arrastre, protección de contenido y vídeo completo sin la barra. No se ha verificado la exclusión del control con el motor real de captura.

## Guardar/localizar en Synapse

- `bun run build`: correcto.
- Con `TAURI_CONFIG` que desactiva recursos de empaquetado solo para el comando: `cargo test --manifest-path src-tauri/Cargo.toml app::commands::vault --lib`: 13 pruebas correctas. Incluye persistencia de ubicación, conservación de identidad/fijado/orden al guardar, dos archivos de carpetas distintas y lectura de estados antiguos sin presentar la caché como un guardado del usuario.
- `tests/fixtures/synapse-file-actions.html`: componente real, IPC simulado. Captura sin ubicación → Guardar (disquete) → Mostrar en carpeta, con ruta del destino en el estado y tooltip. La acción siguiente solicita abrir ese archivo. Las otras tarjetas solicitan respectivamente `D:\A\Foto.png` y `D:\B\Foto.png`.
- Las importaciones nuevas conservan su origen. Los estados antiguos que solo registraron una copia en caché no permiten recuperar con certeza la ruta original; se muestran como pendientes de guardar. Los archivos que ya se registraron con una ruta externa conservan la acción de carpeta.
- Guardado sin sobrescritura reutiliza `copy_to_folder`. La nueva ubicación se publica después de copiar y persistir; un fallo no cambia la tarjeta a un guardado ficticio.
- Pendiente de comprobación nativa del Explorador tras reiniciar Prisma Dev; no se abrió el Explorador real en la prueba simulada.

## Contraste y confirmación de guardado de vídeo

- Causa del contraste: se consumía `--on-error` sin estar definido. Se añadieron sus valores de contraste en tema claro, oscuro y oscuro automático; el hover de Detener queda limitado a rojo/rojo tonal con su primer plano explícito.
- Causa del aviso ausente: el backend y la barra ocultaban la ventana de control al terminar; el aviso previo vivía solo en la ventana principal. Botón y atajo ahora comparten `present_saved_recording`, que registra el archivo en Synapse, difunde el estado final y conserva visible la barra nativa. La barra muestra Grabación guardada, nombre del archivo, carpeta y cierre.
- `bun run build`: correcto. `cargo test --manifest-path src-tauri/Cargo.toml la_barra_se_centra_abajo --lib` con recursos de empaquetado desactivados solo en el entorno del comando: correcto, compila el cambio nativo.
- Fixture `recorder-controls.html` servida en 127.0.0.1:1423 para no interferir con el servidor del usuario: Detener muestra el aviso; la parada por evento/atajo también; carpeta solicita revelar y cerrar retira el aviso. Todo con IPC simulado.
- Inspección del hover real: tema oscuro `hover: true`, fondo `color(srgb 0.911765 0.6 0.572941)` y primer plano `rgb(105, 0, 5)`; tema claro `hover: true`, fondo rojo interpolado `oklab(0.543479 0.160535 0.0767887)` y primer plano blanco. No se observó fondo blanco.
- Pendiente comprobar el flujo nativo minimizado y el archivo real después de reiniciar Prisma Dev; estas pruebas de interfaz no graban el escritorio.

## Regresión de grabadora: validación real de Windows

Las comprobaciones siguientes sustituyen la limitación anterior para inicio, controles y guardado; no validan todavía pausa, arrastre físico ni exclusión visual de controles.

- Reproducción con Computer Use en Prisma Dev: la cuenta atrás acababa, desaparecía el overlay y no existía FFmpeg ni ventana Grabación. El error quedaba oculto. Al recuperar la sesión se observó el mensaje real de FFmpeg: región exterior 1202×832 fuera del área cliente 1200×800.
- Corrección: consultar FindWindowW/GetClientRect/ClientToScreen antes de grabar por título; mantener el título exacto. No reutilizar el título de una ventana al cambiar a rectángulo/pantalla completa ni al seleccionar un control hijo. Si el inicio falla, recuperar la sesión del overlay y mantener el error visible.
- Restaurar la barra si estaba minimizada antes de posicionarla; conservar las dimensiones completas del vídeo.
- Segundo fallo confirmado con FFprobe: el clip `D:/Vídeos/Prisma/Prisma_Grabacion_2026-10-25_15-14-46.mp4`, anterior a corregir el audio, contenía 19 fotogramas en 66,2 s y no tenía pista de audio. WASAPI no emitía paquetes durante el silencio y el socket PCM retenía la captura.
- Corrección de audio: PCM con reloj de bloques de 10 ms, relleno de silencio si faltan muestras y sin duplicar muestras al volver el sonido. Colas de entrada y sondeo corto del PCM explícito en FFmpeg.
- `cargo test --manifest-path src-tauri/Cargo.toml graba_una_ventana_por_titulo --lib -- --nocapture`: grabación física de ventana, 814×1080 y 37 fotogramas confirmados por FFprobe. El test ahora falla si FFmpeg no inicia y comprueba dimensiones/fotogramas, en lugar de registrar el error y aprobar.
- `cargo test --manifest-path src-tauri/Cargo.toml features::screen_capture::system_audio::tests --lib -- --nocapture`: dos pruebas de reloj/silencio correctas y una de hardware ignorada por defecto.
- `cargo test --manifest-path src-tauri/Cargo.toml graba_con_el_audio_del_sistema --lib -- --ignored --nocapture`: prueba física optativa ejecutada correctamente. `temp/recorder-audio-test.mp4`: vídeo 320×240, 29 fotogramas y pista AAC a 48 kHz.
- Build web correcto. Todos los comandos Cargo usaron TAURI_CONFIG de entorno con recursos de empaquetado desactivados, sin modificar publicación.
- Recorrido final desde la interfaz real de Prisma Dev: Vídeo, selección de pantalla completa mediante F, Enter, cuenta atrás, ventana nativa Prisma · Grabación con cronómetro/Grabando/Pausar/Detener, parada desde el HUD visible y confirmación nativa Grabación guardada.
- Evidencia final: `D:/Vídeos/Prisma/Prisma_Grabacion_2026-10-25_15-19-49.mp4`: **1920×1080, 15,033333 s, 418 fotogramas y pista AAC de 14,52 s**. FFmpeg terminó y el archivo quedó cerrado. Diferencia de inicio entre audio/vídeo ≈0,5 s; no se afirma sincronización audiovisual de precisión ni 30 fps constantes.
- Prisma Dev se recompiló y reinició mediante su observador existente. La instancia instalada se conservó. Coexisten ambas instancias; el atajo global de parada de Dev no quedó validado en esta sesión por posible competencia con la instalada. Se detuvo el clip mediante el botón de la ventana principal.

## Corrección posterior: vídeo negro y ancho real de la barra

- El archivo del usuario Prisma_Grabacion_2026-10-25_15-39-51.mp4 tenía vídeo 814×1080 y 670 fotogramas, pero el fotograma decodificado estaba negro salvo por el cursor. Los metadatos por sí solos no demostraban una captura correcta; la aceptación anterior de captura por título queda corregida.
- La captura directa de ventana se sustituyó por la región visible del escritorio. Se conserva el rectángulo físico seleccionado, se limita a los bordes del escritorio y se ajusta a dimensiones pares. Ya no se anuncia seguimiento al mover la ventana: debe permanecer visible y en su posición.
- Prueba real graba_la_region_visible_de_una_ventana ejecutada: 1872×1080, 44 fotogramas. Decodificación RGB y comprobación de contenido no negro correctas. Se revisó visualmente temp/recorder-visible-window-test.png: ventana completa con contenido; vídeo conservado en temp/recorder-visible-window-test.mp4.
- Dos pruebas Rust correctas: encuadre físico con origen negativo/recorte de bordes y geometría de barra 150×42.
- Fixture real con IPC simulado: barra medida 150×42; clientWidth y scrollWidth iguales a 148. Captura visual muestra cronómetro, estado y los dos iconos sin desbordamiento. Se encontró y retiró el mínimo global de 320 px solo para la ventana de grabación; la fixture usa la misma clase raíz que la ventana real.
- Compilación web correcta tras corregir ese mínimo (TypeScript y Vite); comprobación de espacios del diff correcta. No se da por validado el arrastre ni la exclusión de controles durante una toma por esta prueba.

## Ajuste de tamaño solicitado después de la reducción

- Tamaño final: 320×56 píxeles lógicos; restaura la altura original y reduce el ancho inicial de 380 en 60 px. Aplicado a configuración nativa, posicionamiento y HUD principal.
- Botones con texto Pausar/Reanudar y Detener/Guardando, conservando iconos y contraste.
- Fixture medida: 320×56, clientWidth = scrollWidth = 318; pausa muestra Reanudar sin desbordamiento. Revisión visual correcta. Build web correcto.
- Este ajuste no vuelve a modificar el motor de grabación.

## Control único y etiquetas corregidas

- Se retiró el control activo duplicado de RecordingHud; conserva las acciones posteriores al guardado. La barra nativa es el único control durante la grabación.
- Tamaño conservado en 320×56: cronómetro, estado Grabando/En pausa al centro, pausa por icono y Detener con texto.
- Fixture con ambos componentes reales e IPC simulado: una barra nativa, cero HUD activos duplicados, botón de pausa sin texto visible y sin desbordamiento, también tras pausar/reanudar. Revisión visual correcta y build web correcto.
- No se realizó una nueva grabación física para este cambio de interfaz.

## Ocultación de controles, Ctrl+S y bandeja

- Build web y cargo check --lib correctos; diff acotado sin errores de espacios. Recursos desactivados solo en TAURI_CONFIG del comando. Se renombró otra copia cargada de WebView2Loader.dll dentro del directorio ignorado de build para permitir la copia idéntica de Tauri sin cerrar aplicaciones.
- Fixture con ambos componentes: 320 px sin desbordamiento, estado junto al cronómetro, ocultación manual y automática correctas. La espera del navegador tiene un límite efectivo inferior a los cinco segundos; una observación posterior confirmó toolbar invisible. Volver a mostrar usa el mismo evento que la bandeja y reinicia el plazo.
- Ctrl+S se registra después de iniciar una grabación real y se libera al guardar/cancelar; un conflicto deja el menú sin anunciar ese atajo y conserva la bandeja y Ctrl+Mayús+R. Las dos entradas nuevas de la bandeja están deshabilitadas fuera de una grabación.
- Recorrido real en Prisma Dev: selección de su ventana 1202×832, Enter, cuenta atrás, barra oculta y Ctrl+S. Resultado D:/Vídeos/Prisma/Prisma_Grabacion_2026-10-25_16-04-43.mp4 cerrado, sin proceso FFmpeg restante: 13 s, 333 fotogramas y pista de audio. Fotograma de 2 s decodificado y revisado visualmente en temp/recorder-hidden-controls-test.png: imagen completa y con contenido.
- La pulsación real de las opciones nuevas de la bandeja y una verificación independiente de liberación de Ctrl+S no se realizaron. La compilación no se presenta como prueba física del menú.
- Herramientas de dibujo: únicamente plan, sin implementación.

## Permanencia mientras el puntero está encima

- El temporizador de ocultación se cancela al entrar el puntero y comienza de nuevo al salir (5 s durante la grabación; 3 s en el aviso de guardado). Ocultar manualmente sigue disponible.
- Fixture con IPC simulado y puntero real del navegador: hover confirmado, barra visible tras esperar 5,5 s; fuera de la barra, invisible tras esperar 5,2 s. Build web correcto.
- No se repitió una grabación física para este ajuste.

## Texto/enlaces en Synapse y reproductor de Inicio

- Build web correcto y cuatro pruebas Bun de casillas/selector correctas.
- Primera ejecución de cargo test app::commands::vault --lib: 16 pruebas correctas. Incluye hueco concreto, no reemplazar fijados, persistencia Unicode, rotación previa, enlace example.invalid sin descarga y texto multilínea. Después se añadió lectura completa para copiar y una prueba de más de 16000 caracteres; la ejecución final quedó bloqueada por el nuevo módulo concurrente src/features/wallpapers (currentFolder sin variable y firmas HWND de windows 0.58 incompatibles). No se da esa prueba nueva ni el build nativo final por aprobados. Se deshizo el ajuste puntual de diagnóstico en wallpapers; no se conserva ninguna modificación de este trabajo allí.
- Para la primera compilación fue necesario renombrar una copia cargada de WebView2Loader.dll dentro de target/debug para que Tauri pudiera reponerla, como en las validaciones anteriores. Sin cerrar aplicaciones ni modificar publicación.
- Fixture synapse-file-actions con componente real e IPC simulado: escribir al portapapeles no añade tarjetas; Ctrl+V sobre Espacio 5 coloca texto Unicode con salto de línea en la quinta casilla, dejando libre la cuarta. Ctrl+V sobre Espacio 4 añade el enlace. Doble clic en cada vista previa copia exactamente el contenido correspondiente; lectura del portapapeles comprobada y estado Copiado, sin abrir visores ni navegador.
- Las vistas previas son texto React, sin insertar HTML. El archivo conserva todo el contenido, la vista previa persistida tiene un máximo de 16000 caracteres y vault_read_text devuelve el original completo.
- Fixture home-music: revisión visual de cabecera con música y en reposo. Pausar cambia el nombre accesible y detiene todas las animaciones de barras; siguiente cambia Luz de Prisma a Órbita. Controles de 44×44 y sin desbordamiento en columna estrecha; disposición en una columna y órbita sin recortar. Se conectan los controles al controlador existente de App, pero no se verificó audibilidad ni control físico de la reproducción desde la instancia nativa.
- Las barras son decorativas; no representan un análisis espectral del audio.
