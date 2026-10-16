'use strict';
/* The Saga: your real-life actions are the modifiers on a D&D-style campaign.
   Every day the hero faces an encounter (the week's boss, stronger each day). The d20 is rolled fairly from a fixed seed,
   so there is no re-rolling for a better result; what you actually did sets the modifier. Misses are setbacks that turn into
   training montages, never punishments, and a day with no actions is a calm campfire rest.
   Episodes are written by a local LLM on your server and illustrated by a local Stable Diffusion, with a template fallback. */

const SAGA_ABILITY = { body: ['STR', 'Strength'], mind: ['INT', 'Intelligence'], spirit: ['WIS', 'Wisdom'], craft: ['DEX', 'Dexterity'], social: ['CHA', 'Charisma'], wealth: ['LCK', 'Luck'] };
const SAGA_CLASS = { body: 'Fighter', mind: 'Wizard', spirit: 'Monk', craft: 'Rogue', social: 'Bard', wealth: 'Treasure Hunter' };
const SAGA_PHASES = ['Scout', 'Lieutenant', 'Champion', 'Warlord', 'Shadow', 'Avatar', 'True Form'];      // Monday … Sunday
const SAGA_DCS = [10, 11, 12, 13, 14, 15, 16];
const SAGA_OUTCOME = {
  critical: ['💥', 'CRITICAL SUCCESS', 'var(--gold)'], success: ['⚔️', 'SUCCESS', 'var(--good)'], narrow: ['🌧️', 'NARROW MISS', 'var(--blue)'],
  setback: ['🛡️', 'SETBACK', 'var(--blue)'], fumble: ['🤡', 'COMIC FUMBLE', 'var(--dim)'], rest: ['🏕️', 'REST DAY', 'var(--dim)'],
};
const sagaRT = { status: null, statusAt: 0, imgs: {}, busy: {}, loadingImg: {} };

// ── dice (deterministic: the same date always gives the same roll) ──
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function sagaSeed() { if (!S.saga.seed) { S.saga.seed = uid() + uid(); save(); } return S.saga.seed; }
const sagaD20 = date => 1 + Math.floor(mulberry(strHash(sagaSeed() + '|' + date))() * 20);
const abilityMod = k => Math.min(6, Math.floor(statLevel(S.stats[k] || 0) / 2));

// everything the hero did on a date, from your own logs (no journal text, no money amounts)
function sagaDay(date) {
  const habits = S.habits.filter(h => h.log[date]).map(h => ({ name: h.name, stat: h.stat, xp: h.log[date].xp || 0 }));
  const quests = S.quests.filter(q => q.done && q.doneAt && dkey(new Date(q.doneAt)) === date).map(q => ({ name: q.name, stat: q.stat, xp: q.xp || 0 }));
  const focus = S.focus.sessions.filter(s => s.date === date), statXp = {}, add = (k, x) => { statXp[k] = (statXp[k] || 0) + x; };
  habits.forEach(h => add(h.stat, h.xp)); quests.forEach(q => add(q.stat, q.xp)); focus.forEach(f => add(f.stat || 'mind', f.min * 2));
  const focusMin = focus.reduce((n, f) => n + f.min, 0), xp = S.history[date] || 0, top = Object.entries(statXp).sort((a, b) => b[1] - a[1])[0];
  const later = Object.entries(S.history).filter(([d]) => d >= date).reduce((n, [, v]) => n + v, 0), start = Math.max(0, S.xp - later);
  return { date, habits, quests, focusMin, perfect: !!S.perfect[date], mood: S.checkins[date]?.mood, xp, topStat: top ? top[0] : null, lvBefore: levelOf(start), lvAfter: levelOf(start + xp), any: habits.length + quests.length + focusMin > 0 };
}
const actionBonus = d => Math.min(3, Math.ceil(d.habits.length / 2)) + (d.perfect ? 2 : 0) + Math.min(2, Math.floor(d.focusMin / 25)) + Math.min(2, Math.ceil(d.quests.length / 2)) + (d.mood != null ? 1 : 0);
function sagaCheck(date, d = sagaDay(date)) {
  const dt = new Date(date + 'T12:00:00'), wd = (dt.getDay() + 6) % 7, boss = WBOSSES[Math.round(weekStart(dt).getTime() / (7 * 864e5)) % WBOSSES.length];
  const ab = d.topStat || STAT_KEYS.slice().sort((a, b) => (S.stats[b] || 0) - (S.stats[a] || 0))[0];
  const out = { boss: { n: boss.n, e: boss.e }, phase: SAGA_PHASES[wd], dc: SAGA_DCS[wd], ability: ab, mod: abilityMod(ab), bonus: actionBonus(d) };
  if (!d.any) return { ...out, d20: 0, total: 0, outcome: 'rest' };
  const d20 = sagaD20(date), total = d20 + out.mod + out.bonus;
  return { ...out, d20, total, outcome: d20 === 20 ? 'critical' : d20 === 1 ? 'fumble' : total >= out.dc ? 'success' : total >= out.dc - 4 ? 'narrow' : 'setback' };
}
const sagaOdds = (mod, bonus, dc) => { let w = 0; for (let f = 1; f <= 20; f++) if (f === 20 || (f !== 1 && f + mod + bonus >= dc)) w++; return w / 20; };

