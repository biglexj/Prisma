# Plan: Paleta de Álbum Estable y Botón Silenciar en Volumen (Panel Escuchar)

## Contexto y Diagnóstico
1. **Botón Silenciar en el Control de Volumen**:
   - En el panel Escuchar (`PlaybackPreview.tsx`), el icono de altavoz dentro de `.preview-volume` es un elemento estático no interactivo dentro de un `<label>`. Al hacer clic no silenciaba el audio ni cambiaba a icono silenciado.
2. **Inestabilidad cromática entre Play y Pausa**:
   - En `App.tsx`, `applyMusicPalette(isAudioPlaying ? currentAlbumPalette : null)` ligaba la activación de la paleta extraída del álbum únicamente a la condición `isAudioPlaying`.
   - Cuando el usuario ponía Pausa, la paleta dinámica se destruía de golpe, haciendo que el color saltase inmediatamente al color de acento base del tema (celeste/verde/neón). Al pulsar Play, volvía a cambiar a los colores del álbum.
3. **Falta de sincronización cromática unificada en el Panel Escuchar**:
   - La barra de progreso (`MediaProgressBar`) no recibía el color de acento de la carátula y leía el `--primary` global de CSS.
   - El botón Play (`preview-play`) usaba el color del álbum (`var(--album-accent)`).
   - Los botones de acciones como Aleatorio/Shuffle activo (`is-active`) usaban el color del tema global, generando incoherencia cromática (ej. barra celeste, botón marrón, botón shuffle menta).

## Objetivos (Opción 2 seleccionada por el usuario)
1. **Control de Silencio Interactivo en Volumen**:
   - Convertir el icono de altavoz en un botón accesible con hover y acción de toggle mute.
   - Guardar el volumen anterior al silenciar (0%) para restaurarlo al desilenciar.
   - Mostrar el icono dinámico `volume-mute` cuando el volumen sea 0, y `volume` / `volume-1` cuando tenga sonido.
   - Unificar con el atajo de teclado existente "M".
2. **Paleta de Álbum Estable durante la Carga de Pista**:
   - En `App.tsx`, mantener activa la paleta del álbum mientras haya una pista cargada (`currentAudioPath`), evitando que saltos entre Play y Pausa destruyan y recreen el esquema de color.
3. **Unificación Cromática en el Panel Escuchar**:
   - Pasar `activeColor={palette?.accent}` a `MediaProgressBar`.
   - Adaptar en `album-adaptive.css` los botones activos de acciones (`.preview-actions > button.is-active`), el hover del botón de volumen y el botón de favoritos para que sigan armoniosamente la misma paleta.
