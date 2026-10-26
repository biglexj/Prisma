/** Prueba de UI en navegador aislado. Backend simulado; pruebas nativas por separado. */
const fs = require('node:fs'), path = require('node:path'), {randomUUID} = require('node:crypto');
const {chromium} = require(process.env.PRISMA_PLAYWRIGHT_ROOT || 'playwright');
function assert(value,message){if(!value)throw Error(message)}

(async()=>{
  const root=path.resolve(__dirname,'..'), name=`gallery-test-${randomUUID()}.html`;
  fs.mkdirSync(path.join(root,'test'),{recursive:true});
  fs.mkdirSync(path.join(root,'temp'),{recursive:true});
  const fixture=path.join(root,'test',name);
  fs.writeFileSync(fixture,`<!doctype html><style>*{box-sizing:border-box}body{margin:16px;font:14px 'Segoe UI',sans-serif;background:#fbf7fc}</style><div id="root"></div>
    <script type="module">import React from 'react';import {createRoot} from 'react-dom/client';
    import {CompositionControls} from '/src/features/wallpapers/ui/CompositionControls.tsx';
    import '/src/features/wallpapers/ui/live-wallpapers.css';
    createRoot(document.getElementById('root')).render(React.createElement(CompositionControls,{enabled:true}));</script>`);
  let browser;
  try {
    browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.savedConfig={scenario:'none',dynamic:'prisma',ambient:'original',intensity:0.5,audioLevel:0,paused:false,enabled:true,
        particle:'none',controls:{},visibility:{ambient:true,scenario:true,particles:true},parallax:{enabled:false,strength:0.5}};
      let id=0;
      window.__TAURI_INTERNALS__={transformCallback:()=>++id,unregisterCallback(){},invoke:async(cmd,args)=>{
        if(cmd==='live_wallpaper_compositor_config_get')return structuredClone(window.savedConfig);
        if(cmd==='live_wallpaper_compositor_config_set'){window.savedConfig=structuredClone(args.config);return;}
        return 1;
      }};
      window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(){}};
    });
    const origin=process.env.PRISMA_PREVIEW_ORIGIN||'http://127.0.0.1:1421';
    await page.goto(`${origin}/test/${name}`);
    await page.locator('.scene-card').first().waitFor();
    assert(await page.locator('.scene-card').count()===46,'Faltan efectos');
    assert(await page.locator('canvas').count()===0,'La galería no debe crear un WebGL por tarjeta');
    await page.screenshot({path:path.join(root,'temp/gallery-all-effects.png'),fullPage:true});
    await page.getByRole('button',{name:'Escenas 3D',exact:true}).click();
    await page.getByRole('button',{name:'Seleccionar Holo Ciudad',exact:true}).click();
    await page.getByRole('slider',{name:'Velocidad',exact:true}).press('End');
    await page.getByRole('slider',{name:'Velocidad',exact:true}).press('ArrowLeft');
    await page.waitForTimeout(300);
    assert(await page.evaluate(()=>window.savedConfig.controls['scene:cybercity']?.speed===2.9),'Se pierde el último ajuste del slider');
    await page.getByRole('button',{name:'Todos',exact:true}).click();
    await page.getByRole('button',{name:'Seleccionar Aurora Boreal',exact:true}).click();
    assert(await page.getByLabel('Vista de cámara',{exact:true}).count()===0,'Un efecto plano no ofrece cámara 3D');
    await page.getByRole('button',{name:'Seleccionar Holo Ciudad',exact:true}).click();
    assert(await page.getByRole('slider',{name:'Velocidad',exact:true}).inputValue()==='2.9','No conserva ajustes por efecto');
    await page.getByRole('tab',{name:'Partículas 3D',exact:true}).click();
    await page.getByRole('button',{name:'Partículas 3D',exact:true}).click();
    assert(await page.locator('.scene-card').count()===16,'Galería de partículas incorrecta');
    await page.getByRole('button',{name:'Seleccionar Nebulosa Orión',exact:true}).click();
    await page.getByRole('button',{name:'Pausar capa',exact:true}).click();
    await page.getByLabel('Visible',{exact:true}).uncheck();
    await page.waitForTimeout(300);
    assert(await page.evaluate(()=>window.savedConfig.particle==='nebula'&&window.savedConfig.scenario==='cybercity'
      &&window.savedConfig.controls['particles:nebula'].paused&&!window.savedConfig.visibility.particles),'Capas no independientes');
    await page.getByRole('tab',{name:'Partículas 2D',exact:true}).click();
    await page.getByLabel('Activar capa',{exact:true}).check();
    await page.getByLabel('Forma de la partícula',{exact:true}).selectOption('snow');
    await page.waitForTimeout(300);
    assert(await page.evaluate(()=>window.savedConfig.overlay.enabled&&window.savedConfig.overlay.shape==='snow'&&window.savedConfig.particle==='nebula'),'Dos sistemas de partículas independientes');
    await page.getByRole('tab',{name:'Ambiente',exact:true}).click();
    await page.getByRole('button',{name:'Color sólido',exact:true}).click();
    await page.getByRole('slider',{name:'Opacidad del ambiente',exact:true}).fill('0.5');
    await page.waitForTimeout(300);
    assert(await page.evaluate(()=>window.savedConfig.ambient==='solid'&&window.savedConfig.ambientOpacity===0.5),'Ambiente independiente de color');
    await page.getByRole('tab',{name:'Parallax',exact:true}).click();
    await page.getByLabel('Seguir el cursor',{exact:true}).check();
    await page.waitForTimeout(250);
    assert(await page.evaluate(()=>window.savedConfig.parallax.enabled),'No guarda parallax');
    await page.setViewportSize({width:375,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Desbordamiento horizontal');
    await page.screenshot({path:path.join(root,'temp/gallery-narrow.png'),fullPage:true});
    assert(errors.length===0,errors.join('\n'));
    console.log(JSON.stringify({effects:25,particleEffects:16,perEffectControls:true,independentLayers:true,narrowLayout:true,errors}));
  } finally {
    if(browser)await browser.close();
    fs.unlinkSync(fixture);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
