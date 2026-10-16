'use strict';
/* The Saga battle scene: an episode played as a turn-based encounter.
   Pure presentation. Every number comes from the episode's stored check (ep.check): the d20 was cast at dawn from a fixed seed,
   and nothing the player taps here can change it. Lives in #battle (outside #app) so render() never wipes it mid-scene. */

const BT = { sc: null };
const btSleep = ms => new Promise(r => setTimeout(r, ms));
const btHost = () => document.getElementById('battle');
const btBlip = () => { try { if (S.settings.sound && typeof tone === 'function') tone(1320, .03, 0, 'square', .03); } catch { } };
const btCheckDead = sc => { if (sc.dead) throw new Error('closed'); };
const btQ = s => document.querySelector('#battle ' + s);

function btShell(sc) {
  const lv = sc.ep.lv || sc.d.lvAfter, ab = sc.chk.ability, [abbr] = SAGA_ABILITY[ab] || ['STR'];
  const pct = Math.min(100, Math.round((sc.chk.bonus || 0) / 10 * 100));
  return `<div class="bt-top"><button class="bt-link" data-bt="text">Skip to text</button><button class="bt-x" data-bt="close" aria-label="Leave the scene">✕</button></div>
  <div class="bt-stage" id="bt-stage"></div>
  <div class="bt-win bt-msg" id="bt-msg" tabindex="0" role="status" aria-live="polite" aria-label="Story message, tap to continue"><div class="bt-text"></div></div>
  <div class="bt-panel">
    <div class="bt-win bt-hero" id="bt-hero"><div class="bt-title">${esc(S.profile.name)}</div><div class="bt-sub">Lv ${lv} · ${SAGA_CLASS[ab] || 'Hero'} (${abbr})</div>
      <div class="gauge"><span class="lbl">ACT</span><span class="num">+${sc.chk.bonus || 0}</span><div class="bar"><i style="width:${pct}%"></i></div></div></div>
    <div class="bt-win bt-cmds" id="bt-cmds" role="menu" aria-label="Command"></div>
  </div>`;
}

function btWipe() {
  return new Promise(r => {
    if (rpgCalm()) return r();
    const host = btHost(), w = document.createElement('div'); w.className = 'bt-wipe';
    w.innerHTML = Array.from({ length: 8 }, (_, i) => `<i style="--n:${i}"></i>`).join('');
    host.append(w); setTimeout(() => { w.remove(); r(); }, 460);
  });
}

// typewriter: first tap finishes the line, second tap moves on
async function btSay(sc, text, wait = true) {
  const box = btQ('.bt-text'), msg = btQ('#bt-msg'); if (!box) return;
  let skip = false; sc.tap = () => { skip = true; };
  msg.setAttribute('aria-busy', 'true'); box.textContent = '';
  if (rpgCalm()) box.textContent = text;
  else {
    for (let i = 1; i <= text.length && !skip; i++) { box.textContent = text.slice(0, i); if (i % 3 === 0) btBlip(); await btSleep(20); btCheckDead(sc); }
    box.textContent = text;
  }
  msg.setAttribute('aria-busy', 'false');
  if (!wait) { sc.tap = null; return; }
  box.insertAdjacentHTML('beforeend', ' <i class="more" aria-hidden="true">▼</i>');
  await new Promise(r => { sc.tap = () => { sc.tap = null; r(); }; });
  btCheckDead(sc);
}

function btChoose(sc, list) {
  const box = btQ('#bt-cmds');
  box.innerHTML = list.map(([id, label]) => `<button class="cmd" role="menuitem" data-bt="cmd" data-v="${id}">${label}</button>`).join('');
  box.querySelector('.cmd')?.focus({ preventScroll: true });
  return new Promise(r => { sc.choose = id => { sc.choose = null; r(id); }; });
}
const btNoCmds = () => { const b = btQ('#bt-cmds'); if (b) b.innerHTML = ''; };

function btStage(html) { const s = btQ('#bt-stage'); if (s) s.innerHTML = html; }
const btDots = (n, i) => `<div class="bt-dots" aria-hidden="true">${Array.from({ length: n }, (_, k) => k === i ? '●' : '○').join(' ')}</div>`;