// ── the hero's look grows with level, so XP visibly pays off in the pictures ──
const sagaGear = lv => lv < 3 ? 'simple travelling clothes' : lv < 6 ? 'leather armor and a travelling cloak' : lv < 10 ? 'reinforced steel armor and a flowing cape' : lv < 18 ? 'ornate silver plate armor with glowing runes and a heroic cape' : 'legendary radiant armor, floating glowing runes, a majestic cape';
const sagaLook = () => (S.saga.look || '').trim() || 'a young adventurer with messy dark hair and a bright scarf, determined expression';
const SAGA_MOOD = { critical: 'epic victory, explosive glowing power, dramatic sky', success: 'triumphant, confident, glowing', narrow: 'battered but determined, hard-fought, rain, resolute eyes', setback: 'regrouping at dawn, resolute eyes, training montage', fumble: 'comic mishap, laughing, sweatdrop, lighthearted', rest: 'peaceful campfire at night, stars, relaxing, warm light' };

// ── the prompt the storyteller receives ──
function sagaPrompt(date, d, chk) {
  const names = S.saga.names !== false, list = a => a.length ? (names ? a.map(x => x.name).join(', ') : a.length + ' tasks') : 'none';
  const cls = SAGA_CLASS[STAT_KEYS.slice().sort((a, b) => (S.stats[b] || 0) - (S.stats[a] || 0))[0]], [abbr, abName] = SAGA_ABILITY[chk.ability];
  const prev = Object.entries(S.saga.eps).filter(([k]) => k < date).sort().slice(-3).map(([, e]) => e.recap).filter(Boolean);
  const o = { critical: 'CRITICAL SUCCESS (natural 20)', success: 'SUCCESS', narrow: 'NARROW MISS', setback: 'SETBACK', fumble: 'FUMBLE (natural 1)', rest: 'REST DAY' }[chk.outcome];
  return [
    `HERO: ${S.profile.name}, level ${d.lvAfter} ${titleOf(d.lvAfter)}. Class: ${cls}. Gear: ${sagaGear(d.lvAfter)}.`,
    `CAMPAIGN: Chapter ${(S.saga.eps[date]?.n) || (S.saga.n + 1)}. This week's villain: ${chk.boss.n}, tonight's form: the ${chk.phase}.`,
    `PREVIOUS EPISODES: ${prev.length ? prev.join(' ') : 'This is the first episode.'}`,
    chk.outcome === 'rest' ? `YESTERDAY'S REAL ACTIONS: none. The hero rested.`
      : `YESTERDAY'S REAL ACTIONS: finished ${d.habits.length} daily rituals (${list(d.habits)}); completed ${d.quests.length} missions (${list(d.quests)}); fought ${d.focusMin ? 'focus duels totalling ' + d.focusMin + ' minutes' : 'no focus duels'}; ${d.mood != null ? 'checked in with a ' + ['miserable', 'low', 'neutral', 'good', 'excellent'][d.mood] + ' mood' : 'no mood check-in'}. ${d.perfect ? 'A PERFECT DAY: every ritual done.' : 'Not a perfect day.'}`,
    chk.outcome === 'rest' ? 'ABILITY CHECK: none (rest day).'
      : `ABILITY CHECK: ${abName} (${abbr}) vs DC ${chk.dc}. The d20 rolled ${chk.d20}, +${chk.mod} for ability, +${chk.bonus} for the actions above = ${chk.total}. Result: ${o}.`,
    d.lvAfter > d.lvBefore ? `The hero LEVELED UP to level ${d.lvAfter}!` : 'No level-up occurred.',
  ].join('\n');
}

