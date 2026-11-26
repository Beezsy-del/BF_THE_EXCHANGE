import { test } from 'node:test'
import assert from 'node:assert/strict'
import { run } from '../lang/draw.js'
import { ArtRenderer } from '../lang/artRenderer.js'
import { PixelRenderer } from '../scene/renderer.js'
import { FormulaBlender } from '../engine/smooth.js'
import { compile, parseExpr, toSource } from '../engine/expr.js'
import { wrapAt } from '../workflow/tree.js'
import { serialiseProject, parseProjectFile } from './project.js'
const canvas = () => ({ getContext: () => ({ createImageData: (w,h) => ({data:new Uint8ClampedArray(w*h*4)}), putImageData(){},fillRect(){},beginPath(){},arc(){},fill(){} }) })
test('BUG-006 finite extremes cannot poison particle buffers and damaged state recovers', () => {
 const r=new ArtRenderer(canvas());r.setArt(run('CANVAS 8 8\nDOT\nANIMATE { dx = 1e40 }').art);r.setMode('particles');
 for(let i=0;i<5;i++)r.frame(i/60,1/60,{amp:1,glow:0,mx:-1000,my:-1000});
 assert.ok([...r.px,...r.py,...r.vx,...r.vy].every(Number.isFinite));
 r.px[0]=NaN;r.vy[0]=Infinity;r.setArt(run('CANVAS 8 8\nDOT').art);
 assert.ok([...r.px,...r.py,...r.vx,...r.vy].every(Number.isFinite));
})
test('BUG-010 block edits preserve exact literals',()=>{
 const s=toSource(wrapAt(parseExpr('1000000000001 - 1000000000000',[]).ast,[],{kind:'call',name:'abs'}));assert.equal(compile(s,[]).fn({}),1)
})
test('BUG-011 inherited names are valid layer dictionary keys',()=>{
 const r=new ArtRenderer(canvas());r.setArt(run('CANVAS 8 8\nLAYER constructor\nMOVE 1 1\nDOT\nMOVE 3 1\nDOT').art);assert.equal(r.items[0].cx,2)
})
test('BUG-012 line includes fractional endpoint',()=>{assert.deepEqual(run('CANVAS 8 8\nMOVE 1 1\nLINE 1.5 1').art.pixels.map(p=>[p.x,p.y]),[[1,1],[2,1]])})
test('CR-01 direct negative and non-finite petal inputs cannot throw',()=>{
 const r=new PixelRenderer(canvas());for(const petals of [-1,NaN,Infinity]){r.setParams({petals});assert.doesNotThrow(()=>r.updatePetals(0,0));assert.equal(r.petals.length,0)}
})
test('CR-05 retargeting halfway through a blend is continuous',()=>{
 const b=new FormulaBlender(1);b.set({x:()=>0});b.set({x:()=>10});b.tick(.5);const v=b.out.x({});b.set({x:()=>20});assert.equal(b.out.x({}),v);b.tick(1);assert.equal(b.out.x({}),20)
})
test('CR-05 many rapid edits do not grow a recursive call stack',()=>{
 const b=new FormulaBlender(1);for(let i=0;i<10000;i++){b.set({x:()=>i});b.tick(.001)}assert.ok(Number.isFinite(b.out.x({})))
})
test('CR-13 modulo zero cannot erase the surrounding sum',()=>{assert.equal(compile('10 + (x % 0)',['x']).fn({x:3}),10)})
test('BUG-001/005 project roundtrip preserves scene and valid rendering controls',()=>{
 const a={origin:'code',name:'test',code:'CANVAS 8 8\nDOT'};
 const scene={palette:'frost',params:{petals:42,wind:1,speed:2,glow:.3},sources:{sway:'42'}};
 const p=parseProjectFile(serialiseProject(a,{key:'breeze',mode:'particles',opts:{amp:2,speed:2,glow:2,trails:false}},{preset:'marble',amp:2,speed:.7},scene));
 assert.equal(p.ok,true);assert.equal(p.scene.palette,'frost');assert.equal(p.scene.params.petals,42);assert.equal(p.motion.opts.amp,2);assert.equal(p.explore.speed,.7)
})
test('formula transitions preserve neutral brightness when adding or removing it',()=>{
 const b=new FormulaBlender(1);b.set({dx:()=>0});b.set({dx:()=>10});b.tick(.5);b.set({dx:()=>20,bright:()=>2});assert.equal(b.out.bright({}),1);b.tick(1);assert.equal(b.out.bright({}),2);b.set({dx:()=>0});assert.equal(b.out.bright({}),2);b.tick(1);assert.equal(b.out.bright({}),1)
})
test('project controls reject non-finite and out-of-range file values',()=>{
 const a={origin:'code',code:'DOT'};const p=parseProjectFile(serialiseProject(a,{key:'breeze',opts:{amp:99,speed:-1,glow:'bad',trails:'yes'}},{preset:'marble',amp:-2,speed:99},{params:{petals:-1},palette:'constructor'}));
 assert.equal(p.motion.opts.amp,1);assert.equal(p.motion.opts.speed,1);assert.equal(p.scene.params.petals,80);assert.equal(p.scene.palette,'sakura');assert.equal(p.explore.amp,1)
})
test('retargeting preserves properties that are still fading out',()=>{
 const b=new FormulaBlender(1);b.set({bright:()=>2});b.set({dx:()=>0});b.tick(.5);const bright=b.out.bright({});b.set({dx:()=>4});assert.equal(b.out.bright({}),bright);b.tick(1);assert.equal(b.out.bright({}),1)
})
