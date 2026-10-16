'use strict';
// Phase 6 "feel": FF-style level-up window, chiptune sounds, boss-hit and perfect-day moments, and the Status screen.
// Loaded last so it can refine functions from app.js. Everything respects calm mode (rpgCalm) and the sound setting.

const feelRpg = () => document.documentElement.dataset.skin === 'rpg';

// 3-step screen flash in the effects layer (outside #app, so re-renders never replay it)
function fxFlash(kind = '') {
  if (rpgCalm()) return; const h = document.getElementById('fxl'); if (!h) return;
  const d = document.createElement('div'); d.className = 'fx-flash ' + kind; h.append(d); setTimeout(() => d.remove(), 450);
}

// ── level-up: a window whose lines appear one by one ──
levelUp = function (l) {
  const snap = S.saga.lvSnap || null, now = {}; STAT_KEYS.forEach(k => { now[k] = statLevel(S.stats[k] || 0); });
  const lines = [`${esc(S.profile.name || 'Hero')} is now Lv ${l}`];
  if (titleOf(l) !== titleOf(l - 1)) lines.push(`Title: ${titleOf(l - 1)} → ${titleOf(l)}`);
  if (snap) STAT_KEYS.forEach(k => { const was = snap[k] || 1; if (now[k] > was) lines.push(`${SAGA_ABILITY[k][0]}: ${was} → ${now[k]}`); });
  if (typeof sagaGear === 'function' && sagaGear(l) !== sagaGear(l - 1)) lines.push(`New gear: ${esc(sagaGear(l))}`);
  const unlocked = AVATARS.filter(([, lv]) => lv === l).map(([e]) => e); if (unlocked.length) lines.push(`New portrait: ${unlocked.join(' ')}`);
  S.saga.lvSnap = now; save();
  sfx.level(); buzz([60, 40, 120]); confetti(160); fxFlash();
  const calm = rpgCalm();
  openModal(`<div class="lvl-win" role="status"><div class="lvl-title">★ LEVEL UP! ★</div>
    <div aria-live="polite">${lines.map((x, i) => `<div class="lvl-line" data-i="${i}"${calm ? '' : ' style="visibility:hidden"'}>${x}</div>`).join('')}</div>
    <button class="btn block" data-act="close" style="margin-top:14px">▶ OK</button></div>`, true);
  if (!calm) lines.forEach((_, i) => setTimeout(() => { const e = document.querySelector(`.lvl-line[data-i="${i}"]`); if (e) { e.style.visibility = 'visible'; if (typeof btBlip === 'function') btBlip(); } }, 400 + i * 450));
};

// ── chiptune voice (square waves, low volume). Only in the 16-bit skin; the classic skin keeps its original sounds. ──
{
  const orig = { ...sfx }, q = (f, d, t, v = .04) => tone(f, d, t, 'square', v);
  sfx.ding = () => feelRpg() ? (q(880, .05, 0), q(1320, .08, .05)) : orig.ding();
  sfx.undo = () => feelRpg() ? q(330, .08, 0) : orig.undo();
  sfx.level = () => feelRpg() ? ([523, 659, 784, 1047, 1319].forEach((f, i) => q(f, .14, i * .09)), q(1568, .45, .5)) : orig.level();
  sfx.chest = () => feelRpg() ? [392, 523, 659, 784, 1047].forEach((f, i) => q(f, .1, i * .06)) : orig.chest();
  sfx.hit = () => feelRpg() ? (q(160, .12, 0, .05), q(110, .18, .06, .05)) : orig.hit();
}

// ── moments ──
function perfectFx() { fxFlash('gold'); popNum('PERFECT!', 'xp'); }
function bossHit(text, slain) {
  setTimeout(() => {
    const b = document.querySelector('#app .card.boss'); if (!b) return;
    const r = b.getBoundingClientRect(); rpgLast = { x: r.left + r.width / 2, y: r.top + 90 };
    if (!rpgCalm()) { b.classList.add(slain ? 'ko' : 'hit'); setTimeout(() => b.classList.remove('hit', 'ko'), 800); }
    popNum(text, 'dmg');
  }, 40);
}

// ── Status screen: window, attributes as bars, equipment ──
function statusWindow() {
  const l = level(), lower = 40 * (l - 1) * (l - 1), upper = 40 * l * l, pct = Math.max(0, Math.min(100, Math.round((S.xp - lower) / (upper - lower) * 100)));
  const keys = STAT_KEYS, lv = keys.map(k => statLevel(S.stats[k] || 0)), mx = Math.max(5, ...lv);
  const top = keys.slice().sort((a, b) => (S.stats[b] || 0) - (S.stats[a] || 0))[0];
  const nextGear = (() => { for (let x = l + 1; x <= l + 40; x++) if (sagaGear(x) !== sagaGear(l)) return `${sagaGear(x)} at Lv ${x}`; return 'You wear the finest gear.'; })();
  return `<div class="card"><div class="win-title">STATUS</div>
    <div class="row"><div class="avatar" style="width:72px;height:72px;font-size:40px;flex:none">${S.profile.avatar}</div>
      <div class="grow"><b style="font-size:1.15rem">${esc(S.profile.name)}</b><div class="sm dim">Lv ${l} ${titleOf(l)}</div><div class="sm dim">Class: ${SAGA_CLASS[top]}</div></div></div>
    <div class="gauge" style="margin-top:10px"><span class="lbl">EXP</span><span class="num">${S.xp} · NEXT ${Math.max(0, upper - S.xp)}</span><div class="bar"><i style="width:${pct}%"></i></div></div></div>
  <div class="card"><div class="win-title">ATTRIBUTES</div>
    ${keys.map((k, i) => `<div class="attr"><span class="ab">${SAGA_ABILITY[k][0]}</span><b>${lv[i]}</b><span class="md">+${abilityMod(k)}</span><div class="bar"><i style="width:${Math.round(lv[i] / mx * 100)}%"></i></div><span class="dim an">${STATS[k].n}</span></div>`).join('')}
    <details style="margin-top:10px"><summary class="sm dim" style="cursor:pointer">Show chart</summary>${radar()}</details></div>
  <div class="card"><div class="win-title">EQUIPMENT</div>
    <div class="row"><span class="dim" style="width:64px">Armor</span><span class="grow">${esc(sagaGear(l))}</span></div>
    <div class="row" style="margin-top:6px"><span class="dim" style="width:64px">Next</span><span class="grow">${esc(nextGear)}</span></div></div>`;
}
