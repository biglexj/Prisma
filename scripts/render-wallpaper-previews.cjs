/**
 * Ejecutar con Vite iniciado. Las miniaturas proceden del motor real de Aurora.
 * Opciones: --width --height --out --format (png|webp, repetible) --quality --origin
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { chromium } = require(process.env.PRISMA_PLAYWRIGHT_ROOT || 'playwright');

function parseArgs(argv) {
  const options = { width: 320, height: 180, out: 'public/wallpapers/scenes',
    formats: ['webp'], quality: 0, origin: process.env.PRISMA_PREVIEW_ORIGIN || 'http://127.0.0.1:1421' };
  let explicitFormat = false;
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key === 'width') options.width = Number(value);
    else if (key === 'height') options.height = Number(value);
    else if (key === 'out') options.out = value;
    else if (key === 'format') {
      if (!['png','webp'].includes(value)) throw new Error('Formato inválido');
      if (!explicitFormat) { options.formats = []; explicitFormat = true; }
      if (!options.formats.includes(value)) options.formats.push(value);
    }
    else if (key === 'quality') options.quality = Number(value);
    else if (key === 'origin') options.origin = value;
  }
  if (!Number.isFinite(options.width) || !Number.isFinite(options.height) || options.width < 16 || options.height < 16)
    throw new Error('Resolución inválida');
  return options;
}

(async () => {
  const options = parseArgs(process.argv.slice(2));
  const root = path.resolve(__dirname, '..');
  const { width, height, quality } = options;
  const testDir = path.join(root, 'test');
  fs.mkdirSync(testDir, { recursive: true });
  const name = `wallpaper-preview-${randomUUID()}.html`;
  const fixture = path.join(testDir, name);
  fs.writeFileSync(fixture, `<!doctype html><body style="margin:0;background:#050814"><script type="module">
    import * as THREE from 'three';
    import { LayeredBackgroundComposer } from '/src/features/wallpapers/compositor/aurora/LayeredBackgroundComposer.ts';
    import { DEFAULT_BACKGROUND_CONTROLS } from '/src/features/wallpapers/compositor/aurora/controls.ts';
    const renderer = new THREE.WebGLRenderer({alpha:false,antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(${width},${height}); renderer.setPixelRatio(1); renderer.setClearColor(0x050814,1);
    document.body.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(60,${width}/${height},0.1,1000); camera.position.z=5;
    const composer = new LayeredBackgroundComposer(camera,renderer), foreground = new THREE.Scene();
    const controls = {...DEFAULT_BACKGROUND_CONTROLS,quality:${quality},clickEffect:'off'};
    window.renderEffect = async type => {
      await composer.selectScenario(type,controls); composer.onResize(${width},${height});
      for(let frame=0;frame<30;frame++) {
        composer.update(1/30,{ambient:controls,scenario:controls,ambientVisible:false,scenarioVisible:true,reducedMotion:false,intensity:0.25,fusion:false});
        composer.render(foreground);
      }
      return {
        png: renderer.domElement.toDataURL('image/png'),
        webp: renderer.domElement.toDataURL('image/webp',0.88),
      };
    };
  </script></body>`);
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${options.origin}/test/${name}`);
    await page.waitForFunction(() => typeof window.renderEffect === 'function');
    const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/features/wallpapers/compositor/catalog.json'), 'utf8'));
    const output = path.resolve(root, options.out); fs.mkdirSync(output, { recursive: true });
    for (const item of catalog) {
      const offset = errors.length;
      const data = await page.evaluate(type => window.renderEffect(type), item.type);
      if (errors.length !== offset) throw Error(`${item.type}: ${errors.slice(offset).join('\n')}`);
      for (const format of options.formats) {
        const payload = data[format];
        if (!payload) continue;
        fs.writeFileSync(path.join(output, `${item.type}.${format}`), Buffer.from(payload.split(',')[1], 'base64'));
      }
      console.log(`Renderizado: ${item.type}`);
    }
    console.log(`${catalog.length} capturas en ${output} (${width}x${height}).`);
  } finally {
    if (browser) await browser.close();
    fs.unlinkSync(fixture);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
