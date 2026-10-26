# Fondos vivos — vídeos y composición Aurora

Fecha: 2026-10-25. Plan definido en dos fases según la dirección de Biglex.
Herramienta integrada en Prisma para Windows. Nombre provisional: **Fondos vivos**.

## TAREA

Fase 1: reproducir vídeos de varias carpetas locales como fondo de escritorio, de forma continua en orden o aleatoria.

Fase 2: adaptar el sistema de composición por capas ya existente en Aurora para ofrecer fondos de escena. Aprovechar nuestros componentes y experiencia; no construir otro motor de escenas desde cero.

El encargo vigente autoriza revisar la fase 1 e iniciar la fase 2. Implementación local en curso; sin publicación.

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

### Modelo de capas (definido por Biglex el 2026-10-25)

El fondo de escritorio se compone por capas apiladas. **No existe una capa cero**: la numeración arranca en la capa 1.

| Capa | Contenido | Estado |
|---|---|---|
| 1 | Medios base: vídeo o imagen estática, desde carpetas locales | En construcción |
| 2 | Fondos dinámicos | Pendiente |
| 3 | Fondos y escenarios 3D | Pendiente |
| 4 | Partículas | Pendiente |
| 5 | Ecualizador: efectos que dan vida al fondo según el audio | Pendiente |
| 6 | Parallax | Pendiente |

La capa 1 es el medio que se reproduce detrás de los iconos. Las capas 2 a 6 se superponen sobre ella y comparten sus controles de activación, pausa y detención. La capa 5 reacciona al audio: el ecualizador aporta el movimiento reactivo sin exigir un motor de escenas propio.

#### Capa 1 — medios base

La capa 1 acepta vídeo e imagen estática de forma indistinguible para el usuario: la misma carpeta puede mezclar ambos, y se importa también una carpeta que contenga solo imágenes.

- Extensiones de vídeo: mp4, webm, mkv, mov, avi, m4v. Extensiones de imagen: jpg, jpeg, png, webp, bmp, gif, tif, tiff, avif.
- **El tipo se elige con un switch arriba de la cajita de controles: por defecto no se mezclan.** Con el switch en «Vídeos» la cola y la cuadrícula contienen solo vídeos; en «Imágenes», solo imágenes; «Combinado» es la opción separada y explícita para mezclarlos. El valor por defecto es «Vídeos».
- Una imagen se muestra durante un tiempo configurable (`imageDurationSec`, 20 s por defecto) y después la cola avanza. Un único elemento en la cola nunca avanza: el vídeo se repite en bucle y la imagen se queda fija.
- Solo el vídeo tiene audio; con el switch en «Imágenes» el control de sonido queda sin efecto y así se indica.
- Las imágenes se reproducen en la misma sesión de libmpv que el vídeo, con el mismo encuadre (cover/contain) y la misma ventana detrás de los iconos.

### Fase 2 — reutilizar las capas de Aurora

La decisión de aprovechar Aurora está confirmada por Biglex. Antes de adaptar, revisar dependencias y consumidores vigentes y elegir una unidad reutilizable con un origen mantenible; evitar copias divergentes del compositor.

Base Aurora inspeccionada el 2026-10-25 (resultado verificado, no supuesto):