async function btEncounter(sc) {
  const { chk, d } = sc, rest = chk.outcome === 'rest', name = S.profile.name || 'The hero';
  btStage(rest
    ? `<div class="bt-boss" id="bt-boss">🏕️</div><div class="bt-name">CAMPFIRE</div><div class="bt-sub">A quiet night</div><div id="bt-fx"></div>`
    : `<div class="bt-boss" id="bt-boss">${chk.boss.e}</div><div class="bt-name">${esc(chk.boss.n.toUpperCase())}</div><div class="bt-sub">${chk.phase} · DC ${chk.dc}</div><div id="bt-fx"></div>`);
  const intro = rest ? `No battle tonight. ${name} rests by the fire.` : `The ${chk.boss.n}, ${chk.phase} form, blocks the road!`;
  await btSay(sc, intro, false);
  const cmds = rest ? [['fight', 'Rest'], ['status', 'Status'], ['flee', 'Leave']] : [['fight', 'Fight'], ['skills', 'Skills'], ['status', 'Status'], ['flee', 'Flee']];
  for (;;) {
    const c = await btChoose(sc, cmds); btCheckDead(sc);
    if (c === 'fight') { btNoCmds(); return; }
    if (c === 'flee') { btClose(sc); throw new Error('closed'); }
    btNoCmds();
    if (c === 'status') {
      const lv = sc.ep.lv || d.lvAfter;
      await btSay(sc, `${name}: Lv ${lv} ${titleOf(lv)}, ${SAGA_CLASS[chk.ability] || 'Hero'}. Wearing ${sagaGear(lv)}.`);
    } else {
      const bits = [...d.habits.map(h => h.name), ...d.quests.map(q => q.name)];
      if (d.focusMin) bits.push('Focus Duel (' + d.focusMin + ' min)');
      if (d.perfect) bits.push('Perfect Day');
      await btSay(sc, bits.length ? 'Skills that powered the roll: ' + bits.slice(0, 8).join(', ') + (bits.length > 8 ? ', and more.' : '.') : 'No actions were taken that day.');
    }
    await btSay(sc, intro, false);
  }
}

async function btTurn(sc) {
  const { d, chk } = sc, name = S.profile.name || 'The hero', lines = [];
  d.habits.forEach(h => lines.push(`${name} used ${h.name}!`));
  d.quests.forEach(q => lines.push(`${name} completed ${q.name}!`));
  if (d.focusMin) lines.push(`${name} entered a ${d.focusMin}-minute Focus Duel!`);
  const shown = lines.slice(0, 4); if (lines.length > 4) shown.push(`...and ${lines.length - 4} more!`);
  for (const l of shown) await btSay(sc, l);
  if (d.perfect) await btSay(sc, 'PERFECT DAY! Every ritual done.');
  await btSay(sc, `Action bonus +${chk.bonus}.  ${(SAGA_ABILITY[chk.ability] || ['', 'Skill'])[1]} +${chk.mod}.`);
}

async function btRollDie(sc) {
  const chk = sc.chk, fx = btQ('#bt-fx'), boss = btQ('#bt-boss'), hero = btQ('#bt-hero'), name = S.profile.name || 'The hero';
  fx.innerHTML = `<div class="d20" id="bt-d20" role="img" aria-label="d20 rolled ${chk.d20}"><span class="face">?</span></div><div class="bt-cap">The die was cast at dawn and can't be re-rolled.</div>`;
  const die = btQ('#bt-d20'), face = die.querySelector('.face');
  if (rpgCalm()) face.textContent = chk.d20;
  else {
    die.classList.add('rolling'); const end = performance.now() + 1100;
    while (performance.now() < end) { face.textContent = 1 + Math.floor(Math.random() * 20); btBlip(); await btSleep(70); btCheckDead(sc); }
    die.classList.remove('rolling'); die.classList.add('land'); face.textContent = chk.d20;
  }
  if (chk.d20 === 20) die.classList.add('nat20'); if (chk.d20 === 1) die.classList.add('nat1');
  await btSleep(rpgCalm() ? 0 : 350); btCheckDead(sc);
  const sum = `${chk.d20} + ${chk.mod} + ${chk.bonus} = ${chk.total} vs DC ${chk.dc}`, o = chk.outcome, hit = o === 'critical' || o === 'success';
  const word = { critical: 'CRITICAL HIT!', success: 'SUCCESS!', narrow: `So close! Missed by ${Math.max(1, chk.dc - chk.total)}.`, setback: 'Not this time. Training montage!', fumble: 'Oops! A natural 1.' }[o];
  if (!rpgCalm()) {
    boss.classList.add(o === 'critical' ? 'ko' : o === 'success' ? 'hit' : o === 'narrow' ? 'miss' : o === 'fumble' ? 'trip' : 'shrug');
    if (o === 'setback') hero.classList.add('hurt');
    if (hit) { const n = document.createElement('div'); n.className = 'bt-dmg'; n.textContent = '-' + chk.total; fx.append(n); }
    if (o === 'critical') { const fl = document.createElement('div'); fl.className = 'bt-flash'; btHost().append(fl); setTimeout(() => fl.remove(), 400); }
  }
  try { if (S.settings.sound) (hit ? sfx.chest : sfx.undo)(); } catch { }
  await btSay(sc, `${sum}.  ${word}`);
  if (o === 'fumble') await btSay(sc, `${name} trips over a root and laughs it off.`);
}

