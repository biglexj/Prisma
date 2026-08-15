# libmpv en Windows

## Propósito

Prisma enlaza `libmpv2` de forma opcional durante la Fase 1. En Windows, activar la feature `mpv` requiere una biblioteca de importación compatible con el target `x86_64-pc-windows-gnullvm` y la DLL correspondiente en tiempo de ejecución.

Instalar únicamente `mpv.exe` no aporta la biblioteca `libmpv.dll.a` que necesita el enlazador.

## Preparación local

Desde la raíz del proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-libmpv.ps1
bun tauri dev --features mpv
```

El script descarga una compilación fijada de desarrollo para Windows x64, conserva la biblioteca de importación y la DLL dentro de `src-tauri/vendor/libmpv`, y elimina el archivo temporal. Esta carpeta está excluida de Git.

`build.rs` añade automáticamente la carpeta nativa al enlace y copia la DLL junto al ejecutable de desarrollo. Para utilizar una instalación distinta, se puede definir `PRISMA_LIBMPV_DIR`; esa ruta debe contener:

```text
libmpv/
├── bin/
│   └── libmpv-*.dll
└── lib/
    └── libmpv.dll.a
```

El mismo script de compilación desactiva la exportación automática de símbolos del `cdylib` de Tauri. Sin esta opción, MinGW/LLVM intenta exportar también los símbolos estáticos incorporados por libmpv y puede superar el límite de 65 535 entradas de una DLL PE. Esta opción no altera el `rlib` utilizado por el ejecutable de escritorio.

## Distribución

La preparación local solo desbloquea la prueba técnica. Antes de publicar Prisma se debe fijar el artefacto definitivo, verificar su procedencia, hashes, arquitectura, requisitos de CPU y licencias de mpv y de las bibliotecas incluidas.

La página oficial de instalación de mpv enumera las compilaciones disponibles para Windows y las instrucciones para compilarlo desde código fuente.