- **El compositor es three.js puro y portable.** `dynamic-backgrounds/` (58 archivos, 6.484 líneas) no importa React, React Router, i18n ni Supabase. Cero `fetch`, cero URLs externas: todas las texturas son `CanvasTexture` generadas en runtime. No hay HDRI ni texturas remotas.
- **Unidad mínima reutilizable: 15 archivos, 1.218 líneas** bajo `dynamic-backgrounds/`: `LayeredBackgroundComposer.ts`, `index.ts`, `controls.ts`, `catalog.ts`, `particleScenes.ts`, `particleTextures.ts`, `ParticleBackground.ts`, `resources.ts`, `BackgroundProjection.ts`, `BackgroundCamera.ts`, `Backgrounds/{AmbientBackground.ts, themes.ts, sky.frag.ts}`, `Interaction/{BackgroundInteraction.ts, ClickEffects.ts, textures.ts}`.
- **Dependencias:** `three` 0.185.1 instalado (el `package.json` declara `^0.186.0`: el lockfile está desfasado). Frontend de Aurora sobre Astro 7.3.2 + React 19.2.8. El compositor no necesita Astro: es TS + three, con `import()` dinámico para cargar un escenario a la vez.
- **Lo que bloquea la reutilización no es el compositor, es su andamiaje:**
  1. `LayeredThreeBackground.tsx` es un componente React: hay que reescribirlo como TypeScript vanilla para montarlo en un webview de escritorio.
  2. `controls.ts` mezcla los valores por defecto con un store de React (`useSyncExternalStore` + `localStorage`): hay que separarlo.
  3. `vtuberAssets` (Supabase) es la única ruta que hay que descartar, junto con `ThreeBackground.tsx` y `StaticBackgroundFallback.tsx`. `LayeredThreeBackground.tsx` ya recibe la imagen por prop y no lo necesita.
  4. `BackgroundInteraction` registra listeners de `window` sin retirarlos si el host no llama a `dispose()`, y usa selectores propios de Aurora: hay que redefinirlos.
  5. Seis efectos leen `window.innerWidth/innerHeight` en su `init`: el tamaño debe inyectarse en un webview redimensionable.
  6. `visualRenderer` es una fábrica, no un singleton: se puede instanciar, pero cada instancia es un contexto WebGL (WebView2 tiene límites de contexto).

- Adaptar Three.js/WebGL, compositor, catálogo de efectos y controles que resulten pertinentes. No migrar automáticamente a otro motor ni reescribir shaders y efectos ya disponibles.
- Conservar las seis capas como modelo de referencia. El modelo vigente de Prisma es el de sus seis capas indicado arriba; no exige avatar ni servicios de conversación.
- Incorporar progresivamente imagen estática, ambiente, escenario 3D, escenografía y partículas mediante sus controles existentes. Parallax se aprovecha si el efecto ya lo implementa; comprobar lo disponible antes de añadirlo.

Decisiones de Biglex tomadas el 2026-10-25:

1. **Alojamiento de la composición**: un webview de escritorio dentro de Prisma, detrás de los iconos, con el compositor vendorizado en Prisma (los 15 archivos de `dynamic-backgrounds/` con su origen declarado y un script de sincronización desde Aurora). No se toca el pipeline de build de Aurora ni se crea un paquete compartido.
2. **Alimento de la capa 5 (ecualizador)**: el audio del propio fondo, es decir, la pista del vídeo que está en pantalla. No se captura el audio del sistema ni el DSP de la app: mpv ya expone el análisis de audio de la sesión.
- Alojar la composición en una superficie web de escritorio detrás de iconos y evaluar transparencia, aceleración, consumo y ciclo de vida. Decidir la integración concreta después del prototipo: reutilizar el compositor no resuelve automáticamente su alojamiento Windows.
- Compartir con fase 1 los controles de activación, pausa y detención. Solo un modo de fondo activo por destino: vídeo o composición Aurora, sin dos motores renderizando ocultos a la vez.
- Interacción con el cursor optativa: comprobar recepción sin interceptar clics del escritorio ni robar foco. Un efecto con ratón dentro de una página no prueba interacción detrás de iconos.
- Conservar recursos y presets necesarios localmente para uso sin cuenta o conexión. Auditar recursos externos, dependencias y avisos al distribuir.
- Validar primero una composición representativa con capas independientes, visibilidad, pausa y liberación; ampliar luego a los efectos disponibles con límites de calidad según medición.

No incluye construir un editor general nuevo, formatos de Wallpaper Engine o publicación de catálogos. Los detalles de adaptación se completan tras validar la fase 1, sin eliminar la fase 2 del plan.

