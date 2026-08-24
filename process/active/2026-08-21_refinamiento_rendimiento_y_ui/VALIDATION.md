# Validación

- Estado: `PASSED_WITH_NOTES`

## Comprobaciones

- [x] `npm run build`.
- [x] Inicio reserva Música, Vídeos e Imágenes mientras se resuelven las fuentes; revisión nativa final correcta.
- [x] Los escaneos iniciales pasan por un coordinador con concurrencia máxima de uno.
- [x] La búsqueda de Wallpapers usa debounce de 300 ms y cancela la solicitud anterior.
- [x] Las categorías visibles corresponden al catálogo recibido.
- [x] Un wallpaper no autorizado usa la miniatura en la vista previa y no habilita acciones protegidas.
- [x] El cliente distingue la API web `/api/v1/wallpapers` del transporte local Aurora Synapse.
- [x] El catálogo admite autenticación Bearer con degradación al catálogo público y trata `src` como un dato protegido opcional.
- [x] Las etiquetas incrustadas tienen prioridad sobre la interpretación del nombre de archivo en biblioteca, Inicio, favoritos, historial y cola.
- [x] Las colas guardadas se actualizan por ruta al cargar la biblioteca, sin borrar su orden ni sus nombres personalizados.
- [x] El visor vertical elimina bandas internas y adapta su ancho a la imagen cargada.
- [x] Hover y foco visible comparten estados en navegación, tarjetas y wallpapers.
- [x] `prefers-reduced-motion` reduce animaciones y transiciones.
- [x] No se modificó AuroraHub.
- [x] `package.json`, Cargo, Tauri, `Cargo.lock` y la versión visible declaran `1.0.5`.
- [x] `cargo metadata --format-version 1 --no-deps` reconoce el paquete `prisma@1.0.5`.
- [x] Instalador nativo `1.0.4` generado e inspeccionado.
- [x] Ejecutable, instalador y recurso nativo de 32 px muestran el mismo icono regenerado desde la fuente pública.
- [x] `public/icon/icon.png` es la única fuente pública de la identidad de Prisma; el catálogo Synapse conserva únicamente iconos de aplicaciones vinculadas.
- [x] Instalador nativo `1.0.5` generado e inspeccionado.
- [ ] Instalación limpia `1.0.5` comprobada.
- [ ] Publicación remota comprobada.

## Evidencia

- Build de producción actualizado: TypeScript y Vite correctos; 175 módulos transformados.
- Preparación de versión: los cuatro puntos de versión principales coinciden en `1.0.5`; el empaquetado local fue ejecutado correctamente.
- Empaquetado del `2026-08-24`: `Prisma_1.0.4_x64-setup.exe` generado correctamente; ejecutable e instalador declaran versión `1.0.4` y sus iconos asociados fueron inspeccionados.
- Biglex confirmó el `2026-08-24` que v1.0.4 ya fue publicada; la evidencia posterior corresponde a la preparación separada de v1.0.5.
- Diagnóstico de iconos del `2026-08-24`: coexistían el proceso instalado v1.0.4 y el proceso de desarrollo; ambos ejecutables activos contenían el icono anterior, mientras el ejecutable `release` recompilado después de regenerar los recursos ya contenía el icono blanco.
- Empaquetado final de v1.0.5 del `2026-08-24`: `Prisma_1.0.5_x64-setup.exe` generado con 39.804.136 bytes, versiones de producto y archivo `1.0.5`, y SHA-256 `A15FFD771508652EAF95E5D9877BA72BCA361CE62D0F2D9AB92B3B065A034DD6`.
- Los iconos asociados extraídos del ejecutable `debug`, el ejecutable `release` y el instalador 1.0.5 muestran la misma variante blanca. La comprobación visual de la ventana nativa confirmó el icono nuevo en la barra de título, la navegación y la versión 1.0.5 en Acerca de.
- Una regeneración incondicional podía fallar en Windows con `os error 1224` si Explorer o Prisma mantenían un PNG mapeado. El comando ahora compara la huella de `public/icon/icon.png` y omite toda escritura cuando los derivados ya están vigentes.
- El generador incremental se ejecutó dos veces con los recursos abiertos y omitió correctamente la reescritura. `bun run tauri:dev` superó la etapa de iconos, compiló Prisma v1.0.5 y lanzó `target/debug/prisma.exe`; la instancia de prueba se cerró después de validar el arranque.
- Revisión nativa: Inicio cargó con 226 canciones, 112 vídeos y 17 imágenes en el entorno de desarrollo utilizado.
- Catálogo oficial consultado el `2026-08-21`: 50 elementos; categorías `Escritorio`, `Móvil` y `Social`; cero elementos con categoría literal `Fan`; un elemento premium no autorizado; cero NSFW.
- Reconsulta contractual del `2026-08-21`: `/api/v1/wallpapers` conserva `success`, paginación, `isAuthorized` y `thumbnailSrc`. El único elemento no autorizado todavía entrega también `src`; esa exposición debe corregirse en Aurora y no puede considerarse resuelta por el bloqueo visual de Prisma.
- Caso real de metadatos: `Your Name. CD 1 TRACK 8 (FLAC).flac` declara título `Zenzenzense - movie ver.`, artista `RADWIMPS` y álbum `Your Name.`. Prisma ya no divide ese título como si `Zenzenzense` fuera el artista.
- Wallpaper protegido probado: `Biglex y Ely`, categoría `Escritorio`, `isPremium=true`, `isAuthorized=false`, `isNsfw=false`.
- Modal nativo: aviso de cuenta Fan y botones Móvil, Descargar HD y Establecer como Fondo deshabilitados.
- Visor nativo de Mahuyu (`864 x 1184`): imagen ajustada de borde a borde arriba y a los costados; Móvil, Favorito, Descargar HD y Establecer como Fondo visibles.
- El navegador web independiente no es una prueba válida de Prisma porque no expone el runtime de Tauri. La aplicación sí se verificó en su ventana nativa.

## Notas pendientes

- Vite conserva una advertencia de paquete JavaScript de aproximadamente 700 kB; conviene tratar la separación de chunks como deuda de rendimiento posterior, no como bloqueo de esta fase.
- La primera ejecución nativa coexistió con Prisma instalado y compartió el entorno WebView/puertos de Synapse, produciendo una ventana en blanco. Tras cerrar la instancia instalada y ejecutar Prisma de forma limpia, la interfaz cargó correctamente. El proceso instalado se restauró al terminar.
- `cargo test` aislado del escáner no pudo ejecutarse mientras la instancia nativa de desarrollo mantenía bloqueada `target/debug/libmpv-2.dll`; los dos archivos Rust modificados pasan `rustfmt --check`, el build TypeScript/Vite es correcto y el observador de Tauri recompiló y relanzó la aplicación nativa con el cambio.
