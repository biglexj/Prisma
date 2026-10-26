import { invoke } from "@tauri-apps/api/core";
import type { EcosystemApp, EcosystemAppState } from "./ecosystemApps";

/**
 * Puente con el backend que detecta y lanza las aplicaciones del ecosistema.
 *
 * El backend expone `ecosystem_apps_state` y `ecosystem_app_launch`
 * (src-tauri/src/app/commands/ecosystem.rs). Sólo devuelve estado de las
 * aplicaciones de escritorio: las móviles, como Super Gallery, no se instalan
 * en Windows.
 */

/** Estado de todas las apps del ecosistema, indexado por identificador. */
export async function fetchEcosystemAppStates(): Promise<Record<string, EcosystemAppState>> {
  const list = await invoke<EcosystemAppState[]>("ecosystem_apps_state");
  if (!Array.isArray(list)) return {};
  return Object.fromEntries(list.map((item) => [item.id, item]));
}

export type EcosystemLaunchResult = "launched" | "opened";

/**
 * Abre una app del ecosistema.
 *
 * Si está instalada en el equipo se lanza el ejecutable; si no, se abre su
 * ficha en la web. Si el arranque falla, se cae a la ficha en lugar de dejar
 * al usuario con un botón que no hace nada.
 */
export async function launchEcosystemApp(
  app: EcosystemApp,
  state?: EcosystemAppState,
): Promise<EcosystemLaunchResult> {
  if (!state?.installed) {
    await invoke("open_external_url", { url: app.linkUrl });
    return "opened";
  }

  try {
    const launched = await invoke<boolean>("ecosystem_app_launch", { id: app.id });
    if (launched) return "launched";
  } catch (error) {
    console.error(`No se pudo iniciar ${app.name}:`, error);
  }

  await invoke("open_external_url", { url: app.linkUrl });
  return "opened";
}