## RESTRICCIONES

- Aura es referencia conceptual; nuestro sistema de capas procede de Aurora.
- Fase 1 con medios locales ya implementada (vídeos e imágenes). Fase 2 aprovecha composición Aurora existente.
- Sin dependencias de Wallpaper Engine/Steam ni control de procesos ajenos.
- Sin prometer consumo cero, transiciones sin cortes o compatibilidad universal. Medir rendimiento y verificar escritorio real; un build no demuestra funcionamiento.
- Verificar distribución de dependencias nativas y recursos web concretos al implementar.
- El encargo actual incluye código y verificación local. No incluye publicación ni reemplazar la instalación del usuario.

## Dirección e implementación vigentes — revisión del 2026-10-25

Esta sección sustituye las propuestas anteriores de «Combinado» y de exigir un medio base para activar escenarios:

- Selector superior **Vídeos · Imágenes · Fondos 3D**. Los escenarios y su ambiente se eligen dentro de Fondos 3D. Las carpetas y opciones de cola se muestran solo para medios locales. El backend mantiene `mixed` como contrato legado, sin ofrecerlo como pestaña.
- Fondos 3D puede crear su host sin carpeta ni sesión mpv; el cambio desde un medio detiene la sesión anterior. Se mantienen los controles comunes de activar, pausar, reanudar y detener.
- Primer subconjunto vendorizado: ambiente, Prisma, Aurora Boreal y Holo Ciudad 3D. Sincronización explícita con `scripts/sync-aurora-wallpapers.ts`, 19 originales y hashes en `provenance.json`; build independiente del repositorio Aurora.
- Escenario y ambiente persisten en `live_wallpapers.json`; la composición se activa manualmente en esta entrega. No se fabrica un nivel de audio.
- Integración verificada en WebView2 nativo a 1920×1080 con cero medios configurados: animación de Holo Ciudad, pausa estable, cambio de escenario y destrucción de la superficie al detener.
- La base de fase 1 permite continuar. Aún deben completarse pausa automática por pantalla completa/bloqueo y recuperación tras reiniciar Explorer: el bucle actual controla final de medios, no esas políticas.
- Siguen pendientes partículas como capa independiente, ecualizador del audio del fondo, parallax de cursor y medición sostenida de consumo. No considerar cerrada la fase 2.

## Ampliación autorizada — catálogo y controles por capas

Biglex solicita copiar los efectos de Aurora, mostrarlos como galería dentro de Fondos 3D y ofrecer arriba sus controles por capas. Se importa el catálogo completo de 25 efectos y su cierre de dependencias (46 archivos de motor; UI/store React excluidos). Se generan miniaturas del propio renderizador, no imágenes ilustrativas.

La interfaz tendrá filtros por categoría, selección visual y controles persistentes por efecto: ambiente, escenario, partículas independientes y parallax opcional. Cámara/rotación y detalle se ofrecen solo cuando el motor los admite. No capturar audio del sistema ni presentar un nivel simulado como ecualizador real.

La implementación debe conservar un único contexto WebGL de escritorio, cargas dinámicas con protección frente a selecciones tardías y liberación al cambiar/detener. La galería usa miniaturas estáticas para evitar un contexto de renderizado por tarjeta.

## Modelo vigente — aclaraciones de Biglex, 2026-10-26

Este bloque sustituye la exclusión entre medio y compositor y la numeración anterior.
Capa 1: imagen/vídeo. Capa 2: ambiente independiente, utilizable solo o sobre el medio.
Después: dinámicos planos, escenarios 3D, partículas volumétricas y partículas 2D.
Parallax es una transformación opcional de la base y de las capas con cámara.
El ecualizador real sigue pendiente; no se sustituye por datos simulados.

