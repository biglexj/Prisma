/** Adaptador desktop del compositor Aurora. No importa React ni servicios online. */
import * as THREE from "three";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { LayeredBackgroundComposer } from "./aurora/LayeredBackgroundComposer";
import { DEFAULT_BACKGROUND_CONTROLS } from "./aurora/controls";
import type { AmbientTheme } from "./aurora/Backgrounds/themes";
import type { CompositionConfig } from "./config";

export function mountComposition(root: HTMLElement): { dispose(): void } {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  root.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.z = 5;
  const composer = new LayeredBackgroundComposer(camera, renderer);
  const foreground = new THREE.Scene();
  let config: CompositionConfig | null = null;
  let disposed = false;
  let raf = 0;
  let last = performance.now();
  let selected = "";
  let unlisten: UnlistenFn | undefined;
  let polling = false;

  const controls = () => ({ ...DEFAULT_BACKGROUND_CONTROLS, clickEffect: "off" as const,
    clickTrail: false, paused: config?.paused ?? true });
  const resize = () => {
    const width = Math.max(root.clientWidth, 1), height = Math.max(root.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.onResize(width, height);
    paint(performance.now());
  };
  function paint(time: number) {
    if (disposed) return;
    cancelAnimationFrame(raf);
    raf = 0;
    const delta = Math.min(Math.max((time - last) / 1000, 0), 0.1);
    last = time;
    if (config?.enabled) {
      composer.update(delta, { ambient: { ...controls(), ambient: config.ambient as AmbientTheme },
        scenario: controls(), ambientVisible: config.ambient !== "original",
        scenarioVisible: config.scenario !== "none", reducedMotion: false,
        intensity: config.intensity, fusion: true });
      composer.render(foreground);
      if (!config.paused) raf = requestAnimationFrame(paint);
    } else renderer.clear();
  }
  async function apply(next: CompositionConfig) {
    if (disposed) return;
    if (config && JSON.stringify(next) === JSON.stringify(config)) return;
    config = next;
    if (selected !== next.scenario) {
      selected = next.scenario;
      try { await composer.selectScenario(next.scenario, controls()); }
      catch (error) { console.error("No se pudo cargar el efecto Aurora", error); }
      if (disposed) return;
      composer.onResize(Math.max(root.clientWidth, 1), Math.max(root.clientHeight, 1));
    }
    paint(performance.now());
  }
  // Registrar antes de pedir estado: no se pierde la configuración durante la carga.
  void listen<CompositionConfig>("prisma://compositor-config", event => { void apply(event.payload); })
    .then(off => { if (disposed) off(); else unlisten = off; })
    .catch(error => console.error("No se pudo escuchar la composición", error));
  const refresh = async () => {
    if (disposed || polling) return;
    polling = true;
    try { await apply(await invoke<CompositionConfig>("live_wallpaper_compositor_config_get")); }
    catch (error) { if (!disposed) console.error("Estado de composición no disponible", error); }
    finally { polling = false; }
  };
  // Respaldo para pausa desde bandeja y para el estado inicial del webview.
  const timer = window.setInterval(() => { void refresh(); }, 800);
  window.addEventListener("resize", resize);
  resize();
  void refresh();
  return { dispose() {
    if (disposed) return;
    disposed = true;
    clearInterval(timer);
    cancelAnimationFrame(raf);
    unlisten?.();
    window.removeEventListener("resize", resize);
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  } };
}
