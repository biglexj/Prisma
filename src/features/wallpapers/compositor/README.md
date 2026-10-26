# Composición Aurora en Prisma

La primera integración usa el ambiente y los efectos Prisma, Borealis y Holo Ciudad de Aurora.
El motor vive en `compositor.html`; la UI principal solo importa el contrato y
sus etiquetas. Fondos 3D permite activar escenarios sin una carpeta de medios, detrás de los iconos.

`aurora/` es código vendorizado del proyecto de Biglex `Aurora---Blog`, no de
`antwny/aura`. `provenance.json` registra ruta y SHA-256 de cada original.

Actualizar explícitamente con `bun scripts/sync-aurora-wallpapers.ts` desde la
raíz de Prisma, teniendo Aurora en la carpeta vecina. El script recorre las
dependencias del subconjunto y registra las adaptaciones: cargador limitado,
capacidades del catálogo limitado y controles sin store React. Los builds no
leen Aurora ni ejecutan la sincronización. No modificar los archivos generados
manualmente: cualquier adaptación se mantiene en el script.

Three.js usa la versión 0.185.1 observada en la instalación Aurora revisada.
Sus avisos están en el paquete instalado y en `THREE-LICENSE.txt`.

Configuración de ambiente y escenario guardada en `live_wallpapers.json`.
La activación de la composición es manual en esta entrega; no se restaura al
arrancar. No se solicita captura de audio ni se genera audioLevel simulado.
Partículas independientes, ecualizador del audio del vídeo y parallax del
cursor siguen pendientes. La pausa cancela el bucle WebGL y el cierre libera
renderizador, recursos y listeners; animación, pausa y cierre verificados en WebView2 nativo; recuperación de Explorer y consumo sostenido siguen pendientes.
