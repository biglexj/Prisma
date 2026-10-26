/** UI completa en navegador aislado; backend simulado. */
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {chromium}=require(process.env.PRISMA_PLAYWRIGHT_ROOT||'playwright');
function assert(value,message){if(!value)throw Error(message)}
(async()=>{
 const root=path.resolve(__dirname,'..'),name=`gallery-test-${randomUUID()}.html`;
 fs.mkdirSync(path.join(root,'test'),{recursive:true});fs.mkdirSync(path.join(root,'temp'),{recursive:true});
 const fixture=path.join(root,'test',name);
 fs.writeFileSync(fixture,`<!doctype html><style>*{box-sizing:border-box}body{margin:16px;font:14px 'Segoe UI',sans-serif;background:#fbf7fc}</style><div id="root"></div>
 <script type="module">import React from 'react';import {createRoot} from 'react-dom/client';
 import {LiveWallpapersView} from '/src/features/wallpapers/ui/LiveWallpapersView.tsx';
 import '/src/features/wallpapers/ui/live-wallpapers.css';
 createRoot(document.getElementById('root')).render(React.createElement(LiveWallpapersView));</script>`);
 let browser;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.savedConfig={scenario:'none',dynamic:'prisma',ambient:'original',intensity:0.5,audioLevel:0,paused:false,enabled:true,particle:'none',controls:{},visibility:{ambient:true,dynamic:true,scenario:true,particles:true},parallax:{enabled:false,strength:0.5}};
   window.wallpaperState={isActive:false,isPaused:false,baseActive:false,compositorEnabled:false,currentMedia:null,currentFolder:null,totalMedia:0,media:[],settings:{sources:[],mode:'sequential',fit:'cover',audioEnabled:false,mediaKindMode:'video',imageDurationSec:20}};
   let id=0;window.__TAURI_INTERNALS__={transformCallback:()=>++id,unregisterCallback(){},invoke:async(cmd,args)=>{
    if(cmd==='live_wallpaper_get_state')return structuredClone(window.wallpaperState);
    if(cmd==='live_wallpaper_set_media_kind_mode'){window.wallpaperState.settings.mediaKindMode=args.mode;return structuredClone(window.wallpaperState);}
    if(cmd==='live_wallpaper_compositor_config_get')return structuredClone(window.savedConfig);
    if(cmd==='live_wallpaper_compositor_set'){window.activationConfig=structuredClone(window.savedConfig);window.wallpaperState.isActive=args.enabled;window.wallpaperState.compositorEnabled=args.enabled;return structuredClone(window.wallpaperState);}
    if(cmd==='live_wallpaper_compositor_config_set'){window.savedConfig=structuredClone(args.config);return;}
    return 1;
   }};window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(){}};
  });
  const tab=name=>page.getByRole('tab',{name,exact:true}),card=name=>page.getByRole('button',{name:`Seleccionar ${name}`,exact:true});
  await page.goto(`${process.env.PRISMA_PREVIEW_ORIGIN||'http://127.0.0.1:1421'}/test/${name}`);
  await tab('Ambiente').click();
  await page.locator('.scene-card').first().waitFor();
  assert(await page.getByRole('tab').count()===6,'Pestañas incorrectas');
  assert(await tab('Dinámicos').count()===0,'Dinámicos sigue como categoría inventada');
  assert(await page.locator('.scene-card').count()===8,'Ambiente mezcla categorías');
  await tab('Escenarios 3D').click();
  assert(await page.locator('.scene-card').count()===25,'Catálogo Aurora incompleto');
  assert(await page.locator('canvas').count()===0,'La galería crea renderizadores');
  const gallery=page.getByRole('region',{name:'Galería de Escenarios 3D',exact:true});
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'src/features/wallpapers/compositor/catalog.json'),'utf8'));
  for(const [group,count] of [['Escenarios 3D',17],['Efectos 3D',8]]){
   const section=gallery.getByRole('region',{name:group,exact:true});
   const labels=await section.locator('.scene-card > strong').allTextContents();
   assert(labels.length===count,`Tamaño de ${group}`);
   assert(JSON.stringify(labels)===JSON.stringify(catalog.filter(item=>item.uiGroup===group).map(item=>item.label)),`Orden de Aurora alterado: ${group}`);
  }
  await card('Holo Ciudad').click();
  await page.waitForFunction(()=>window.activationConfig?.scenario==='cybercity');
  await page.getByRole('slider',{name:'Velocidad',exact:true}).press('End');
  await page.getByRole('slider',{name:'Velocidad',exact:true}).press('ArrowLeft');await page.waitForTimeout(300);
  assert(await page.evaluate(()=>window.savedConfig.controls['scene:cybercity'].speed===2.9),'Se pierde el último slider');
  await card('Aurora Boreal').click();
  assert(await page.getByLabel('Vista de cámara',{exact:true}).count()===0,'Cámara en efecto plano');
  await page.getByRole('slider',{name:'Zoom',exact:true}).fill('0.5');await page.waitForTimeout(250);
  assert(await page.evaluate(()=>window.savedConfig.controls['dynamic:borealis'].zoom===0.5),'El slider no guarda el zoom del efecto seleccionado');
  await card('Holo Ciudad').click();
  assert(await page.getByRole('slider',{name:'Velocidad',exact:true}).inputValue()==='2.9','Controles no persisten por efecto');
  await page.waitForTimeout(200);await page.screenshot({path:path.join(root,'temp/wallpaper-aurora-groups.png'),fullPage:true});
  await card('Nebulosa Orión').click();await page.getByRole('button',{name:'Pausar capa',exact:true}).click();await page.waitForTimeout(300);
  assert(await page.evaluate(()=>window.savedConfig.particle==='nebula'&&window.savedConfig.scenario==='none'&&window.savedConfig.dynamic==='none'&&window.savedConfig.controls['particles:nebula'].paused),'No sustituye escenario o usa controles incorrectos');
  await tab('Partículas').click();
  assert(await page.locator('.scene-card').count()===13,'Escenarios volumétricos mezclados con partículas superpuestas');
  assert(await page.getByRole('group',{name:'Sistema de partículas',exact:true}).count()===0,'Selector técnico duplicado');
  await page.getByLabel('Activar capa',{exact:true}).check();await page.getByLabel('Forma de la partícula',{exact:true}).selectOption('snow');await page.waitForTimeout(300);
  assert(await page.evaluate(()=>window.savedConfig.overlay.enabled&&window.savedConfig.overlay.shape==='snow'&&window.savedConfig.particle==='nebula'),'Partículas y escenario no independientes');
  await tab('Ambiente').click();await card('Color sólido').click();await page.getByRole('slider',{name:'Opacidad del ambiente',exact:true}).fill('0.5');await page.waitForTimeout(300);
  await tab('Escenarios 3D').click();await card('Aurora Boreal').click();await page.waitForTimeout(300);
  assert(await page.getByRole('slider',{name:'Velocidad',exact:true}).count()===1,'Ambiente sólido oculta controles del escenario');
  assert(await page.evaluate(()=>window.savedConfig.ambient==='solid'&&window.savedConfig.ambientOpacity===0.5&&window.savedConfig.dynamic==='borealis'&&window.savedConfig.particle==='none'&&window.savedConfig.overlay.enabled),'Cambiar escenario altera ambiente/partículas');
  await page.getByRole('searchbox',{name:'Buscar efectos',exact:true}).fill('Nebulosa');
  assert(await page.locator('.scene-card').count()===1,'Búsqueda por grupos incorrecta');
  await tab('Vídeos').click();assert(await page.locator('.composition-studio').count()===0,'Vídeos mezcla controles');
  await tab('Imágenes').click();assert(await page.locator('.scene-card').count()===0,'Imágenes mezcla efectos');
  await tab('Parallax').click();assert(await page.locator('.scene-card').count()===0,'Parallax mezcla galerías');
  await page.getByLabel('Seguir el cursor',{exact:true}).check();await page.waitForTimeout(250);
  await page.screenshot({path:path.join(root,'temp/wallpaper-parallax-toggle.png'),fullPage:true});
  const before=await page.evaluate(()=>JSON.stringify(window.savedConfig));
  await tab('Parallax').press('ArrowLeft');assert(await tab('Partículas').getAttribute('aria-selected')==='true','Navegación de teclado');await page.waitForTimeout(250);
  assert(before===await page.evaluate(()=>JSON.stringify(window.savedConfig)),'Navegar cambia capas');
  await page.setViewportSize({width:375,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Desbordamiento horizontal');
  await page.screenshot({path:path.join(root,'temp/gallery-narrow.png'),fullPage:true});assert(!errors.length,errors.join('\n'));
  console.log(JSON.stringify({topTabs:6,auroraGroups:[17,8],exactOrder:true,preservedControls:true,independentAmbientAndOverlay:true,narrowLayout:true,errors}));
 }finally{if(browser)await browser.close();fs.unlinkSync(fixture)}
})().catch(e=>{console.error(e);process.exitCode=1});
