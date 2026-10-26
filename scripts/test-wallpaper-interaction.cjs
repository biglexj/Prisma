/** Integra el adaptador real con clics nativos simulados; no inyecta entrada en Windows. */
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const{chromium}=require(process.env.PRISMA_PLAYWRIGHT_ROOT||'playwright');
function assert(v,m){if(!v)throw Error(m)}
(async()=>{
 const root=path.resolve(__dirname,'..'),name=`wallpaper-click-${randomUUID()}.html`,file=path.join(root,'test',name);
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,`<!doctype html><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}</style><div id="root"></div><script type="module">
 import {mountComposition} from '/src/features/wallpapers/compositor/host.ts';
 import {ParticleBackground} from '/src/features/wallpapers/compositor/aurora/ParticleBackground.ts';
 const init=ParticleBackground.prototype.init;ParticleBackground.prototype.init=function(...args){init.apply(this,args);window.engine=this;
 const animate=this.animateScene;this.animateScene=(...values)=>{if(this.context.state.clickStrength>0.99)window.freshClicks=(window.freshClicks||0)+1;animate(...values)};};
 window.host=mountComposition(document.getElementById('root'));</script>`);
 let browser;
 try{
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:960,height:540}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript(()=>{
  window.savedConfig={scenario:'none',dynamic:'none',particle:'morphclick',ambient:'original',intensity:.5,audioLevel:0,paused:false,enabled:true,controls:{},visibility:{ambient:true,dynamic:true,scenario:true,particles:true},parallax:{enabled:false,strength:.5}};
  window.queue=[];window.polls=0;let id=0;
  window.__TAURI_INTERNALS__={transformCallback:()=>++id,unregisterCallback(){},invoke:async(cmd)=>{
   if(cmd==='live_wallpaper_compositor_config_get')return structuredClone(window.savedConfig);
   if(cmd==='live_wallpaper_compositor_clicks'){window.polls++;return window.queue.splice(0);}
   return 1;
  }};window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(){}};
 });
 await page.goto(`${process.env.PRISMA_PREVIEW_ORIGIN||'http://127.0.0.1:1421'}/test/${name}`);
 await page.waitForFunction(()=>window.engine?.context?.state);
 await page.evaluate(()=>window.queue.push([0,0],[.25,-.25]));
 await page.waitForFunction(()=>window.engine.context.state.morphShapeIndex===2);
 assert(await page.evaluate(()=>window.engine.context.state.clickWorldPos.length()>0),'No convierte coordenadas a punto 3D');
 await page.evaluate(()=>{window.savedConfig.paused=true});await page.waitForTimeout(1000);
 let start=await page.evaluate(()=>window.polls);await page.waitForTimeout(250);assert(start===await page.evaluate(()=>window.polls),'Sigue leyendo clics al pausar');
 await page.evaluate(()=>{window.savedConfig.paused=false;window.savedConfig.particle='bubbles';window.savedConfig.controls={'particles:bubbles':{speed:3}}});
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.particleBackground==='bubbles');
 await page.evaluate(()=>{window.freshClicks=0;window.queue.push([0,0])});
 await page.waitForFunction(()=>window.freshClicks>0);
 assert(await page.evaluate(()=>window.engine.context.state.morphShapeIndex===1),'El clic no llega a Burbujas');
 const droplets=await page.evaluate(()=>{const pool=window.engine.masterGroup.children.find(o=>o.isPoints&&o.geometry.attributes.position.count===2400);const arr=pool.geometry.attributes.position.array;let count=0;for(let i=1;i<arr.length;i+=3)if(arr[i]>-1000)count++;return count;});
 assert(droplets>0,'Las burbujas no explotan con el clic');
 await page.evaluate(()=>{window.savedConfig.particle='none';window.savedConfig.dynamic='matrix'});
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.flatBackground==='matrix');await page.waitForTimeout(200);
 start=await page.evaluate(()=>window.polls);await page.waitForTimeout(250);assert(start===await page.evaluate(()=>window.polls),'Lee clics para efectos no interactivos');
 await page.evaluate(()=>window.host.dispose());start=await page.evaluate(()=>window.polls);await page.waitForTimeout(200);
 assert(start===await page.evaluate(()=>window.polls),'No libera temporizador');assert(await page.locator('canvas').count()===0,'No libera canvas');assert(!errors.length,errors.join('\n'));
 console.log(JSON.stringify({nexusShapesPerTwoClicks:2,bubbleDroplets:droplets,freshClickAtSpeed3:true,pausedStopsInput:true,inactiveStopsInput:true,disposed:true,errors}));
 }finally{if(browser)await browser.close();fs.unlinkSync(file)}
})().catch(e=>{console.error(e);process.exitCode=1});
