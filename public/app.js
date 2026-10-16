'use strict';
/* LifeQuest — a self-hosted, gamified life coach. Vanilla JS, no build step. */

// Sign-in / link addresses look like  /#token=XXXX  (server access) and optionally  &pid=YYYY  (use an existing profile on this device).
// This runs before any state loads so switching profiles can never overwrite the one being linked.
(function () {
  const t = location.hash.match(/token=([\w-]+)/), p = location.hash.match(/pid=([a-z0-9]{8,40})/);
  if (!t && !p) return;
  try {
    if (t) localStorage.setItem('lifequest.token', t[1]);
    if (p && p[1] !== localStorage.getItem('lifequest.pid')) {
      const hadLocal = !!localStorage.getItem('lifequest.v1');
      if (!hadLocal || confirm('Switch this device to the linked profile? Anything saved only on this device will be replaced by the synced copy.')) {
        localStorage.removeItem('lifequest.v1'); localStorage.setItem('lifequest.pid', p[1]);
      }
    }
  } catch { }
  history.replaceState(null, '', location.pathname);
})();

// ───────────────────────── constants ─────────────────────────
const STATS = {
  mind:   { n: 'Mind',   e: '🧠' }, body:   { n: 'Body',   e: '💪' }, spirit: { n: 'Spirit', e: '🧘' },
  craft:  { n: 'Craft',  e: '🛠️' }, social: { n: 'Social', e: '🤝' }, wealth: { n: 'Wealth', e: '💰' },
};
const STAT_KEYS = Object.keys(STATS);
const DIFF = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
const MOODS = ['😫', '😕', '😐', '🙂', '🤩'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const EMOJIS = ['💧', '🚶', '📚', '🧘', '🤸', '😴', '✍️', '📞', '💸', '🎯', '🥗', '🏋️', '🎨', '🎸', '🧹', '☀️', '🦷', '🌱', '💻', '🙏'];
const AVATARS = [['🙂', 1], ['😎', 1], ['🦊', 1], ['🐱', 3], ['🐺', 5], ['🦉', 7], ['🐉', 10], ['🦄', 13], ['🧙', 16], ['🥷', 20], ['🤖', 25], ['👑', 30]];
const TITLES = ['Wanderer', 'Apprentice', 'Adept', 'Challenger', 'Vanguard', 'Champion', 'Paragon', 'Legend', 'Mythic', 'Ascended'];
const STARTERS = [
  ['Drink water', '💧', 'body', 1], ['Walk 20 min', '🚶', 'body', 2], ['Read 10 pages', '📚', 'mind', 2], ['Meditate 5 min', '🧘', 'spirit', 1],
  ['Stretch', '🤸', 'body', 1], ['Lights out by 11', '😴', 'body', 2], ['Journal', '✍️', 'spirit', 1], ['Text a friend', '📞', 'social', 1],
  ['Track spending', '💸', 'wealth', 1], ['Deep work 1h', '💻', 'craft', 3], ['Tidy up 10 min', '🧹', 'mind', 1], ['Workout', '🏋️', 'body', 3],
];
const BOSSES = [['Procrastination Slime', '🟢'], ['Doomscroll Demon', '👹'], ['Couch Golem', '🗿'], ['Distraction Dragon', '🐲'],
  ['Burnout Banshee', '👻'], ['Perfectionist Phantom', '🎭'], ['Snooze Kraken', '🐙'], ['Chaos Lich', '💀']];
const SIDE_QUESTS = [
  ['Take a 10-minute walk without your phone', 'body', 1], ['Compliment someone genuinely', 'social', 1], ['Clear one surface completely', 'mind', 1],
  ['Cook a meal from scratch', 'body', 2], ['Write down 3 things you are grateful for', 'spirit', 1], ['Learn one new word and use it today', 'mind', 1],
  ['Cancel one subscription you do not use', 'wealth', 2], ['Message someone you have not talked to in a month', 'social', 2],
  ['Do 20 push-ups (or whatever you can)', 'body', 1], ['Spend 30 min on a creative project', 'craft', 2], ['Unsubscribe from 5 junk emails', 'mind', 1],
  ['Drink only water today', 'body', 2], ['Watch the sunset or sunrise', 'spirit', 1], ['Plan tomorrow in 5 minutes', 'mind', 1],
  ['Go 2 hours with no social media', 'mind', 2], ['Learn a skill for 45 minutes', 'craft', 3], ['Put $10 into savings', 'wealth', 1],
  ['Take a cold shower (30 seconds)', 'body', 2], ['Do something kind for a stranger', 'social', 2], ['Declutter one drawer', 'mind', 1],
  ['Stretch for 10 minutes before bed', 'body', 1], ['Ask someone for feedback', 'craft', 3], ['Sit in silence for 10 minutes', 'spirit', 2],
];
const PROMPTS = [
  'What is one thing that went better than expected today?', 'What is draining your energy right now, and what is one small step to reduce it?',
  'Who are you becoming? Describe that person\'s Tuesday.', 'What are you avoiding, and what is the smallest first move?',
  'Name three wins from this week, however tiny.', 'What would you do today if you were not afraid of looking silly?',
  'What do you need to forgive yourself for?', 'What is one thing you are looking forward to?',
  'If today repeated for a year, would you be happy with your life? What would you change?', 'Who made your life better recently? Tell them.',
  'What does "enough" look like for you this week?', 'What did you learn about yourself lately?',
  'What habit would change everything if you did it daily?', 'Describe your ideal morning in detail. What is one piece you can do tomorrow?',
];
const WISDOM = [
  'You do not rise to the level of your goals; you fall to the level of your systems.', 'Done is better than perfect. Shipped beats polished.',
  'Motivation gets you started. Habit keeps you going.', 'Two minutes is enough to start. Starting is the whole battle.',
  'Never miss twice. One slip is an accident; two is the start of a new habit.', 'Compare yourself to who you were yesterday, not to who someone else is today.',
  'Rest is part of the training, not a break from it.', 'Small hinges swing big doors.', 'The best time to start was earlier. The second best is now.',
  'Be kind to yourself like you would to a friend with the same goals.', 'Energy follows action more often than action follows energy.',
];

// Weekly bosses: three auto-tracked objectives each. Objective kinds are defined in objDef().
const WBOSSES = [
  { n: 'The Iron Colossus', e: '🗿', flavor: 'A titan of stone that fears consistency.', obj: ['habits', 'focus', 'stat:body'] },
  { n: 'Hydra of Habits', e: '🐍', flavor: 'Cut off one bad habit and two more grow back. Out-discipline it.', obj: ['habits', 'perfect', 'checkin'] },
  { n: 'Procrastination Dragon', e: '🐉', flavor: 'It breathes "later" and hoards your Tuesdays.', obj: ['focus', 'quests', 'streakdays'] },
  { n: 'The Doom Scroller', e: '📱', flavor: 'Hypnotic. Bottomless. Beatable.', obj: ['focus', 'journal', 'stat:mind'] },
  { n: 'Lich of Lethargy', e: '💀', flavor: 'It drains energy and whispers "tomorrow".', obj: ['habits', 'stat:body', 'streakdays'] },
  { n: 'Shadow of Self-Doubt', e: '🌑', flavor: 'It only has power while you do not look at it.', obj: ['journal', 'checkin', 'stat:spirit'] },
  { n: 'Clutter Kraken', e: '🐙', flavor: 'Tentacles in every drawer.', obj: ['quests', 'habits', 'stat:mind'] },
  { n: 'Gold-Hoarding Wyrm', e: '🐲', flavor: 'Sits on a pile of unspent potential.', obj: ['stat:wealth', 'quests', 'stat:craft'] },
  { n: 'The Lonely Wraith', e: '👻', flavor: 'Feeds on cancelled plans. Starve it with connection.', obj: ['stat:social', 'checkin', 'journal'] },
];

const DEFAULT_RULES = [['uber', 'transport'], ['lyft', 'transport'], ['shell', 'transport'], ['chevron', 'transport'], ['gas', 'transport'], ['transit', 'transport'],
  ['starbucks', 'food'], ['mcdonald', 'food'], ['doordash', 'food'], ['grubhub', 'food'], ['kroger', 'food'], ['walmart', 'food'], ['safeway', 'food'], ['trader joe', 'food'], ['whole foods', 'food'], ['restaurant', 'food'], ['cafe', 'food'],
  ['amazon', 'shop'], ['target', 'shop'], ['netflix', 'fun'], ['spotify', 'fun'], ['steam', 'fun'], ['cinema', 'fun'], ['hulu', 'fun'],
  ['rent', 'home'], ['ikea', 'home'], ['home depot', 'home'], ['pharmacy', 'health'], ['cvs', 'health'], ['walgreens', 'health'], ['gym', 'health'],
  ['electric', 'bills'], ['water', 'bills'], ['internet', 'bills'], ['comcast', 'bills'], ['verizon', 'bills'], ['at&t', 'bills'], ['insurance', 'bills']];
// ───────────────────────── utils ─────────────────────────
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dkey();
const uid = () => Math.random().toString(36).slice(2, 9);
const pick = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const levelOf = xp => Math.floor(Math.sqrt(xp / 40)) + 1;
const xpFor = l => 40 * (l - 1) ** 2;
const statLevel = xp => Math.floor(Math.sqrt(xp / 25)) + 1;
const titleOf = l => TITLES[Math.min(TITLES.length - 1, Math.floor((l - 1) / 3))];
const daySeed = () => { const d = new Date(); return d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate(); };
// extension points: separate files (ext-*.js) add cards to each tab through these
const HOOKS = { today: [], 'today-top': [], hero: [], money: [], 'money-top': [], plan: [], board: [] };
const hooks = n => (HOOKS[n] || []).map(f => { try { return f() || ''; } catch (e) { console.error(e); return ''; } }).join('');
// weeks run Monday–Sunday
function weekStart(d = new Date()) { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const weekKey = d => dkey(weekStart(d));
function weekDays(offset = 0) { const s = weekStart(); s.setDate(s.getDate() + offset * 7); return Array.from({ length: 7 }, (_, i) => { const x = new Date(s); x.setDate(s.getDate() + i); return dkey(x); }); }
const weekIndex = () => Math.round(weekStart().getTime() / (7 * 864e5));
const daysLeftInWeek = () => 7 - ((new Date().getDay() + 6) % 7);
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;

// ───────────────────────── state ─────────────────────────
const KEY = 'lifequest.v1';
function defaults() {
  return {
    v: 1, updatedAt: 0, created: Date.now(),
    profile: { name: '', avatar: '🙂' },
    xp: 0, coins: 0, chests: 0, bestStreak: 0,
    stats: Object.fromEntries(STAT_KEYS.map(k => [k, 0])),
    habits: [], quests: [], checkins: {}, journal: [], rewards: [], purchases: [],
    history: {}, perfect: {}, achievements: {}, login: { last: '', streak: 0 },
    focus: { boss: newBoss(0), tier: 0, active: null, sessions: [], defeated: 0, min: 25, stat: 'mind' },
    chat: [], settings: { sound: false, haptics: true, board: false, stakes: false, calm: false, hideAmt: false, pushOn: false, remind: { on: false, lead: 15, quietFrom: '22:00', quietTo: '07:30', max: 6, checkin: '20:00' } },
    saga: { on: false, look: '', names: true, seed: '', n: 0, eps: {}, tried: {}, pending: {} }, rest: null, events: [], snoozed: {}, skills: {}, lite: null, reviews: {}, remFired: { date: '', ids: {}, n: 0 },
    weekly: { week: '', claimed: {}, boss: false, raid: false, seen: {} }, wk: { k: '', xpStat: {} },
    trophies: [], cheerLog: { date: '', n: 0 }, stake: null, stakeHistory: [],
    money: { cur: '$', tx: [], budgets: {}, goal: { name: '', target: 0, saved: 0, done: false }, bills: [], noSpend: {}, adj: {}, rollover: {}, irregular: { on: false, baseline: 0, tax: 0 }, accounts: [], nwHist: [], rules: DEFAULT_RULES.map(r => r.slice()), processed: '', goalsDone: 0, xpToday: { date: '', n: 0 } }, chClaimed: {}, league: { div: 0, processed: '', history: [] },
  };
}
function newBoss(tier) {
  const [n, e] = BOSSES[tier % BOSSES.length];
  const hp = 200 + tier * 100;
  return { name: tier >= BOSSES.length ? `${n} II` : n, emoji: e, max: hp, hp };
}
function migrate(s) {
  const d = defaults();
  const out = { ...d, ...s };
  out.profile = { ...d.profile, ...s.profile };
  out.stats = { ...d.stats, ...s.stats };
  out.focus = { ...d.focus, ...s.focus };
  out.settings = { ...d.settings, ...s.settings };
  out.login = { ...d.login, ...s.login };
  out.weekly = { ...d.weekly, ...s.weekly };
  out.wk = { ...d.wk, ...s.wk };
  out.cheerLog = { ...d.cheerLog, ...s.cheerLog };
  out.league = { ...d.league, ...s.league };
  out.saga = { ...d.saga, ...s.saga };
  out.settings.remind = { ...d.settings.remind, ...((s.settings || {}).remind || {}) };
  out.money = { ...d.money, ...s.money, goal: { ...d.money.goal, ...(s.money || {}).goal }, xpToday: { ...d.money.xpToday, ...(s.money || {}).xpToday } };
  return out;
}
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { console.warn(e); }
  return defaults();
}
let S = load();
let saveTimer = 0;
function save() {
  S.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn(e); }
  clearTimeout(saveTimer); saveTimer = setTimeout(pushState, 1500);
  if (typeof schedulePushSync === 'function') schedulePushSync();
}

// ───────────────────────── server sync (optional) ─────────────────────────
// a link like http://host:4747/#token=XXXX signs this device in once, then the token is stripped from the address bar
(function () { const m = location.hash.match(/token=([\w-]+)/); if (m) { try { localStorage.setItem('lifequest.token', m[1]); } catch { } history.replaceState(null, '', location.pathname); } })();
function getPid() {
  try { let p = localStorage.getItem('lifequest.pid'); if (!p) { p = uid() + uid() + uid(); localStorage.setItem('lifequest.pid', p); } return p; }
  catch { return 'anonymous00'; }
}
const net = { token: localStorage.getItem('lifequest.token') || '', pid: getPid(), pub: '', info: null, status: 'checking' };
function apiFetch(path, opt = {}) {
  return fetch(path, { ...opt, headers: { 'Content-Type': 'application/json', 'X-Player': net.pid, ...(net.token ? { Authorization: 'Bearer ' + net.token } : {}) } });
}
async function initSync() {
  try {
    net.info = await (await apiFetch('/api/info')).json(); net.pub = net.info.you || net.pub;
    if (net.info.tokenRequired && !net.info.authed) { net.status = 'needs-token'; render(); if (S.profile.name) tokenPrompt(); return; }
    const r = await apiFetch('/api/state');
    const { state } = await r.json();
    if (state && state.updatedAt > S.updatedAt) { S = migrate(state); localStorage.setItem(KEY, JSON.stringify(S)); net.status = 'synced'; render(); }
    else if (S.updatedAt) await pushState();
    else net.status = 'synced';
  } catch { net.status = 'offline'; }
  render();
}
async function pushState() {
  try {
    const r = await apiFetch('/api/state', { method: 'PUT', body: JSON.stringify(S) });
    net.status = r.ok ? 'synced' : r.status === 401 ? 'needs-token' : 'offline';
    if (r.ok && S.settings.board) { await apiFetch('/api/board', { method: 'PUT', body: JSON.stringify(myCard()) }); await syncScores(); }
  } catch { net.status = 'offline'; }
  const el = $('#syncst'); if (el) el.textContent = syncLabel();
}
function tokenPrompt() {
  openModal(`<h2>🔒 Sign in to your server</h2><p class="dim sm">Your server is protected. Paste the access token (it is in <code>data/token.txt</code> on the PC, or open the Phone link printed when the server starts).</p>
    <input id="tok" placeholder="Access token" autocomplete="off"><br><br><button class="btn block" data-act="token-save">Sign in</button><button class="btn block ghost" style="margin-top:8px" data-act="close">Keep working offline</button>`);
}
const syncLabel = () => ({ synced: '☁️ Synced to your server', offline: '📴 Offline (saved on phone)', 'needs-token': '🔒 Server needs your token', checking: '…' }[net.status]);

// ───────────────────────── feedback: sound, haptics, confetti, toasts ─────────────────────────
let actx;
function tone(freq, dur = .12, delay = 0, type = 'triangle', vol = .08) {
  if (!S.settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + delay;
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur);
  } catch { }
}
const sfx = {
  ding() { tone(660, .1); tone(880, .16, .08); },
  undo() { tone(300, .1, 0, 'sine'); },
  level() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .2, i * .1)); },
  hit() { tone(120, .2, 0, 'sawtooth', .1); tone(80, .25, .05, 'square', .06); },
  chest() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, .14, i * .07)); },
};
const buzz = p => { if (S.settings.haptics && navigator.vibrate) navigator.vibrate(p); };

function toast(msg, cls = '') {
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 2800);
}
let confettiRun = 0;
function confetti(n = 90) {
  if (S.settings.calm) return;
  const cv = $('#fx'), ctx = cv.getContext('2d'); cv.width = innerWidth; cv.height = innerHeight;
  const cs = getComputedStyle(document.documentElement), cols = ['--acc', '--gold', '--good', '--bad', '--blue', '--txt'].map(v => cs.getPropertyValue(v).trim() || '#fff');
  const ps = Array.from({ length: n }, () => ({ x: innerWidth / 2, y: innerHeight * .4, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, s: 5 + Math.random() * 6, c: pick(cols), r: Math.random() * 6, vr: (Math.random() - .5) * .4 }));
  const id = ++confettiRun;
  (function frame() {
    if (id !== confettiRun) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    let alive = 0;
    for (const p of ps) {
      p.vy += .4; p.x += p.vx; p.y += p.vy; p.r += p.vr; if (p.y < innerHeight + 20) alive++;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); ctx.restore();
    }
    if (alive) requestAnimationFrame(frame); else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

// ───────────────────────── modal ─────────────────────────
function openModal(html, center = false) {
  const m = $('#modal'); m.className = center ? 'center' : ''; m.innerHTML = `<div class="sheet">${html}</div>`;
}
function closeModal() { const m = $('#modal'); m.className = 'hidden'; m.innerHTML = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !modalLocked) closeModal(); });
let modalLocked = false;

