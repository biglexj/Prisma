# Validación

Las seis copias originales tenían el mismo SHA-256. Se ejecutó sync-ecosystem.ps1 tras editar el maestro. Comprobación de cinco vistas: ninguna contiene su propio HostAppId; las cuatro vistas públicas no contienen Aurora Hub. Todos los registros generados tienen ambas descripciones. El maestro conserva 18 registros.

Prisma presenta 13 aplicaciones ejecutables ajenas; sus identificadores de escritorio coinciden con el detector del backend. PASS final: siete pruebas de catálogo, 96 aserciones, y `bun run build` (TypeScript y Vite). El contador excluye estados de aplicaciones ausentes de la vista. Diff-check aprobado.

No se ha comprobado la interfaz de una app instalada ni se han actualizado sus binarios. Los demás consumidores han recibido datos generados; no se afirma compilación o validación funcional de esos proyectos.
