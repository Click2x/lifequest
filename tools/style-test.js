#!/usr/bin/env node
'use strict';
// Compare Saga art styles and checkpoints with a fixed seed, so the only thing that changes is the style.
//
//   node tools/style-test.js [--url http://127.0.0.1:7860] [--out ./style-test] [--models a,b,c] [--steps 28]
//
// This talks to YOUR running Stable Diffusion WebUI (started with --api) and temporarily switches its checkpoint, then
// restores the original one when it finishes. Close other work that uses that WebUI first, and note it needs about 9 GB of free VRAM.
// It writes one PNG per (checkpoint, style) pair plus an index.html contact sheet. Nothing here touches the LifeQuest server.

const fs = require('fs'), path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const URL_ = arg('url', 'http://127.0.0.1:7860'), OUT = path.resolve(arg('out', 'style-test')), STEPS = +arg('steps', 28), SEED = +arg('seed', 424242);

const SUBJECT = 'a young adventurer with messy dark hair and a bright red scarf, determined expression, simple travelling clothes, standing in a sunlit forest clearing at golden hour, heroic pose';
const COMMON_NEG = 'score_6, score_5, score_4, source_pony, source_furry, nsfw, nudity, explicit, gore, blood, text, watermark, signature, logo, lowres, bad anatomy, extra fingers, deformed';
const STYLES = {
  cinematic: { pos: `score_9, score_8_up, score_7_up, source_anime, rating_safe, anime key visual, cel shaded, vibrant colors, dynamic composition, cinematic lighting, fantasy adventure, ${SUBJECT}`, neg: `${COMMON_NEG}, photorealistic, photo, 3d render` },
  anime: { pos: `score_9, score_8_up, score_7_up, source_anime, rating_safe, anime screencap, anime coloring, flat color, 2d illustration, clean lineart, thick outlines, cel shading, vibrant colors, studio anime key visual, dynamic composition, fantasy adventure, ${SUBJECT}`, neg: `${COMMON_NEG}, realistic, photorealistic, photo, 3d, 3d render, cgi, skin pores, film grain, depth of field, bokeh, volumetric light, lens flare, hdr` },
};

async function api(p, body) {
  const r = await fetch(URL_ + p, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  if (!r.ok) throw new Error(p + ' answered ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}

(async () => {
  const opts = await api('/sdapi/v1/options'), original = opts.sd_model_checkpoint;
  const all = (await api('/sdapi/v1/sd-models')).map(m => m.model_name);
  const models = arg('models', '') ? arg('models', '').split(',') : all;
  console.log('Checkpoints available:', all.join(', '), '\nOriginal checkpoint:', original, '\nTesting:', models.join(', '));
  fs.mkdirSync(OUT, { recursive: true });
  const rows = [];
  try {
    for (const m of models) for (const [style, s] of Object.entries(STYLES)) {
      const file = `${m.replace(/[^\w.-]+/g, '_')}__${style}.png`;
      process.stdout.write(`rendering ${m} / ${style} ... `);
      const t0 = Date.now();
      const res = await api('/sdapi/v1/txt2img', { prompt: s.pos, negative_prompt: s.neg, steps: STEPS, cfg_scale: 6.5, width: 832, height: 1216, sampler_name: 'Euler a', seed: SEED,
        override_settings: { sd_model_checkpoint: m }, override_settings_restore_afterwards: false });
      fs.writeFileSync(path.join(OUT, file), Buffer.from(res.images[0], 'base64'));
      console.log(Math.round((Date.now() - t0) / 1000) + 's');
      rows.push({ m, style, file });
    }
  } finally {
    try { await api('/sdapi/v1/options', { sd_model_checkpoint: original }); console.log('restored checkpoint:', original); } catch (e) { console.log('could not restore checkpoint:', e.message); }
  }
  const styles = Object.keys(STYLES);
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Saga style test</title><style>body{font:14px system-ui;background:#111;color:#eee;padding:12px}table{border-collapse:collapse}td,th{padding:6px;vertical-align:top}img{width:260px;display:block}</style>
<h1>Saga style test (seed ${SEED})</h1><table><tr><th></th>${styles.map(s => `<th>${s}</th>`).join('')}</tr>
${models.map(m => `<tr><th>${m}</th>${styles.map(s => { const r = rows.find(x => x.m === m && x.style === s); return `<td>${r ? `<img src="${r.file}">` : '-'}</td>`; }).join('')}</tr>`).join('')}</table>`);
  console.log('Done. Open', path.join(OUT, 'index.html'));
})().catch(e => { console.error('Failed:', e.message); process.exit(1); });
