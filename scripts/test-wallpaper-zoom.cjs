/** Render real: zoom reducido/ampliado y conservación del encuadre inicial. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const{randomUUID}=crypto,{chromium}=require(process.env.PRISMA_PLAYWRIGHT_ROOT||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),name=`wallpaper-zoom-${randomUUID()}.html`,file=path.join(root,'test',name);
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.mkdirSync(path.join(root,'temp'),{recursive:true});
 fs.writeFileSync(file,`<!doctype html><body style="margin:0;background:#000"><script type="module">
 import * as THREE from 'three';import {LayeredBackgroundComposer} from '/src/features/wallpapers/compositor/aurora/LayeredBackgroundComposer.ts';
 import {DEFAULT_BACKGROUND_CONTROLS} from '/src/features/wallpapers/compositor/aurora/controls.ts';
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});renderer.setSize(640,360);renderer.setPixelRatio(1);document.body.appendChild(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(60,640/360,.1,1000);camera.position.z=5;
 const composer=new LayeredBackgroundComposer(camera,renderer),foreground=new THREE.Scene();let selected='';
 window.renderZoom=async(type,zoom)=>{const controls={...DEFAULT_BACKGROUND_CONTROLS,zoom,paused:true,motion:'none',clickEffect:'off'};
 if(selected!==type){await composer.selectScenario(type,controls);composer.onResize(640,360);selected=type;}
 composer.update(0,{ambient:controls,scenario:controls,ambientVisible:false,scenarioVisible:true,reducedMotion:false,intensity:.25,fusion:false});composer.render(foreground);
 return renderer.domElement.toDataURL('image/png');};</script></body>`);
 let browser;
 try{
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:640,height:360}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(`${process.env.PRISMA_PREVIEW_ORIGIN||'http://127.0.0.1:1421'}/test/${name}`);await page.waitForFunction(()=>typeof window.renderZoom==='function');
 const types=['prisma','borealis','blackhole','matrix','liquid'],baseline={},result=[];
 for(const type of types){const render=z=>page.evaluate(({type,z})=>window.renderZoom(type,z),{type,z});
 const normal=await render(1),far=await render(.5),near=await render(2),reset=await render(1);
 baseline[type]=crypto.createHash('sha256').update(normal).digest('hex');
 if(!process.argv.includes('--record')){
  if(normal===far)throw Error(`${type}: alejar zoom no cambia la imagen`);
  if(normal===near)throw Error(`${type}: acercar zoom no cambia la imagen`);
  if(normal!==reset)throw Error(`${type}: volver a 1 no recupera el encuadre`);
  if(normal===await render(.1))throw Error(`${type}: zoom mínimo no funciona`);
  if(normal===await render(2.5))throw Error(`${type}: zoom máximo no funciona`);
 }
 for(const[label,data]of[['normal',normal],['far',far],['near',near]])fs.writeFileSync(path.join(root,`temp/zoom-${type}-${label}.png`),Buffer.from(data.split(',')[1],'base64'));
 result.push({type,zoomOut:normal!==far,zoomIn:normal!==near,reset:normal===reset});}
 if(errors.length)throw Error(errors.join('\n'));
 const baselineFile=path.join(root,'temp/wallpaper-zoom-baseline.json');
 if(process.argv.includes('--record'))fs.writeFileSync(baselineFile,JSON.stringify(baseline,null,2));
 else if(fs.existsSync(baselineFile)){const previous=JSON.parse(fs.readFileSync(baselineFile,'utf8'));for(const type of types)if(previous[type]!==baseline[type])throw Error(`${type}: se cambió el encuadre de zoom 1`);}
 console.log(JSON.stringify({record:process.argv.includes('--record'),result,errors}));
 }finally{if(browser)await browser.close();fs.unlinkSync(file)}
})().catch(e=>{console.error(e);process.exitCode=1});