// ── offline fallback: a short template story so the feature still works with no AI available ──
function sagaFallback(chk, d) {
  const n = S.profile.name || 'The hero', f = chk.boss.n, pick_ = a => a[Math.floor(Math.random() * a.length)];
  const acts = [d.habits.length && `${d.habits.length} daily ritual${d.habits.length > 1 ? 's' : ''}`, d.quests.length && `${d.quests.length} mission${d.quests.length > 1 ? 's' : ''}`, d.focusMin && `${d.focusMin} minutes of focused dueling`].filter(Boolean).join(', ');
  const roll = chk.outcome === 'rest' ? '' : ` The DM's d20 clatters to a stop: ${chk.d20} + ${chk.mod} + ${chk.bonus} = ${chk.total} against DC ${chk.dc}.`;
  const T = {
    critical: [`Critical Strike!`, `${n} steps into the clearing, still glowing from ${acts}.${roll} A natural twenty! Power erupts, and the ${chk.phase} of the ${f} is flung back in a blaze of light.`, 'a heroic pose, explosive light, dramatic sky'],
    success: [`Victory at Dawn`, `Fueled by ${acts}, ${n} faces the ${chk.phase} of the ${f}.${roll} The blow lands true and the foe retreats, snarling.`, 'a confident stance, glowing aura, golden hour'],
    narrow: [`A Close One`, `${n} gives everything after ${acts}, but the ${chk.phase} of the ${f} holds on.${roll} A narrow miss! ${n} falls back, grinning through the rain, already planning tomorrow.`, 'a battered hero smiling in the rain, determined eyes'],
    setback: [`The Training Montage`, `The ${chk.phase} of the ${f} proves tough today.${roll} ${n} retreats, bruised but unbowed, and trains harder at the camp. Every small step still counts.`, 'a hero training at dawn, resolute eyes, warm light'],
    fumble: [`Oops, Natural One`, `${n} charges the ${chk.phase} of the ${f}, trips over a root and lands face-first in a bush.${roll} Everyone laughs, including ${n}. Tomorrow will go better.`, 'a comic tumble, sweatdrop, lighthearted'],
    rest: [`Campfire Night`, `${n} rests by the fire today. No battle, just warm stew, mended gear and bright stars. Even heroes need a quiet chapter.`, 'a peaceful campfire at night, stars'],
  }[chk.outcome];
  return { title: T[0], story: T[1], recap: `${n} ${chk.outcome === 'rest' ? 'rested at camp' : chk.outcome === 'critical' || chk.outcome === 'success' ? 'beat the ' + chk.phase : 'regrouped after meeting the ' + chk.phase}.`, scene: T[2], teaser: pick_([`Tomorrow, the ${f} sends something stronger.`, `The ${f} is watching from the shadows…`, `A new challenge stirs at the edge of the map.`]), src: 'template' };
}

