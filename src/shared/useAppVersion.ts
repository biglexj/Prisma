import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { APP_VERSION } from "./version";

/**
 * Versión real del paquete.
 *
 * La que viaja dentro del ejecutable manda: el valor de `version.ts` es solo
 * la copia de reserva para cuando la consulta al runtime no responde.
 */
export function useAppVersion(): string {
  const [version, setVersion] = useState(APP_VERSION);

  useEffect(() => {
    let active = true;
    void getVersion()
      .then((value) => {
        if (active && value) setVersion(value);
      })
      .catch(() => {
        // Sin runtime de Tauri se mantiene la copia local.
      });
    return () => {
      active = false;
    };
  }, []);

  return version;
}
