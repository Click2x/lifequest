'use strict';
/* Habits & motivation extras: rhythm, flexible frequency, welcome-back/lite mode, private pattern insights, skill tree. */

// ── rhythm: "5 of the last 7 scheduled days", a kinder number than a streak ──
const weekCount = h => weekDays().filter(d => h.log[d]).length;
function rhythmTag(h) {
  if (h.freq) return ` <span class="tag" style="color:var(--blue)">${weekCount(h)}/${h.freq} this week</span>`;
  const ds = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d; })
    .filter(d => h.days.includes(d.getDay()) && !isRest(dkey(d)));
  if (ds.length < 3) return '';
  return ` <span class="sm dim">${ds.filter(d => h.log[dkey(d)]).length}/${ds.length} this week</span>`;
}
// "N times a week" habits count consecutive weeks that hit the target (one missed week is forgiven)
function weekStreak(h) {
  let n = 0, miss = 0;
  for (let i = 0; i < 80; i++) {
    const c = weekDays(-i).filter(d => h.log[d]).length;
    if (c >= h.freq) { n++; miss = 0; } else if (i > 0 && ++miss >= 2) break;
  }
  return n;
}
const liteActive = () => !!(S.lite && S.lite.until && S.lite.until >= today());
const liteOK = h => !liteActive() || h.id === S.lite.habitId;

// ── welcome back: lapsing is normal; offer a lite week instead of guilt ──
function maybeWelcomeBack() {
  if (!S.profile.name) return;
  let last = 0; try { last = +localStorage.getItem('lifequest.seen') || 0; localStorage.setItem('lifequest.seen', String(Date.now())); } catch { }   // per device, never synced
  const days = last ? Math.floor((Date.now() - last) / 864e5) : 0;
  if (days < 4 || !S.habits.length || liteActive()) return;
  draft = { liteHabit: S.habits.filter(h => !h.archived)[0]?.id };
  openModal(`<div class="big-em">👋</div><h2 style="justify-content:center">Welcome back</h2>
    <p>It's been ${days} days. That's completely normal, and nothing is lost. Taking breaks and coming back is how habits really get built.</p>
    <p class="sm dim">Want an easier restart? A <b>lite week</b> shows just one habit, so the first win is easy.</p>
    <div class="pills" style="justify-content:center;margin-bottom:10px">${S.habits.filter(h => !h.archived).map((h, i) => `<button class="${i === 0 ? 'on' : ''}" data-act="pick-one" data-k="liteHabit" data-v="${h.id}">${h.emoji} ${esc(h.name)}</button>`).join('')}</div>
    <button class="btn block" data-act="lite-start">Start a lite week</button><button class="btn block ghost" style="margin-top:8px" data-act="close">Everything as before</button>`, true);
}
function liteBanner() {
  if (!liteActive()) return '';
  const h = S.habits.find(x => String(x.id) === String(S.lite.habitId));
  return `<div class="card" style="border-color:var(--blue)"><b>🌱 Lite week until ${S.lite.until}</b><p class="sm dim" style="margin:4px 0 8px">Just ${h ? h.emoji + ' ' + esc(h.name) : 'one habit'} for now. Your other habits are paused, not lost.</p><button class="btn sm ghost" data-act="lite-end">Back to everything</button></div>`;
}