// ───────────────────────── game logic ─────────────────────────
const level = () => levelOf(S.xp);
function award(xp, coins = 0, stat = null) {
  if (coins && hasSkill('coin10')) coins = Math.ceil(coins * 1.1);
  const before = level();
  S.xp += xp; S.coins += coins;
  if (stat) { S.stats[stat] = (S.stats[stat] || 0) + xp; wkStat()[stat] = (wkStat()[stat] || 0) + xp; }
  S.history[today()] = (S.history[today()] || 0) + xp;
  toast(`+${xp} XP${coins ? `  ·  +${coins} 🪙` : ''}`);
  if (typeof popNum === 'function') popNum('+' + xp + ' XP', 'xp');
  if (level() > before) levelUp(level());
}
function revoke(xp, coins = 0, stat = null) {
  S.xp = Math.max(0, S.xp - xp); S.coins = Math.max(0, S.coins - coins);
  if (stat) { S.stats[stat] = Math.max(0, (S.stats[stat] || 0) - xp); wkStat()[stat] = Math.max(0, (wkStat()[stat] || 0) - xp); }
  S.history[today()] = Math.max(0, (S.history[today()] || 0) - xp);
}
function wkStat() { const k = weekKey(); if (S.wk.k !== k) S.wk = { k, xpStat: {} }; return S.wk.xpStat; }
function levelUp(l) {
  sfx.level(); buzz([60, 40, 120]); confetti(160);
  const unlocked = AVATARS.filter(([, lv]) => lv === l).map(([e]) => e);
  openModal(`<div class="big-em">🎉</div><h2 style="justify-content:center">Level ${l}!</h2>
    <p>You are now a <b>${titleOf(l)}</b>.</p>${unlocked.length ? `<p>New avatar unlocked: <span style="font-size:32px">${unlocked.join(' ')}</span></p>` : ''}
    <button class="btn block" data-act="close">Keep going</button>`, true);
}
function scheduled(h, d = new Date()) { return h.days.includes(d.getDay()); }
function streak(h) {
  if (h.freq) return weekStreak(h);
  let n = 0, miss = 0; const d = new Date(), lim = hasSkill('grace2') ? 3 : 2;
  for (let i = 0; i < 400; i++) {
    if (h.days.includes(d.getDay())) {
      if (h.log[dkey(d)]) { n++; miss = 0; }
      else if (!isRest(dkey(d)) && i > 0 && ++miss >= lim) break;       // one miss is forgiven; two scheduled misses in a row end the streak
    }
    d.setDate(d.getDate() - 1);
  }
  return n;
}
const todaysHabits = () => S.habits.filter(h => !h.archived && liteOK(h) && (h.freq ? (!!h.log[today()] || weekCount(h) < h.freq) : scheduled(h)));
const perfectNow = () => { const t = todaysHabits().filter(h => !h.freq); return t.length >= 2 && t.every(h => h.log[today()]); };

function toggleHabit(id) {
  const h = S.habits.find(x => x.id === id); if (!h) return; const d = today();
  if (h.log[d]) {
    const l = h.log[d]; revoke(l.xp, l.c, h.stat); delete h.log[d]; sfx.undo();
    if (S.perfect[d] && !perfectNow()) { revoke(50, 20); delete S.perfect[d]; S.chests = Math.max(0, S.chests - 1); }
  } else {
    const s = streak(h) + 1, mult = 1 + Math.min(s, 20) * .05;
    const xp = Math.round(h.diff * 10 * mult), c = h.diff * 4;
    h.log[d] = { xp, c }; award(xp, c, h.stat); sfx.ding(); buzz(30);
    S.bestStreak = Math.max(S.bestStreak, s);
    if (perfectNow() && !S.perfect[d]) {
      S.perfect[d] = true; S.chests++; award(50, 20); sfx.chest(); confetti(140);
      setTimeout(() => openModal(`<div class="big-em">🌟</div><h2 style="justify-content:center">PERFECT DAY</h2><p>Every habit done. Bonus <b>+50 XP, +20 🪙</b> and a free <b>loot chest</b>!</p><button class="btn block" data-act="close">Nice</button>`, true), 500);
    }
  }
  save(); checkAch(); render();
}
function toggleQuest(id) {
  const q = S.quests.find(x => x.id === id); if (!q) return;
  if (q.done) { revoke(q.xp + (q.bonus || 0), q.c + (q.bonus ? 10 : 0), q.stat); q.done = false; q.bonus = 0; delete q.doneAt; if (q.spawned) { S.quests = S.quests.filter(x => !(x.id === q.spawned && !x.done)); delete q.spawned; } sfx.undo(); }
  else { q.done = true; q.doneAt = Date.now(); q.xp = Math.round(q.diff * 25 * (hasSkill('quest20') ? 1.2 : 1)); q.c = q.diff * 10; award(q.xp, q.c, q.stat); q.bonus = q.mit ? 25 : 0; if (q.bonus) award(q.bonus, 10, q.stat); if (q.repeat && !q.spawned) spawnNext(q); sfx.ding(); buzz(40); confetti(50); }
  save(); checkAch(); render();
}
function checkin(mood, energy) {
  const first = !S.checkins[today()];
  S.checkins[today()] = { ...(S.checkins[today()] || {}), ...(mood != null ? { mood } : {}), ...(energy != null ? { energy } : {}) };
  const c = S.checkins[today()];
  if (first && c.mood != null && c.energy != null) { award(10, 2, 'spirit'); sfx.ding(); }
  save(); checkAch(); render();
}
function openChest(free = false) {
  if (!free) { if (S.chests < 1) return; S.chests--; }
  let r = Math.random(); if (hasSkill('luck')) r = Math.min(r, Math.random()); let msg, big = '🎁';
  if (r < .02) { award(500, 100, null); msg = 'LEGENDARY! +500 XP, +100 🪙'; big = '🌈'; confetti(220); }
  else if (r < .10) { const c = rnd(150, 250); S.coins += c; msg = `Rare find! +${c} 🪙`; big = '💎'; confetti(120); }
  else if (r < .45) { const x = rnd(40, 120); award(x, 0, pick(STAT_KEYS)); msg = `A glowing scroll! +${x} XP`; big = '📜'; }
  else { const c = rnd(25, 80); S.coins += c; msg = `A pile of coins! +${c} 🪙`; big = '🪙'; }
  sfx.chest(); buzz([40, 30, 80]); save();
  openModal(`<div class="big-em">${big}</div><h2 style="justify-content:center">Chest opened</h2><p>${msg}</p><button class="btn block" data-act="close">Sweet</button>`, true);
  render();
}

// achievements
function metrics() {
  const checks = S.habits.reduce((n, h) => n + Object.keys(h.log).length, 0);
  return {
    checks, quests: S.quests.filter(q => q.done).length, level: level(), best: S.bestStreak,
    focusMin: S.focus.sessions.reduce((n, s) => n + s.min, 0), sessions: S.focus.sessions.length, bosses: S.focus.defeated,
    journal: S.journal.length, checkins: Object.keys(S.checkins).length, perfect: Object.keys(S.perfect).length,
    coins: S.coins, habits: S.habits.length, days: Object.keys(S.history).filter(k => S.history[k] > 0).length,
    spread: STAT_KEYS.filter(k => statLevel(S.stats[k]) >= 3).length, stakes: S.stakeHistory.filter(x => !x.withdrawn && x.lost === 0).length, moneyDays: new Set(S.money.tx.map(t => t.date)).size, goals: S.money.goalsDone,
  };
}
const ACH = [
  ['first', '🌱', 'First Step', 'Complete your first habit', m => m.checks >= 1],
  ['c50', '✅', 'Checkmate', '50 habit check-ins', m => m.checks >= 50],
  ['c250', '🏅', 'Machine', '250 habit check-ins', m => m.checks >= 250],
  ['s7', '🔥', 'On Fire', '7-day streak', m => m.best >= 7],
  ['s30', '☄️', 'Unstoppable', '30-day streak', m => m.best >= 30],
  ['q5', '⚔️', 'Adventurer', 'Complete 5 quests', m => m.quests >= 5],
  ['q25', '🗡️', 'Quest Master', 'Complete 25 quests', m => m.quests >= 25],
  ['l5', '⭐', 'Rising Star', 'Reach level 5', m => m.level >= 5],
  ['l10', '🌟', 'Veteran', 'Reach level 10', m => m.level >= 10],
  ['f1', '🎯', 'Locked In', 'Finish a focus session', m => m.sessions >= 1],
  ['f10', '🧘', 'Deep Diver', '10 hours of focus', m => m.focusMin >= 600],
  ['b1', '🐲', 'Boss Slayer', 'Defeat a boss', m => m.bosses >= 1],
  ['b5', '👑', 'Dragon Lord', 'Defeat 5 bosses', m => m.bosses >= 5],
  ['j7', '📖', 'Reflective', '7 journal entries', m => m.journal >= 7],
  ['ci7', '💜', 'Self-Aware', '7 daily check-ins', m => m.checkins >= 7],
  ['p1', '🌠', 'Perfect Day', 'Finish all habits in a day', m => m.perfect >= 1],
  ['p5', '💫', 'Flawless', '5 perfect days', m => m.perfect >= 5],
  ['coin', '💰', 'Dragon Hoard', 'Hold 500 coins', m => m.coins >= 500],
  ['all', '🔷', 'Well Rounded', 'Four stats at level 3', m => m.spread >= 4],
  ['d30', '📅', 'Regular', 'Active on 30 different days', m => m.days >= 30],
  ['track7', '🧾', 'Money Tracker', 'Log spending on 7 different days', m => m.moneyDays >= 7],
  ['hoard', '🐉', 'Hoard Built', 'Reach a savings goal', m => m.goals >= 1],
  ['stake', '🏺', 'Skin in the Game', 'Finish a stake without losing a coin', m => m.stakes >= 1],
];
function checkAch() {
  weeklyNotify();
  const m = metrics();
  for (const [id, e, n, , f] of ACH) {
    if (!S.achievements[id] && f(m)) {
      S.achievements[id] = today(); S.coins += 25;
      toast(`${e} Achievement: ${n}  +25 🪙`, 'gold'); sfx.chest(); buzz([30, 30, 60]);
    }
  }
}

// ───────────────────────── focus (boss fights) ─────────────────────────
let wakeLock = null;
async function startFocus() {
  const f = S.focus, task = ($('#ftask') || {}).value || '';
  f.active = { start: Date.now(), endAt: Date.now() + f.min * 60000, min: f.min, task: task.trim(), stat: f.stat, buddy: typeof roomOthers === 'function' && roomOthers() > 0 };
  onFocusStart();
  save();
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { }
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch { }
  render();
}
function finishFocus() {
  const f = S.focus, a = f.active; if (!a) return; f.active = null; onFocusEnd();
  try { wakeLock?.release(); } catch { } wakeLock = null;
  const dmg = a.min * 4, boss = f.boss; boss.hp = Math.max(0, boss.hp - dmg);
  f.sessions.push({ date: today(), min: a.min, task: a.task, stat: a.stat, hour: new Date(a.start).getHours(), q: a.questId || '' });
  if (a.questId) { const qq = S.quests.find(x => x.id === a.questId); if (qq) qq.actual = (qq.actual || 0) + a.min; }
  if (a.buddy) toast('🤝 Body-double bonus: +10% XP');
  award(focusXp(a), Math.ceil(a.min / 5), a.stat); sfx.hit(); buzz([100, 50, 200]);
  let extra = '';
  if (boss.hp <= 0) {
    f.defeated++; S.chests++; award(150, 50); confetti(200); sfx.level();
    extra = `<p>🏆 <b>${esc(boss.name)} defeated!</b> +150 XP, +50 🪙 and a loot chest.</p>`;
    f.tier++; f.boss = newBoss(f.tier);
  }
  try { navigator.serviceWorker?.ready.then(r => Notification.permission === 'granted' && r.showNotification('Focus complete ⚔️', { body: `You dealt ${dmg} damage!`, icon: '/icon-192.png' })); } catch { }
  save(); checkAch();
  openModal(`<div class="big-em">⚔️</div><h2 style="justify-content:center">Focus complete</h2><p>You dealt <b>${dmg} damage</b> in ${a.min} minutes.</p>${extra}<button class="btn block" data-act="close">Onward</button>`, true);
  render();
}
function cancelFocus() {
  if (!confirm('Give up? The boss heals and you earn nothing.')) return;
  S.focus.active = null; onFocusEnd(); try { wakeLock?.release(); } catch { } save(); render();
}
const CIRC = 2 * Math.PI * 105;
function tick() {
  const a = S.focus.active; if (!a) return;
  const rem = Math.max(0, a.endAt - Date.now());
  const t = $('#ft'), r = $('#fr');
  if (t) t.textContent = `${pad(Math.floor(rem / 60000))}:${pad(Math.floor(rem / 1000) % 60)}`;
  if (r) r.setAttribute('stroke-dashoffset', CIRC * (1 - rem / (a.min * 60000)));
  if (rem <= 0) finishFocus();
}
setInterval(tick, 500);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.profile.name) { settleStake(); render(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); if (S.focus.active) navigator.wakeLock?.request('screen').then(l => wakeLock = l).catch(() => { }); } });

// ───────────────────────── weekly boss quest ─────────────────────────
function weeklyState() {
  const k = weekKey();
  if (S.weekly.week !== k) S.weekly = { week: k, claimed: {}, boss: false, raid: false, seen: {} };
  return S.weekly;
}
const weeklyBoss = () => WBOSSES[weekIndex() % WBOSSES.length];
function objDef(kind) {
  const wd = weekDays(), inWeek = d => wd.includes(d);
  const nh = Math.max(3, S.habits.length);
  if (kind === 'habits') return { e: '✅', label: 'Complete habits', target: Math.min(60, Math.round(nh * 7 * .6)), prog: S.habits.reduce((n, h) => n + wd.filter(d => h.log[d]).length, 0) };
  if (kind === 'focus') return { e: '🎯', label: 'Focus minutes', target: 150, prog: S.focus.sessions.filter(s => inWeek(s.date)).reduce((n, s) => n + s.min, 0) };
  if (kind === 'quests') return { e: '⚔️', label: 'Finish quests', target: 4, prog: S.quests.filter(q => q.done && inWeek(dkey(new Date(q.doneAt)))).length };
  if (kind === 'perfect') return { e: '🌟', label: 'Perfect days', target: 3, prog: Object.keys(S.perfect).filter(inWeek).length };
  if (kind === 'journal') return { e: '📓', label: 'Journal entries', target: 4, prog: S.journal.filter(j => inWeek(j.date)).length };
  if (kind === 'checkin') return { e: '💜', label: 'Daily check-ins', target: 5, prog: wd.filter(d => S.checkins[d]?.mood != null).length };
  if (kind === 'streakdays') return { e: '🔥', label: 'Active days', target: 6, prog: wd.filter(d => (S.history[d] || 0) > 0).length };
  const st = kind.split(':')[1];
  return { e: STATS[st].e, label: `${STATS[st].n} XP`, target: st === 'wealth' || st === 'social' ? 100 : 150, prog: wkStat()[st] || 0 };
}
// Endowed progress (Nunes & Drèze 2006): starting part-way, with a believable reason, raises persistence.
// Every objective begins 20% filled; slaying last week's boss adds a 10% momentum bonus. It can never complete an objective on its own.
const slewLastWeek = () => { const last = weekDays(-1)[0]; return S.trophies.some(t => t.week === last && !/^(Challenge|Season)/.test(t.name)); };
const headStartPct = () => .2 + (slewLastWeek() ? .1 : 0);
function weeklyObjs() {
  const pct = headStartPct();
  return weeklyBoss().obj.map(k => {
    const o = objDef(k), head = Math.min(o.target - 1, Math.max(1, Math.round(o.target * pct)));
    return { k, ...o, raw: o.prog, head, prog: Math.min(o.target, o.prog + head) };
  });
}
function claimObjective(k) {
  const w = weeklyState(), o = weeklyObjs().find(x => x.k === k);
  if (!o || w.claimed[k] || o.prog < o.target) return;
  w.claimed[k] = true; award(60, 25); sfx.ding(); buzz(40); confetti(60); save(); render();
}
function claimWeeklyBoss() {
  const w = weeklyState(), objs = weeklyObjs();
  if (w.boss || !objs.every(o => w.claimed[o.k])) return;
  w.boss = true; const b = weeklyBoss();
  S.trophies.push({ week: w.week, name: b.n, emoji: b.e, kind: 'boss' }); S.chests += 2;
  award(300, 150); sfx.level(); confetti(240); save(); checkAch();
  openModal(`<div class="big-em">${b.e}</div><h2 style="justify-content:center">${esc(b.n)} SLAIN</h2><p>Weekly boss defeated! <b>+300 XP, +150 🪙, 2 chests</b> and a trophy for your cabinet.</p><button class="btn block" data-act="close">Glorious</button>`, true);
  render();
}
function weeklyNotify() {
  const w = weeklyState();
  for (const o of weeklyObjs()) if (o.prog >= o.target && !w.seen[o.k]) { w.seen[o.k] = true; toast(`${weeklyBoss().e} Weekly objective ready to claim!`, 'gold'); }
}
function weeklyCard() {
  const w = weeklyState(), b = weeklyBoss(), objs = weeklyObjs();
  const pct = objs.reduce((n, o) => n + Math.min(1, o.prog / o.target), 0) / objs.length;
  const allClaimed = objs.every(o => w.claimed[o.k]);
  return `<div class="card glow boss"><div class="sm dim">WEEKLY BOSS · ${daysLeftInWeek()} day${daysLeftInWeek() > 1 ? 's' : ''} left</div>
    <div class="big" style="font-size:64px">${b.e}</div><b>${esc(b.n)}</b><div class="sm dim" style="margin:2px 0 6px">${esc(b.flavor)}</div>
    <div class="bar red"><i style="width:${Math.round((1 - pct) * 100)}%"></i></div><div class="sm dim">${Math.round((1 - pct) * 100)}% HP remaining</div>
    <div style="text-align:left;margin-top:12px">${objs.map(o => {
      const done = o.prog >= o.target, cl = w.claimed[o.k];
      return `<div class="task ${cl ? 'done' : ''}" style="margin-bottom:6px"><div class="em">${o.e}</div><div class="grow"><div class="nm" style="font-size:.92rem">${o.label}: ${Math.min(o.prog, o.target)}/${o.target}</div>
        <div class="bar gold" style="height:7px"><i style="width:${Math.min(100, o.prog / o.target * 100)}%;background:linear-gradient(90deg,var(--mp) ${o.head / o.prog * 100}%,var(--gold) ${o.head / o.prog * 100}%)"></i></div>
        <div class="sm dim" style="font-size:.7rem">${o.raw} earned + ${o.head} head start</div></div>
        ${cl ? '<span class="chip">✓</span>' : done ? `<button class="btn gold sm" data-act="wclaim" data-v="${o.k}">+60 XP</button>` : ''}</div>`;
    }).join('')}</div>
    <div class="sm dim" style="text-align:left;margin-top:6px">🎁 Head start: each objective begins ${Math.round(headStartPct() * 100)}% filled${slewLastWeek() ? ' (includes +10% momentum for slaying last week\'s boss)' : ' (slay this boss for +10% momentum next week)'}. The purple part is your head start.</div>
    ${w.boss ? '<div class="chip" style="display:inline-block;margin-top:6px">🏆 Boss slain this week</div>'
      : allClaimed ? '<button class="btn gold block" data-act="wboss">⚔️ Deliver the final blow</button>'
        : '<div class="sm dim">Claim all 3 objectives to deliver the final blow (+300 XP, 2 chests).</div>'}
    ${S.trophies.length ? `<div class="sm dim" style="margin-top:8px">Trophy cabinet: ${S.trophies.slice(-12).map(t => `<span title="${esc(t.name)}">${t.emoji}</span>`).join(' ')}</div>` : ''}</div>`;
}