// ── talking to the server (storyteller + painter) ──
async function sagaStatus(force) {
  if (!force && sagaRT.status && Date.now() - sagaRT.statusAt < 30000) return sagaRT.status;
  try { const r = await apiFetch('/api/saga/status'); sagaRT.status = r.ok ? await r.json() : null; } catch { sagaRT.status = null; }
  sagaRT.statusAt = Date.now(); return sagaRT.status;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function sagaPollEpisode(date) {
  for (let i = 0; i < 260; i++) {                           // up to ~17 minutes (a cold model load from a slow disk can take a while)
    const r = await apiFetch('/api/saga/episode?date=' + date);
    if (r.status === 200) return (await r.json()).episode;
    if (r.status !== 202) throw new Error((await r.json().catch(() => ({}))).error || 'story failed');
    const ph = (await r.json()).status; if (sagaRT.busy[date] !== ph) { sagaRT.busy[date] = ph; if (tab === 'today' || tab === 'saga') render(); }
    await sleep(i < 20 ? 4000 : 15000);
  }
  const e = new Error('still waiting'); e.keepWaiting = true; throw e;
}
async function sagaGenerate(date, again) {
  if (sagaRT.busy[date]) return;
  sagaRT.busy[date] = 'writing'; if (tab === 'today' || tab === 'saga') render();
  const d = sagaDay(date), chk = sagaCheck(date, d); let ep;
  try {
    const st = await sagaStatus(true);
    if (!st || !st.llm) throw new Error('no storyteller');
    if (!S.saga.pending[date]) {
      const r = await apiFetch('/api/saga/episode', { method: 'POST', body: JSON.stringify({ date, input: sagaPrompt(date, d, chk) }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
      S.saga.pending[date] = true; save();
    }
    ep = { ...(await sagaPollEpisode(date)), src: 'ai' };
  } catch (e) {
    if (e.keepWaiting) { delete sagaRT.busy[date]; save(); if (tab === 'today' || tab === 'saga') render(); return; }       // the server keeps the job; sagaResume() collects it later
    console.warn('Saga: using the template story:', e.message || e); ep = sagaFallback(chk, d);
  }
  delete S.saga.pending[date];
  const old = S.saga.eps[date];
  S.saga.eps[date] = { ...ep, date, n: old ? old.n : ++S.saga.n, check: chk, lv: d.lvAfter, img: again ? 'none' : (old?.img || 'none') };
  delete sagaRT.busy[date]; save(); render();
  if (!old || again) sagaPaint(date);
  toast('📖 New episode: ' + (ep.title || 'your story'), 'gold'); sfx.chest();
}
async function sagaPaint(date) {
  const ep = S.saga.eps[date]; if (!ep) return;
  const st = await sagaStatus(true); if (!st || (!st.sd && !st.canLaunchSd)) { ep.img = 'none'; save(); return; }
  ep.img = 'painting'; save(); if (tab === 'today' || tab === 'saga') render();
  try {
    const r = await apiFetch('/api/saga/image', { method: 'POST', body: JSON.stringify({ date, look: sagaLook(), gear: sagaGear(ep.lv || level()), scene: ep.scene || '', mood: SAGA_MOOD[ep.check?.outcome] || '', seed: strHash(sagaSeed() + date) % 2147483647 }) });
    if (!r.ok) throw new Error('image refused');
    for (let i = 0; i < 120; i++) {                          // up to ~10 minutes (a cold start loads the model)
      const g = await apiFetch('/api/saga/image?date=' + date);
      if (g.status === 200) { sagaRT.imgs[date] = URL.createObjectURL(await g.blob()); ep.img = 'done'; save(); render(); return; }
      if (g.status !== 202) throw new Error('image failed');
      await sleep(5000);
    }
    throw new Error('image timed out');
  } catch (e) { console.warn('Saga image:', e.message || e); ep.img = 'error'; save(); if (tab === 'today' || tab === 'saga') render(); }
}
async function sagaLoadImg(date) {
  if (sagaRT.imgs[date] || sagaRT.loadingImg[date] || S.saga.eps[date]?.img !== 'done') return;
  sagaRT.loadingImg[date] = true;
  try { const g = await apiFetch('/api/saga/image?date=' + date); if (g.status === 200) { sagaRT.imgs[date] = URL.createObjectURL(await g.blob()); render(); } } catch { }
  delete sagaRT.loadingImg[date];
}

// ── screens ──
const yesterday = () => addDays(today(), -1);
function diceLine(c) {
  if (!c || c.outcome === 'rest') return '🏕️ Rest day: no check needed';
  const [e, label] = SAGA_OUTCOME[c.outcome];
  return `🎲 ${c.d20} + ${c.mod} + ${c.bonus} = ${c.total} vs DC ${c.dc} · ${e} ${label}`;
}
function sagaImgTag(date, h) {
  const ep = S.saga.eps[date], src = sagaRT.imgs[date];
  if (src) return `<img class="portrait" src="${src}" alt="Episode illustration" style="height:${h}px">`;
  if (ep?.img === 'done') { sagaLoadImg(date); }
  const msg = ep?.img === 'painting' ? '🎨 Painting the scene…' : ep?.img === 'error' ? 'Illustration unavailable' : '🎬';
  return `<div class="portrait-slot" style="height:${h > 200 ? 120 : 70}px;font-size:${ep?.img === 'none' || !ep?.img ? 34 : 15}px">${msg}</div>`;
}
function sagaCard() {
  const A_ = S.saga;
  if (!A_.on) return `<div class="card glow" style="border-color:var(--acc)"><div class="row"><div style="font-size:34px">📖</div><div class="grow"><b>Your life is a campaign</b><div class="sm dim">Every real action you take powers your hero. Each morning, read the anime episode of what yesterday's effort did.</div></div></div><button class="btn block" style="margin-top:10px" data-act="saga-on">Begin the Saga</button></div>`;
  const y = yesterday(), ep = A_.eps[y], busy = sagaRT.busy[y] || A_.pending[y];
  let main;
  if (ep) main = `<div data-act="saga-read" data-d="${y}" style="cursor:pointer">${sagaImgTag(y, 190)}<div style="margin-top:8px"><div class="sm dim">EPISODE ${ep.n}${ep.seen ? '' : ' <span class="chip newchip">NEW</span>'}</div><b style="font-size:1.1rem">${esc(ep.title)}</b><div class="sm" style="margin-top:2px">${diceLine(ep.check)}</div></div></div><button class="btn sm gold" style="margin-top:8px" data-act="saga-read" data-d="${y}">▶ Watch episode</button>`;
  else if (busy) main = `<div class="row"><div style="font-size:28px">${busy === 'waiting-gpu' ? '⏳' : '✍️'}</div><div class="grow"><b>${busy === 'waiting-gpu' ? 'Waiting for the graphics card…' : 'The storyteller is writing…'}</b><div class="sm dim">${busy === 'waiting-gpu' ? 'Another app is using the GPU, so the story starts as soon as it is free. You can keep using the app.' : 'The episode will appear here. You can keep using the app.'}</div></div></div>`;
  else if (sagaDay(y).any || A_.n > 0) main = `<div class="row"><div class="grow"><b>Yesterday's episode</b><div class="sm dim">${sagaDay(y).any ? 'Your actions are ready to become a story.' : 'A quiet day: the hero rests at camp.'}</div></div><button class="btn sm" data-act="saga-gen" data-d="${y}">Write it</button></div>`;
  else main = `<div class="sm dim">Your first episode is written the morning after your first day of real actions. Go earn some XP!</div>`;
  return `<div class="card glow"><div class="sm dim" style="margin-bottom:6px">📖 THE SAGA</div>${main}</div>${sagaTonight()}`;
}
// what would raise tonight's odds, worked out from the real bonus rules (only options that actually help)
function sagaRaiseOptions(t, d, c) {
  const cur = c.bonus, bonusWith = patch => actionBonus({ ...d, ...patch }), opts = [];
  const left = todaysHabits().filter(h => !h.log[t]).length, open = S.quests.filter(q => !q.done).length;
  for (let k = 1; k <= Math.min(2, left); k++) { const g = bonusWith({ habits: d.habits.concat(Array(k).fill({})) }) - cur; if (g > 0) { opts.push({ g, label: k + ' more ritual' + (k > 1 ? 's' : ''), act: 'today' }); break; } }
  const f = bonusWith({ focusMin: d.focusMin + 25 }) - cur; if (f > 0) opts.push({ g: f, label: '25 minutes of focus', act: 'focus' });
  for (let k = 1; k <= Math.min(2, open); k++) { const g = bonusWith({ quests: d.quests.concat(Array(k).fill({})) }) - cur; if (g > 0) { opts.push({ g, label: k + ' more quest' + (k > 1 ? 's' : ''), act: 'quests' }); break; } }
  if (!d.perfect && left > 0) { const g = bonusWith({ perfect: true, habits: d.habits.concat(Array(left).fill({})) }) - cur; if (g > 0) opts.push({ g, label: 'finish all ' + left + ' ritual' + (left > 1 ? 's' : '') + ' (perfect day)', act: 'today' }); }
  if (d.mood == null) { const g = bonusWith({ mood: 2 }) - cur; if (g > 0) opts.push({ g, label: 'daily check-in (+10 XP)', act: 'checkin' }); }
  return opts.map(o => ({ ...o, odds: Math.round(sagaOdds(c.mod, cur + o.g, c.dc) * 100) })).sort((x, y) => y.odds - x.odds).slice(0, 4);
}
function sagaTonight() {
  const t = today(), d = sagaDay(t), c = sagaCheck(t, d), odds = Math.round(sagaOdds(c.mod, c.bonus, c.dc) * 100), [abbr] = SAGA_ABILITY[c.ability];
  const col = odds >= 70 ? 'var(--good)' : odds >= 45 ? 'var(--gold)' : 'var(--bad)', opts = sagaRaiseOptions(t, d, c);
  return `<div class="card forecast" role="group" aria-label="Tonight's forecast"><div class="win-title">TONIGHT'S FORECAST</div>
    <div class="row"><div style="font-size:34px">${c.boss.e}</div><div class="grow"><b>${esc(c.boss.n)}</b><div class="sm dim">the ${c.phase} · DC ${c.dc}</div></div></div>
    <div class="fc-hit"><span class="lbl">HIT</span><b class="num" style="color:${col}" aria-label="Hit chance ${odds} percent">${d.any ? odds + '%' : '~' + odds + '%'}</b></div>
    <div class="bar" role="img" aria-label="Hit chance ${odds} percent"><i style="width:${odds}%;background:${col}"></i></div>
    <div class="fc-stats"><span>MOD <b>+${c.mod} ${abbr}</b></span><span>ACT <b>+${c.bonus}</b></span><span>CRIT <b>5%</b></span></div>
    ${opts.length ? `<div class="sm dim" style="margin-top:12px">Raise your odds</div>${opts.map(o => `<button class="fc-opt" data-act="saga-raise" data-k="${o.act}"><b>+${o.g}</b> ${o.label} <span class="dim">→ ${o.odds}%</span></button>`).join('')}` : '<div class="sm" style="margin-top:12px">Your preparation is at its peak. Finish strong.</div>'}
    <div class="sm dim" style="margin-top:10px">The die is cast at dawn and can't be re-rolled. Your actions today set the modifier. 🎲</div></div>`;
}
const sagaUnread = () => { const ep = S.saga.eps[yesterday()]; return !!(S.saga.on && ep && !ep.seen); };
function sagaRead(date) {
  const ep = S.saga.eps[date]; if (!ep) return;
  if (!ep.seen) { ep.seen = true; save(); setTimeout(render, 0); }
  const c = ep.check, [e, label, col] = SAGA_OUTCOME[c?.outcome || 'rest'];
  const dice = !c || c.outcome === 'rest' ? '<div class="sm dim" style="text-align:center">🏕️ Rest day, so no dice were rolled. Your hero recovers.</div>' :
    `<div style="text-align:center"><div style="font-size:3rem;font-weight:800;line-height:1">🎲 ${c.d20}</div><div class="sm dim" style="margin:4px 0">d20 ${c.d20} + ${SAGA_ABILITY[c.ability][0]} ${c.mod} + actions ${c.bonus} = <b style="color:var(--txt)">${c.total}</b> vs DC ${c.dc}</div><div style="font-weight:800;color:${col}">${e} ${label}</div></div>`;
  openModal(`${sagaImgTag(date, 420)}<div class="sm dim" style="margin-top:12px">EPISODE ${ep.n} · ${date}</div><h2 style="margin:4px 0 8px">${esc(ep.title)}</h2>
    <div class="card" style="margin-bottom:10px">${dice}</div>
    ${String(ep.story).split('\n').filter(x => x.trim()).map(p => `<p style="line-height:1.55;margin:0 0 10px">${esc(p)}</p>`).join('')}
    ${ep.teaser ? `<p class="dim" style="font-style:italic">${esc(ep.teaser)}</p>` : ''}
    <div class="sm dim" style="margin-bottom:10px">${ep.src === 'ai' ? '✨ Written by your local AI storyteller' : '📜 Template story (AI storyteller unavailable)'}</div>
    <div class="row"><button class="btn ghost grow" data-act="saga-repaint" data-d="${date}">🎨 New picture</button><button class="btn grow" data-act="close">Close</button></div>`);
}
function sagaSettings() {
  const A_ = S.saga, st = sagaRT.status, eps = Object.entries(A_.eps).sort().reverse().slice(0, 10);
  return `<h2>📖 The Saga</h2><div class="card"><div class="row"><span class="grow">Daily anime episode</span><button class="btn sm ${A_.on ? '' : 'ghost'}" data-act="${A_.on ? 'saga-off' : 'saga-on'}">${A_.on ? 'On' : 'Off'}</button></div>
    ${A_.on ? `<label>How does your hero look? (used for the pictures)</label><input id="sg-look" maxlength="200" value="${esc(A_.look)}" placeholder="a young adventurer with messy dark hair and a bright scarf">
      <div class="row" style="margin-top:10px"><span class="grow sm">Use habit and quest names in stories</span><button class="btn sm ${A_.names !== false ? '' : 'ghost'}" data-act="saga-names">${A_.names !== false ? 'On' : 'Off'}</button></div>
      <div class="row" style="margin-top:10px"><button class="btn sm grow" data-act="saga-save">Save look</button><button class="btn sm ghost grow" data-act="saga-check">Check AI status</button></div>
      <div class="sm dim" style="margin-top:8px">${!st ? 'Tap "Check AI status" to see whether your server can write and paint.' : `Storyteller (${esc(st.model)}): ${st.llm ? '✅ ready' : '❌ not found'} · Painter: ${st.sd ? '✅ running' : st.canLaunchSd ? '🟡 starts on demand' : '❌ not set up'}`}</div>
      <div class="dim" style="font-size:.72rem;margin-top:6px">Stories are written by AI models running on your own PC. Journal text and money amounts are never used.</div>
      ${eps.length ? `<div style="margin-top:10px"><b class="sm">Past episodes</b>${eps.map(([k, e]) => `<div class="row sm" style="padding:5px 0" data-act="saga-read" data-d="${k}"><span style="width:44px" class="dim">Ep ${e.n}</span><span class="grow">${esc(e.title)}</span><span>${(SAGA_OUTCOME[e.check?.outcome] || SAGA_OUTCOME.rest)[0]}</span></div>`).join('')}</div>` : ''}` : '<div class="sm dim" style="margin-top:6px">Turn it on to turn each day of real effort into a story.</div>'}</div>`;
}

// ── automatic daily episode ──
function sagaAuto() {
  const A_ = S.saga; if (!A_.on || !S.profile.name) return;
  const y = yesterday();
  if (A_.eps[y] || A_.tried[y] || sagaRT.busy[y]) return;
  if (!sagaDay(y).any && A_.n === 0) return;                 // nothing to tell yet
  A_.tried[y] = true; save(); sagaGenerate(y);
}
async function sagaResume() {                                 // a story may have finished while the app was closed
  for (const date of Object.keys(S.saga.pending || {})) {
    if (sagaRT.busy[date]) continue;
    try { const r = await apiFetch('/api/saga/episode?date=' + date); if (r.status === 404) { delete S.saga.pending[date]; save(); } else sagaGenerate(date); } catch { }
  }
}
function sagaBoot() {
  setTimeout(() => { sagaResume(); sagaAuto(); }, 3500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(sagaAuto, 1500); });
}

HOOKS['today-top'].push(sagaCard);
HOOKS.config.push(sagaSettings);
Object.assign(A, {
  'saga-on': () => { S.saga.on = true; sagaSeed(); save(); render(); toast('The Saga begins! 📖', 'gold'); sagaStatus(true).then(() => tab === 'hero' && render()); setTimeout(sagaAuto, 500); },
  'saga-off': () => { S.saga.on = false; save(); render(); },
  'saga-read': el => sagaRead(el.dataset.d),
  'saga-raise': el => {
    const k = el.dataset.k; tab = k === 'focus' ? 'focus' : k === 'quests' ? 'quests' : 'today'; render(); window.scrollTo(0, 0);
    if (k === 'today' || k === 'checkin') setTimeout(() => { const h = [...document.querySelectorAll('#app h2')].find(x => x.textContent.includes(k === 'checkin' ? 'Daily check-in' : "Today's habits")); h && h.scrollIntoView({ block: 'start' }); }, 50);
  },
  'saga-gen': el => sagaGenerate(el.dataset.d),
  'saga-repaint': el => { closeModal(); const e = S.saga.eps[el.dataset.d]; if (e) { e.img = 'none'; delete sagaRT.imgs[el.dataset.d]; sagaPaint(el.dataset.d); toast('Repainting…'); } },
  'saga-names': () => { S.saga.names = S.saga.names === false; save(); render(); },
  'saga-save': () => { S.saga.look = val('sg-look').trim().slice(0, 200); save(); toast('Saved. Your next picture uses this look.'); },
  'saga-check': async () => { toast('Checking…'); await sagaStatus(true); render(); },
});

// ── the Saga tab: this week's chapter, tonight's forecast, and the chronicle of past episodes ──
function viewSaga() {
  const A_ = S.saga, days = weekDays(0), names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], t = today();
  const c = sagaCheck(t), strip = days.map((d, i) => {
    const ep = A_.eps[d], glyph = ep ? (SAGA_OUTCOME[ep.check?.outcome] || SAGA_OUTCOME.rest)[0] : (d === t ? '❔' : '·');
    return `<div style="text-align:center;flex:1;${d === t ? 'color:var(--acc)' : ''}"><div class="sm dim">${names[i]}</div><div style="font-size:22px;min-height:30px">${glyph}</div></div>`;
  }).join('');
  const eps = Object.entries(A_.eps).sort().reverse();
  return `<div class="card"><div class="win-title">CHAPTER ${Math.max(1, A_.n)}</div><div class="row"><div style="font-size:34px">${c.boss.e}</div><div class="grow"><b>${esc(c.boss.n)}</b><div class="sm dim">Villain of the week</div></div></div>
    <div class="row" style="margin-top:10px">${strip}</div></div>
    ${sagaCard()}
    <h2>📜 Chronicle <small>${eps.length} episode${eps.length === 1 ? '' : 's'}</small></h2>
    ${eps.length ? eps.slice(0, 30).map(([k, e]) => `<div class="task" data-act="saga-read" data-d="${k}"><div class="em">${(SAGA_OUTCOME[e.check?.outcome] || SAGA_OUTCOME.rest)[0]}</div><div class="grow"><div class="nm">Ep ${e.n} · ${esc(e.title)}</div><div class="sm dim">${k}</div></div>${e.seen ? '' : '<span class="chip">NEW</span>'}</div>`).join('') : '<div class="empty">Your first episode appears the morning after your first day of real actions.</div>'}
    <div class="sm dim" style="margin-top:10px">Saga settings live in Menu → Config.</div>`;
}
