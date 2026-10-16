'use strict';
// The Saga: a daily anime/D&D episode about your hero, written by a local LLM (Ollama) and illustrated by a local
// Stable Diffusion (AUTOMATIC1111 API). Everything stays on your machine. Jobs run one at a time so the GPU is never shared.
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

// words we never let into an image prompt (this app is family-friendly even if the checkpoint is not)
const BLOCK = ['nsfw', 'nude', 'naked', 'explicit', 'porn', 'erotic', 'lingerie', 'topless', 'sex', 'fetish', 'gore', 'underage', 'child', 'loli', 'shota', 'blood'];
const clean = s => { let t = String(s || '').toLowerCase(); for (const w of BLOCK) t = t.split(w).join(''); return t.replace(/\s+/g, ' ').trim().slice(0, 300); };

function create(cfg, dataDir) {
  const S = { child: null, weStarted: false, stopTimer: null, queue: Promise.resolve(), jobs: new Map(), episodesToday: new Map() };
  const enqueue = fn => { const p = S.queue.then(fn, fn); S.queue = p.catch(() => { }); return p; };
  const sagaDir = path.join(dataDir, 'saga');

  async function llmUp() {
    try {
      const r = await fetch(cfg.storyUrl + '/api/tags', { signal: AbortSignal.timeout(2500) });
      if (!r.ok) return false;
      const base = cfg.storyModel.split(':')[0];
      return ((await r.json()).models || []).some(m => m.name === cfg.storyModel || m.name.split(':')[0] === base);
    } catch { return false; }
  }
  // The GPU is shared with whatever else you run. Never load a model unless enough memory is genuinely free; otherwise wait.
  const sleepMs = ms => new Promise(r => setTimeout(r, ms));
  function gpuFreeMb() {
    return new Promise(res => execFile('nvidia-smi', ['--query-gpu=memory.free', '--format=csv,noheader,nounits'], { timeout: 6000, windowsHide: true }, (e, out) => {
      const v = e ? [] : String(out).trim().split(/\r?\n/).map(Number).filter(Number.isFinite); res(v.length ? Math.max(...v) : null);   // null = no NVIDIA GPU info: do not block
    }));
  }
  async function waitForGpu(job, needMb) {
    const tries = (cfg.gpuWaitMinutes || 360) * 2;
    for (let i = 0; i < tries; i++) {
      const free = await gpuFreeMb();
      if (free == null || free >= needMb) { if (job.status === 'waiting-gpu') job.status = 'queued'; return; }
      if (job.status !== 'waiting-gpu') console.log(`Saga: waiting for GPU memory (${free} MB free, need ${needMb} MB)`);
      job.status = 'waiting-gpu'; await sleepMs(30000);
    }
    throw new Error('the GPU stayed busy; try again later');
  }
  // free the GPU before painting: ask Ollama to drop the model and wait until it really has
  async function unloadLlm() {
    try {
      await fetch(cfg.storyUrl + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: cfg.storyModel, keep_alive: 0 }), signal: AbortSignal.timeout(20000) });
      for (let i = 0; i < 20; i++) { const j = await (await fetch(cfg.storyUrl + '/api/ps', { signal: AbortSignal.timeout(3000) })).json(); if (!(j.models || []).length) return; await new Promise(r => setTimeout(r, 1500)); }
    } catch { }
  }
  async function sdUp() { try { return (await fetch(cfg.sdUrl + '/sdapi/v1/options', { signal: AbortSignal.timeout(2500) })).ok; } catch { return false; } }
  async function status() { const [llm, sd] = await Promise.all([llmUp(), sdUp()]); return { llm, model: cfg.storyModel, sd, canLaunchSd: !!cfg.sdDir && fs.existsSync(path.join(cfg.sdDir || '', 'webui-user.bat')), sdModel: cfg.sdModel }; }

  // ── the storyteller ──
  const SYSTEM = [
    "You are the Dungeon Master of a wholesome anime fantasy campaign called LifeQuest. The hero's REAL-LIFE actions power the story.",
    'Write ONE episode recap in vivid present-tense anime narration with light Dungeons & Dragons flavour (ability checks, the DM\'s dice).',
    'Rules:',
    '- 150 to 200 words. Turn real actions into fantasy: habits are training rituals, focus sessions are duels, quests are missions, XP is power.',
    '- Obey the dice exactly. Critical success: a spectacular triumph. Success: a clear win. Narrow miss: a hard-fought setback where the hero retreats stronger. Fumble: a brief comic mishap the hero laughs off. Rest day: a calm campfire scene with no fighting.',
    '- Never shame or punish the hero. Setbacks always become motivation. No real-world private details, no brand names, family-friendly cartoon action only.',
    '- Mention the specific actions given, and the villain by name. Continue the story from the previous recaps.',
    'Reply with EXACTLY these five labelled parts and nothing else:',
    'TITLE: a short episode title',
    'STORY: the narration (may span several lines)',
    'RECAP: one sentence summarising what happened',
    'SCENE: comma-separated visual tags for one illustration (pose, setting, lighting, mood; no character names)',
    'TEASER: one sentence cliffhanger for tomorrow',
  ].join('\n');

  const chatml = (sys, user) => `<|im_start|>system\n${sys}<|im_end|>\n<|im_start|>user\n${user}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n`;   // the model file has a raw template, so we format the turns ourselves
  function parse(text) {
    const marks = ['TITLE:', 'STORY:', 'RECAP:', 'SCENE:', 'TEASER:'], at = marks.map(m => text.indexOf(m));
    const part = i => { if (at[i] < 0) return ''; const later = at.filter(x => x > at[i]); return text.slice(at[i] + marks[i].length, later.length ? Math.min(...later) : text.length).trim(); };
    const out = { title: part(0).split('\n')[0].replace(/[*#"]/g, '').trim(), story: part(1), recap: part(2).split('\n')[0], scene: part(3).split('\n')[0], teaser: part(4).split('\n')[0] };
    if (!out.story) { out.story = text.trim(); }
    return out;
  }
  async function writeEpisode(userText) {
    const r = await fetch(cfg.storyUrl + '/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(900000),
      body: JSON.stringify({ model: cfg.storyModel, prompt: chatml(SYSTEM, userText), raw: true, stream: false, keep_alive: 0,   // keep_alive 0 frees the GPU for image generation right after
        options: { temperature: 0.85, top_p: 0.92, num_ctx: 4096, num_predict: 900, stop: ['<|im_end|>', '<|endoftext|>'] } }),
    });
    if (!r.ok) throw new Error('storyteller answered ' + r.status);
    const j = await r.json(), ep = parse(String(j.response || ''));
    if (ep.story.length < 40) throw new Error('storyteller returned too little text');
    return ep;
  }
  // a few episodes per player per day so nobody can hog the GPU
  function allow(pid, kind) {
    const day = new Date().toISOString().slice(0, 10), k = kind + '|' + pid + '|' + day, n = S.episodesToday.get(k) || 0, limit = kind === 'img' ? (cfg.dailyImages || 6) : (cfg.dailyLimit || 4);
    if (n >= limit) return false; S.episodesToday.set(k, n + 1);
    for (const key of S.episodesToday.keys()) if (!key.endsWith(day)) S.episodesToday.delete(key);
    return true;
  }

  // ── Stable Diffusion: start on demand, stop when idle (only if we started it) ──
  function killTree(pid) { if (process.platform === 'win32') execFile('taskkill', ['/PID', String(pid), '/T', '/F'], () => { }); else try { process.kill(-pid); } catch { } }
  function armStop() {
    clearTimeout(S.stopTimer);
    if (!S.weStarted) return;
    S.stopTimer = setTimeout(() => { if (S.child) { killTree(S.child.pid); S.child = null; S.weStarted = false; console.log('Saga: Stable Diffusion stopped (idle)'); } }, (cfg.sdIdleMinutes || 10) * 60000);
  }
  async function ensureSd() {
    if (await sdUp()) { armStop(); return; }
    if (!cfg.sdDir || !fs.existsSync(path.join(cfg.sdDir, 'webui-user.bat'))) throw new Error('Stable Diffusion is not running and no sdDir is configured');
    if (!S.child) {
      console.log('Saga: starting Stable Diffusion…');
      fs.mkdirSync(sagaDir, { recursive: true });
      const log = fs.openSync(path.join(sagaDir, 'sd.log'), 'w'), bat = path.join(cfg.sdDir, 'webui-user.bat');
      // full path (cmd will not search the current folder), run from the install folder, output kept in data/saga/sd.log
      const env = { ...process.env }; delete env.NoDefaultCurrentDirectoryInExePath;     // that setting stops the .bat from finding webui.bat next to it
      S.child = spawn('cmd.exe', ['/d', '/s', '/c', `"${bat}"`], { cwd: cfg.sdDir, env, windowsHide: true, stdio: ['ignore', log, log], windowsVerbatimArguments: true });
      S.child.on('exit', code => { S.child = null; S.weStarted = false; console.log('Saga: Stable Diffusion process exited (' + code + ')'); });
      S.weStarted = true;
    }
    for (let i = 0; i < 100; i++) {
      await new Promise(r => setTimeout(r, 3000));
      if (await sdUp()) { armStop(); return; }
      if (!S.child) throw new Error('Stable Diffusion exited while starting (see data/saga/sd.log)');
    }                                                                                    // up to ~5 minutes for the first load
    throw new Error('Stable Diffusion did not start in time (see data/saga/sd.log)');
  }
  const imgPath = (pid, date) => path.join(sagaDir, pid, date + '.png');
  async function paint(job) {
    await unloadLlm();
    if (!(await sdUp())) await waitForGpu(job, cfg.sdMinFreeMb || 9000);
    job.status = 'painting';
    await ensureSd();
    clearTimeout(S.stopTimer);                       // never shut SD down while it is rendering; the idle clock restarts when the job ends
    try {
      const body = {
        prompt: job.prompt, negative_prompt: job.negative, steps: cfg.sdSteps || 28, cfg_scale: 6.5, width: 832, height: 1216, sampler_name: 'Euler a', seed: job.seed,
        override_settings: cfg.sdModel ? { sd_model_checkpoint: cfg.sdModel } : {}, override_settings_restore_afterwards: false,
      };
      const r = await fetch(cfg.sdUrl + '/sdapi/v1/txt2img', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(900000) });
      if (!r.ok) throw new Error('Stable Diffusion answered ' + r.status);
      const img = (await r.json()).images?.[0]; if (!img) throw new Error('no image returned');
      fs.mkdirSync(path.join(sagaDir, job.pid), { recursive: true });
      fs.writeFileSync(imgPath(job.pid, job.date), Buffer.from(img, 'base64'));
    } finally { armStop(); }
  }
  // Pony-family checkpoints respond to these score/source tags; the safe rating and negative terms keep it family-friendly
  // sdStyle: "cinematic" (default, the tested look) or "anime" (flat-colour cel-shaded key art; pushes realistic checkpoints away from photo looks)
  const ANIME_POS = ['anime screencap', 'anime coloring', 'flat color', '2d illustration', 'clean lineart', 'thick outlines', 'cel shading', 'vibrant colors', 'studio anime key visual'];
  const ANIME_NEG = 'realistic, photorealistic, photo, 3d, 3d render, cgi, skin pores, film grain, depth of field, bokeh, volumetric light, lens flare, hdr';
  function compose({ look, gear, scene, mood }) {
    if (cfg.sdStyle === 'anime') {
      const positive = ['score_9', 'score_8_up', 'score_7_up', 'source_anime', 'rating_safe', ...ANIME_POS, 'dynamic composition', 'fantasy adventure', clean(look), clean(gear), clean(scene), clean(mood)].filter(Boolean).join(', ');
      return { positive, negative: 'score_6, score_5, score_4, source_pony, source_furry, nsfw, nudity, explicit, gore, blood, text, watermark, signature, logo, lowres, bad anatomy, extra fingers, deformed, ' + ANIME_NEG };
    }
    const positive = ['score_9', 'score_8_up', 'score_7_up', 'source_anime', 'rating_safe', 'anime key visual', 'cel shaded', 'vibrant colors', 'dynamic composition', 'cinematic lighting', 'fantasy adventure',
      clean(look), clean(gear), clean(scene), clean(mood)].filter(Boolean).join(', ');
    const negative = 'score_6, score_5, score_4, source_pony, source_furry, nsfw, nudity, explicit, gore, blood, text, watermark, signature, logo, lowres, bad anatomy, extra fingers, deformed, photorealistic, photo, 3d render';
    return { positive, negative };
  }
  function startImage(pid, date, parts, seed) {
    const key = pid + '|' + date, { positive, negative } = compose(parts);
    const job = { pid, date, prompt: positive, negative, seed: Number.isFinite(+seed) ? +seed : -1, status: 'queued', error: '' };
    S.jobs.set(key, job);
    enqueue(async () => { try { await paint(job); job.status = 'done'; } catch (e) { job.status = 'error'; job.error = String(e.message || e); console.log('Saga image error:', job.error); } });
    return job;
  }
  const jobFor = (pid, date) => S.jobs.get(pid + '|' + date);
  // episodes are background jobs too, so a phone that falls asleep mid-request can come back and collect the finished story
  function startEpisode(pid, date, userText) {
    const key = 'ep|' + pid + '|' + date, job = { status: 'queued', episode: null, error: '' };
    S.jobs.set(key, job);
    enqueue(async () => { try { await waitForGpu(job, cfg.storyMinFreeMb || 18500); job.status = 'writing'; job.episode = await writeEpisode(userText); job.status = 'done'; } catch (e) { job.status = 'error'; job.error = String(e.message || e); console.log('Saga story error:', job.error); } });
    return job;
  }
  const episodeJob = (pid, date) => S.jobs.get('ep|' + pid + '|' + date);
  const hasImage = (pid, date) => fs.existsSync(imgPath(pid, date));
  return { status, startEpisode, episodeJob, allow, startImage, jobFor, hasImage, imgPath, stop: () => { if (S.child) killTree(S.child.pid); } };
}
module.exports = { create };