// ── private patterns from your own check-ins (correlation, not causation) ──
const avgOf = a => a.reduce((x, y) => x + y, 0) / a.length;
function patternLines() {
  const out = [], ck = S.checkins, days = Object.keys(ck).filter(d => ck[d].mood != null);
  for (const h of S.habits.filter(x => !x.archived)) {
    const yes = [], no = [];
    for (const d of days) {
      const dow = new Date(d + 'T12:00:00').getDay(); if (!(h.freq || h.days.includes(dow)) || isRest(d)) continue;
      (h.log[d] ? yes : no).push(ck[d].mood + 1);
    }
    if (yes.length >= 5 && no.length >= 5) {
      const a = avgOf(yes), b = avgOf(no);
      if (Math.abs(a - b) >= .4) out.push(`${h.emoji} On days you did <b>${esc(h.name)}</b>, your mood averaged <b>${a.toFixed(1)}</b> vs ${b.toFixed(1)} when you didn't (${yes.length} vs ${no.length} days).`);
    }
  }
  const byDow = Array.from({ length: 7 }, () => []);
  for (const d of days) byDow[new Date(d + 'T12:00:00').getDay()].push(ck[d].mood + 1);
  const ranked = byDow.map((a, i) => ({ i, n: a.length, v: a.length ? avgOf(a) : 0 })).filter(x => x.n >= 3).sort((a, b) => b.v - a.v);
  if (ranked.length >= 3 && ranked[0].v - ranked.at(-1).v >= .6) {
    const nm = i => ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][i];
    out.push(`📅 Your mood tends to be highest on <b>${nm(ranked[0].i)}</b> and lowest on <b>${nm(ranked.at(-1).i)}</b>. Maybe plan lighter on the low day.`);
  }
  const fd = days.filter(d => S.focus.sessions.some(s => s.date === d)).map(d => ck[d].mood + 1), nf = days.filter(d => !S.focus.sessions.some(s => s.date === d)).map(d => ck[d].mood + 1);
  if (fd.length >= 5 && nf.length >= 5 && Math.abs(avgOf(fd) - avgOf(nf)) >= .4) out.push(`🎯 Mood averages <b>${avgOf(fd).toFixed(1)}</b> on days with a focus session vs ${avgOf(nf).toFixed(1)} without.`);
  const ss = S.focus.sessions.filter(s => s.hour != null);
  if (ss.length >= 6) {
    const bucket = h => h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening', tot = {};
    for (const s of ss) tot[bucket(s.hour)] = (tot[bucket(s.hour)] || 0) + s.min;
    const best = Object.entries(tot).sort((a, b) => b[1] - a[1])[0];
    out.push(`⏰ You've logged the most focus time in the <b>${best[0]}</b> (${fmtMin(best[1])}).`);
  }
  return out;
}
function insightsCard() {
  const lines = patternLines(), n = Object.keys(S.checkins).length;
  return `<h2>🔎 Patterns <small>private</small></h2><div class="card sm">${lines.length ? lines.map(l => `<p style="margin:0 0 8px">${l}</p>`).join('') : `<span class="dim">Patterns about your habits, mood and focus appear after about two weeks of daily check-ins (${n} so far). They're from your data only.</span>`}
    <div class="dim" style="font-size:.72rem">These are correlations, not proof of cause. Use them as clues, not rules.</div></div>`;
}

// ── skill tree: new mechanics unlock as you level, so the game keeps evolving ──
const PERKS = [
  ['coin10', '🧲', 'Coin Magnet', '+10% coins from everything'], ['quest20', '🗡️', 'Quest Hunter', '+20% XP from quests'],
  ['focus15', '🧘', 'Deep Diver', '+15% XP from focus sessions'], ['luck', '🍀', 'Lucky Looter', 'Better odds in loot chests'],
  ['grace2', '🛡️', 'Second Wind', 'Streaks survive two missed days in a row'], ['fox', '🦊', 'Frugal Fox', 'No-spend days pay double'],
];
const skillPoints = () => Math.max(0, level() - 1 - Object.keys(S.skills || {}).length);
const hasSkill = id => !!(S.skills && S.skills[id]);
function skillsCard() {
  const pts = skillPoints();
  return `<h2>🌳 Skill tree <small>${pts} point${pts === 1 ? '' : 's'}</small></h2><div class="card sm dim" style="margin-bottom:8px">You earn 1 point per level. Perks are permanent.</div>
    ${PERKS.map(([id, e, n, d]) => `<div class="task" style="${hasSkill(id) ? 'border-color:var(--gold)' : ''}"><div class="em">${e}</div><div class="grow"><div class="nm">${n}</div><div class="sm dim">${d}</div></div>
      ${hasSkill(id) ? '<span class="chip">✓</span>' : `<button class="btn sm ${pts ? 'gold' : 'ghost'}" data-act="skill-buy" data-id="${id}">1 pt</button>`}</div>`).join('')}`;
}
const focusXp = a => Math.round(a.min * 2 * (hasSkill('focus15') ? 1.15 : 1) * (a.buddy ? 1.1 : 1));

HOOKS.today.push(liteBanner);
HOOKS.hero.push(insightsCard, skillsCard);
Object.assign(A, {
  'lite-start': () => { S.lite = { until: addDays(today(), 6), habitId: String(draft.liteHabit || '') }; save(); closeModal(); render(); toast('Lite week started 🌱'); },
  'lite-end': () => { S.lite = null; save(); render(); },
  'skill-buy': el => {
    const id = el.dataset.id; if (hasSkill(id)) return;
    if (!skillPoints()) return toast('Level up to earn skill points');
    (S.skills = S.skills || {})[id] = true; sfx.chest(); confetti(60); save(); render(); toast('Skill unlocked!', 'gold');
  },
});
