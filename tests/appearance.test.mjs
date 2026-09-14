import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../lib/appearance.ts',import.meta.url),'utf8');
const bootstrap=source.match(/appearanceBootstrap = `([^`]+)`/)[1];
function boot(value,ambient,blocked=false){const document={documentElement:{dataset:{}}};vm.runInNewContext(bootstrap,{document,localStorage:{getItem(key){if(blocked)throw Error('Storage disabled');return key==='bearagon-appearance'?value:ambient;}}});return document.documentElement.dataset;}
test('stored modes are applied before paint; missing or invalid modes keep Light',()=>{
 for(const mode of ['light','dark','plaid'])assert.equal(boot(mode).appearance,mode);
 for(const mode of [null,'system','unexpected','<script>'])assert.equal(boot(mode).appearance,'light');
});
test('blocked storage does not prevent the application from displaying',()=>{assert.equal(boot('dark',null,true).appearance,'light');});
test('animation preference restores independently of the color mode',()=>{assert.equal(boot('plaid','off').ambient,'off');assert.equal(boot('dark',null).ambient,'on');});
test('text and important status colors remain readable on dark surfaces',()=>{
 const css=readFileSync(new URL('../app/appearance.css',import.meta.url),'utf8');
 const luminance=hex=>{const n=hex.match(/[0-9a-f]{2}/gi).slice(0,3).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*n[0]+.7152*n[1]+.0722*n[2];};
 const groups=[css.slice(0,css.indexOf('html[data-appearance="plaid"]')),css.slice(css.indexOf('html[data-appearance="plaid"]'),css.indexOf('html[data-appearance="plaid"]')+650)];
 for(const group of groups){const vars=Object.fromEntries([...group.matchAll(/--appearance-([a-z-]+):#([0-9a-f]+)/g)].map(m=>[m[1],m[2]]));for(const color of ['text','muted','accent','danger','warning','success']){const a=luminance(vars[color]),b=luminance(vars.surface);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${color} has insufficient contrast`);}}
});