// ───────────────────────── squad: leaderboard, cheers, co-op raid ─────────────────────────
const squad = { players: [], name: '', loaded: false, err: '', mode: 'week', sub: 'board', challenges: [] };
const bestStreak = () => S.habits.reduce((m, h) => Math.max(m, streak(h)), 0);
const weekXpOf = off => weekDays(off).reduce((n, d) => n + (S.history[d] || 0), 0);
function myCard() {
  const wd = weekDays();
  return { name: S.profile.name, avatar: S.profile.avatar, level: level(), xp: S.xp, week: weekKey(), weekXp: weekXpOf(0), lastWeekXp: weekXpOf(-1),
    streak: bestStreak(), focusWeek: S.focus.sessions.filter(s => wd.includes(s.date)).reduce((n, s) => n + s.min, 0), trophies: S.trophies.length,
    month: monthPrefix(), monthXp: monthXpOf(monthPrefix()), lastMonthXp: monthXpOf(prevMonthPrefix()), div: S.league.div };
}
const prevWeekKey = () => weekDays(-1)[0];
const cWeekXp = c => c.week === weekKey() ? c.weekXp : 0;
const cLastXp = c => c.week === weekKey() ? c.lastWeekXp : c.week === prevWeekKey() ? c.weekXp : 0;
async function fetchBoard() {
  if (!S.settings.board || !net.info) return;
  try {
    const r = await apiFetch('/api/board');
    if (!r.ok) throw new Error(r.status);
    const j = await r.json(); squad.players = j.players; squad.name = j.squad; net.pub = j.you || net.pub; squad.loaded = true; squad.err = '';
    // use my live local numbers instead of the (possibly stale) copy on the server
    const me = squad.players.find(p => p.pid === net.pub); if (me) Object.assign(me, myCard());
    for (const c of j.cheers || []) { S.coins += 3; toast(`💜 ${c.from} cheered you! +3 🪙`, 'gold'); }
    if (j.cheers?.length) { sfx.chest(); save(); }
    try { const cr = await apiFetch('/api/challenges'); if (cr.ok) squad.challenges = (await cr.json()).challenges; } catch { }
    await syncScores(); processLeague(); if (typeof fetchRoom === 'function') await fetchRoom();
  } catch { squad.err = 'Cannot reach the squad server'; }
  if (tab === 'squad') render();
}
async function joinBoard(on) {
  S.settings.board = on; save();
  if (!on) { try { await apiFetch('/api/board', { method: 'DELETE' }); } catch { } squad.players = []; squad.loaded = false; }
  else { try { await apiFetch('/api/board', { method: 'PUT', body: JSON.stringify(myCard()) }); } catch { } await fetchBoard(); }
  render();
}
function raidBoss() { return WBOSSES[(weekIndex() + 4) % WBOSSES.length]; }
function raidStats() {
  const active = squad.players.filter(c => c.week === weekKey());
  const hp = 400 * Math.max(1, active.length), dmg = active.reduce((n, c) => n + c.weekXp, 0);
  return { hp, dmg, active };
}
function claimRaid() {
  const w = weeklyState(), r = raidStats();
  if (w.raid || r.dmg < r.hp || weekXpOf(0) < 20) return;
  w.raid = true; S.chests++; award(150, 100); confetti(220); sfx.level(); save(); render();
}
async function cheer(to) {
  const k = today(); if (S.cheerLog.date !== k) S.cheerLog = { date: k, n: 0 };
  try {
    const r = await apiFetch('/api/cheer', { method: 'POST', body: JSON.stringify({ to, from: S.profile.name }) });
    if (!r.ok) throw 0;
    if (S.cheerLog.n < 5) { S.cheerLog.n++; S.coins += 2; toast('👏 Cheer sent! +2 🪙'); } else toast('👏 Cheer sent!');
    sfx.ding(); buzz(30); save(); render();
  } catch { toast('Could not send cheer'); }
}
function viewBoard() {
  if (!S.settings.board) {
    return `<div class="card glow" style="text-align:center"><div style="font-size:56px">🏰</div><h2 style="justify-content:center;margin:6px 0">Join ${esc(net.info?.squad || 'the squad')}</h2>
      <p class="dim">Compete on a weekly leaderboard, cheer your friends on, and team up to slay raid bosses.</p>
      <p class="sm dim">Only your name, avatar, level, XP, streak and focus minutes are shared. Never your habits, journal or chats. You can leave any time.</p>
      ${net.info && net.status !== 'offline' ? '<button class="btn block" data-act="board-join">Join the leaderboard</button>' : '<div class="empty">Squads need your LifeQuest server to be reachable.</div>'}</div>
      <div class="card"><b>How to invite friends</b><p class="sm dim">Share this page's address with them (and the server token, if you set one). Each friend gets a private save. Everyone just opens the same link, picks a name, and joins.</p></div>`;
  }
  const wk = weekKey(), players = squad.players.slice();
  const modes = { week: ['This week', c => cWeekXp(c), v => v + ' XP'], all: ['All-time', c => c.xp, (v, c) => 'Lv ' + c.level], streak: ['Streak', c => c.streak, v => '🔥 ' + v], focus: ['Focus', c => c.week === wk ? c.focusWeek : 0, v => fmtMin(v)] };
  const [, val_, fmt] = modes[squad.mode];
  players.sort((a, b) => val_(b) - val_(a) || b.xp - a.xp);
  const lastBest = Math.max(0, ...players.map(cLastXp)), crown = lastBest > 0 ? players.find(c => cLastXp(c) === lastBest)?.pid : null;
  const r = raidStats(), rb = raidBoss(), w = weeklyState(), pct = Math.min(1, r.dmg / r.hp);
  const medals = ['🥇', '🥈', '🥉'];
  return `${hooks('board')}<div class="card glow boss"><div class="sm dim">SQUAD RAID · ${daysLeftInWeek()}d left</div><div class="big" style="font-size:64px">${rb.e}</div><b>${esc(rb.n)}</b>
    <div class="bar red"><i style="width:${Math.round((1 - pct) * 100)}%"></i></div>
    <div class="sm dim">${Math.max(0, r.hp - r.dmg)} / ${r.hp} HP · every XP the squad earns this week is damage</div>
    ${w.raid ? '<div class="chip" style="display:inline-block;margin-top:8px">🏆 Raid cleared</div>'
      : r.dmg >= r.hp ? (weekXpOf(0) >= 20 ? '<button class="btn gold block" style="margin-top:8px" data-act="raid-claim">Claim raid loot (+150 XP, +100 🪙, chest)</button>' : '<div class="sm dim" style="margin-top:8px">Earn at least 20 XP yourself to claim the loot.</div>')
        : '<div class="sm dim" style="margin-top:8px">Clear it together for +150 XP, +100 🪙 and a chest each.</div>'}</div>
  ${ownRace()}
  <h2>🏆 ${esc(squad.name || 'Leaderboard')} <small>${players.length} hero${players.length === 1 ? '' : 'es'}</small></h2>
  <div class="pills" style="margin-bottom:10px">${Object.entries(modes).map(([k, m]) => `<button class="${squad.mode === k ? 'on' : ''}" data-act="lb-mode" data-v="${k}">${m[0]}</button>`).join('')}</div>
  ${squad.err ? `<div class="empty">${squad.err}</div>` : ''}
  ${players.map((c, i) => `<div class="task" style="${c.pid === net.pub ? 'border-color:var(--gold);background:var(--card2)' : ''}">
      <div style="width:30px;text-align:center;font-weight:800;font-size:${i < 3 ? 22 : 16}px">${medals[i] || i + 1}</div><div class="avatar" style="width:42px;height:42px;font-size:22px">${esc(c.avatar)}</div>
      <div class="grow"><div class="nm">${esc(c.name)}${c.pid === crown ? ' 👑' : ''}${c.pid === net.pub ? ' <span class="dim sm">(you)</span>' : ''}</div><div class="sm dim">Lv ${c.level}${c.trophies ? ' · 🏆 ' + c.trophies : ''}</div></div>
      <b>${fmt(val_(c), c)}</b>${c.pid !== net.pub ? `<button class="btn sm ghost" data-act="cheer" data-id="${c.pid}" title="Cheer">👏</button>` : ''}</div>`).join('') || '<div class="empty">Loading…</div>'}
  <div class="sm dim" style="margin:8px 0">👑 = last week's champion. Cheer a friend: +2 🪙 for you (5/day), +3 🪙 for them. Scores are on the honor system.</div>
  <button class="btn sm ghost" data-act="board-leave">Leave leaderboard</button>`;
}

