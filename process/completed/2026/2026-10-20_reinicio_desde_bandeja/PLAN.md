# Reinicio desde la bandeja

Biglex informa que «Reiniciar Prisma» no produce el reinicio esperado y autoriza corregirlo.

Sustituir el relanzamiento manual mediante PowerShell oculto por `AppHandle::request_restart`. La llamada debe regresar al bucle principal, ejecutar el cierre de audio y el plugin de instancia única, limpiar las ventanas y relanzar el mismo ejecutable conservando sus argumentos. No modificar la instalación ni publicar una versión.

Validar compilación nativa y el botón real: comprobar que termina el PID anterior y aparece un proceso nuevo, sin duplicados. Registrar por separado lo comprobado en Dev y cualquier cobertura pendiente de la instalación.
