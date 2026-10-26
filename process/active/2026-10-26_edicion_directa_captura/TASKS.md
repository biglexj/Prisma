# Tareas

- [x] Retirar doble clic y actualizar los textos del badge informativo en `ScreenCaptureOverlay.tsx`.
- [x] Ajustar cursor de `.capture-target-box` a `crosshair` para sesión de imagen en `screen-capture.css` / componente.
- [x] Implementar captura inmediata de garabato en medio del marco (`pointerdown`, `pointermove`, `pointerup`) con soporte para habilitar herramientas al terminar o al hacer clic.
- [x] Asegurar que `handleConfirmToAnnotate` acepte e incorpore el trazo inicial en el historial sin parpadeos ni pérdidas de puntos.
- [x] Verificar atajos: `Ctrl+C` copia directo, `Enter` habilita herramientas sin garabato, `Esc` cancela.
- [x] Ejecutar suite de pruebas unitarias (`bun test`) y verificar compilación TypeScript (`bun run build`).
- [x] Documentar validaciones y resultados en `VALIDATION.md`.
