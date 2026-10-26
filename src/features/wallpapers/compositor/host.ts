/** Adaptador desktop del compositor Aurora; un solo contexto WebGL por escritorio. */
import * as THREE from "three";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { LayeredBackgroundComposer } from "./aurora/LayeredBackgroundComposer";
import { createBackgroundEffect, type DynamicBackground } from "./aurora/index";
import { DEFAULT_BACKGROUND_CONTROLS, type BackgroundControls } from "./aurora/controls";
import { supportsBackgroundCamera } from "./aurora/catalog";
import { BackgroundProjection, bindBackgroundHue } from "./aurora/BackgroundProjection";
import type { AmbientTheme } from "./aurora/Backgrounds/themes";
import { getLayerControls, normalizeComposition, type CompositionConfig } from "./config";
import type { ParticleLayerProps } from "./aurora/particles/ParticleLayer";

/** Estado de la capa 6 (partículas 2D) que se dibuja sobre el lienzo. */
export interface OverlayState {
  shape: NonNullable<ParticleLayerProps["shape"]>;
  direction: NonNullable<ParticleLayerProps["direction"]>;
  color: string;
  size: number;
  density: number;
  speed: number;
  opacity: number;
  paused: boolean;
  intensity: number;
}
export interface CompositionHostOptions {
  /** Publica la capa 6; null cuando la capa está apagada. */
  onOverlay?: (state: OverlayState | null) => void;
}

