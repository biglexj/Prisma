# Plan: Configuración de Atajos, Autorun y Bandeja del Sistema (System Tray) para Quick Look

## 1. Contexto y Objetivos

Añadir opciones completas de configuración y comportamiento del sistema para **Prisma Quick Look**:
- **Atajo Personalizable para Quick Look**:
  - Permitir elegir entre `Espacio` (por defecto), `Ctrl + Espacio`, `Alt + Espacio`, `Shift + Espacio` o `Desactivado`.
  - Configurable desde la sección de Configuración (`AppSettings.tsx`) y aplicado dinámicamente al hook de Windows en Rust sin reiniciar la app.
- **Bandeja del Sistema (System Tray / Barra de Tareas)**:
  - Icono de Prisma en el área de notificación de Windows (System Tray).
  - Menú contextual: "Mostrar Prisma", "Quick Look activo", "Configuración", "Salir".
  - Opción de "Minimizar a la bandeja al cerrar" para mantener el daemon de Quick Look activo en segundo plano sin estorbar en la barra de tareas.
  - Clic en el icono de la bandeja restaura la ventana principal.
- **Autorun / Inicio con Windows**:
  - Opción para arrancar Prisma automáticamente al encender el equipo (vía Registro de Windows `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`).
  - Detección del flag `--autostart` para iniciar en modo silencioso (oculto en la bandeja del sistema).
- **UI en Configuración (`AppSettings.tsx`)**:
  - Nueva tarjeta con controles Material 3 Expressive (switches, selector de atajos y descripciones claras).

---

## 2. Arquitectura de la Solución

### A. Backend Rust (`src-tauri`)
1. **Atajos en `keyboard_hook.rs`**:
   - Soporte para evaluar teclas modificadoras con `GetAsyncKeyState(VK_CONTROL)`, `GetAsyncKeyState(VK_MENU)`, `GetAsyncKeyState(VK_SHIFT)`.
   - Modos: `"space"`, `"ctrl_space"`, `"alt_space"`, `"shift_space"`, `"disabled"`.
   - Comando `quick_look_set_shortcut(shortcut: String)`.
2. **Autorun nativo (`src-tauri/src/infrastructure/autostart.rs`)**:
   - Lectura y escritura en el Registro de Windows (`HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`).
   - Comandos `autostart_get_status` y `autostart_set`.
3. **System Tray en `lib.rs`**:
   - `TrayIconBuilder` con menú contextual y eventos de clic.
   - Manejo de `WindowEvent::CloseRequested`: si "Cerrar a la bandeja" está activo, oculta la ventana principal en lugar de cerrar el proceso.

### B. Frontend React (`src/app/ui/AppSettings.tsx` y `useSystemSettings.ts`)
- Hook `useSystemSettings` para gestionar y persistir:
  - `quickLookShortcut` (`"space" | "ctrl_space" | "alt_space" | "shift_space" | "disabled"`)
  - `minimizeToTray` (`boolean`)
  - `autostart` (`boolean`)
- UI en `AppSettings.tsx` con diseño limpio Material 3 Expressive.

---

## 3. Fases de Ejecución

1. **Fase 1: Backend Rust — Modificadores de Atajo y Autorun en Registro**
2. **Fase 2: Backend Rust — System Tray y Gestión de Cierre a la Bandeja**
3. **Fase 3: Frontend — Hook `useSystemSettings` y UI en `AppSettings.tsx`**
4. **Fase 4: Validación y Pruebas Integrales**