Vídeos, Imágenes y Fondos y efectos navegan el catálogo sin apagar capas. Los controles y la galería están disponibles también con medios locales.
Ambiente incluye color sólido/degradado con opacidad, además de las paletas originales. Cada efecto conserva sus controles.
Se autoriza generar los mismos recursos a 1920 × 1080 para reutilizarlos: se entregan 25 PNG en assets/wallpapers/scenes-1080, separados de las miniaturas de producción.

## Corrección de navegación solicitada por Biglex — 2026-10-26

Pestañas superiores independientes: Vídeos, Imágenes, Ambiente, Dinámicos, Escenarios 3D, Partículas y Parallax. Eliminar Fondos y efectos y la galería global Todos. Cada pestaña contiene exclusivamente su catálogo y controles. Partículas agrupa los dos sistemas bajo un selector interno y conserva sus ajustes independientes. La navegación no modifica las capas activas. Dinámicos se explica como fondos procedurales animados, sin escenario 3D.

## Catálogo canónico de Aurora — corrección del 2026-10-26

La fuente de agrupación es DYNAMIC_BACKGROUND_GROUPS de Aurora, consumida por ui/tabs/Fondos/Dinamicos.tsx. El nombre de carpeta Dinamicos no define una categoría de interfaz ni supportsBackgroundCamera su organización.
Pestañas: Vídeos, Imágenes, Ambiente, Escenarios 3D, Partículas y Parallax. Escenarios 3D contiene los 25 efectos, agrupados exactamente como Aurora en Escenarios 3D (17) y Efectos 3D (8), en su orden de origen. Partículas mantiene las partículas superpuestas independientes; los escenarios volumétricos vuelven al catálogo canónico de escenarios. Se conservan los controles existentes y sus ajustes por efecto. Elegir un escenario sustituye el anterior, sin borrar ambiente, medio base ni partículas superpuestas. Los campos internos de renderizado se mantienen por compatibilidad y no se utilizan para inventar agrupaciones visuales.

## Pulido funcional solicitado — 2026-10-26
Diagnosticar visibilidad real de ambiente/escenarios, nitidez del original y fluidez de vídeo; animar GIF manteniéndolo dentro de Imágenes. Recuadro accesible para interruptores de Parallax. Verificar con medios originales y pruebas nativas en perfil aislado, conservando la sesión del usuario.

El clic en una tarjeta de efecto debe guardar la configuración antes de activar el compositor, igualando la aplicación inmediata de medios. Sincronizar visibilidad de ventana y WebView2. Perfiles del modelo anterior conservan una sola selección de escenario para evitar carga oculta acumulada. Efectos WebGL limitados a 30 fps; mpv mantiene su reloj propio y velocidad 1. GIF permanece en Imágenes con bucle de animación durante su duración configurada. Escalado spline36/mitchell sin interpolación temporal ni reconstrucción IA.

## Incidencia abierta: composición no visible sobre medios — 2026-10-26

Biglex confirma que la corrección anterior no muestra escenarios ni partículas sobre la imagen. No considerar resuelto por isVisible o capturas internas. Revisar WS_EX_LAYERED añadido por set_ignore_cursor_events, inicialización de alfa nativo y orden de show/SetParent/estilos. Verificar lectura de atributos de capa, además del motor y su selección.

## Zoom primero — petición de Biglex, 2026-10-26

Alcance inmediato: corregir zoom en los fondos planos compartidos con el frontend Aurora. No tocar Gargantúa ni optimizar rendimiento; Biglex lo ha diferido expresamente. No cambiar encuadre inicial de Lente Gravitacional: después del arreglo el usuario indicará el valor deseado. Activadores de imágenes/vídeos y semántica de ambiente quedan para después.

Reproducción en motor real congelado a zoom 0,5/1/2: Prisma y Lente Gravitacional no cambian en ninguna dirección porque el mínimo de cobertura geométrica supera los valores del control. Cambiar muestreo UV en lugar de escala del quad permite alejar/acercar manteniendo cobertura y el resultado original a zoom 1. La fuente es BackgroundProjection.ts en Aurora; Prisma recibe su copia mediante el sincronizador.
