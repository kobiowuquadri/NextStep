import { writeFileSync } from 'node:fs';
import * as I from '../dist/index.js';
const poses = ['welcome','focus','encourage','recovery','celebrate','rest','thinking'];
const accs = ['none','headphones','cap','scarf','glasses','backpack','gradcap','starpin'];
const skins = ['violet','lagoon','coral','marigold','midnight','mint'];
let html = '<html><body style="margin:0;background:#FFFBF5;font-family:sans-serif"><div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px">';
for (const p of poses) html += `<div style="width:180px">${I.mascotSvg({pose:p,size:170})}<div>${p}</div></div>`;
html += '</div><div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px">';
accs.forEach((a,i)=> html += `<div style="width:140px">${I.mascotSvg({pose:'welcome',accessory:a,skin:skins[i%skins.length],size:130})}<div>${a}</div></div>`);
html += '</div>';
if (I.heroSceneSvg) html += `<div style="padding:8px;display:flex;gap:8px;flex-wrap:wrap">${I.heroSceneSvg()}</div>`;
if (I.SCENES) { html += '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px">'; for (const k of Object.keys(I.SCENES)) html += `<div style="width:300px;border:1px solid #ddd">${I.SCENES[k]()}<div>${k}</div></div>`; html += '</div>'; }
if (I.badgeSvg) { html += '<div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px">'; for (const b of I.BADGE_KEYS) { html += `<div style="width:110px">${I.badgeSvg(b,{size:100})}<div>${b}</div></div>`; } html += `<div style="width:110px">${I.badgeSvg('reroute',{size:100,locked:true})}<div>locked</div></div></div>`; }
html += '</body></html>';
const out = process.argv[2] ?? 'preview.html';
writeFileSync(out, html); console.log('wrote', out);
