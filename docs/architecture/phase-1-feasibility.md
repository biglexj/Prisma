# Fase 1: viabilidad multimedia

## Objetivo

Comprobar que Tauri, React, Rust y libmpv pueden sostener el núcleo de Prisma antes de implementar features de producto.

## Experimento 01: contrato y audio

La primera rebanada implementa:

- selección de un archivo local;
- carga mediante libmpv;
- reproducción y pausa;
- seek absoluto;
- volumen;
- lectura de posición y duración;
- rutas con espacios y caracteres Unicode;
- backend activable mediante la feature de Cargo `mpv`.

La aplicación también debe compilar sin libmpv. En ese caso mostrará explícitamente que el backend está deshabilitado; esto permite trabajar en la arquitectura sin ocultar el requisito nativo.

## Experimento 02: renderizado de vídeo

Pendiente hasta que el Experimento 01 compile y reproduzca audio correctamente.

Debe comparar al menos:

1. Render API de libmpv sobre una superficie nativa administrada por Prisma.
2. Ventana hija de mpv incrustada mediante identificador nativo.

El criterio no es solo mostrar una imagen: debe permitir redimensionamiento, pantalla completa, subtítulos, aceleración por hardware y cierre limpio sin interferir con WebView2.

## Criterios de salida de la Fase 1

- La compilación base de frontend y Rust finaliza correctamente.
- La compilación con la feature `mpv` encuentra y enlaza libmpv.
- Se reproduce un archivo de audio local.
- Pausa, seek y volumen funcionan.
- Una ruta con tildes, eñes y espacios funciona.
- El renderizado de vídeo funciona dentro de una ventana de Prisma.
- El proceso se cierra sin dejar archivos bloqueados.
- Se documenta cómo distribuir la dependencia nativa en Windows.

Hasta cumplir todos estos puntos, libmpv continúa siendo candidato y no una decisión arquitectónica cerrada.
