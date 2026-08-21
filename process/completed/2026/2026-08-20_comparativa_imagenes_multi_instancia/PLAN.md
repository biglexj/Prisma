# Proceso: Corrección de Cierre de Instancias y Modo Comparativa de Imágenes en Visor

## Contexto
El usuario reportó que al cerrar una instancia de visualización desacoplada, la ventana quedó abierta con un estado negro/vacío ("Listo para previsualizar"). Además, solicitó que cuando se trabaje con varias imágenes se puedan abrir múltiples instancias desacopladas o realizar comparativas directamente en el visor de imágenes (con un botón de comparativa en la barra superior para seleccionar otra imagen y visualizar comparaciones lado a lado, cortinilla o cuadrícula de hasta 6 imágenes según su esquema).

## Objetivos
1. Resolver el problema de cierre de instancias (añadir comando nativo en Rust `quick_look_close_window`, permisos de ventana en `capabilities/default.json` y flujo seguro en React).
2. Asegurar que "Abrir en otra instancia" permita abrir múltiples instancias independientes que se cierren limpiamente.
3. Crear el componente y modo de **Comparativa de Imágenes** (`ImageComparisonModal`) en `src/features/visual_library/ui/comparison/` con 4 modos: Lado a Lado, Cortinilla Deslizante (Split Slider), Cuadrícula 2 a 6 imágenes, y Alternancia Rápida A/B con zoom/pan sincronizado.
4. Integrar el botón "Comparar" en la barra superior del visor `ImageViewer` (atajo `C`) y en la cabecera de `QuickLook`.
