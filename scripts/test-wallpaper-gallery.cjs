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
    import {LiveWallpapersView} from '/src/features/wallpapers/ui/LiveWallpapersView.tsx';
    import '/src/features/wallpapers/ui/live-wallpapers.css';
    createRoot(document.getElementById('root')).render(React.createElement(LiveWallpapersView));</script>`);
  let browser;
  try {
    browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.savedConfig={scenario:'none',dynamic:'prisma',ambient:'original',intensity:0.5,audioLevel:0,paused:false,enabled:true,
        particle:'none',controls:{},visibility:{ambient:true,scenario:true,particles:true},parallax:{enabled:false,strength:0.5}};
      window.wallpaperState={isActive:true,isPaused:false,baseActive:false,compositorEnabled:true,currentMedia:null,currentFolder:null,totalMedia:0,media:[],
        settings:{sources:[],mode:'sequential',fit:'cover',audioEnabled:false,mediaKindMode:'video',imageDurationSec:20}};
      let id=0;
      window.__TAURI_INTERNALS__={transformCallback:()=>++id,unregisterCallback(){},invoke:async(cmd,args)=>{
        if(cmd==='live_wallpaper_get_state')return structuredClone(window.wallpaperState);
        if(cmd==='live_wallpaper_set_media_kind_mode'){window.wallpaperState.settings.mediaKindMode=args.mode;return structuredClone(window.wallpaperState);}
        if(cmd==='live_wallpaper_compositor_config_get')return structuredClone(window.savedConfig);
        if(cmd==='live_wallpaper_compositor_config_set'){window.savedConfig=structuredClone(args.config);return;}
        return 1;
      }};
      window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(){}};
    });
    const origin=process.env.PRISMA_PREVIEW_ORIGIN||'http://127.0.0.1:1421';
    await page.goto(`${origin}/test/${name}`);
    await page.locator('.scene-card').first().waitFor();
    assert(await page.getByRole('tab').count()===7,'Cada categoría debe tener una pestaña superior');
    assert(await page.locator('.scene-card').count()===8,'Ambiente mezcla categorías');
    assert(await page.getByRole('button',{name:'Todos',exact:true}).count()===0,'Sigue existiendo galería global');
    assert(await page.locator('canvas').count()===0,'La galería no debe crear un WebGL por tarjeta');
    await page.getByRole('tab',{name:'Escenarios 3D',exact:true}).click();
    assert(await page.locator('.scene-card').count()===4,'Escenarios mezcla otras categorías');
    await page.getByRole('button',{name:'Seleccionar Holo Ciudad',exact:true}).click();
    await page.getByRole('slider',{name:'Velocidad',exact:true}).press('End');
    await page.getByRole('slider',{name:'Velocidad',exact:true}).press('ArrowLeft');
    await page.waitForTimeout(300);
    assert(await page.evaluate(()=>window.savedConfig.controls['scene:cybercity']?.speed===2.9),'Se pierde el último ajuste del slider');
    await page.getByRole('tab',{name:'Dinámicos',exact:true}).click();
    assert(await page.locator('.scene-card').count()===5,'Dinámicos mezcla otras categorías');
    await page.getByRole('button',{name:'Seleccionar Aurora Boreal',exact:true}).click();
    assert(await page.getByLabel('Vista de cámara',{exact:true}).count()===0,'Un efecto plano no ofrece cámara 3D');
    await page.getByRole('tab',{name:'Escenarios 3D',exact:true}).click();
    await page.getByRole('button',{name:'Seleccionar Holo Ciudad',exact:true}).click();
    assert(await page.getByRole('slider',{name:'Velocidad',exact:true}).inputValue()==='2.9','No conserva ajustes por efecto');
    await page.getByRole('tab',{name:'Partículas',exact:true}).click();
    await page.getByRole('button',{name:'Partículas 3D',exact:true}).click();
    assert(await page.locator('.scene-card').count()===16,'Galería de partículas incorrecta');
    await page.getByRole('button',{name:'Seleccionar Nebulosa Orión',exact:true}).click();
    await page.getByRole('button',{name:'Pausar capa',exact:true}).click();
    await page.getByLabel('Visible',{exact:true}).uncheck();
    await page.waitForTimeout(300);
    assert(await page.evaluate(()=>window.savedConfig.particle==='nebula'&&window.savedConfig.scenario==='cybercity'
      &&window.savedConfig.controls['particles:nebula'].paused&&!window.savedConfig.visibility.particles),'Capas no independientes');
    await page.getByRole('button',{name:'Partículas 2D',exact:true}).click();
    assert(await page.locator('.scene-card').count()===13,'Partículas 2D mezcla categorías');
    await page.getByLabel('Activar capa',{exact:true}).check();
    await page.getByLabel('Forma de la partícula',{exact:true}).selectOption('snow');
    await page.waitForTimeout(300);
    assert(await page.evaluate(()=>window.savedConfig.overlay.enabled&&window.savedConfig.overlay.shape==='snow'&&window.savedConfig.particle==='nebula'),'Dos sistemas de partículas independientes');
    await page.getByRole('tab',{name:'Ambiente',exact:true}).click();
    await page.getByRole('button',{name:'Seleccionar Color sólido',exact:true}).click();
    await page.getByRole('slider',{name:'Opacidad del ambiente',exact:true}).fill('0.5');
    await page.waitForTimeout(300);
    assert(await page.evaluate(()=>window.savedConfig.ambient==='solid'&&window.savedConfig.ambientOpacity===0.5),'Ambiente independiente de color');
    await page.getByRole('tab',{name:'Dinámicos',exact:true}).click();
    assert(await page.getByRole('slider',{name:'Velocidad',exact:true}).count()===1,'El ambiente sólido oculta controles de otra capa');
    await page.waitForTimeout(200);
    assert(await page.getByRole('tab',{name:'Dinámicos',exact:true}).getAttribute('aria-selected')==='true','La pestaña seleccionada no coincide con el catálogo');
    await page.screenshot({path:path.join(root,'temp/wallpaper-dynamic-category.png'),fullPage:true});
    await page.getByRole('tab',{name:'Vídeos',exact:true}).click();
    assert(await page.locator('.scene-card').count()===0&&await page.locator('.composition-studio').count()===0,'Vídeos muestra efectos de otra pestaña');
    await page.getByRole('tab',{name:'Imágenes',exact:true}).click();
    assert(await page.locator('.scene-card').count()===0,'Imágenes muestra efectos de otra pestaña');
    await page.getByRole('tab',{name:'Parallax',exact:true}).click();
    assert(await page.locator('.scene-card').count()===0,'Parallax mezcla catálogos');
    await page.getByLabel('Seguir el cursor',{exact:true}).check();
    await page.waitForTimeout(250);
    assert(await page.evaluate(()=>window.savedConfig.parallax.enabled),'No guarda parallax');
    const before=await page.evaluate(()=>JSON.stringify(window.savedConfig));
    await page.getByRole('tab',{name:'Parallax',exact:true}).press('ArrowLeft');
    assert(await page.getByRole('tab',{name:'Partículas',exact:true}).getAttribute('aria-selected')==='true','Teclado no navega pestañas');
    await page.waitForTimeout(250);
    assert(before===await page.evaluate(()=>JSON.stringify(window.savedConfig)),'La navegación cambia capas activas');
    await page.setViewportSize({width:375,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Desbordamiento horizontal');
    await page.screenshot({path:path.join(root,'temp/gallery-narrow.png'),fullPage:true});
    assert(errors.length===0,errors.join('\n'));
    console.log(JSON.stringify({topTabs:7,ambient:8,dynamic:5,scenes:4,particle3D:16,particle2D:13,isolatedCategories:true,perEffectControls:true,independentLayers:true,narrowLayout:true,errors}));
  } finally {
    if(browser)await browser.close();
    fs.unlinkSync(fixture);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