export function mountComposition(root: HTMLElement, options: CompositionHostOptions = {}): { dispose(): void } {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  const backdrop = document.createElement("div");
  Object.assign(backdrop.style, {position:"absolute",inset:"0",pointerEvents:"none"});
  root.appendChild(backdrop);
  renderer.domElement.style.position = "relative";
  root.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.z = 5;
  const composer = new LayeredBackgroundComposer(camera, renderer);
  let foreground = new THREE.Scene();
  let particle: DynamicBackground | null = null;
  let particleProjection: BackgroundProjection | null = null;
  let particleTime = 0;
  const particleHue = { value: 0 };
  let particleVersion = 0;
  /** Capa 3: fondo plano de pantalla completa, entre el ambiente y el escenario. */
  let dynamicEffect: DynamicBackground | null = null;
  let dynamicProjection: BackgroundProjection | null = null;
  let dynamicScene = new THREE.Scene();
  let dynamicTime = 0;
  const dynamicHue = { value: 0 };
  let dynamicVersion = 0;
  let config: CompositionConfig | null = null;
  let disposed = false;
  let raf = 0;
  let last = performance.now();
  let lastDraw = 0;
  let selected = "", selectedParticle = "", selectedDynamic = "";
  let unlisten: UnlistenFn | undefined;
  let polling = false, pointerPolling = false, clickPolling = false, clickFailed = false;
  const clickRay = new THREE.Raycaster(), clickPlane = new THREE.Plane(new THREE.Vector3(0,0,1),0), clickPoint = new THREE.Vector3();
  const targetPointer = new THREE.Vector2(), pointer = new THREE.Vector2(), zeroPointer = new THREE.Vector2();
  const layerPointers = {ambient:new THREE.Vector2(),dynamic:new THREE.Vector2(),scene:new THREE.Vector2(),particles:new THREE.Vector2()};
  let overlaySignature = "";

  const report = (error: unknown) => {
    const message = `No se pudo renderizar el efecto: ${String(error)}`;
    console.error(message);
    void emit("prisma://compositor-error", message).catch(() => {});
  };
  function controls(layer: "ambient" | "dynamic" | "scene" | "particles"): BackgroundControls {
    if (!config) return { ...DEFAULT_BACKGROUND_CONTROLS, clickEffect: "off", paused: true };
    const value = getLayerControls(config, layer);
    const type = layer === "scene" ? config.scenario : layer === "particles" ? config.particle
      : layer === "dynamic" ? config.dynamic : "ambient";
    const shift = config.parallax.enabled && supportsBackgroundCamera(type) ? config.parallax.strength : 0;
    if (!config.paused && !value.paused) layerPointers[layer].copy(pointer);
    const position = layerPointers[layer];
    return { ...DEFAULT_BACKGROUND_CONTROLS, ...value, clickEffect: "off", clickTrail: false,
      panX: value.panX + position.x * shift, panY: value.panY + position.y * shift,
      paused: config.paused || value.paused };
  }
  /** Publica la capa 6 solo cuando cambia algo: el lienzo se redibuja en cada cuadro. */
  function publishOverlay() {
    const overlay = config?.overlay;
    const active = !!config?.enabled && !!overlay?.enabled;
    const signature = active ? JSON.stringify([overlay.shape, overlay.direction, overlay.color,
      overlay.size, overlay.density, overlay.speed, overlay.opacity, overlay.paused, config?.paused, config?.intensity]) : "";
    if (signature === overlaySignature) return;
    overlaySignature = signature;
    options.onOverlay?.(active ? {
      shape: overlay.shape, direction: overlay.direction, color: overlay.color,
      size: overlay.size, density: overlay.density, speed: overlay.speed,
      opacity: overlay.opacity, paused: overlay.paused || !!config?.paused, intensity: config?.intensity ?? 0.5,
    } : null);
  }
  const resize = () => {
    const width = Math.max(root.clientWidth, 1), height = Math.max(root.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.onResize(width, height);
    particle?.onResize?.(width, height);
    dynamicEffect?.onResize?.(width, height);
    paint(performance.now());
  };
  function paint(time: number) {
    if (disposed) return;
    cancelAnimationFrame(raf);
    raf = 0;
    const delta = Math.min(Math.max((time - last) / 1000, 0), 0.1);
    last = time;
    if (!config?.enabled) { renderer.clear(); return; }
    pointer.lerp(config.parallax.enabled ? targetPointer : zeroPointer, 1 - Math.exp(-delta * 5));
    const ambient = controls("ambient"), dynamic = controls("dynamic"), scene = controls("scene"), particles = controls("particles");
    const flatAmbient = config.ambient === "solid" || config.ambient === "gradient";
    const ambientVisible = config.visibility.ambient && config.ambient !== "original" && !flatAmbient;
    backdrop.style.background = config.ambient === "gradient"
      ? `linear-gradient(135deg,${config.ambientColor},${config.ambientColor2})` : config.ambientColor;
    backdrop.style.opacity = String(config.ambientOpacity);
    backdrop.hidden = !config.visibility.ambient || !flatAmbient;
    const dynamicVisible = config.visibility.dynamic && dynamicEffect !== null;
    const scenarioVisible = config.visibility.scenario && config.scenario !== "none";
    const particlesVisible = config.visibility.particles && particle !== null;
    try {
      composer.update(delta, { ambient: { ...ambient, ambient: config.ambient as AmbientTheme },
        scenario: scene, ambientVisible, scenarioVisible, reducedMotion: false,
        intensity: config.intensity, fusion: true });
      if (dynamicVisible) {
        const dt = dynamic.paused ? 0 : delta * dynamic.speed;
        dynamicTime += dt;
        dynamicHue.value = dynamic.colorCycle ? dynamicTime * 0.55 : 0;
        dynamicProjection?.update(dynamic, dynamicTime, dt);
        dynamicEffect?.setControls?.(dynamic);
        dynamicEffect?.update(dt, config.intensity, dynamicTime, true);
      }
      foreground.visible = particlesVisible;
      if (particlesVisible) {
        const dt = particles.paused ? 0 : delta * particles.speed;
        particleTime += dt;
        particleHue.value = particles.colorCycle ? particleTime * 0.55 : 0;
        particleProjection?.update(particles, particleTime, dt);
        particle?.setControls?.(particles);
        particle?.update(dt, config.intensity, particleTime, true);
      }
      composer.render(foreground, dynamicVisible ? dynamicScene : undefined);
      publishOverlay();
      if (!config.paused && ((ambientVisible && !ambient.paused) || (dynamicVisible && !dynamic.paused)
        || (scenarioVisible && !scene.paused) || (particlesVisible && !particles.paused))) {
        raf = requestAnimationFrame(frame);
      }
    } catch (error) { report(error); }
  }
  // Los efectos decorativos se limitan a 30 fps; la reproducción mpv conserva su cadencia.
  function frame(time: number) {
    if (disposed) return;
    if (time - lastDraw < 1000 / 30 - 0.5) { raf = requestAnimationFrame(frame); return; }
    lastDraw = time;
    paint(time);
  }
  async function selectParticle(type: string) {
    const version = ++particleVersion;
    const next = type === "none" ? null : await createBackgroundEffect(type);
    if (disposed || version !== particleVersion) { next?.dispose(); return; }
    const nextScene = new THREE.Scene();
    try {
      next?.setControls?.(controls("particles"));
      next?.init(nextScene, camera, renderer);
    } catch (error) { next?.dispose(); throw error; }
    particle?.dispose();
    foreground = nextScene;
    particle = next;
    particleProjection = next && !next.setControls ? new BackgroundProjection([...foreground.children], camera, type) : null;
    if (particleProjection) foreground.add(particleProjection.group);
    renderer.domElement.dataset.particleBackground = type;
    particleTime = 0;
    bindBackgroundHue(foreground.children, particleHue);
    particle?.onResize?.(Math.max(root.clientWidth, 1), Math.max(root.clientHeight, 1));
  }
  /** Capa 3: fondo plano. Vive en su propia escena, entre el ambiente y el escenario. */
  async function selectDynamic(type: string) {
    const version = ++dynamicVersion;
    const next = type === "none" ? null : await createBackgroundEffect(type);
    if (disposed || version !== dynamicVersion) { next?.dispose(); return; }
    const nextScene = new THREE.Scene();
    try {
      next?.setControls?.(controls("dynamic"));
      next?.init(nextScene, camera, renderer);
    } catch (error) { next?.dispose(); throw error; }
    dynamicEffect?.dispose();
    dynamicScene = nextScene;
    dynamicEffect = next;
    dynamicProjection = next && !next.setControls ? new BackgroundProjection([...dynamicScene.children], camera, type) : null;
    if (dynamicProjection) dynamicScene.add(dynamicProjection.group);
    renderer.domElement.dataset.flatBackground = type;
    dynamicTime = 0;
    bindBackgroundHue(dynamicScene.children, dynamicHue);
    dynamicEffect?.onResize?.(Math.max(root.clientWidth, 1), Math.max(root.clientHeight, 1));
  }
  async function apply(input: CompositionConfig) {
    if (disposed) return;
    const next = normalizeComposition(input);
    if (config && JSON.stringify(next) === JSON.stringify(config)) return;
    config = next;
    clickFailed = false;
    const tasks: Promise<unknown>[] = [];
    if (selected !== next.scenario) {
      selected = next.scenario;
      tasks.push(composer.selectScenario(next.scenario, controls("scene")));
    }
    if (selectedParticle !== next.particle) {
      selectedParticle = next.particle;
      tasks.push(selectParticle(next.particle));
    }
    if (selectedDynamic !== next.dynamic) {
      selectedDynamic = next.dynamic;
      tasks.push(selectDynamic(next.dynamic));
    }
    const results = await Promise.allSettled(tasks);
    if (disposed) return;
    for (const result of results) if (result.status === "rejected") report(result.reason);
    composer.onResize(Math.max(root.clientWidth, 1), Math.max(root.clientHeight, 1));
    paint(performance.now());
  }
  void listen<CompositionConfig>("prisma://compositor-config", event => { void apply(event.payload); })
    .then(off => { if (disposed) off(); else unlisten = off; }).catch(report);
  const refresh = async () => {
    if (disposed || polling) return;
    polling = true;
    try { await apply(await invoke<CompositionConfig>("live_wallpaper_compositor_config_get")); }
    catch (error) { if (!disposed) report(error); }
    finally { polling = false; }
  };
  const timer = window.setInterval(() => { void refresh(); }, 800);
  const clickTimer = window.setInterval(() => {
    if (disposed || clickPolling || clickFailed || !config?.enabled || config.paused) return;
    const active = config.visibility.particles && !controls("particles").paused && ["bubbles","morphclick"].includes(config.particle);
    if (!active) return;
    clickPolling = true;
    const type = config.particle;
    void invoke<[number,number][]>("live_wallpaper_compositor_clicks").then(clicks => {
      if (disposed || !config?.enabled || config.paused || config.particle !== type || !config.visibility.particles || controls("particles").paused) return;
      camera.updateMatrixWorld();
      for (const [x,y] of clicks) {
        clickRay.setFromCamera(new THREE.Vector2(x,y),camera);
        if (clickRay.ray.intersectPlane(clickPlane,clickPoint)) particle?.onClick?.(clickPoint);
      }
    }).catch(error => { clickFailed = true; report(error); }).finally(() => { clickPolling = false; });
  },50);
  const pointerTimer = window.setInterval(() => {
    if (disposed || pointerPolling || !config?.enabled || config.paused || !config.parallax.enabled) return;
    pointerPolling = true;
    void invoke<[number, number]>("live_wallpaper_compositor_pointer").then(value => {
      if (!disposed) targetPointer.set(value[0], value[1]);
    }).catch(() => {}).finally(() => { pointerPolling = false; });
  }, 50);
  window.addEventListener("resize", resize);
  resize();
  void refresh();
  return { dispose() {
    if (disposed) return;
    disposed = true;
    ++particleVersion;
    ++dynamicVersion;
    clearInterval(timer);
    clearInterval(pointerTimer);
    clearInterval(clickTimer);
    cancelAnimationFrame(raf);
    unlisten?.();
    window.removeEventListener("resize", resize);
    particle?.dispose();
    dynamicEffect?.dispose();
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    backdrop.remove();
  } };
}
