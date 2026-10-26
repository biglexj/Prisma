/** Sincronización explícita, nunca durante build. No modifica Aurora. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const source = resolve(import.meta.dir, "../../Aurora---Blog/frontend/src/features/Comunidad/EspacioVtuber/islands/three/dynamic-backgrounds");
const target = resolve(import.meta.dir, "../src/features/wallpapers/compositor/aurora");
const visited = new Set<string>();
const manifest: Record<string, string> = {};

function copy(file: string) {
  if (visited.has(file)) return;
  visited.add(file);
  const original = readFileSync(resolve(source, file), "utf8");
  manifest[file] = createHash("sha256").update(original).digest("hex");
  let content = original.replaceAll('\r\n', '\n');
  if (file === 'LayeredBackgroundComposer.ts') {
    content = content.replace('render(foreground: THREE.Scene): void', 'render(foreground: THREE.Scene, dynamic?: THREE.Scene): void');
    content = content.replace('if (this.scenarioScene.visible && this.effect)',
      'if (dynamic?.visible) this.renderer.render(dynamic, this.camera);\n        this.renderer.clearDepth();\n        if (this.scenarioScene.visible && this.effect)');
    // Inicializar fuera de la escena visible para conservar el efecto anterior si falla.
    content = content.replace('effect.init(this.scenarioScene, this.camera, this.renderer);',
      'const staged = new THREE.Scene();\n            effect.init(staged, this.camera, this.renderer);');
    content = content.replace('previous?.dispose();\n            this.projection?',
      'previous?.dispose();\n            this.scenarioScene.clear();\n            this.scenarioScene.add(...staged.children);\n            this.projection?');
    content = content.replace('effect.dispose();\n            this.scenarioScene.clear();\n            throw error;', 'effect.dispose();\n            throw error;');
  }
  if (file === "controls.ts") {
    content = (original.slice(0, original.indexOf("const KEY =")) + original.slice(original.indexOf("export function normalizeBackgroundControls"), original.indexOf("function readSettings")))
      .replace(/^import .*from 'react';\r?\n/m, "")
;
  }
  const destination = resolve(target, file.replace(/\.js$/, '.ts'));
  // Aurora mantiene algunas fábricas como JS sin checkJs. Se conserva su lógica.
  if (file.endsWith('.js')) content = '// @ts-nocheck — fábrica JavaScript original de Aurora\n' + content;
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `// Sincronizado desde Aurora. Ejecutar scripts/sync-aurora-wallpapers.ts para actualizar.\n${content}`.replace(/[ \t]+(?=\r?$)/gm, ''));
  const imports = content.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of imports.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)) {
    let dependency = resolve(dirname(resolve(source, file)), match[1]);
    if (dependency.endsWith(".js") && existsSync(dependency.slice(0, -3) + '.ts')) dependency = dependency.slice(0, -3) + ".ts";
    if (!/\.(ts|js)$/.test(dependency)) dependency += ".ts";
    if (!dependency.startsWith(source + "/") && !dependency.startsWith(source + "\\")) throw new Error("Import fuera de Aurora: " + dependency);
    if (!existsSync(dependency)) throw new Error("Import no resuelto: " + dependency);
    copy(relative(source, dependency).replaceAll("\\", "/"));
  }
}
copy("LayeredBackgroundComposer.ts");
const overlaySource = readFileSync(resolve(source, '../../particles/ParticleLayer.tsx'),'utf8');
let overlayCode = overlaySource.replaceAll('\r\n','\n')
  .replace(/import type \{ ParticleShape, ParticleDirection \} from [^;]+;/,
    'type ParticleShape = "tech"|"circle"|"star"|"heart"|"square"|"diamond"|"sparkle"|"ripple"|"digits"|"bubble"|"petal"|"note"|"snow";\ntype ParticleDirection="down"|"up"|"float";')
  .replace('function drawShape(', 'export function drawShape(')
  .replace('const pausedRef = useRef(paused);', 'const pausedRef = useRef(paused);\n    const resumeRef = useRef<(() => void) | null>(null);')
  .replace('useEffect(() => { pausedRef.current = paused; }, [paused]);',
    'useEffect(() => { pausedRef.current = paused; if (paused) cancelAnimationFrame(frameRef.current); else resumeRef.current?.(); }, [paused]);')
  .replace('        animate();','        resumeRef.current = () => { lastFrame=performance.now();cancelAnimationFrame(frameRef.current);frameRef.current=requestAnimationFrame(animate); };\n        animate();')
  .replace('frameRef.current = requestAnimationFrame(animate);','if (!pausedRef.current) frameRef.current = requestAnimationFrame(animate);')
  .replace('            cancelAnimationFrame(frameRef.current);','            resumeRef.current=null;\n            cancelAnimationFrame(frameRef.current);')
  .replace('data-vtuber-particles data-layer="5"','data-wallpaper-overlay-particles');
mkdirSync(resolve(target,'particles'),{recursive:true});
writeFileSync(resolve(target,'particles/ParticleLayer.tsx'), ('// Adaptación de Aurora; regenerar con sync-aurora-wallpapers.ts.\n'+overlayCode).replace(/[ \t]+(?=\r?$)/gm, ''));
writeFileSync(resolve(target, "provenance.json"), JSON.stringify({
  source: "Aurora---Blog/frontend/src/features/Comunidad/EspacioVtuber/islands/three/dynamic-backgrounds",
  adaptations: ["controls.ts: tipos, valores y normalización sin store React", "fábricas JS: extensión TS sin checkJs; lógica original", "LayeredBackgroundComposer.ts: inicialización transaccional y escena dinámica intermedia", "ParticleLayer.tsx: tipos locales, pausa sin RAF y atributo de escritorio", "normalización de finales de línea y espacios finales"],
  sha256: manifest,
  external: { 'particles/ParticleLayer.tsx': {source:'../../particles/ParticleLayer.tsx',sha256:createHash('sha256').update(overlaySource).digest('hex')} },
}, null, 2) + "\n");
console.log(`Aurora: ${visited.size} archivos sincronizados.`);

const { DYNAMIC_BACKGROUNDS, DYNAMIC_BACKGROUND_GROUPS, supportsBackgroundCamera } = await import(pathToFileURL(resolve(source, 'catalog.ts')).href);
const { PARTICLE_BACKGROUNDS } = await import(pathToFileURL(resolve(source, 'particleScenes.ts')).href);
const particles = new Set(PARTICLE_BACKGROUNDS.map((item: { type: string }) => item.type));
const catalog = DYNAMIC_BACKGROUNDS.map((item: {type:string;label:string;desc:string}) => ({
  type: item.type, label: item.label,
  description: item.desc.replace(/reactiv[ao]s? a la voz/g, 'con movimiento procedural').replace('Fluido interactivo reactivo al ratón', 'Fluido procedural con remolinos'),
  category: particles.has(item.type) ? 'particles' : supportsBackgroundCamera(item.type) ? '3d' : 'dynamic',
  uiGroup: DYNAMIC_BACKGROUND_GROUPS.find((group: {backgrounds:{type:string}[]}) => group.backgrounds.some(background => background.type === item.type))?.label === 'Escenas principales' ? 'Escenarios 3D' : 'Efectos 3D',
  spatial: supportsBackgroundCamera(item.type),
  preview: `/wallpapers/scenes/${item.type}.webp`,
}));
writeFileSync(resolve(target, '../catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
