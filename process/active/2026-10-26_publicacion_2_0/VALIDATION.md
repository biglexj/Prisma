# Validación

- GitHub consultado: última release estable v1.1.7; no se modifica.
- `bun test tests`: 160 pruebas correctas, cero fallos.
- `bun run build`: correcto; advertencia de tamaño de chunks existente.
- `cargo check --manifest-path src-tauri/Cargo.toml --lib`: correcto con las fuentes acumuladas antes de cambiar la versión.
- Prisma instalada: navegación a Fondos Vivos e Imágenes comprobada; biblioteca cargada. El usuario confirma funcionamiento de wallpapers, partículas y parallax.
- Incidente comunicado: algunas imágenes se mostraron incorrectamente al abrir desde el Explorador durante el arranque. Causa todavía no reproducida; no se atribuye al arranque ni se declara corregido sin evidencia.
- Publicación no autorizada: solo preparación local; cero escrituras remotas.
- Comprobación nativa ampliada: 73 pruebas correctas, 6 ignoradas y cero fallos del filtro features::; otras 76 pruebas fuera del filtro.
- Suite nativa completa: inicialmente 146 correctas y dos fallos por una suposición incorrecta del helper COM. Ambas pruebas pasan aisladas. El helper distingue ahora IMPLICIT_MTA de inicialización explícita, sin cambios en producción: resultado final 148 correctas, 7 omitidas, cero fallos.
- Diagnóstico reutilizable: `Docs/troubleshooting/platforms/windows-com-implicit-mta-tests.md`, con referencia de Microsoft.
- Comprobación en Edge aislado con backend simulado: Sonido solo en Vídeos y antes de Modo; no se muestra en Imágenes. Color inicial 00C9B9 y escritura hexadecimal persistida. Cero errores de JavaScript.
- Primer empaquetado local: Inno generó el EXE, pero el resumen del script de release falló porque Windows PowerShell no dispone de Get-FileHash en ese entorno. Se sustituyó por SHA-256 de .NET, igual que en el empaquetador existente. Se vuelve a compilar el candidato para incluir el ajuste de Sonido, añadido después del primer build web.
- Referencia: `Docs/troubleshooting/tools/powershell-host-portability.md`.