// ───────────────────────── squad challenges ─────────────────────────
const CH_METRICS = { xp: ['⚡', 'XP earned'], focus: ['🎯', 'Focus minutes'], habits: ['✅', 'Habit check-ins'], quests: ['⚔️', 'Quests finished'], journal: ['📓', 'Journal entries'], days: ['🔥', 'Active days'] };
const addDays = (k, n) => { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return dkey(d); };
function datesBetween(a, b) { const out = []; for (let k = a; k <= b && out.length < 45; k = addDays(k, 1)) out.push(k); return out; }
// every client scores itself from its own data over the challenge window, then reports the number
function challengeScore(ch) {
  const ds = datesBetween(ch.start, ch.end < today() ? ch.end : today()), set = new Set(ds);
  switch (ch.metric) {
    case 'xp': return ds.reduce((n, d) => n + (S.history[d] || 0), 0);
    case 'focus': return S.focus.sessions.filter(s => set.has(s.date)).reduce((n, s) => n + s.min, 0);
    case 'habits': return S.habits.reduce((n, h) => n + ds.filter(d => h.log[d]).length, 0);
    case 'quests': return S.quests.filter(q => q.done && set.has(dkey(new Date(q.doneAt)))).length;
    case 'journal': return S.journal.filter(j => set.has(j.date)).length;
    default: return ds.filter(d => (S.history[d] || 0) > 0).length;
  }
}
async function chPost(body) {
  const r = await apiFetch('/api/challenges', { method: 'POST', body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.status);
  return j;
}
async function syncScores() {
  if (!S.settings.board) return;
  for (const ch of squad.challenges) {
    const mine = ch.participants[net.pub]; if (!mine) continue;
    const sc = challengeScore(ch);
    if (sc !== mine.score) { try { await chPost({ action: 'score', id: ch.id, score: sc }); mine.score = sc; } catch { } }
  }
}
const chParts = ch => Object.entries(ch.participants).map(([pid, p]) => ({ pid, ...p, score: pid === net.pub ? challengeScore(ch) : p.score })).sort((a, b) => b.score - a.score);
const chRank = (ch, pid) => { const ps = chParts(ch), me = ps.find(p => p.pid === pid); return me ? 1 + ps.filter(p => p.score > me.score).length : 0; };
function challengeForm() {
  draft = { metric: 'xp', days: 7 };
  openModal(`<h2>⚔️ New squad challenge</h2><p class="dim sm">Everyone in the squad can join. Scores are tracked automatically from the day you start.</p>
  <label>What counts?</label><div class="pills">${Object.entries(CH_METRICS).map(([k, [e, l]]) => `<button class="${draft.metric === k ? 'on' : ''}" data-act="pick-one" data-k="metric" data-v="${k}">${e} ${l}</button>`).join('')}</div>
  <label>Duration</label><div class="pills">${[3, 7, 14].map(d => `<button class="${draft.days === d ? 'on' : ''}" data-act="pick-one" data-k="days" data-v="${d}">${d} days</button>`).join('')}</div>
  <label>Name (optional)</label><input id="f-name" maxlength="40" placeholder="e.g. Sunday Sprint">
  <p class="sm dim">Prizes: 🥇 100 XP + 100 🪙 + trophy · 🥈 50 · 🥉 25 · everyone who finishes gets 15 XP + 15 🪙.</p>
  <button class="btn block" data-act="ch-save">Throw down the gauntlet</button>`);
}
async function createChallenge() {
  const metric = draft.metric, days = draft.days, title = val('f-name').trim() || `${CH_METRICS[metric][1]} showdown`;
  try {
    await chPost({ action: 'create', title, metric, start: today(), end: addDays(today(), days - 1) });
    closeModal(); toast('⚔️ Challenge thrown down!', 'gold'); sfx.chest(); await fetchBoard();
  } catch (e) { toast('Could not create: ' + e.message); }
}
async function challengeAction(action, id) {
  try { await chPost({ action, id, today: today() }); if (action === 'join') toast('Joined! Game on.'); await fetchBoard(); } catch (e) { toast(e.message); }
}
function claimChallenge(id) {
  const ch = squad.challenges.find(c => c.id === id);
  if (!ch || S.chClaimed[id] || ch.end >= today() || !ch.participants[net.pub]) return;
  const n = chParts(ch).length, rank = chRank(ch, net.pub); let em, msg;
  S.chClaimed[id] = true;
  if (n >= 2 && rank === 1) { award(100, 100); S.trophies.push({ week: ch.end, name: 'Challenge: ' + ch.title, emoji: '🥇' }); em = '🥇'; msg = 'You won! +100 XP, +100 🪙 and a trophy.'; confetti(200); }
  else if (n >= 2 && rank === 2) { award(50, 50); em = '🥈'; msg = 'Silver! +50 XP, +50 🪙.'; }
  else if (n >= 2 && rank === 3) { award(25, 25); em = '🥉'; msg = 'Bronze! +25 XP, +25 🪙.'; }
  else { award(15, 15); em = '🎖️'; msg = 'You finished! +15 XP, +15 🪙. Showing up counts.'; }
  sfx.level(); save(); checkAch(); render();
  openModal(`<div class="big-em">${em}</div><h2 style="justify-content:center">${esc(ch.title)}</h2><p>You placed <b>#${rank}</b> of ${n}.<br>${msg}</p><button class="btn block" data-act="close">Onward</button>`, true);
}
function chCard(ch) {
  const t = today(), ended = ch.end < t, mine = !!ch.participants[net.pub], [em, label] = CH_METRICS[ch.metric];
  const ps = chParts(ch), left = ended ? 0 : datesBetween(t, ch.end).length;
  const rows = ps.slice(0, 5).map((p, i) => `<div class="row sm" style="padding:3px 0"><span style="width:24px">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span>${esc(p.avatar)}</span><span class="grow">${esc(p.name)}${p.pid === net.pub ? ' <span class="dim">(you)</span>' : ''}</span><b>${p.score}</b></div>`).join('');
  let action = '';
  if (!ended) { if (!mine) action = `<button class="btn sm" data-act="ch-join" data-id="${ch.id}">Join</button>`; }
  else if (!mine) action = '<span class="sm dim">Not entered</span>';
  else if (S.chClaimed[ch.id]) action = '<span class="chip">Claimed ✓</span>';
  else action = `<button class="btn gold sm" data-act="ch-claim" data-id="${ch.id}">Claim reward</button>`;
  return `<div class="card ${ended ? '' : 'glow'}"><div class="row"><div style="font-size:30px">${em}</div><div class="grow"><b>${esc(ch.title)}</b>
    <div class="sm dim">${label} · by ${esc(ch.creatorName)} · ${ended ? 'ended ' + ch.end : left + ' day' + (left > 1 ? 's' : '') + ' left'}</div></div>${action}</div>
    <div style="margin-top:8px">${rows}</div>${!ended && ch.creator === net.pub ? `<button class="btn sm ghost" style="margin-top:6px" data-act="ch-del" data-id="${ch.id}">Cancel challenge</button>` : ''}</div>`;
}
function viewChallenges() {
  const t = today(), list = squad.challenges;
  const active = list.filter(c => c.end >= t).sort((a, b) => a.end.localeCompare(b.end));
  const ended = list.filter(c => c.end < t).sort((a, b) => b.end.localeCompare(a.end)).slice(0, 5);
  return `<button class="btn block" data-act="ch-new">⚔️ Challenge the squad</button>
  <h2>Active <small>${active.length}</small></h2>${active.map(chCard).join('') || '<div class="empty">No active challenges.<br>Start one, such as a 7-day focus race!</div>'}
  ${ended.length ? `<h2>Finished</h2>${ended.map(chCard).join('')}` : ''}`;
}

// ───────────────────────── monthly league ─────────────────────────
const DIVS = [['🥉', 'Bronze'], ['🥈', 'Silver'], ['🥇', 'Gold'], ['💠', 'Platinum'], ['💎', 'Diamond'], ['🔱', 'Legend']];
const monthPrefix = d => dkey(d || new Date()).slice(0, 7);
const prevMonthPrefix = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return monthPrefix(d); };
const monthXpOf = p => Object.entries(S.history).reduce((n, [k, v]) => k.startsWith(p) ? n + v : n, 0);
const monthDaysLeft = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() + 1; };
const monthLabel = p => new Date(p + '-01T12:00:00').toLocaleString(undefined, { month: 'long', year: 'numeric' });
const cMonthXp = c => c.month === monthPrefix() ? c.monthXp : 0;
const cPrevXp = c => c.month === monthPrefix() ? c.lastMonthXp : c.month === prevMonthPrefix() ? c.monthXp : 0;
// promote: top third with 100+ XP (solo: 600+). relegate: under 50 XP, or bottom third of 3+ active players.
function leagueZone(xp, rank, n) {
  if (n <= 1) return xp >= 600 ? 'up' : xp < 50 ? 'down' : '';
  if (xp >= 100 && rank <= Math.ceil(n / 3)) return 'up';
  if (xp < 50 || (n >= 3 && rank > n - Math.floor(n / 3))) return 'down';
  return '';
}
function processLeague() {
  if (!S.settings.board || !squad.loaded) return;
  const prev = prevMonthPrefix(), L = S.league;
  if (L.processed >= prev) return;
  const first = L.processed === '';
  L.processed = prev;
  if (first) return save();                       // first time in the league: nothing to judge yet
  const mine = monthXpOf(prev), all = [mine, ...squad.players.filter(p => p.pid !== net.pub).map(cPrevXp)].filter(x => x > 0);
  const n = all.length, rank = 1 + all.filter(x => x > mine).length, old = L.div;
  const zone = leagueZone(mine, rank, n);
  const div = zone === 'up' ? Math.min(DIVS.length - 1, old + 1) : zone === 'down' ? Math.max(0, old - 1) : old;
  L.div = div;
  let coins = 0, chests = 0, xp = 0;
  if (mine > 0) {
    coins = 30;
    if (n >= 2 && rank === 1) { coins = 200; chests = 2; xp = 200; S.trophies.push({ week: prev, name: 'Season Champion ' + monthLabel(prev), emoji: '🏅' }); }
    else if (n >= 2 && rank === 2) { coins = 100; chests = 1; xp = 100; }
    else if (n >= 2 && rank === 3) { coins = 50; xp = 50; }
  }
  if (div > old) { coins += 100 * div; chests++; }
  S.coins += coins; S.chests += chests; if (xp) award(xp, 0);
  L.history = [...L.history, { month: prev, rank: mine > 0 ? rank : 0, of: n, xp: mine, from: old, to: div }].slice(-24);
  save(); confetti(div > old ? 180 : 60); sfx.level();
  const move = div > old ? `<b>Promoted</b> to ${DIVS[div][0]} ${DIVS[div][1]}!` : div < old ? `Moved down to ${DIVS[div][0]} ${DIVS[div][1]}. A fresh month is a fresh start.` : `You stay in ${DIVS[div][0]} ${DIVS[div][1]}.`;
  openModal(`<div class="big-em">${DIVS[div][0]}</div><h2 style="justify-content:center">${monthLabel(prev)} season over</h2>
    <p>${mine ? `You earned <b>${mine} XP</b>${n >= 2 ? `, finishing <b>#${rank}</b> of ${n}` : ''}.` : 'No XP last month.'}</p><p>${move}</p>
    <p>${coins || chests ? `Rewards: ${coins ? '+' + coins + ' 🪙 ' : ''}${chests ? '+' + chests + ' 🎁 ' : ''}${xp ? '+' + xp + ' XP' : ''}` : ''}</p><button class="btn block" data-act="close">New season, let's go</button>`, true);
  render();
}
function viewLeague() {
  const cur = monthPrefix(), L = S.league, myXp = monthXpOf(cur);
  const entries = squad.players.map(c => ({ c, xp: c.pid === net.pub ? myXp : cMonthXp(c) })).sort((a, b) => b.xp - a.xp);
  const active = entries.filter(e => e.xp > 0).length;
  const rankOf = xp => 1 + entries.filter(e => e.xp > xp).length;
  const myZone = leagueZone(myXp, rankOf(myXp), Math.max(1, active));
  const status = myZone === 'up' ? '▲ You are in the <b>promotion zone</b>. Hold it!' : myZone === 'down' ? '▼ <b>Relegation zone</b>. Earn some XP to climb out (under 50 XP, or bottom third).' : 'Safe mid-table. Finish in the top third with 100+ XP to be promoted.';
  const hist = L.history.slice().reverse().slice(0, 6);
  return `<div class="card glow boss"><div class="sm dim">${monthLabel(cur).toUpperCase()} · ${monthDaysLeft()} day${monthDaysLeft() > 1 ? 's' : ''} left</div>
    <div class="big" style="font-size:64px">${DIVS[L.div][0]}</div><b>${DIVS[L.div][1]} division</b><div class="sm dim" style="margin:6px 0">${myXp} XP this month</div><div class="sm">${status}</div>
    <div class="sm dim" style="margin-top:8px">Promotion pays 🪙 and a chest. A fresh season starts on the 1st.</div></div>
  <h2>Standings <small>${active} active</small></h2>
  ${entries.map(e => { const rk = rankOf(e.xp), z = e.xp > 0 || active <= 1 ? leagueZone(e.xp, rk, Math.max(1, active)) : 'down';
    return `<div class="task" style="${e.c.pid === net.pub ? 'border-color:var(--gold);background:var(--card2)' : ''}"><div style="width:28px;text-align:center;font-weight:800">${rk}</div><div class="avatar" style="width:40px;height:40px;font-size:20px">${esc(e.c.avatar)}</div>
      <div class="grow"><div class="nm">${esc(e.c.name)}${e.c.pid === net.pub ? ' <span class="dim sm">(you)</span>' : ''}</div><div class="sm dim">${DIVS[e.c.pid === net.pub ? L.div : (e.c.div || 0)][0]} ${DIVS[e.c.pid === net.pub ? L.div : (e.c.div || 0)][1]}</div></div>
      <b>${e.xp} XP</b><span style="width:18px;color:${z === 'up' ? 'var(--good)' : 'var(--bad)'}">${z === 'up' ? '▲' : z === 'down' ? '▼' : ''}</span></div>`; }).join('') || '<div class="empty">Loading…</div>'}
  <div class="card sm dim"><b style="color:var(--txt)">Season rewards</b><br>🏅 #1: 200 🪙, 2 chests, 200 XP and a Season Champion trophy · #2: 100 🪙, chest · #3: 50 🪙 · everyone who played: 30 🪙.<br>Divisions: ${DIVS.map(d => d[0] + ' ' + d[1]).join(' → ')}.<br>Open the app in the first days of a month so last month's results are counted.</div>
  ${hist.length ? `<h2>Season history</h2>${hist.map(h => `<div class="j"><b>${monthLabel(h.month)}</b>: ${h.xp} XP${h.rank ? ` · #${h.rank} of ${h.of}` : ''} · ${DIVS[h.from][0]} ${h.to > h.from ? '▲' : h.to < h.from ? '▼' : '→'} ${DIVS[h.to][0]}</div>`).join('')}` : ''}`;
}
function viewSquad() {
  if (!S.settings.board) return viewBoard();
  const subs = [['board', '🏆 Board'], ['challenges', '⚔️ Challenges'], ['league', '🏅 League']];
  const body = { board: viewBoard, challenges: viewChallenges, league: viewLeague }[squad.sub]();
  return `<div class="pills" style="margin-bottom:12px">${subs.map(([k, l]) => `<button class="${squad.sub === k ? 'on' : ''}" data-act="sq-sub" data-v="${k}">${l}</button>`).join('')}</div>${body}`;
}

function ownRace() {
  const a = weekXpOf(0), b = weekXpOf(-1), pct = b ? Math.min(100, a / b * 100) : 100;
  return `<div class="card"><div class="sm dim">Your own race (you vs. you)</div><b>${a} XP</b> this week vs ${b} last week ${a >= b ? '📈' : '💪'}<div class="bar gold"><i style="width:${pct}%"></i></div></div>`;
}

// ───────────────────────── opt-in loss-framed stakes ─────────────────────────
// Patel et al. 2016: money already "in the pot" that shrinks on each missed day beat gain-framed incentives.
// Here it is play-money coins only, off by default, with a shield day and a bonus for a flawless week.
const STAKE_DAYS = 7;
const stakeSlices = amount => { const base = Math.floor(amount / STAKE_DAYS), extra = amount - base * STAKE_DAYS; return Array.from({ length: STAKE_DAYS }, (_, i) => base + (i < extra ? 1 : 0)); };
function stakeGoalMet(st, d) {
  if (isRest(d)) return true;
  const dow = new Date(d + 'T12:00:00').getDay(), sched = S.habits.filter(h => h.days.includes(dow));
  if (st.type === 'habit') { const h = S.habits.find(x => String(x.id) === String(st.habitId)); return !h || !h.days.includes(dow) || !!h.log[d]; }
  return !sched.length || sched.filter(h => h.log[d]).length >= Math.min(st.n, sched.length);
}
const stakeDayIndex = st => Math.min(STAKE_DAYS - 1, Math.max(0, datesBetween(st.start, today()).length - 1));
// days are settled lazily once they are over, so it works even if the app was closed for a while
function settleStake() {
  const st = S.stake; if (!st) return;
  const t = today(); let changed = false;
  for (let i = 0; i < STAKE_DAYS; i++) {
    const d = addDays(st.start, i);
    if (d >= t || st.log[d]) continue;
    changed = true;
    if (stakeGoalMet(st, d)) st.log[d] = 'met';
    else if (st.shield > 0) { st.shield--; st.log[d] = 'pass'; }
    else { st.log[d] = 'lost'; st.lost += st.slices[i]; }
  }
  if (addDays(st.start, STAKE_DAYS - 1) < t) finishStake(); else if (changed) save();
}
function finishStake() {
  const st = S.stake, kept = st.amount - st.lost, perfect = st.lost === 0, bonus = perfect ? Math.ceil(st.amount * .1) : 0;
  S.coins += kept + bonus;
  S.stakeHistory = [...S.stakeHistory, { start: st.start, label: st.label, amount: st.amount, lost: st.lost, bonus }].slice(-12);
  S.stake = null;
  if (perfect) { award(40, 0, 'spirit'); confetti(160); sfx.level(); } else sfx.chest();
  save(); checkAch();
  openModal(`<div class="big-em">${perfect ? '🏺' : '🪙'}</div><h2 style="justify-content:center">Stake complete</h2><p>${esc(st.label)}</p>
    <p>You kept <b>${kept} of ${st.amount} 🪙</b>${bonus ? ` and earned a <b>+${bonus} 🪙</b> bonus plus 40 XP for a flawless week.` : '.'}</p>
    ${perfect ? '' : '<p class="sm dim">Misses happen. Every day you showed up still counted. Try again with a smaller goal if it helps.</p>'}<button class="btn block" data-act="close">Nice</button>`, true);
}
function stakeIntro() {
  openModal(`<h2>🏺 Loss-framed stakes</h2>
    <p>Most of us hate losing something more than we like gaining the same thing. In one trial, people with money placed up front that shrank on each missed day hit their step goals about <b>50% more often</b> than people paid for hitting goals (Patel et al., 2016).</p>
    <p class="sm dim"><b>How it works here:</b> you pick a 7-day goal and move some coins into a pot. Each day you miss, a seventh of the pot is lost. Keep every day and you get it all back <b>plus 10%</b>. You get one free shield day.</p>
    <p class="sm dim"><b>Honest limits:</b> that trial used real money. Play-money coins may motivate less, and effects often fade once incentives stop. It is entirely optional, and you can turn it off any time.</p>
    <button class="btn block" data-act="stakes-enable">Turn on stakes</button><button class="btn block ghost" style="margin-top:8px" data-act="close">Not now</button>`);
}
function stakeForm() {
  if (S.stake) return;
  if (!S.habits.filter(h => !h.archived).length) return toast('Add a habit first');
  const pres = [10, 20, 50, 100].filter(a => a <= S.coins);
  if (!pres.length) return toast('You need at least 10 🪙 to stake');
  draft = { type: 'habit', habitId: S.habits.filter(h => !h.archived)[0].id, n: 1, amount: pres.includes(50) ? 50 : pres[pres.length - 1] };
  const nmax = Math.min(5, S.habits.filter(h => !h.archived).length);
  openModal(`<h2>🏺 Put coins on the line</h2>
    <p class="sm dim">Your stake moves into a pot now. Each missed day loses a seventh of it. A flawless week returns everything <b>+10%</b>. One shield day is free. Play-money coins only.</p>
    <label>Goal type</label><div class="pills"><button class="on" data-act="pick-one" data-k="type" data-v="habit">One habit</button><button data-act="pick-one" data-k="type" data-v="count">Any N habits a day</button></div>
    <label>Which habit (for "one habit")</label><div class="pills">${S.habits.filter(h => !h.archived).map((h, i) => `<button class="${i === 0 ? 'on' : ''}" data-act="pick-one" data-k="habitId" data-v="${h.id}">${h.emoji} ${esc(h.name)}</button>`).join('')}</div>
    <label>How many per day (for "any N")</label><div class="pills">${Array.from({ length: nmax }, (_, i) => `<button class="${i === 0 ? 'on' : ''}" data-act="pick-one" data-k="n" data-v="${i + 1}">${i + 1}</button>`).join('')}</div>
    <label>Stake (you have ${S.coins} 🪙)</label><div class="pills">${pres.map(a => `<button class="${a === draft.amount ? 'on' : ''}" data-act="pick-one" data-k="amount" data-v="${a}">${a} 🪙</button>`).join('')}</div>
    <br><button class="btn block" data-act="stake-go">Lock it in for 7 days</button>`);
}
function startStake() {
  if (S.stake) return;
  const amount = +draft.amount;
  if (!(amount >= 10) || S.coins < amount) return toast('Not enough coins 🪙');
  let label;
  if (draft.type === 'habit') {
    const h = S.habits.find(x => String(x.id) === String(draft.habitId)); if (!h) return toast('Pick a habit');
    label = `${h.emoji} ${h.name} on every scheduled day`;
  } else label = `At least ${draft.n} habit${draft.n > 1 ? 's' : ''} every day`;
  S.coins -= amount;
  S.stake = { id: uid(), type: draft.type, habitId: String(draft.habitId || ''), n: +draft.n || 1, label, start: today(), amount, slices: stakeSlices(amount), log: {}, lost: 0, shield: 1 };
  sfx.chest(); buzz(40); save(); closeModal(); render();
}
function withdrawStake() {
  const st = S.stake; if (!st) return;
  const refund = Math.floor((st.amount - st.lost) * .75);
  if (!confirm(`Withdraw early? You get back ${refund} 🪙. A quarter of the remaining pot is forfeited.`)) return;
  S.coins += refund;
  S.stakeHistory = [...S.stakeHistory, { start: st.start, label: st.label, amount: st.amount, lost: st.amount - refund, bonus: 0, withdrawn: true }].slice(-12);
  S.stake = null; save(); render();
}
function stakeCard() {
  if (!S.settings.stakes) return '';
  const st = S.stake;
  if (!st) return '<div class="task" data-act="stake-new" style="border-style:dashed"><div class="em">🏺</div><div class="grow"><div class="nm">Stakes</div><div class="sm dim">Optional: put coins on a 7-day goal</div></div><span class="chip">Set up</span></div>';
  const t = today(), idx = stakeDayIndex(st), met = stakeGoalMet(st, t);
  const pips = st.slices.map((_, i) => {
    const d = addDays(st.start, i), r = st.log[d];
    const col = r === 'met' ? 'var(--good)' : r === 'pass' ? 'var(--blue)' : r === 'lost' ? 'var(--bad)' : d === t ? (met ? 'var(--good)' : 'var(--gold)') : 'var(--line)';
    return `<i style="flex:1;height:10px;border-radius:5px;background:${col}${d === t && !r ? ';opacity:.8' : ''}"></i>`;
  }).join('');
  return `<div class="card glow"><div class="row"><div style="font-size:30px">🏺</div><div class="grow"><b>Stake: ${esc(st.label)}</b>
    <div class="sm dim">Day ${idx + 1}/${STAKE_DAYS} · pot ${st.amount - st.lost}/${st.amount} 🪙 · ${st.shield ? '🛡️ shield ready' : 'shield used'}</div></div></div>
    <div style="display:flex;gap:4px;margin:10px 0">${pips}</div>
    <div class="sm">${met ? `✅ Today's goal is done. Your ${st.slices[idx]} 🪙 slice is safe.` : `⚠️ Finish your goal today to keep today's <b>${st.slices[idx]} 🪙</b>.`}</div>
    <button class="btn sm ghost" style="margin-top:8px" data-act="stake-out">Withdraw early</button></div>`;
}

// ───────────────────────── money: bank CSV import (no bank passwords, no third party) ─────────────────────────
// People distrust handing bank credentials to aggregators and bank links break often, so you import the CSV your bank already lets you download.
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(c => c.trim())) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some(c => c.trim())) rows.push(row);
  return rows;
}
function parseDateStr(s) {
  s = String(s).trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${pad(+m[1])}-${pad(+m[2])}`; }
  const t = Date.parse(s); return isNaN(t) ? '' : dkey(new Date(t));
}
function parseAmt(s) {
  s = String(s || '').trim(); if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s), n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : (neg ? -n : n);
}
const catFor = desc => { const d = desc.toLowerCase(); const r = S.money.rules.find(([k]) => d.includes(k.toLowerCase())); return r ? r[1] : 'other'; };
const txKey = (date, amt, note) => `${date}|${amt}|${note.slice(0, 20).toLowerCase()}`;
let csvDraft = null;
function readCsv(text) {
  const rows = parseCsv(text); if (rows.length < 2) return toast('That file looks empty');
  const head = rows[0].map(h => h.toLowerCase().trim());
  const find = re => head.findIndex(h => re.test(h));
  const iDate = Math.max(0, find(/date|posted/)), iDesc = find(/desc|payee|merchant|name|memo|narr|detail/), iAmt = find(/^amount$|^amt$|amount/), iDeb = find(/debit|withdraw|outflow|paid out/), iCred = find(/credit|deposit|inflow|paid in/);
  const items = [];
  for (const r of rows.slice(1)) {
    const date = parseDateStr(r[iDate]); if (!date) continue;
    let amt = iAmt >= 0 ? parseAmt(r[iAmt]) : null;
    if (amt == null && (iDeb >= 0 || iCred >= 0)) { const d = parseAmt(r[iDeb]), c = parseAmt(r[iCred]); amt = d ? -Math.abs(d) : c ? Math.abs(c) : null; }
    if (!amt) continue;
    const desc = (iDesc >= 0 ? r[iDesc] : r.filter((_, i) => i !== iDate && i !== iAmt).join(' ')).replace(/\s+/g, ' ').trim();
    items.push({ date, amt, desc });
  }
  if (!items.length) return toast('No transactions found. Needs date and amount columns.');
  const negShare = items.filter(i => i.amt < 0).length / items.length;
  csvDraft = { items, negIsSpend: negShare >= .5 };
  csvPreview();
}
function csvBuild() {
  const have = new Set(S.money.tx.map(t => txKey(t.date, t.amt, t.note))), out = []; let dup = 0;
  for (const it of csvDraft.items) {
    const spend = csvDraft.negIsSpend ? it.amt < 0 : it.amt > 0, cents = Math.round(Math.abs(it.amt) * 100), note = it.desc.slice(0, 40), k = txKey(it.date, cents, note);
    if (have.has(k)) { dup++; continue; } have.add(k);
    out.push({ id: uid(), date: it.date, amt: cents, type: spend ? 'out' : 'in', cat: spend ? catFor(it.desc) : 'income', note });
  }
  return { out, dup };
}
function csvPreview() {
  const { out, dup } = csvBuild(), spend = out.filter(t => t.type === 'out'), sum = spend.reduce((n, t) => n + t.amt, 0), unmatched = spend.filter(t => t.cat === 'other').length;
  openModal(`<h2>🏦 Import bank CSV</h2><p><b>${out.length}</b> new transactions${dup ? ` (${dup} duplicates skipped)` : ''}: ${spend.length} spending (${fmtMoney(sum)}), ${out.length - spend.length} income.</p>
    <p class="sm dim">${spend.length - unmatched} auto-sorted by your rules, ${unmatched} left as "Other". You can add rules afterward and re-import safely; duplicates are skipped.</p>
    <label>In this file, spending shows as…</label><div class="pills"><button class="${csvDraft.negIsSpend ? 'on' : ''}" data-act="csv-sign" data-v="neg">negative amounts</button><button class="${csvDraft.negIsSpend ? '' : 'on'}" data-act="csv-sign" data-v="pos">positive amounts</button></div>
    <p class="sm dim">Bank accounts usually show spending as negative; credit cards often show it as positive.</p>
    <br><button class="btn block" data-act="csv-go" ${out.length ? '' : 'disabled'}>Import ${out.length}</button>`);
}
function rulesForm() {
  openModal(`<h2>🏷️ Auto-category rules</h2><p class="dim sm">If a transaction's description contains the keyword, it gets that category on import.</p>
    <div class="row"><input id="r-k" placeholder="keyword, e.g. aldi" style="flex:2"><select id="r-c" style="flex:1">${Object.entries(MCATS).map(([k, [e, n]]) => `<option value="${k}">${e} ${n}</option>`).join('')}</select></div>
    <button class="btn block" style="margin:8px 0" data-act="rule-add">Add rule</button>
    <div style="max-height:40vh;overflow:auto">${S.money.rules.map(([k, c], i) => `<div class="row sm" style="padding:4px 0"><span class="grow">“${esc(k)}”</span><span>${MCATS[c][0]} ${MCATS[c][1]}</span><button class="del" data-act="rule-del" data-i="${i}">🗑</button></div>`).join('')}</div>`);
}
document.addEventListener('change', e => {
  if (e.target.id !== 'csvin' || !e.target.files[0]) return;
  const r = new FileReader(); r.onload = () => readCsv(String(r.result)); r.readAsText(e.target.files[0]); e.target.value = '';
});

// ───────────────────────── evidence-based habit features ─────────────────────────
// Streaks forgive one missed day ("never miss twice"): Lally et al. 2010 found a single miss did not materially affect habit formation.
const isAuto = h => (h.auto || []).length >= 2 && h.auto.slice(-2).every(r => r.v >= 4);
function autoDue() {
  const t = Date.now();
  return S.habits.find(h => t - h.created > 14 * 864e5 && Object.keys(h.log).length >= 8 && t - ((h.auto || []).slice(-1)[0]?.t || 0) > 14 * 864e5);
}
function autoCard() {
  const h = autoDue(); if (!h) return '';
  return `<div class="card"><b>🧪 Habit check: ${h.emoji} ${esc(h.name)}</b><p class="sm dim">How automatic does this feel now? 1 = takes real effort, 5 = I do it without thinking. Tracking this shows when a habit has truly stuck.</p>
    <div class="moods">${[1, 2, 3, 4, 5].map(v => `<button data-act="auto" data-id="${h.id}" data-v="${v}">${v}</button>`).join('')}</div></div>`;
}
function rateAutomaticity(id, v) {
  const h = S.habits.find(x => x.id === id); if (!h) return;
  (h.auto = h.auto || []).push({ d: today(), t: Date.now(), v }); award(5, 1, 'spirit'); sfx.ding();
  if (isAuto(h)) { toast('✨ ' + h.name + ' is now automatic!', 'gold'); confetti(80); }
  save(); render();
}
function slipCard() {
  const y = new Date(); y.setDate(y.getDate() - 1); const yk = dkey(y), startY = new Date(yk + 'T00:00:00').getTime();
  const slipped = S.habits.filter(h => !h.freq && !h.archived && liteOK(h) && h.days.includes(y.getDay()) && !h.log[yk] && !h.log[today()] && Object.keys(h.log).length >= 3 && h.created < startY);
  if (!slipped.length || isRest(yk) || isRest(today())) return '';
  return `<div class="card"><b>🌱 Missed yesterday? That is okay.</b><p class="sm dim" style="margin:6px 0 0">Research on real-world habit building found that missing a single day does not meaningfully hurt a habit. Two in a row is the thing to avoid. Do <b>${slipped.map(h => esc(h.name)).join(', ')}</b> today and your streak carries on.</p></div>`;
}
function woopForm() {
  openModal(`<h2>🧭 WOOP your goal</h2><p class="dim sm">Wish, Outcome, Obstacle, Plan. A research-backed method that pairs positive thinking with a realistic if-then plan.</p>
  <label>Wish: something you want that is challenging but doable</label><input id="w-wish" maxlength="80" placeholder="e.g. Exercise 3 times this week">
  <label>Outcome: the best result, and how it would feel</label><input id="w-out" maxlength="120" placeholder="e.g. More energy, feel proud">
  <label>Obstacle: what inside you could get in the way?</label><input id="w-obs" maxlength="120" placeholder="e.g. I get tired after work and sit on the couch">
  <label>Plan: If (obstacle), then I will…</label><input id="w-plan" maxlength="140" placeholder="e.g. If I feel tired after work, then I change into gym clothes first">
  <br><button class="btn block" data-act="woop-save">Save plan + create quest</button>`);
}
function saveWoop() {
  const w = val('w-wish').trim(), o = val('w-out').trim(), b = val('w-obs').trim(), p = val('w-plan').trim();
  if (!w || !b || !p) return toast('Fill in the wish, obstacle and plan');
  S.quests.push({ id: uid(), name: w, stat: 'mind', diff: 2, done: false, plan: p });
  S.journal.push({ id: uid(), date: today(), prompt: 'WOOP', text: `Wish: ${w}\nOutcome: ${o}\nObstacle: ${b}\nPlan: ${p}` });
  award(15, 3, 'mind'); sfx.chest(); save(); closeModal(); tab = 'quests'; render();
}
function showScience() {
  const items = [
    ['🔁', 'Habits take months, not 21 days', 'Median ≈ 2 months to plateau, range from weeks to most of a year (Lally 2010; Singh 2024).'],
    ['🛡️', 'One missed day is fine', 'A single miss did not materially affect habit formation. Streaks here forgive one miss: never miss twice.'],
    ['🔗', 'If-then cues', 'Implementation intentions: d ≈ 0.65 on goal attainment (Gollwitzer & Sheeran 2006). Add a cue to each habit.'],
    ['🧭', 'WOOP', 'Mental contrasting + planning: g ≈ 0.3 on goal attainment, lasting 3+ months.'],
    ['📊', 'Tracking works', 'Monitoring progress: d ≈ 0.40 across 138 experiments, stronger when recorded or shared (Harkin 2016).'],
    ['🧪', 'Automaticity checks', 'Researchers measure habit strength by "do I do it without thinking?". You rate that every 2 weeks.'],
    ['🎁', 'Rewards are double-edged', 'Expected rewards can dampen intrinsic motivation (Deci 1999). That is why chests are surprises and you choose your own habits.'],
    ['📅', 'Fresh starts', 'Mondays and the 1st of the month are real motivation spikes (Dai, Milkman & Riis 2014), so bosses and seasons reset then.'],
    ['👥', 'Social + game design', 'Team incentives raised activity in the BE FIT trial, but leaderboards can discourage lower ranks. So everyone who finishes gets rewards and you also race yourself.'],
    ['🔔', 'Gentle reminders', 'Users abandon apps that nag. Reminders here are opt-in, capped per day, respect quiet hours, and never use guilt wording.'],
    ['💰', 'Money tracking', 'Logging is progress monitoring (d ≈ 0.40). So adding a purchase is 2 taps, envelopes work like health bars, and overspending never costs XP, to avoid the what-the-hell spiral.'],
    ['🎁', 'Head starts', 'Weekly boss objectives begin 20% filled. Starting part-way raised follow-through in a field study (34% vs 19% redeemed; Nunes & Drèze 2006). It never completes an objective on its own.'],
    ['🏺', 'Stakes are optional', 'Loss-framed incentives beat gain-framed ones in a step trial (Patel 2016), but with real money. Play-money effects are untested and incentives often fade once removed.'],
    ['⚠️', 'Honest limits', 'Gamification effects are mixed and often fade. Many studies are short and self-reported. This app applies principles; it is not a proven treatment.'],
  ];
  openModal(`<h2>🔬 The science behind LifeQuest</h2>${items.map(([e, t, d]) => `<div class="task" style="margin-bottom:6px"><div class="em">${e}</div><div class="grow"><div class="nm" style="font-size:.95rem">${t}</div><div class="sm dim">${d}</div></div></div>`).join('')}
    <p class="sm"><a href="/research.md" target="_blank" style="color:var(--acc2)">Read the full research report with sources</a></p><button class="btn block" data-act="close">Close</button>`);
}

// ───────────────────────── coach (local brain + optional LLM) ─────────────────────────
function weakestStat() { return STAT_KEYS.slice().sort((a, b) => S.stats[a] - S.stats[b])[0]; }
function coachTips() {
  const tips = [], h = new Date().getHours(), c = S.checkins[today()], name = S.profile.name || 'friend';
  const th = todaysHabits(), done = th.filter(x => x.log[today()]).length;
  tips.push(h < 12 ? `Good morning, ${name}! Pick your one most important thing today, and do it before anything else.`
    : h < 18 ? `Afternoon check, ${name}. How is your energy? A 5-minute walk beats another coffee.`
      : `Evening, ${name}. Wrap up: finish what is left, then reflect on one win from today.`);
  if (!c || c.mood == null) tips.push('Start with a quick check-in below. Noticing how you feel is a skill, and it is worth XP.');
  if (c && c.mood != null && c.mood <= 1) tips.push('Rough day? Lower the bar. Do just the easiest habit and call it a victory. Tiny counts.');
  if (c && c.energy != null && c.energy <= 1) tips.push('Low energy detected. Hydrate, stretch, get sunlight, and consider an early night. Recovery is progress.');
  if (c && c.mood >= 4) tips.push('You are feeling great, so ride the wave: tackle your hardest quest while momentum is on your side.');
  if (th.length && done === th.length) tips.push('All habits done! Treat yourself. Check your Shop and spend those coins guilt-free.');
  else if (th.length) tips.push(`${th.length - done} habit${th.length - done > 1 ? 's' : ''} left today. ${th.length - done === 1 ? 'Just one more for a perfect day!' : 'Start with the easiest to build momentum.'}`);
  const best = S.habits.map(x => [x, streak(x)]).sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 3) tips.push(`${best[0].emoji} ${best[0].name} is on a ${best[1]}-day streak. Protect it. Never miss twice!`);
  const w = weakestStat(); if (S.xp > 100) tips.push(`Your ${STATS[w].e} ${STATS[w].n} is your lowest stat. Try a side quest in that area today.`);
  if (!S.habits.length) tips.push('Add your first habit to begin. Make it laughably small, like "put on running shoes".');
  if (!S.focus.sessions.some(s => s.date === today())) tips.push('Haven\'t fought a boss today. One 25-minute focus session = big damage and big XP.');
  if (S.stake && !stakeGoalMet(S.stake, today())) tips.unshift(`🏺 Your stake is on the line: finish your goal today to keep ${S.stake.slices[stakeDayIndex(S.stake)]} 🪙.`);
  const dnow = new Date();
  if (dnow.getDay() === 1 || dnow.getDate() === 1) tips.unshift('Fresh start! New weeks and months are proven moments to reset (the "fresh start effect"). Pick one thing to begin today.');
  const nocue = S.habits.find(x => !x.cue);
  if (nocue) tips.push(`Give "${nocue.name}" a cue: "After I [something I already do], I will..." If-then plans reliably boost follow-through. Tap ⋯ on the habit to add one.`);
  tips.push(WISDOM[daySeed() % WISDOM.length]);
  return tips;
}
let tipIdx = 0;

const SCRIPTS = {
  unmotivated: n => `${n}, motivation is a result, not a requirement. Try this:\n1) Pick the smallest possible version of the task (2 minutes).\n2) Set a 5-minute timer in Focus.\n3) Stop if you want to; most of the time you won't.\nStarting is the hard part, and you have already started by asking.`,
  overwhelmed: n => `Breathe, ${n}. Overwhelm means too much is in your head.\n1) Write everything down (use a Quest per item).\n2) Circle just ONE that matters most.\n3) Ignore the rest until it is done.\nOne thing at a time is a complete strategy.`,
  failed: n => `Slips happen, ${n}, and they matter less than you think. In real-world habit research, missing one day made no meaningful difference to how automatic a habit became. What hurts is the "what the hell, I've blown it" spiral. So: be kind to yourself, do the tiny version today, and never miss twice. Your best streak so far is ${S.bestStreak}; you can rebuild it.`,
  plan: n => `Let's plan, ${n}:\n• MIT: your One Most Important Thing, done first.\n• 2 supporting tasks max.\n• 1 focus session on the MIT (25 min).\n• 1 thing for your body, 1 for your mind.\nAdd these as Quests and attack in that order.`,
  tired: n => `Tired is real, ${n}. Check the basics: water, food, sleep, light, movement. If it is a low-energy day, do the minimum viable day: your easiest habit plus rest. Rest is progress too.`,
  sad: n => `I'm sorry it feels heavy, ${n}. You don't have to fix everything today. Be gentle: a glass of water, a short walk, a message to someone you trust. If this feeling sticks around, talking to a professional is a strong move, not a weak one.`,
  procrastinating: n => `Procrastination is usually avoiding a feeling, not laziness. Name the feeling (boredom, fear, confusion), shrink the task until it is almost silly, then start a 10-minute focus session. You only have to begin.`,
  sleep: n => `Better sleep, ${n}: same wake-up time daily, no screens 30 minutes before bed, cool dark room, no caffeine after noon. Try adding a "Lights out by 11" habit. It pays back in every other stat.`,
  crisis: n => `I'm really glad you told me, ${n}. I'm only an app and can't help with this the way a person can. Please reach out right now to someone you trust, or a local crisis line or emergency services (in the US you can call or text 988). You deserve real support, and you matter.`,
  default: n => `${pick(['I hear you', 'Thanks for sharing', 'Got it'])}, ${n}. Let's turn it into action: what's one tiny step you could take in the next 10 minutes? Tell me, and let's add it as a quest. If you want, try the quick prompts above.`,
};
function localCoach(text) {
  const t = text.toLowerCase(), n = S.profile.name || 'friend';
  if (/suicid|kill myself|end it all|hurt myself|self.?harm|don'?t want to live/.test(t)) return SCRIPTS.crisis(n);
  if (/unmotiv|no motivation|can'?t start|lazy/.test(t)) return SCRIPTS.unmotivated(n);
  if (/overwhelm|too much|stress|anxi|panic/.test(t)) return SCRIPTS.overwhelmed(n);
  if (/streak|failed|fail|slipped|missed|relapse/.test(t)) return SCRIPTS.failed(n);
  if (/plan|schedule|organi|prioriti/.test(t)) return SCRIPTS.plan(n);
  if (/tired|exhaust|energy|burn/.test(t)) return SCRIPTS.tired(n);
  if (/sad|depress|lonely|down|hopeless/.test(t)) return SCRIPTS.sad(n);
  if (/procrast|distract|focus|phone/.test(t)) return SCRIPTS.procrastinating(n);
  if (/sleep|insomn|bed/.test(t)) return SCRIPTS.sleep(n);
  return SCRIPTS.default(n);
}
function contextSummary() {
  const th = todaysHabits(), c = S.checkins[today()] || {};
  return `Name: ${S.profile.name}. Level ${level()} (${titleOf(level())}), ${S.xp} XP. Best streak ${S.bestStreak}. ` +
    `Habits today: ${th.filter(x => x.log[today()]).length}/${th.length} done (${th.map(x => x.name).join(', ')}). ` +
    `Mood today: ${c.mood != null ? c.mood + 1 + '/5' : 'unknown'}, energy ${c.energy != null ? c.energy + 1 + '/5' : 'unknown'}. ` +
    `Weakest area: ${STATS[weakestStat()].n}. Open quests: ${S.quests.filter(q => !q.done).map(q => q.name).slice(0, 5).join('; ') || 'none'}.`;
}
let thinking = false;
async function sendChat(text) {
  text = text.trim(); if (!text || thinking) return;
  S.chat.push({ role: 'user', content: text }); thinking = true; render(); scrollChat();
  let reply;
  if (net.info?.ai) {
    try {
      const r = await apiFetch('/api/chat', { method: 'POST', body: JSON.stringify({ messages: S.chat.slice(-12), context: contextSummary() }) });
      reply = r.ok ? (await r.json()).reply : null;
    } catch { }
  }
  if (!reply) reply = localCoach(text);
  S.chat.push({ role: 'assistant', content: reply }); S.chat = S.chat.slice(-30);
  thinking = false; save(); render(); scrollChat();
}
const scrollChat = () => setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);

// ───────────────────────── views ─────────────────────────
let tab = 'today';
const NAV = [['today', '🏠', 'Today'], ['quests', '🗺️', 'Plan'], ['money', '💰', 'Money'], ['focus', '🎯', 'Focus'], ['squad', '🏰', 'Squad'], ['coach', '💬', 'Coach'], ['hero', '🦸', 'Hero']];

function hud() {
  const l = level(), cur = S.xp - xpFor(l), need = xpFor(l + 1) - xpFor(l);
  return `<div class="hud"><div class="avatar" data-act="tab" data-v="hero">${S.profile.avatar}</div>
    <div class="mid"><div class="nm">${esc(S.profile.name || 'Hero')}</div><div class="ttl">Lv ${l} · ${titleOf(l)} · ${cur}/${need} XP</div>
    <div class="bar"><i style="width:${Math.min(100, cur / need * 100)}%"></i></div></div>
    <div class="chips"><span class="chip">🪙 ${S.coins}</span>${S.chests ? `<span class="chip" data-act="chest" style="border-color:var(--gold)">🎁 ${S.chests}</span>` : ''}</div></div>`;
}
function habitRow(h) {
  const done = !!h.log[today()], s = streak(h);
  return `<div class="task ${done ? 'done' : ''}" data-act="habit" data-id="${h.id}"><div class="chk">${done ? '✓' : ''}</div><div class="em">${h.emoji}</div>
    <div class="grow"><div class="nm">${esc(h.name)}</div>${h.cue ? `<div class="sm dim">↪ ${esc(h.cue)}</div>` : ''}<div class="sm"><span class="tag t-${h.stat}">${STATS[h.stat].n}</span>${DIFF[h.diff]}${isAuto(h) ? ' <span class="fire" style="color:var(--gold)">✨ Automatic</span>' : ''}${s >= 2 ? ` <span class="fire">🔥 ${s}</span>` : ''}${rhythmTag(h)}</div></div>
    <button class="del" data-act="habit-menu" data-id="${h.id}" aria-label="Edit">⋯</button></div>`;
}
function viewToday() {
  const th = todaysHabits(), done = th.filter(h => h.log[today()]).length, c = S.checkins[today()] || {};
  const tips = coachTips(), tip = tips[tipIdx % tips.length];
  const others = S.habits.filter(h => !scheduled(h) && !h.archived && !h.freq && liteOK(h));
  return `<div class="card glow coach"><div class="bot">🧙</div><div class="grow"><p>${esc(tip)}</p>
    <button class="btn sm ghost" data-act="tip">Another tip</button></div></div>
  ${hooks('today-top')}${restBanner()}${slipCard()}${autoCard()}${stakeCard()}${weeklyTeaser()}${nextBlockStrip()}${nextUpCard()}${moneyTeaser()}${hooks('today')}
  <h2>Daily check-in <small>+10 XP</small></h2>
  <div class="card"><div class="sm dim">Mood</div><div class="moods">${MOODS.map((m, i) => `<button class="${c.mood === i ? 'on' : ''}" data-act="mood" data-v="${i}">${m}</button>`).join('')}</div>
  <div class="sm dim" style="margin-top:10px">Energy</div><div class="moods">${['🪫', '🔋', '🔋', '⚡', '🚀'].map((m, i) => `<button class="${c.energy === i ? 'on' : ''}" data-act="energy" data-v="${i}">${m}</button>`).join('')}</div></div>
  <h2>Today's habits <small>${done}/${th.length}</small></h2>
  ${th.length ? `<div class="bar gold" style="margin:-4px 0 12px"><i style="width:${th.length ? done / th.length * 100 : 0}%"></i></div>` : ''}
  ${th.map(habitRow).join('') || `<div class="empty">No habits scheduled today.<br>Add one to start your streak 🔥</div>`}
  <button class="btn block ghost" data-act="add-habit">＋ New habit</button>
  ${others.length ? `<h2 class="dim" style="font-size:.9rem">Not scheduled today</h2>${others.map(h => `<div class="task" style="opacity:.5" data-act="habit-menu" data-id="${h.id}"><div class="em">${h.emoji}</div><div class="grow nm">${esc(h.name)}</div></div>`).join('')}` : ''}`;
}
function weeklyTeaser() {
  const w = weeklyState(), b = weeklyBoss(), objs = weeklyObjs(), ready = objs.filter(o => o.prog >= o.target && !w.claimed[o.k]).length;
  const pct = objs.reduce((n, o) => n + Math.min(1, o.prog / o.target), 0) / objs.length;
  return `<div class="task" data-act="tab" data-v="quests" style="border-color:var(--gold)"><div class="em" style="font-size:34px">${b.e}</div><div class="grow"><div class="nm">Weekly boss: ${esc(b.n)}</div>
    <div class="bar red" style="height:7px"><i style="width:${Math.round((1 - pct) * 100)}%"></i></div></div>${w.boss ? '<span class="chip">🏆</span>' : ready ? `<span class="chip" style="border-color:var(--gold)">${ready} to claim</span>` : `<span class="sm dim">${daysLeftInWeek()}d</span>`}</div>`;
}
// ───────────────────────── money: the Vault ─────────────────────────
// Tracking works (Harkin 2016, d≈0.40), so logging is one tap away. Envelopes work like boss HP; overspending never costs XP.
const MCATS = { food: ['🍔', 'Food'], transport: ['🚗', 'Transport'], home: ['🏠', 'Home'], fun: ['🎮', 'Fun'], health: ['💊', 'Health'], shop: ['🛍️', 'Shopping'], bills: ['🧾', 'Bills'], other: ['📦', 'Other'] };
let mdraft = { type: 'out', cat: 'food' };
const toCents = v => Math.round(parseFloat(String(v).replace(/[^0-9.]/g, '')) * 100) || 0;
const fmtMoney = c => S.settings.hideAmt ? S.money.cur + '•••' : (c < 0 ? '-' : '') + S.money.cur + (Math.abs(c) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const txIn = p => S.money.tx.filter(t => t.date.startsWith(p));
const spentIn = (p, cat) => txIn(p).filter(t => t.type === 'out' && (!cat || t.cat === cat)).reduce((n, t) => n + t.amt, 0);
const incomeIn = p => txIn(p).filter(t => t.type === 'in').reduce((n, t) => n + t.amt, 0);
const totalBudget = () => Object.keys(S.money.budgets).reduce((a, c) => a + envBudget(c), 0);
const spentOn = dates => S.money.tx.filter(t => t.type === 'out' && dates.includes(t.date)).reduce((n, t) => n + t.amt, 0);
// daily allowance = what is left of the month's budget at the start of today, spread over the days remaining
function allowance() {
  if (S.money.irregular && S.money.irregular.on) return irregularAllowance();
  const b = totalBudget(); if (!b) return null;
  const todaySpent = spentOn([today()]), startLeft = b - spentIn(monthPrefix()) + todaySpent, perDay = Math.max(0, Math.floor(startLeft / monthDaysLeft()));
  return { perDay, todaySpent, safe: Math.max(0, perDay - todaySpent), over: b - spentIn(monthPrefix()) < 0 };
}
function billDue(b) {
  const [y, m] = monthPrefix().split('-').map(Number), dim = new Date(y, m, 0).getDate();
  return `${y}-${pad(m)}-${pad(Math.min(b.day, dim))}`;
}
const billPaid = b => !!(b.paid || {})[monthPrefix()];
function addTx() {
  const amt = toCents(val('m-amt')); if (!amt) return toast('Enter an amount');
  const t = { id: uid(), date: today(), amt, type: mdraft.type, cat: mdraft.type === 'in' ? 'income' : mdraft.cat, note: val('m-note').trim().slice(0, 40) };
  S.money.tx.push(t);
  const x = S.money.xpToday; if (x.date !== today()) { x.date = today(); x.n = 0; }
  if (x.n < 5) { x.n++; award(3, 1, 'wealth'); }       // capped per day so logging cannot be farmed
  sfx.ding(); buzz(25);
  const bud = envBudget(t.cat);
  if (t.type === 'out' && bud) { const left = bud - spentIn(monthPrefix(), t.cat); toast(left >= 0 ? `${fmtMoney(left)} left in ${MCATS[t.cat][1]}` : `${MCATS[t.cat][1]} is ${fmtMoney(-left)} over. No stress, adjust tomorrow.`); }
  save(); checkAch(); render();
}
function markBillPaid(id) {
  const b = S.money.bills.find(x => x.id === id); if (!b || billPaid(b)) return;
  (b.paid = b.paid || {})[monthPrefix()] = true;
  S.money.tx.push({ id: uid(), date: today(), amt: b.amt, type: 'out', cat: b.cat, note: b.name });
  award(5, 2, 'wealth'); sfx.ding(); save(); checkAch(); render();
}
function billForm() {
  draft = { cat: 'bills' };
  openModal(`<h2>🧾 New recurring bill</h2><label>Name</label><input id="f-name" maxlength="30" placeholder="e.g. Rent, Phone, Netflix">
    <label>Amount</label><input id="f-amt" inputmode="decimal" placeholder="0.00"><label>Due on day of month</label><input id="f-day" type="number" inputmode="numeric" min="1" max="31" value="1">
    <label>Category</label><div class="pills">${Object.entries(MCATS).map(([k, [e, n]]) => `<button class="${k === 'bills' ? 'on' : ''}" data-act="pick-one" data-k="cat" data-v="${k}">${e} ${n}</button>`).join('')}</div>
    <br><button class="btn block" data-act="bill-save">Add bill</button>`);
}
function goalForm() {
  const g = S.money.goal;
  openModal(`<h2>🐉 Savings hoard</h2><label>What are you saving for?</label><input id="f-name" maxlength="30" value="${esc(g.name)}" placeholder="e.g. Emergency fund, Trip, New laptop">
    <label>Target amount</label><input id="f-amt" inputmode="decimal" value="${g.target ? g.target / 100 : ''}" placeholder="0.00"><br><button class="btn block" data-act="goal-save">Save goal</button>`);
}
function depositForm() {
  openModal(`<h2>🪙 Add to your hoard</h2><label>Amount saved</label><input id="f-amt" inputmode="decimal" placeholder="0.00"><br><button class="btn block" data-act="deposit-save">Deposit</button>`);
}
function saveDeposit() {
  const g = S.money.goal, amt = toCents(val('f-amt')); if (!amt || !g.target) return toast('Set a goal first');
  g.saved += amt; award(Math.min(50, 5 + Math.floor(amt / 2000)), 2, 'wealth'); sfx.chest(); closeModal();
  if (g.saved >= g.target && !g.done) {
    g.done = true; S.money.goalsDone++; S.chests++; award(100, 50, 'wealth'); confetti(220); sfx.level();
    setTimeout(() => openModal(`<div class="big-em">🐉</div><h2 style="justify-content:center">Hoard complete!</h2><p>You reached <b>${esc(g.name || 'your goal')}</b> (${fmtMoney(g.target)}). +100 XP, +50 🪙 and a chest.</p><button class="btn block" data-act="close">Legendary</button>`, true), 400);
  }
  save(); checkAch(); render();
}
function noSpendDay() {
  if (S.money.noSpend[today()] || spentOn([today()])) return;
  S.money.noSpend[today()] = true; award(hasSkill('fox') ? 20 : 10, hasSkill('fox') ? 8 : 3, 'wealth'); sfx.chest(); save(); render();
}
function exportCsv() {
  const rows = [['date', 'type', 'category', 'amount', 'note'], ...S.money.tx.slice().sort((a, b) => a.date.localeCompare(b.date)).map(t => [t.date, t.type, t.cat, (t.amt / 100).toFixed(2), '"' + t.note.replace(/"/g, '""') + '"'])];
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' })); a.download = `lifequest-money-${today()}.csv`; a.click();
}
// first open of a new month: reward envelopes you kept under budget
function processMoneyMonth() {
  const M = S.money, prev = prevMonthPrefix();
  if (M.processed >= prev) return;
  M.processed = prev;
  if (!txIn(prev).length || !Object.keys(M.budgets).length) return save();
  let xp = 0, kept = 0;
  for (const [cat, bud] of Object.entries(M.budgets)) if (spentIn(prev, cat) <= bud) { xp += 10; kept++; }
  const total = Object.values(M.budgets).reduce((a, b) => a + b, 0), under = spentIn(prev) <= total;
  if (under) xp += 50;
  save(); if (xp) award(xp, under ? 25 : 0, 'wealth');
  setTimeout(() => openModal(`<div class="big-em">${under ? '🏆' : '📒'}</div><h2 style="justify-content:center">${monthLabel(prev)} money report</h2>
    <p>You spent <b>${fmtMoney(spentIn(prev))}</b> against a ${fmtMoney(total)} budget.</p><p>${kept} envelope${kept === 1 ? '' : 's'} stayed in budget (+${kept * 10} XP)${under ? ', and you finished the month under budget: +50 XP, +25 🪙!' : '. A new month is a fresh start, so adjust your envelopes and go again.'}</p><button class="btn block" data-act="close">New month</button>`, true), 500);
}
function moneyTeaser() {
  const al = allowance(), due = S.money.bills.filter(b => !billPaid(b) && billDue(b) <= addDays(today(), 3));
  const bills = due.length ? `<div class="sm" style="color:var(--gold)">🧾 ${due.map(b => esc(b.name)).join(', ')} due soon</div>` : '';
  if (al) return `<div class="task" data-act="tab" data-v="money"><div class="em">💰</div><div class="grow"><div class="nm">Safe to spend today: ${fmtMoney(al.safe)}</div><div class="sm dim">of ${fmtMoney(al.perDay)} daily allowance</div>${bills}</div></div>`;
  return `<div class="task" data-act="tab" data-v="money" style="border-style:dashed"><div class="em">💰</div><div class="grow"><div class="nm">Track your money</div><div class="sm dim">Log spending in 2 taps and set envelopes${due.length ? ' · ' + due.length + ' bill(s) due soon' : ''}</div></div></div>`;
}
function viewMoney() {
  const M = S.money, p = monthPrefix(), al = allowance(), spent = spentIn(p), inc = incomeIn(p), tb = totalBudget();
  const wk = spentOn(weekDays(0)), lwk = spentOn(weekDays(-1));
  const cats = Object.entries(MCATS).map(([k, [e, n]]) => ({ k, e, n, spent: spentIn(p, k), bud: envBudget(k) })).sort((a, b) => (b.bud || b.spent) - (a.bud || a.spent));
  const top = cats.filter(c => c.spent).sort((a, b) => b.spent - a.spent)[0];
  const dayOfMonth = new Date().getDate(), g = M.goal;
  const hero = al
    ? `<div class="card glow boss"><div class="sm dim">SAFE TO SPEND TODAY</div><div style="font-size:2.4rem;font-weight:800;color:${al.over ? 'var(--bad)' : 'var(--good)'}">${fmtMoney(al.safe)}</div>
        <div class="bar ${al.todaySpent > al.perDay ? 'red' : 'gold'}"><i style="width:${al.perDay ? Math.min(100, al.todaySpent / al.perDay * 100) : 100}%"></i></div>
        <div class="sm dim">${fmtMoney(al.todaySpent)} spent today · ${fmtMoney(al.perDay)} daily allowance · ${monthDaysLeft()} days left</div>
        ${al.over ? '<div class="sm" style="margin-top:6px">Over budget this month. No penalty: pick an envelope to trim and carry on.</div>' : ''}</div>`
    : `<div class="card glow"><b>Set up envelopes</b><p class="sm dim" style="margin:6px 0 0">Tap a category below to give it a monthly budget. You will get a daily "safe to spend" number that adapts as you go.</p></div>`;
  return `${hero}
  <div class="grid2"><div class="stat">Spent this month<br><b>${fmtMoney(spent)}</b>${tb ? `<div class="sm dim">of ${fmtMoney(tb)}</div>` : ''}</div><div class="stat">Income<br><b>${fmtMoney(inc)}</b><div class="sm dim">net ${fmtMoney(inc - spent)}</div></div></div>
  ${hooks('money-top')}
  <h2>Quick add</h2><div class="card">
    <div class="pills" id="m-types"><button class="${mdraft.type === 'out' ? 'on' : ''}" data-act="m-pick" data-k="type" data-v="out">💸 Spent</button><button class="${mdraft.type === 'in' ? 'on' : ''}" data-act="m-pick" data-k="type" data-v="in">💰 Income</button></div>
    <input id="m-amt" inputmode="decimal" placeholder="0.00" autocomplete="off" style="font-size:1.8rem;text-align:center;margin:10px 0">
    <div class="pills" id="m-cats" style="${mdraft.type === 'in' ? 'display:none' : ''}">${Object.entries(MCATS).map(([k, [e, n]]) => `<button class="${mdraft.cat === k ? 'on' : ''}" data-act="m-pick" data-k="cat" data-v="${k}">${e} ${n}</button>`).join('')}</div>
    <input id="m-note" maxlength="40" placeholder="Note (optional)" style="margin:10px 0"><button class="btn block" data-act="m-add">Add</button>
    ${!spentOn([today()]) && !M.noSpend[today()] ? '<button class="btn block ghost" style="margin-top:8px" data-act="m-nospend">✨ I spent nothing today (+10 XP)</button>' : M.noSpend[today()] ? '<div class="sm dim" style="margin-top:8px;text-align:center">✨ No-spend day logged</div>' : ''}</div>
  <h2>Envelopes <small>tap to set a budget</small></h2>
  ${cats.map(c => { const pct = c.bud ? Math.min(100, c.spent / c.bud * 100) : 0, left = c.bud - c.spent, col = !c.bud ? '' : pct >= 100 ? 'red' : pct >= 75 ? 'gold' : '';
    return `<div class="task" data-act="m-budget" data-cat="${c.k}"><div class="em">${c.e}</div><div class="grow"><div class="nm">${c.n}</div>
      ${c.bud ? `<div class="bar ${col}" style="height:8px"><i style="width:${pct}%"></i></div><div class="sm dim">${left >= 0 ? fmtMoney(left) + ' left of ' + fmtMoney(c.bud) : fmtMoney(-left) + ' over'}</div>` : `<div class="sm dim">${c.spent ? fmtMoney(c.spent) + ' spent · no budget' : 'no budget'}</div>`}</div></div>`; }).join('')}
  <h2>🐉 Savings hoard</h2><div class="card">${g.target
    ? `<div class="row"><b class="grow">${esc(g.name || 'Savings')}</b><b>${fmtMoney(g.saved)} / ${fmtMoney(g.target)}</b></div><div class="bar gold"><i style="width:${Math.min(100, g.saved / g.target * 100)}%"></i></div>
       <div class="row" style="margin-top:10px"><button class="btn grow" data-act="deposit">＋ Deposit</button><button class="btn ghost grow" data-act="goal-edit">Edit goal</button></div>`
    : '<div class="empty" style="padding:6px">Pick something to save for and watch the hoard grow.</div><button class="btn block" data-act="goal-edit">Set a savings goal</button>'}</div>
  <h2>🧾 Bills <small>${M.bills.length}</small></h2>
  ${M.bills.slice().sort((a, b) => billDue(a).localeCompare(billDue(b))).map(b => { const due = billDue(b), paid = billPaid(b), over = !paid && due < today();
    return `<div class="task ${paid ? 'done' : ''}"><div class="em">${MCATS[b.cat]?.[0] || '🧾'}</div><div class="grow"><div class="nm">${esc(b.name)} · ${fmtMoney(b.amt)}</div><div class="sm ${over ? '' : 'dim'}" style="${over ? 'color:var(--bad)' : ''}">${paid ? 'Paid this month' : over ? 'Overdue since ' + due.slice(5) : 'Due ' + dueLabel(due)}</div></div>
      ${paid ? '' : `<button class="btn sm gold" data-act="bill-paid" data-id="${b.id}">Paid</button>`}<button class="del" data-act="bill-del" data-id="${b.id}">🗑</button></div>`; }).join('')}
  <button class="btn block ghost" data-act="bill-new">＋ Add recurring bill</button>
  ${hooks('money')}
  <h2>Insights</h2><div class="card sm">
    <div>This week <b>${fmtMoney(wk)}</b> vs last week <b>${fmtMoney(lwk)}</b> ${lwk ? (wk <= lwk ? '📉 trending down' : '📈 trending up') : ''}</div>
    <div style="margin-top:4px">Daily average this month: <b>${fmtMoney(Math.round(spent / dayOfMonth))}</b></div>
    ${top ? `<div style="margin-top:4px">Biggest category: ${top.e} <b>${top.n}</b> (${fmtMoney(top.spent)})</div>` : ''}
    <div style="margin-top:4px">No-spend days this month: <b>${Object.keys(M.noSpend).filter(d => d.startsWith(p)).length}</b></div></div>
  <h2>Recent</h2>${M.tx.slice(-12).reverse().map(t => `<div class="task"><div class="em">${t.type === 'in' ? '💰' : MCATS[t.cat]?.[0] || '📦'}</div><div class="grow"><div class="nm" style="font-size:.95rem">${esc(t.note || (t.type === 'in' ? 'Income' : MCATS[t.cat]?.[1] || ''))}</div><div class="sm dim">${t.date.slice(5)}</div></div>
    <b style="color:${t.type === 'in' ? 'var(--good)' : 'var(--txt)'}">${t.type === 'in' ? '+' : ''}${fmtMoney(t.amt)}</b>${t.type === 'out' ? `<button class="del" data-act="tx-split" data-id="${t.id}" aria-label="Split">✂️</button>` : ''}<button class="del" data-act="tx-del" data-id="${t.id}">🗑</button></div>`).join('') || '<div class="empty">Nothing logged yet.</div>'}
  <div class="row" style="margin:10px 0"><button class="btn sm ghost grow" data-act="m-import">🏦 Import bank CSV</button><button class="btn sm ghost grow" data-act="rules-edit">🏷️ Rules</button><button class="btn sm ghost grow" data-act="m-export">Export</button><input type="file" id="csvin" accept=".csv,text/csv,text/plain" class="hidden"></div>
  <p class="sm dim">🔒 Your money data lives only in your own save file. It is never shown on the squad board.</p>`;
}

// ───────────────────────── plan: a horizon instead of a calendar grid ─────────────────────────
function dueLabel(d) {
  const t = today(); if (d < t) return 'Overdue'; if (d === t) return 'Today'; if (d === addDays(t, 1)) return 'Tomorrow';
  return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
const questRow = q => `<div class="task ${q.done ? 'done' : ''}" data-act="quest" data-id="${q.id}"><div class="chk">${q.done ? '✓' : ''}</div>
    <div class="grow"><div class="nm">${esc(q.name)}</div>${q.plan ? `<div class="sm dim">↪ ${esc(q.plan)}</div>` : ''}${q.first && !q.done ? `<div class="sm dim">🪜 ${esc(q.first)}</div>` : ''}<div class="sm"><span class="tag t-${q.stat}">${STATS[q.stat].n}</span>${DIFF[q.diff]} · +${q.diff * 25} XP${q.mit ? ' · ⭐ +25 bonus' : ''}${q.due && !q.done ? ` · <span style="${q.due < today() ? 'color:var(--bad)' : ''}">📅 ${dueLabel(q.due)}</span>` : ''}</div></div>
    ${q.done ? '' : `<button class="del" data-act="q-focus" data-id="${q.id}" aria-label="Start a 5-minute focus" title="Start 5 minutes">▶</button>`}${q.done ? '' : `<button class="del" data-act="quest-mit" data-id="${q.id}" aria-label="Most important thing">${q.mit ? '⭐' : '☆'}</button>`}<button class="del" data-act="quest-del" data-id="${q.id}" aria-label="Delete">🗑</button></div>`;
function viewQuests() {
  const t = today(), wkEnd = weekDays()[6];
  const open = S.quests.filter(q => !q.done), done = S.quests.filter(q => q.done).sort((a, b) => b.doneAt - a.doneAt).slice(0, 8);
  const items = open.map(q => ({ d: q.due || '', mit: !!q.mit, html: questRow(q) }));
  for (const b of S.money.bills) {
    const due = billDue(b); if (billPaid(b) || due > addDays(t, 14)) continue;
    items.push({ d: due, mit: false, html: `<div class="task"><div class="em">🧾</div><div class="grow"><div class="nm">${esc(b.name)} · ${fmtMoney(b.amt)}</div><div class="sm" style="${due < t ? 'color:var(--bad)' : ''}">Bill · ${dueLabel(due)}</div></div><button class="btn sm gold" data-act="bill-paid" data-id="${b.id}">Paid</button></div>` });
  }
  items.sort((a, b) => b.mit - a.mit || (a.d || '9').localeCompare(b.d || '9'));
  const groups = [['⚠️ Overdue', x => x.d && x.d < t], ['📍 Today', x => x.d === t], ['📅 This week', x => x.d > t && x.d <= wkEnd], ['🔭 Later', x => x.d > wkEnd], ['🌫️ Someday', x => !x.d]];
  const body = groups.map(([title, f]) => { const g = items.filter(f); return g.length ? `<h2>${title} <small>${g.length}</small></h2>${g.map(x => x.html).join('')}` : ''; }).join('');
  return `${weeklyCard()}${timelineCard()}${overdueBar()}${hooks('plan')}${body || '<div class="empty">Nothing on your horizon.<br>Add a quest, or roll a random side quest!</div>'}
  <div class="row" style="margin-top:10px"><button class="btn grow" data-act="add-quest">＋ New quest</button><button class="btn gold grow" data-act="roll">🎲 Side quest</button></div>
  <p class="sm dim">☆ Star one thing as today's most important: finishing it earns a +25 XP bonus.</p>
  ${done.length ? `<h2>Completed</h2>${done.map(questRow).join('')}` : ''}`;
}
// energy-aware suggestion: starred or due first; otherwise low energy → easiest win, good energy → the big one
function nextUpCard() {
  const open = S.quests.filter(q => !q.done); if (!open.length) return '';
  const e = S.checkins[today()]?.energy, t = today(); let pick = open.find(q => q.mit), why = '⭐ Your most important thing';
  if (!pick) { const due = open.filter(q => q.due && q.due <= t).sort((a, b) => a.due.localeCompare(b.due))[0]; if (due) { pick = due; why = due.due < t ? '⚠️ Overdue' : '📍 Due today'; } }
  if (!pick) {
    const low = e != null && e <= 1; pick = open.slice().sort((a, b) => low ? a.diff - b.diff : b.diff - a.diff)[0];
    why = e == null ? 'Pick off a quest' : low ? '🔋 Low energy: bank an easy win' : '🚀 Energy is good: take the big one';
  }
  return `<div class="card"><div class="sm dim">NEXT UP · ${why}</div>${questRow(pick)}</div>`;
}

function viewFocus() {
  const f = S.focus, b = f.boss, a = f.active, todayMin = f.sessions.filter(s => s.date === today()).reduce((n, s) => n + s.min, 0);
  const rem = a ? Math.max(0, a.endAt - Date.now()) : f.min * 60000;
  const ring = `<div class="ring"><svg width="230" height="230"><circle cx="115" cy="115" r="105" fill="none" style="stroke:var(--ring-bg)" stroke-width="12"/>
    <circle id="fr" cx="115" cy="115" r="105" fill="none" stroke="url(#g)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="${a ? CIRC * (1 - rem / (a.min * 60000)) : 0}"/>
    <defs><linearGradient id="g"><stop offset="0" style="stop-color:var(--ring-a)"/><stop offset="1" style="stop-color:var(--ring-b)"/></linearGradient></defs></svg>
    <div class="t" id="ft">${pad(Math.floor(rem / 60000))}:${pad(Math.floor(rem / 1000) % 60)}</div></div>`;
  return `<div class="card boss"><div class="sm dim">Boss #${f.tier + 1}</div><div class="big">${b.emoji}</div><b>${esc(b.name)}</b>
    <div class="bar red"><i style="width:${b.hp / b.max * 100}%"></i></div><div class="sm dim">${b.hp} / ${b.max} HP</div></div>
  <div class="card" style="text-align:center">${ring}
  ${a ? `<div class="dim">${a.task ? '⚔️ ' + esc(a.task) : 'Stay in the zone…'}</div><br><button class="btn red" data-act="focus-cancel">Give up</button>`
      : `<div class="seg">${[5, 15, 25, 45, 60].map(m => `<button class="${f.min === m ? 'on' : ''}" data-act="focus-min" data-v="${m}">${m}m</button>`).join('')}</div>
    <input id="ftask" placeholder="What will you work on? (optional)" maxlength="80">
    <div class="pills" style="margin:10px 0;justify-content:center">${STAT_KEYS.map(k => `<button class="${f.stat === k ? 'on' : ''}" data-act="focus-stat" data-v="${k}">${STATS[k].e} ${STATS[k].n}</button>`).join('')}</div>
    <button class="btn block" data-act="focus-start">⚔️ Attack (${f.min * 4} dmg · +${f.min * 2} XP)</button>`}
  <p class="sm dim">Phone sleeping? No problem, the timer uses real time. Keep the app open for the screen to stay awake.</p></div>
  <div class="grid2"><div class="stat">Focus today<br><b>${fmtMin(todayMin)}</b></div><div class="stat">Bosses slain<br><b>${f.defeated} 🏆</b></div></div>`;
}
function viewCoach() {
  const prompt = PROMPTS[daySeed() % PROMPTS.length], entries = S.journal.slice().reverse().slice(0, 6);
  const quick = [['Plan my day', 'plan'], ["I'm unmotivated", 'unmotivated'], ["I'm overwhelmed", 'overwhelmed'], ['I broke my streak', 'failed'], ["I'm tired", 'tired'], ['I keep procrastinating', 'procrastinating']];
  return `<h2>Ask your coach ${net.info?.ai ? '<small>🧠 AI connected</small>' : '<small>offline coach</small>'}</h2>
  <div class="qp">${quick.map(([l]) => `<button data-act="quick" data-v="${esc(l)}">${l}</button>`).join('')}</div>
  <button class="btn sm gold" data-act="woop" style="margin-bottom:6px">🧭 Plan a goal with WOOP</button>
  <div class="chat">${S.chat.map(m => `<div class="msg ${m.role === 'user' ? 'me' : 'bot'}">${esc(m.content)}</div>`).join('') || '<div class="empty">Tell me what is on your mind 👇</div>'}
  ${thinking ? '<div class="msg bot">…</div>' : ''}</div>
  <form class="row" data-form="chat"><input id="chatin" placeholder="Type here…" autocomplete="off" maxlength="500"><button class="btn">Send</button></form>
  ${S.chat.length ? '<button class="btn sm ghost" style="margin-top:8px" data-act="chat-clear">Clear chat</button>' : ''}
  <h2>📓 Reflect <small>+15 XP daily</small></h2>
  <div class="card"><div class="sm dim">Today's prompt</div><p><b>${esc(prompt)}</b></p>
  <textarea id="jtext" placeholder="Write freely. This stays on your server."></textarea>
  <button class="btn block" style="margin-top:8px" data-act="journal" data-p="${esc(prompt)}">Save entry</button></div>
  ${entries.map(e => `<div class="j"><div class="sm dim">${e.date}${e.prompt ? ' · ' + esc(e.prompt) : ''}</div>${esc(e.text)}</div>`).join('')}`;
}
function radar() {
  const lv = STAT_KEYS.map(k => statLevel(S.stats[k])), mx = Math.max(5, ...lv), cx = 120, cy = 115, R = 80;
  const pt = (i, f) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 6; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; };
  const poly = lv.map((l, i) => pt(i, l / mx).join(',')).join(' ');
  const rings = [.33, .66, 1].map(f => `<polygon points="${STAT_KEYS.map((_, i) => pt(i, f).join(',')).join(' ')}" fill="none" style="stroke:var(--radar-line)"/>`).join('');
  const labels = STAT_KEYS.map((k, i) => { const [x, y] = pt(i, 1.28); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-size="13" style="fill:var(--txt)">${STATS[k].e} ${lv[i]}</text>`; }).join('');
  return `<svg viewBox="0 0 240 230" width="100%" style="max-width:300px;display:block;margin:auto">${rings}<polygon points="${poly}" style="fill:var(--radar-fill);stroke:var(--radar-stroke)" stroke-width="2"/>${labels}</svg>`;
}
function heatmap() {
  const cells = [], end = new Date(), start = new Date(end); start.setDate(start.getDate() - (12 * 7 - 1) - end.getDay());
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const x = S.history[dkey(d)] || 0, l = x === 0 ? 0 : x < 30 ? 1 : x < 70 ? 2 : x < 130 ? 3 : 4;
    cells.push(`<i class="${l ? 'l' + l : ''}" title="${dkey(d)}: ${x} XP"></i>`);
  }
  return `<div class="heat">${cells.join('')}</div>`;
}
function weekSummary() {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return dkey(d); });
  const xp = days.reduce((n, k) => n + (S.history[k] || 0), 0);
  const ch = S.habits.reduce((n, h) => n + days.filter(k => h.log[k]).length, 0);
  const fm = S.focus.sessions.filter(s => days.includes(s.date)).reduce((n, s) => n + s.min, 0);
  const moods = days.map(k => S.checkins[k]?.mood).filter(x => x != null), avg = moods.length ? MOODS[Math.round(moods.reduce((a, b) => a + b, 0) / moods.length)] : '–';
  return `<div class="grid2"><div class="stat">XP<br><b>${xp}</b></div><div class="stat">Habit check-ins<br><b>${ch}</b></div><div class="stat">Focus<br><b>${fmtMin(fm)}</b></div><div class="stat">Avg mood<br><b>${avg}</b></div></div>`;
}
function viewHero() {
  const l = level();
  return `<div class="card" style="text-align:center"><div class="avatar" style="margin:auto;width:84px;height:84px;font-size:46px">${S.profile.avatar}</div>
    <h2 style="justify-content:center;margin:8px 0 0">${esc(S.profile.name)}</h2><div class="dim">Level ${l} ${titleOf(l)} · ${S.xp} XP total</div>${radar()}</div>
  <h2>This week</h2>${weekSummary()}
  <h2>Activity <small>last 12 weeks</small></h2><div class="card">${heatmap()}</div>
  <h2>🛍️ Reward shop <small>🪙 ${S.coins}</small></h2><div class="shop">
    <div class="task" data-act="buy-chest"><div class="em">🎁</div><div class="grow"><div class="nm">Mystery chest</div><div class="sm dim">Coins, XP or rare loot</div></div><div class="price">60 🪙</div></div>
    ${S.rewards.map(r => `<div class="task" data-act="buy" data-id="${r.id}"><div class="em">${r.emoji}</div><div class="grow"><div class="nm">${esc(r.name)}</div></div><div class="price">${r.cost} 🪙</div><button class="del" data-act="reward-del" data-id="${r.id}">🗑</button></div>`).join('')}
    <button class="btn block ghost" data-act="add-reward">＋ Add a real-life reward</button></div>
  <h2>🏆 Achievements <small>${Object.keys(S.achievements).length}/${ACH.length}</small></h2>
  <div class="badges">${ACH.map(([id, e, n, d]) => `<div class="badge ${S.achievements[id] ? 'got' : ''}" title="${esc(d)}" data-act="ach" data-id="${id}"><span class="e">${e}</span>${n}</div>`).join('')}</div>
  <h2>Avatar</h2><div class="avs">${AVATARS.map(([e, lv]) => `<button class="${S.profile.avatar === e ? 'on' : ''} ${l < lv ? 'lock' : ''}" data-act="avatar" data-v="${e}" data-lv="${lv}">${l < lv ? '🔒' : e}</button>`).join('')}</div>
  ${hooks('hero')}
  <h2>⚙️ Settings</h2><div class="card">
    <div class="row"><span class="grow">Sound effects</span><button class="btn sm ${S.settings.sound ? '' : 'ghost'}" data-act="set" data-v="sound">${S.settings.sound ? 'On' : 'Off'}</button></div><br>
    <div class="row"><span class="grow">Haptics</span><button class="btn sm ${S.settings.haptics ? '' : 'ghost'}" data-act="set" data-v="haptics">${S.settings.haptics ? 'On' : 'Off'}</button></div><br>
    <div class="row"><span class="grow">Loss-framed stakes <span class="sm dim">(optional)</span></span><button class="btn sm ${S.settings.stakes ? '' : 'ghost'}" data-act="stakes-toggle">${S.settings.stakes ? 'On' : 'Off'}</button></div><br>
    <div class="row"><span class="grow">Reminders <span class="sm dim">(gentle, opt-in)</span></span><button class="btn sm ${S.settings.remind.on ? '' : 'ghost'}" data-act="remind-toggle">${S.settings.remind.on ? 'On' : 'Off'}</button></div>${S.settings.remind.on ? '<button class="btn sm ghost block" style="margin-top:6px" data-act="remind-edit">Reminder settings</button>' : ''}<br>
    <div class="row"><span class="grow">Calm mode <span class="sm dim">(no confetti)</span></span><button class="btn sm ${S.settings.calm ? '' : 'ghost'}" data-act="set" data-v="calm">${S.settings.calm ? 'On' : 'Off'}</button></div><br>
    <button class="btn sm ghost block" data-act="rest-new">😴 Rest mode (pause streaks)</button><br>
    <button class="btn sm ghost block" data-act="science">🔬 The science behind this app</button><br>
    <div class="sm dim" id="syncst">${syncLabel()}</div>
    ${net.info?.tokenRequired ? '<button class="btn sm ghost" data-act="token">Set server token</button>' : ''}
    <div class="row" style="margin-top:12px"><button class="btn sm ghost grow" data-act="export">Export backup</button><button class="btn sm ghost grow" data-act="import">Import</button><button class="btn sm ghost grow" data-act="rename">Rename</button></div>
    <button class="btn sm red block" style="margin-top:12px" data-act="reset">Reset everything</button>
    <input type="file" id="imp" accept="application/json" class="hidden"></div>`;
}

function render() {
  if (!S.profile.name) return onboarding();
  if (document.getElementById('ob-name')) { modalLocked = false; closeModal(); }     // the synced profile arrived while the welcome screen was open
  settleStake();
  processMoneyMonth();
  const views = { today: viewToday, quests: viewQuests, money: viewMoney, focus: viewFocus, squad: viewSquad, coach: viewCoach, hero: viewHero };
  const keep = document.activeElement?.id === 'chatin' ? $('#chatin').value : '';
  $('#app').innerHTML = hud() + views[tab]() +
    `<nav><div class="in">${NAV.map(([k, e, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-v="${k}"><span>${e}</span>${n}</button>`).join('')}</div></nav>`;
  if (keep && $('#chatin')) { $('#chatin').value = keep; $('#chatin').focus(); }
  if (typeof rpgA11y === 'function') rpgA11y();
}

// ───────────────────────── forms & modals ─────────────────────────
let draft = {};
function onboarding() {
  draft = { avatar: '🙂', starters: new Set(['Drink water', 'Walk 20 min', 'Journal']) };
  modalLocked = true;
  openModal(`<h2 style="font-size:1.4rem">⚔️ Welcome to LifeQuest</h2><p class="dim">Your life, turned into an RPG. Everything stays on your own server.</p>
  <label>Hero name</label><input id="ob-name" maxlength="20" placeholder="What should I call you?">
  <label>Pick an avatar</label><div class="picker">${AVATARS.filter(a => a[1] === 1).map(([e]) => `<button class="${e === '🙂' ? 'on' : ''}" data-act="pick-one" data-k="avatar" data-v="${e}">${e}</button>`).join('')}</div>
  <label>Starter habits (tap to choose, change anytime)</label><div class="pills">${STARTERS.map(s => `<button class="${draft.starters.has(s[0]) ? 'on' : ''}" data-act="pick-starter" data-v="${esc(s[0])}">${s[1]} ${s[0]}</button>`).join('')}</div>
  <br><button class="btn block" data-act="ob-go">Begin the adventure</button>`);
}
function habitForm(h) {
  draft = h ? { ...h, days: [...h.days] } : { name: '', cue: '', emoji: '🎯', stat: 'mind', diff: 1, days: [0, 1, 2, 3, 4, 5, 6] };
  openModal(`<h2>${h ? 'Edit habit' : 'New habit'}</h2><label>Name</label><input id="f-name" maxlength="40" value="${esc(draft.name)}" placeholder="e.g. Read 10 pages">
  <label>Cue: when/where will you do it? (if-then plans boost follow-through)</label><input id="f-cue" maxlength="80" value="${esc(draft.cue || '')}" placeholder="After I pour my morning coffee…">
  <label>Reminder time (optional)</label><input id="f-time" type="time" value="${esc(draft.time || '')}">
  <label style="display:flex;gap:8px;align-items:center"><input id="f-mute" type="checkbox" style="width:auto" ${draft.mute ? 'checked' : ''}> 🔕 No reminders for this habit</label>
  <label>Icon</label><div class="picker">${EMOJIS.map(e => `<button class="${draft.emoji === e ? 'on' : ''}" data-act="pick-one" data-k="emoji" data-v="${e}">${e}</button>`).join('')}</div>
  <label>Skill it trains</label><div class="pills">${STAT_KEYS.map(k => `<button class="${draft.stat === k ? 'on' : ''}" data-act="pick-one" data-k="stat" data-v="${k}">${STATS[k].e} ${STATS[k].n}</button>`).join('')}</div>
  <label>Difficulty (Easy = ${10} XP, Hard = ${30} XP)</label><div class="pills">${[1, 2, 3].map(d => `<button class="${draft.diff === d ? 'on' : ''}" data-act="pick-one" data-k="diff" data-v="${d}">${DIFF[d]}</button>`).join('')}</div>
  <label>How often?</label><div class="pills">${[0, 1, 2, 3, 4, 5, 6].map(n => `<button class="${(draft.freq || 0) === n ? 'on' : ''}" data-act="pick-one" data-k="freq" data-v="${n}">${n ? n + '×/week' : 'Specific days'}</button>`).join('')}</div>
  <label>Repeat on (for "Specific days")</label><div class="pills">${DAYS.map((d, i) => `<button class="${draft.days.includes(i) ? 'on' : ''}" data-act="pick-day" data-v="${i}">${d}</button>`).join('')}</div>
  ${h && (h.auto || []).length ? `<p class="sm dim">🧪 Automaticity ratings: ${h.auto.map(r => r.v).join(' → ')} (5 = no thought needed)</p>` : ''}
  ${h && isAuto(h) ? `<button class="btn block gold" data-act="habit-grad" data-id="${h.id}" style="margin-top:8px">🎓 Graduate this habit (it is automatic now)</button>` : ''}
  <br><button class="btn block" data-act="habit-save" data-id="${h ? h.id : ''}">Save</button>
  ${h ? `<button class="btn block red" style="margin-top:8px" data-act="habit-del" data-id="${h.id}">Delete habit</button>` : ''}`);
}
function questForm() {
  draft = { stat: 'mind', diff: 1, dur: 30, repeat: 'none' };
  openModal(`<h2>New quest</h2><label>What needs doing?</label><input id="f-name" maxlength="80" placeholder="e.g. Book dentist appointment">
  <label>Tiny first step (optional)</label><input id="f-first" maxlength="80" placeholder="e.g. Open the document and write one sentence">
  <label>Due (optional)</label><div class="pills" style="margin-bottom:6px"><button data-act="due-quick" data-v="0">Today</button><button data-act="due-quick" data-v="1">Tomorrow</button><button data-act="due-quick" data-v="7">Next week</button></div><input id="f-due" type="date">
  <label>Time block (optional)</label><div class="row"><input id="f-start" type="time" style="flex:1"><div class="pills" style="flex:2">${[15, 30, 60, 90].map(m => `<button class="${m === 30 ? 'on' : ''}" data-act="pick-one" data-k="dur" data-v="${m}">${fmtDur(m)}</button>`).join('')}</div></div>
  <label>Repeat</label><div class="pills">${[['none', 'Never'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekly', 'Weekly']].map(([k, l]) => `<button class="${k === 'none' ? 'on' : ''}" data-act="pick-one" data-k="repeat" data-v="${k}">${l}</button>`).join('')}</div>
  <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input id="f-mute" type="checkbox" style="width:auto"> 🔕 No reminders for this quest</label>
  <label>Skill</label><div class="pills">${STAT_KEYS.map(k => `<button class="${draft.stat === k ? 'on' : ''}" data-act="pick-one" data-k="stat" data-v="${k}">${STATS[k].e} ${STATS[k].n}</button>`).join('')}</div>
  <label>Difficulty (25 / 50 / 75 XP)</label><div class="pills">${[1, 2, 3].map(d => `<button class="${draft.diff === d ? 'on' : ''}" data-act="pick-one" data-k="diff" data-v="${d}">${DIFF[d]}</button>`).join('')}</div>
  <br><button class="btn block" data-act="quest-save">Add quest</button>`);
}
function rewardForm() {
  draft = { emoji: '🍕' };
  openModal(`<h2>New reward</h2><p class="dim sm">Something real you will treat yourself to when you have earned the coins.</p>
  <label>Reward</label><input id="f-name" maxlength="50" placeholder="e.g. Pizza night, 1h gaming, new book">
  <label>Icon</label><div class="picker">${['🍕', '🎮', '📖', '☕', '🍦', '🎬', '🛍️', '💆', '🎧', '🏖️', '🍫', '🎁'].map(e => `<button class="${draft.emoji === e ? 'on' : ''}" data-act="pick-one" data-k="emoji" data-v="${e}">${e}</button>`).join('')}</div>
  <label>Cost (coins)</label><input id="f-cost" type="number" inputmode="numeric" value="100" min="1">
  <br><button class="btn block" data-act="reward-save">Add to shop</button>`);
}
const val = id => ($('#' + id) || {}).value || '';

// ───────────────────────── actions ─────────────────────────
const A = {
  close: () => { modalLocked = false; closeModal(); },
  tab: el => { tab = el.dataset.v; render(); window.scrollTo(0, 0); if (tab === 'squad') fetchBoard(); },
  tip: () => { tipIdx++; render(); },
  habit: el => toggleHabit(el.dataset.id),
  'habit-menu': el => habitForm(S.habits.find(h => h.id === el.dataset.id)),
  'add-habit': () => habitForm(null),
  'habit-save': el => {
    const name = val('f-name').trim(); if (!name) return toast('Give it a name');
    if (!draft.days.length) return toast('Pick at least one day');
    const id = el.dataset.id, h = S.habits.find(x => x.id === id);
    const cue = val('f-cue').trim().slice(0, 80), time = val('f-time');
    if (h) Object.assign(h, { name, cue, time, freq: draft.freq || 0, mute: !!($('#f-mute') || {}).checked, emoji: draft.emoji, stat: draft.stat, diff: draft.diff, days: draft.days });
    else S.habits.push({ id: uid(), name, cue, time, freq: draft.freq || 0, mute: !!($('#f-mute') || {}).checked, emoji: draft.emoji, stat: draft.stat, diff: draft.diff, days: draft.days, log: {}, auto: [], created: Date.now() });
    save(); checkAch(); closeModal(); render();
  },
  'habit-del': el => { if (confirm('Delete this habit and its history?')) { S.habits = S.habits.filter(h => h.id !== el.dataset.id); save(); closeModal(); render(); } },
  quest: el => toggleQuest(el.dataset.id),
  'add-quest': () => questForm(),
  'quest-save': () => {
    const name = val('f-name').trim(); if (!name) return toast('Give it a name');
    S.quests.push({ id: uid(), name, stat: draft.stat, diff: draft.diff, done: false, due: val('f-due') || (val('f-start') ? today() : ''), start: val('f-start'), dur: val('f-start') ? draft.dur : 0, repeat: draft.repeat === 'none' ? '' : draft.repeat, first: val('f-first').trim(), mute: !!($('#f-mute') || {}).checked }); save(); closeModal(); render();
  },
  'quest-del': el => { S.quests = S.quests.filter(q => q.id !== el.dataset.id); save(); render(); },
  roll: () => {
    const [name, stat, diff] = pick(SIDE_QUESTS);
    S.quests.push({ id: uid(), name, stat, diff, done: false }); save(); sfx.chest(); toast('🎲 New side quest!', 'gold'); render();
  },
  'sq-sub': el => { squad.sub = el.dataset.v; render(); },
  'ch-new': challengeForm, 'ch-save': createChallenge,
  'ch-join': el => challengeAction('join', el.dataset.id), 'ch-claim': el => claimChallenge(el.dataset.id),
  'ch-del': el => { if (confirm('Cancel this challenge for everyone?')) challengeAction('delete', el.dataset.id); },
  auto: el => rateAutomaticity(el.dataset.id, +el.dataset.v), woop: woopForm, 'woop-save': saveWoop, science: showScience,
  'stake-new': stakeForm, 'stake-go': startStake, 'stake-out': withdrawStake,
  'stakes-toggle': () => {
    if (!S.settings.stakes) return stakeIntro();
    if (S.stake) return toast('Finish or withdraw your stake first');
    S.settings.stakes = false; save(); render();
  },
  'stakes-enable': () => { S.settings.stakes = true; save(); closeModal(); render(); toast('Stakes are on. Find them on Today.'); },
  'm-pick': el => { mdraft[el.dataset.k] = el.dataset.v; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); if (el.dataset.k === 'type') $('#m-cats').style.display = el.dataset.v === 'in' ? 'none' : ''; },
  'm-add': addTx, 'm-nospend': noSpendDay, 'm-export': exportCsv,
  'm-budget': el => {
    const k = el.dataset.cat, cur = S.money.budgets[k] || 0, v = prompt('Monthly budget for ' + MCATS[k][1] + ' (0 removes it):', cur ? cur / 100 : '');
    if (v == null) return; const c = toCents(v); if (c) S.money.budgets[k] = c; else delete S.money.budgets[k]; save(); render();
  },
  'goal-edit': goalForm, deposit: depositForm, 'deposit-save': saveDeposit,
  'goal-save': () => {
    const name = val('f-name').trim(), target = toCents(val('f-amt')); if (!target) return toast('Enter a target amount');
    const g = S.money.goal; if (target !== g.target) g.done = false; Object.assign(g, { name, target }); save(); closeModal(); render();
  },
  'bill-new': billForm, 'bill-paid': el => markBillPaid(el.dataset.id),
  'bill-save': () => {
    const name = val('f-name').trim(), amt = toCents(val('f-amt')), day = Math.min(31, Math.max(1, parseInt(val('f-day')) || 1));
    if (!name || !amt) return toast('Add a name and amount');
    S.money.bills.push({ id: uid(), name, amt, day, cat: draft.cat, paid: {} }); save(); closeModal(); render();
  },
  'bill-del': el => { if (confirm('Delete this bill?')) { S.money.bills = S.money.bills.filter(b => b.id !== el.dataset.id); save(); render(); } },
  'tx-del': el => { S.money.tx = S.money.tx.filter(t => t.id !== el.dataset.id); save(); render(); },
  'quest-mit': el => { const q = S.quests.find(x => x.id === el.dataset.id); if (!q) return; const on = !q.mit; S.quests.forEach(x => x.mit = false); q.mit = on; save(); render(); },
  'due-quick': el => { $('#f-due').value = addDays(today(), +el.dataset.v); },
  'm-import': () => $('#csvin').click(),
  'csv-sign': el => { csvDraft.negIsSpend = el.dataset.v === 'neg'; csvPreview(); },
  'csv-go': () => {
    const { out } = csvBuild(); S.money.tx.push(...out); S.money.tx.sort((a, b) => a.date.localeCompare(b.date));
    award(10, 3, 'wealth'); sfx.chest(); csvDraft = null; save(); checkAch(); closeModal(); render(); toast(`Imported ${out.length} transactions`);
  },
  'rules-edit': rulesForm,
  'rule-add': () => { const k = val('r-k').trim().toLowerCase(), c = val('r-c'); if (!k) return toast('Type a keyword'); S.money.rules.unshift([k, c]); save(); rulesForm(); },
  'rule-del': el => { S.money.rules.splice(+el.dataset.i, 1); save(); rulesForm(); },
  wclaim: el => claimObjective(el.dataset.v), wboss: claimWeeklyBoss,
  'board-join': () => joinBoard(true),
  'board-leave': () => { if (confirm('Leave the leaderboard? Your card will be removed from the server.')) joinBoard(false); },
  'lb-mode': el => { squad.mode = el.dataset.v; render(); },
  cheer: el => cheer(el.dataset.id), 'raid-claim': claimRaid,
  mood: el => checkin(+el.dataset.v, null),
  energy: el => checkin(null, +el.dataset.v),
  chest: () => openChest(),
  'focus-min': el => { S.focus.min = +el.dataset.v; save(); render(); },
  'focus-stat': el => { S.focus.stat = el.dataset.v; save(); render(); },
  'focus-start': startFocus, 'focus-cancel': cancelFocus,
  quick: el => sendChat(el.dataset.v),
  'chat-clear': () => { S.chat = []; save(); render(); },
  journal: el => {
    const text = val('jtext').trim(); if (!text) return toast('Write something first');
    const first = !S.journal.some(j => j.date === today());
    S.journal.push({ id: uid(), date: today(), text, prompt: el.dataset.p });
    if (first) award(15, 3, 'spirit'); else toast('Saved');
    sfx.ding(); save(); checkAch(); render();
  },
  'buy-chest': () => { if (S.coins < 60) return toast('Not enough coins 🪙'); S.coins -= 60; openChest(true); },
  'add-reward': () => rewardForm(),
  'reward-save': () => {
    const name = val('f-name').trim(), cost = Math.max(1, parseInt(val('f-cost')) || 0); if (!name) return toast('Name it first');
    S.rewards.push({ id: uid(), name, emoji: draft.emoji, cost }); save(); closeModal(); render();
  },
  'reward-del': (el, ev) => { ev.stopPropagation(); S.rewards = S.rewards.filter(r => r.id !== el.dataset.id); save(); render(); },
  buy: el => {
    const r = S.rewards.find(x => x.id === el.dataset.id); if (!r) return;
    if (S.coins < r.cost) return toast(`Need ${r.cost - S.coins} more 🪙`);
    if (!confirm(`Spend ${r.cost} 🪙 on "${r.name}"?`)) return;
    S.coins -= r.cost; S.purchases.push({ name: r.name, cost: r.cost, date: today() }); sfx.chest(); confetti(80);
    save(); render(); openModal(`<div class="big-em">${r.emoji}</div><h2 style="justify-content:center">Enjoy it!</h2><p>You earned <b>${esc(r.name)}</b>. Go and claim it, guilt-free.</p><button class="btn block" data-act="close">Yes!</button>`, true);
  },
  ach: el => { const a = ACH.find(x => x[0] === el.dataset.id); toast(`${a[1]} ${a[2]}: ${a[3]}${S.achievements[a[0]] ? ' ✓' : ''}`); },
  avatar: el => { if (level() < +el.dataset.lv) return toast(`Unlocks at level ${el.dataset.lv}`); S.profile.avatar = el.dataset.v; save(); render(); },
  set: el => { S.settings[el.dataset.v] = !S.settings[el.dataset.v]; save(); render(); },
  'token-save': () => { net.token = val('tok').trim(); try { localStorage.setItem('lifequest.token', net.token); } catch { } closeModal(); initSync(); },
  token: () => { const t = prompt('Server token (LIFEQUEST_TOKEN):', net.token); if (t != null) { net.token = t.trim(); localStorage.setItem('lifequest.token', net.token); initSync(); } },
  export: () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' }));
    a.download = `lifequest-backup-${today()}.json`; a.click();
  },
  import: () => $('#imp').click(),
  rename: () => { const n = prompt('Hero name:', S.profile.name); if (n && n.trim()) { S.profile.name = n.trim().slice(0, 20); save(); render(); } },
  reset: () => { if (confirm('Delete ALL progress on this device? Export a backup first!') && confirm('Really? This cannot be undone.')) { S = defaults(); save(); pushState(); render(); } },
  // onboarding / form pickers
  'pick-one': el => { draft[el.dataset.k] = isNaN(el.dataset.v) ? el.dataset.v : +el.dataset.v; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); },
  'pick-day': el => { const d = +el.dataset.v, i = draft.days.indexOf(d); i < 0 ? draft.days.push(d) : draft.days.splice(i, 1); el.classList.toggle('on'); },
  'pick-starter': el => { const v = el.dataset.v; draft.starters.has(v) ? draft.starters.delete(v) : draft.starters.add(v); el.classList.toggle('on'); },
  'ob-go': () => {
    const name = val('ob-name').trim(); if (!name) return toast('Tell me your name, hero');
    S.profile = { name: name.slice(0, 20), avatar: draft.avatar };
    for (const [n, e, stat, diff] of STARTERS) if (draft.starters.has(n)) S.habits.push({ id: uid(), name: n, emoji: e, stat, diff, days: [0, 1, 2, 3, 4, 5, 6], log: {}, created: Date.now() });
    S.quests.push({ id: uid(), name: 'Complete your first habit', stat: 'mind', diff: 1, done: false });
    modalLocked = false; closeModal(); save(); confetti(100); sfx.level(); render(); dailyLogin();
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const f = A[el.dataset.act]; if (f) f(el, e);
});
document.addEventListener('submit', e => {
  const f = e.target.dataset.form; if (!f) return; e.preventDefault();
  if (f === 'chat') { const i = $('#chatin'), t = i.value; i.value = ''; sendChat(t); }
});
document.addEventListener('change', e => {
  if (e.target.id !== 'imp' || !e.target.files[0]) return;
  const r = new FileReader();
  r.onload = () => {
    try { const s = JSON.parse(r.result); if (s.v !== 1) throw 0; if (!confirm('Replace current progress with this backup?')) return; S = migrate(s); save(); render(); toast('Backup restored'); }
    catch { toast('Not a valid backup file'); }
  };
  r.readAsText(e.target.files[0]);
});

// ───────────────────────── daily login bonus & boot ─────────────────────────
function dailyLogin() {
  if (!S.profile.name || S.login.last === today()) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  S.login.streak = S.login.last === dkey(y) ? S.login.streak + 1 : 1; S.login.last = today();
  const c = 5 * Math.min(S.login.streak, 7); S.coins += c; save();
  setTimeout(() => toast(`📅 Day ${S.login.streak} login bonus: +${c} 🪙`, 'gold'), 600);
}

