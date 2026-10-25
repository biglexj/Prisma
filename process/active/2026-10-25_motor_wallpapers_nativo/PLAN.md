# Fondos vivos — vídeos y composición Aurora

Fecha: 2026-10-25. Plan definido en dos fases según la dirección de Biglex.
Herramienta integrada en Prisma para Windows. Nombre provisional: **Fondos vivos**.

## TAREA

Fase 1: reproducir vídeos de varias carpetas locales como fondo de escritorio, de forma continua en orden o aleatoria.

Fase 2: adaptar el sistema de composición por capas ya existente en Aurora para ofrecer fondos de escena. Aprovechar nuestros componentes y experiencia; no construir otro motor de escenas desde cero.

El encargo actual es dejar definido el plan. No iniciar implementación todavía.

## CONTEXTO

Aura es únicamente referencia conceptual. No se utilizará, adaptará ni portará su código. Referencia consultada: [Aura](https://github.com/antwny/aura), commit `739445bfaa4c94150d27d899ec098dbb3f170ff5`.

Base inspeccionada de Prisma el 2026-10-25:

- `src-tauri/src/app/commands/wallpapers.rs` aplica imágenes estáticas; no aloja vídeo detrás de los iconos.
- Cargo y `src-tauri/src/infrastructure/media/mpv.rs` ya incluyen libmpv como candidato de reproducción.
- El reproductor existente conserva su coordinador: fondos con sesión propia, sin apropiarse de música, cola, DSP, SMTC o controles multimedia.
- Acceso local independiente de servicios Aurora; el catálogo Wallpapers Aurora conserva su función.
- Rama inspeccionada: `preview`, con cambios ajenos. Este proceso modifica solo documentación y su enlace en ROADMAP.

Base Aurora inspeccionada para fase 2:

- `../Aurora---Blog/frontend/src/features/Comunidad/EspacioVtuber/islands/three/LayeredThreeBackground.tsx` usa Three.js/WebGL.
- `../Aurora---Blog/frontend/src/features/Comunidad/EspacioVtuber/islands/three/dynamic-backgrounds/LayeredBackgroundComposer.ts` compone ambiente, escenario y escenografía con renderizador compartido y tiempos independientes.
- `../Aurora---Blog/docs/es/frontend/contratos-ui.md` documenta seis capas: **Fondo estático → Ambiente → Escenario 3D → Escenografía → Partículas → Avatar**.
- ElyVerso tiene selección y configuración relacionadas en `useElyVersoBackground.ts`. No asumir que todos los consumidores o la aplicación Ely Intelligence tienen una implementación idéntica sin comprobarlos al adaptar.
- Esta evidencia confirma una base reutilizable; no demuestra todavía su funcionamiento como fondo de Windows.

## FORMATO

### Fase 1 — vídeos de varias carpetas

#### Experiencia

1. Abrir la herramienta y usar **Añadir carpeta** tantas veces como sea necesario: A, B, C… No limitar a una sola ruta.
2. Ver las carpetas registradas con nombre, ruta, cantidad y disponibilidad. Poder activarlas/desactivarlas, actualizar y quitar su registro sin borrar archivos.
3. Elegir **En orden** o **Aleatorio** sobre el conjunto de vídeos de todas las carpetas activas.
4. Pulsar **Activar fondo**. Cada vídeo se reproduce completo detrás de los iconos y al terminar se avanza al siguiente.
5. Pausar/reanudar, siguiente o detener desde la herramienta y bandeja. Mostrar vídeo y carpeta de origen actuales.

Vista compacta con fuentes, modo, vídeo actual y encuadre; Material 3 Expressive con componentes existentes.

#### Contrato de carpetas y cola

- Una colección de fuentes persistentes, cada una con identificador estable, ruta canónica, estado habilitado y disponibilidad. Evitar registros duplicados por variantes de ruta en Windows.
- Las carpetas activas alimentan una cola conjunta. No crear reproductores simultáneos por carpeta. Desactivar B permite reproducir solo A y C sin eliminar su registro.
- **En orden:** carpetas en el orden en que se añadieron; vídeos ordenados naturalmente por nombre dentro de cada carpeta (`2.mp4` antes que `10.mp4`). Tras el último de C, volver al primero de A. No exigir reordenación manual de carpetas en la primera entrega.
- **Aleatorio:** barajar la cola conjunta, recorrerla sin repetir y volver a barajar al agotarla. Evitar repetir inmediatamente el último si hay más de un vídeo. Igual probabilidad por vídeo, sin ponderación adicional por carpeta.
- Un único vídeo válido se repite en bucle. El cambio normal ocurre al finalizar, sin temporizador de rotación.
- Enumerar la carpeta inmediata, sin subcarpetas por defecto. Validar reproducción con el backend; extensión reconocida no garantiza códec compatible.
- Deduplicar por ruta canónica normalizada en la cola, sin calcular hashes de contenido; archivos distintos con contenido idéntico pueden aparecer por separado.
- Botón de actualización por carpeta y **Actualizar todas**; sin vigilancia automática inicial. No mover originales ni persistir un índice multimedia completo.
- Al añadir, desactivar, actualizar o quitar fuentes, reconstruir la cola conservando el vídeo actual si sigue siendo elegible. Si deja de serlo, pasar al siguiente válido; si no queda ninguno, detener. Invalidar eventos tardíos del vídeo anterior para evitar avances dobles.
- Conservar el orden relativo de los pendientes al actualizar en modo ordenado. En aleatorio, mantener los pendientes válidos y mezclar los nuevos elegibles; los ya reproducidos no vuelven hasta la siguiente tanda, salvo que sean los únicos disponibles.
- Una carpeta vacía o inaccesible no bloquea las demás ni elimina su configuración; mostrar estado y continuar con las disponibles. Si no hay vídeos reproducibles en ninguna fuente activa, detener y dejar el fondo estático.
- Omitir archivos fallidos una vez por recorrido; si todos fallan, detener sin reintentos infinitos.
- Silencio por defecto, sin controles de audio adicionales en fase 1.
- Persistir fuentes, orden, habilitación, modo y encuadre en JSON versionado con escritura atómica. Al reiniciar, restaurar configuración y reconstruir la cola; no prometer posición exacta ni la misma tanda aleatoria. Activación automática solo mediante preferencia expresa.
- Primera entrega: monitor principal. Gestionar cambio de pantalla y DPI sin superficies huérfanas; asignaciones independientes o panorámicas no forman parte de esta fase.

#### Implementación y ciclo de vida

Herramienta React → gestor de fuentes y cola Rust → superficie Windows + sesión independiente de libmpv.

- Comandos en `app`, comportamiento en la feature de wallpapers e integración técnica en infraestructura. Crear módulos al implementar responsabilidades reales.
- Probar primero un vídeo detrás de los iconos; decidir alojamiento en proceso o proceso hijo según evidencia, sin imponer un servicio adicional.
- Progman/WorkerW es candidato dependiente del shell. Verificar foco, estilos, DPI y reinicio de Explorer: [SetParent](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent).
- Validar incrustación, aceleración, fin de archivo y liberación de recursos con libmpv: [manual](https://mpv.io/manual/stable/).
- Leer vídeos por ruta, sin base64 ni precarga completa. Miniaturas opcionales bajo demanda y con límites.
- Mantener iconos, clic derecho y Mostrar escritorio funcionales. Si falla el alojamiento, dejar el fondo estático con diagnóstico.
- Pausar por pantalla completa en el monitor de destino, bloqueo y suspensión. Mantener motivos de pausa separados y respetar la pausa manual al reanudar.
- Ocultar Prisma en bandeja conserva el fondo; salir lo detiene y libera recursos. Respetar preferencias actuales; autostart optativo mediante el mecanismo existente.
- Evitar modificar el fondo estático; si se requiere, registrar propiedad y no sobrescribir cambios posteriores del usuario al restaurarlo.

Hitos internos de fase 1: prueba nativa → fuentes/cola → vista y bandeja → pruebas Windows. La fase termina cuando funciona con varias carpetas sin conexión ni Wallpaper Engine.

### Fase 2 — reutilizar las capas de Aurora

La decisión de aprovechar Aurora está confirmada por Biglex. Antes de adaptar, revisar dependencias y consumidores vigentes y elegir una unidad reutilizable con un origen mantenible; evitar copias divergentes del compositor.

- Adaptar Three.js/WebGL, compositor, catálogo de efectos y controles que resulten pertinentes. No migrar automáticamente a otro motor ni reescribir shaders y efectos ya disponibles.
- Conservar las seis capas como modelo de referencia. El avatar es opcional para un fondo; no obligar a incluir personaje ni servicios de conversación.
- Incorporar progresivamente imagen estática, ambiente, escenario 3D, escenografía y partículas mediante sus controles existentes. Parallax se aprovecha si el efecto ya lo implementa; comprobar lo disponible antes de añadirlo.
- Alojar la composición en una superficie web de escritorio detrás de iconos y evaluar transparencia, aceleración, consumo y ciclo de vida. Decidir la integración concreta después del prototipo: reutilizar el compositor no resuelve automáticamente su alojamiento Windows.
- Compartir con fase 1 los controles de activación, pausa y detención. Solo un modo de fondo activo por destino: vídeo o composición Aurora, sin dos motores renderizando ocultos a la vez.
- Interacción con el cursor optativa: comprobar recepción sin interceptar clics del escritorio ni robar foco. Un efecto con ratón dentro de una página no prueba interacción detrás de iconos.
- Conservar recursos y presets necesarios localmente para uso sin cuenta o conexión. Auditar recursos externos, dependencias y avisos al distribuir.
- Validar primero una composición representativa con capas independientes, visibilidad, pausa y liberación; ampliar luego a los efectos disponibles con límites de calidad según medición.

No incluye construir un editor general nuevo, formatos de Wallpaper Engine o publicación de catálogos. Los detalles de adaptación se completan tras validar la fase 1, sin eliminar la fase 2 del plan.

## RESTRICCIONES

- Aura es referencia conceptual; nuestro sistema de capas procede de Aurora.
- Fase 1 exclusivamente vídeos. Fase 2 aprovecha composición Aurora existente.
- Sin dependencias de Wallpaper Engine/Steam ni control de procesos ajenos.
- Sin prometer consumo cero, transiciones sin cortes o compatibilidad universal. Medir rendimiento y verificar escritorio real; un build no demuestra funcionamiento.
- Verificar distribución de dependencias nativas y recursos web concretos al implementar.
- Este encargo deja el plan documentado: no modifica código, instala, compila ni publica.
