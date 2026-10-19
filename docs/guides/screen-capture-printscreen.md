# Guía: Liberar la tecla Impr Pant en Windows 11 para Prisma

En Windows 11 (versión 22H2 y posteriores), el sistema operativo intercepta por defecto la tecla **Impr Pant** (**PrintScreen**) a nivel del explorador de Windows para abrir la *Herramienta Recortes* (*Snipping Tool*), bloqueando que otras aplicaciones capturen este evento globalmente.

Si deseas que **Prisma** use la tecla **Impr Pant** con un solo toque, o prefieres evitar conflictos, tienes dos métodos para liberarla, además de una alternativa sin modificar el sistema.

---

## Método 1: Desde la Configuración de Windows (Recomendado)

1. Abre la **Configuración de Windows** presionando `Win + I`.
2. En la barra lateral izquierda, selecciona **Accesibilidad**.
3. En la sección *Interacción*, haz clic en **Teclado**.
4. Busca la opción **«Usar el botón Impr Pant para abrir Recortes de pantalla»** (o *«Use the Print screen button to open screen snipping»*).
5. Cambia el interruptor a **Desactivado**.

---

## Método 2: Mediante el Registro de Windows (Regedit)

Si prefieres automatizarlo o configurarlo mediante el registro:

1. Presiona `Win + R`, escribe `regedit` y presiona **Enter**.
2. Navega a la siguiente clave:
   ```text
   HKEY_CURRENT_USER\Control Panel\Keyboard
   ```
3. Localiza el valor DWORD (32 bits) denominado:
   ```text
   PrintScreenKeyForSnippingEnabled
   ```
   *(Si no existe, créalo como un nuevo valor DWORD de 32 bits).*
4. Haz doble clic y establece su información de valor en **`0`** (Base: Hexadecimal o Decimal).
5. Reinicia el proceso `explorer.exe` desde el Administrador de tareas o reinicia tu sesión de usuario.

### Comando rápido en PowerShell (Ejecutar como Administrador si es necesario):
```powershell
Set-ItemProperty -Path "HKCU:\Control Panel\Keyboard" -Name "PrintScreenKeyForSnippingEnabled" -Value 0 -Type DWord
Stop-Process -Name explorer -Force
```

---

## Alternativa nativa sin modificar el sistema

Si prefieres no alterar los ajustes de Windows, en **Prisma > Configuración > Capturador de Pantalla**:

- Selecciona el atajo global **Mayús + Impr Pant** (`Shift + PrintScreen`).
- Esta combinación nunca entra en conflicto con Windows 11 y se activa instantáneamente desde cualquier juego, navegador o aplicación en pantalla completa.