async function btStory(sc) {
  const { ep, d, chk, date } = sc, pages = String(ep.story || '').split('\n').filter(x => x.trim());
  const portrait = sagaImgTag(date, 240);
  btQ('#bt-msg').classList.add('bt-story');
  for (let i = 0; i < pages.length; i++) {
    btStage(`<div class="bt-port">${portrait}</div>${btDots(pages.length, i)}`);
    await btSay(sc, pages[i]);
  }
  btQ('#bt-msg').classList.remove('bt-story');
  const lvB = d.lvBefore, lvA = d.lvAfter, o = chk.outcome, win = o === 'critical' || o === 'success';
  const title = o === 'rest' ? 'REST' : win ? 'VICTORY' : 'TRAINING', up = lvA > lvB, gear = sagaGear(lvA) !== sagaGear(lvB);
  btStage(`<div class="bt-win bt-result"><div class="bt-title">${title}</div>
    <div class="bt-row"><span>EXP gained</span><b>${d.xp}</b></div>
    <div class="bt-row"><span>Level</span><b>${up ? `Lv ${lvB} → Lv ${lvA}  LEVEL UP!` : `Lv ${lvA}`}</b></div>
    ${gear ? `<div class="bt-row"><span>New gear</span><b>${esc(sagaGear(lvA))}</b></div>` : ''}</div>`);
  await btSay(sc, ep.teaser ? 'NEXT TIME... ' + ep.teaser : 'The saga continues tomorrow.', false);
  for (;;) {
    const c = await btChoose(sc, [['again', 'Again'], ['paint', 'New picture'], ['done', 'Done']]); btCheckDead(sc);
    if (c === 'again') return 'again';
    if (c === 'paint') { const e = S.saga.eps[date]; if (e) { e.img = 'none'; delete sagaRT.imgs[date]; sagaPaint(date); toast('Repainting…'); } continue; }
    return 'done';
  }
}

async function btRun(sc) {
  try {
    await btWipe();
    for (;;) {
      await btEncounter(sc);
      if (sc.chk.outcome !== 'rest') { await btTurn(sc); await btRollDie(sc); }
      if (await btStory(sc) !== 'again') break;
    }
    btClose(sc);
  } catch (e) { if (!sc.dead && e.message !== 'closed') { console.warn('Battle scene:', e); btClose(sc); } }
}

function btClose(sc) {
  if (sc.dead) return; sc.dead = true;
  if (sc.choose) sc.choose = null; sc.tap = null;
  const ep = S.saga.eps[sc.date]; if (ep && !ep.seen) { ep.seen = true; save(); }
  const host = btHost(); host.classList.add('hidden'); host.innerHTML = '';
  document.body.classList.remove('bt-open'); BT.sc = null;
  try { sc.lastFocus && sc.lastFocus.focus && sc.lastFocus.focus({ preventScroll: true }); } catch { }
  render();
}

function sagaBattle(date) {
  const ep = S.saga.eps[date]; if (!ep || BT.sc) return;
  const sc = BT.sc = { date, ep, d: sagaDay(date), chk: ep.check || sagaCheck(date), dead: false, tap: null, choose: null, lastFocus: document.activeElement };
  const host = btHost(); host.classList.remove('hidden'); host.innerHTML = btShell(sc); document.body.classList.add('bt-open');
  host.onclick = e => {
    const b = e.target.closest('[data-bt]');
    if (b) {
      const k = b.dataset.bt;
      if (k === 'close') btClose(sc);
      else if (k === 'text') { btClose(sc); sagaRead(date); }
      else if (k === 'cmd' && sc.choose) sc.choose(b.dataset.v);
      return;
    }
    if (e.target.closest('#bt-msg') && sc.tap) sc.tap();
  };
  host.onkeydown = e => {
    if (e.key === 'Escape') { btClose(sc); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'bt-msg') { e.preventDefault(); if (sc.tap) sc.tap(); return; }
    if (e.key === 'Tab') {                                                // keep focus inside the scene
      const f = [...host.querySelectorAll('button,[tabindex="0"]')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return; const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  btQ('#bt-msg').focus({ preventScroll: true });
  btRun(sc);
}

Object.assign(A, { 'saga-read': el => sagaBattle(el.dataset.d), 'saga-text': el => sagaRead(el.dataset.d) });
