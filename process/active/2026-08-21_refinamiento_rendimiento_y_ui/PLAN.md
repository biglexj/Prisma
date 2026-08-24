# Refinamiento de rendimiento y UI de Prisma

- Estado: `IMPLEMENTED_V1.0.5_PREPARED`
- Fecha: `2026-08-21`
- Rama: `preview`
- Contrato y autorización Aurora en servidor: trabajo externo; adaptación defensiva del cliente incluida

## Objetivo

Reducir la carga agresiva al iniciar Prisma, impedir que los estantes de Inicio cambien de posición durante la hidratación y unificar los estados interactivos más visibles sin alterar la identidad cromática vigente.

## Alcance aprobado

1. Carga escalonada de fuentes y elementos multimedia.
2. Posiciones estables y esqueletos coherentes en Inicio.
3. Presupuesto por bytes para miniaturas visuales.
4. State layers, foco visible y movimiento reducido en Inicio y Wallpapers.
5. Filtros de categorías derivados del catálogo real.
6. Defensa local para impedir acciones sobre wallpapers no autorizados.
7. Visor adaptable a la proporción natural del wallpaper, sin bandas internas laterales ni superiores.
8. Cliente de wallpapers alineado con las bases Core de Aurora: API `/api/v1`, contrato normalizado, autenticación opcional y degradación controlada.
9. Compatibilidad con respuestas seguras que omitan la URL HD de recursos Fan no autorizados.
10. Respeto estricto de títulos y artistas incrustados en Música, sin volver a separar títulos válidos por guiones.
11. Centralización del icono web en `public` y generación de sus derivados nativos para Tauri.
12. Sincronización automática de los consumidores nativos del icono antes de desarrollo y empaquetado.

## Fuera de alcance

- Modificar AuroraHub o su base de datos.
- Diseñar o desplegar el contrato Fan en Aurora.
- Incorporar contenido para mayores de edad.
- Cambiar la paleta de Prisma.
- Introducir SQLite o persistir vistas previas.

## Puertas

- `G1`: build TypeScript correcto y carga escalonada sin errores.
- `G2`: Inicio conserva el orden de estantes durante la carga.
- `G3`: estados hover, foco y movimiento reducido funcionan en claro y oscuro.
- `G4`: wallpapers no autorizados no pueden abrirse en HD, descargarse ni aplicarse desde Prisma.
- `G6`: Prisma acepta catálogos autenticados o públicos sin asumir que `src` siempre existe y conserva Synapse solo para el traspaso entre aplicaciones.
- `G7`: biblioteca, cola y reproductor comparten título y artista desde una única resolución de metadatos.

## Resultado

- `G1`: superada con `npm run build`.
- `G2`: superada mediante fuentes rápidas, estantes reservados y escaneos serializados. La revisión nativa confirmó el orden final; no se realizó una captura cuadro a cuadro del arranque.
- `G3`: superada mediante tokens semánticos, equivalencia de foco y soporte de movimiento reducido; revisión visual nativa realizada en modo oscuro.
- `G4`: superada en el cliente. La prueba real mostró “Biglex y Ely” como Fan Exclusivo y deshabilitó Móvil, Descargar HD y Establecer como Fondo.
- `G5`: superada con Mahuyu (`864 x 1184`): el ancho del modal siguió la proporción natural, sin bandas internas, y conservó todas las acciones visibles.
- `G6`: implementada en el cliente. El catálogo usa el endpoint web versionado, normaliza respuestas/errores, intenta autenticación Bearer con degradación pública y bloquea acciones cuando Aurora no entrega `src`.
- `G7`: implementada. El escáner identifica cuándo el título proviene de una etiqueta y las vistas de Música conservan esos metadatos como fuente de verdad; el parser `Artista - Título` queda solo como respaldo del nombre de archivo.

El contrato de autorización de Aurora continúa fuera de este proceso y debe seguir resolviéndose en el servidor.

## Preparación de versión

- Versión candidata: `1.0.5`.
- Manifiestos, versión visible, notas de lanzamiento y mensaje público sincronizados.
- Biglex confirmó el `2026-08-24` que v1.0.4 ya fue publicada; no debe reemplazarse ni reutilizarse.
- La instalación limpia y la publicación remota de v1.0.5 requieren una orden posterior de lanzamiento.
- El instalador `1.0.5` fue generado e inspeccionado el `2026-08-24`; ejecutable, instalador y ventana nativa consumen el icono blanco sincronizado.
