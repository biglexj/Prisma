# Proceso: Rediseño de Prisma Upscaler y Variantes de Color de Fondo — Plan

- Estado: `IN_PROGRESS`
- Fecha: `2026-09-14`
- Proyecto: `Prisma`
- Propietario: `biglexj`

## Diagnóstico y Objetivos

1. **Rediseño de la Vista Prisma Upscaler (`PrismaUpscalerView.tsx`)**:
   - La implementación previa ocupaba demasiado espacio vertical con 3 tarjetas gigantes de modelos apiladas.
   - Adoptar el diseño probado y práctico de `prisma-upscaler` (`D:\Proyectos\biglexj\prisma-upscaler\desktop`):
     - Selector compacto de modelo con tarjeta interactiva (Icono + Nombre + Descripción + Flecha `>`).
     - Modal especializado `ModelSelectModal.tsx` para explorar y seleccionar modelos con tarjetas categorizadas (Anime, Foto, Nitidez, Compacto).
     - Botonera compacta de factores de escala (2x, 3x, 4x).
     - DropZone interactiva con soporte de Drag & Drop, pegado desde portapapeles (Ctrl+V) y previsualización de imagen seleccionada.
     - Botón principal de lanzamiento claro y destacado.

2. **Variantes de Color de Fondo (Background Variants)**:
   - Permitir al usuario elegir entre 3 variantes del color de fondo de la aplicación:
     1. **Tonal Prisma (Predeterminado)**: Tono cálido ciruela-carbón Material 3 característico de Prisma (`#1b1216` / `#140d10`).
     2. **Gris Neutro (Oscuro Clásico)**: Fondo grisáceo neutro tipo zinc/slate (`#121214` / `#18181b`).
     3. **Miku Code**: Color base azul profundo nocturno extraído del tema oficial de VS Code en `D:\Proyectos\4. Temas\3. VS Code\miku-code` (`#16161e` / `#1a1b26`).
   - Integración en `useTheme.ts` con persistencia en `localStorage` (`prisma_bg_variant`) y atributo HTML `data-bg`.
   - Ajuste de selectores en `styles.css`.
   - Selector visual en `AppSettings.tsx` (Configuración -> Apariencia).

## Criterios de Finalización

- [ ] Selector compacto de modelo y modal `ModelSelectModal.tsx` integrado en `PrismaUpscalerView.tsx`.
- [ ] DropZone funcional con Drag & Drop, selección y pegado de imagen.
- [ ] Soporte de variantes de fondo `prisma`, `neutral` y `miku` en `useTheme.ts` y `styles.css`.
- [ ] Selector de Variante de Fondo añadido a la sección de Apariencia en `AppSettings.tsx`.
- [ ] Compilación exitosa con `bun run build`.
- [ ] Commit de resguardo en la rama `preview`.
