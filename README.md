# Prisma

Visor y reproductor multimedia local-first construido con Tauri, React, TypeScript y Rust.

## Estado

El motor multimedia de la Fase 1 continúa en validación manual. En paralelo, la Fase 2 ya incorpora clasificación multimedia y sesiones de carpeta con navegación anterior/siguiente.

## Desarrollo base

```text
npm install
npm run tauri dev
```

La compilación base no habilita libmpv. Para preparar la dependencia nativa en Windows y validar el backend:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-libmpv.ps1
bun tauri dev --features mpv
```

Consulta `docs/distribution/libmpv-windows.md` para conocer el mecanismo, la ruta alternativa y las consideraciones de distribución.

Consulta `docs/architecture/phase-1-feasibility.md` antes de ampliar el alcance.
