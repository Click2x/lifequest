'use strict';
// 16-bit Saga skin: switching, settings card, and accessibility helpers. Styles live in theme-rpg.css (docs/UI-REFRESH.md).

const RPG_THEMES = { dark: '#08091a', light: '#eef2fb' };
const rpgCalm = () => !!(S.settings.calm || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches));

// S.settings.skin: 'rpg' (default) | 'classic';  S.settings.theme: '' (auto) | 'dark' | 'light';  S.settings.plainfont: bool
function applySkin() {
  const root = document.documentElement, st = S.settings || {};
  const skin = st.skin === 'classic' ? 'classic' : 'rpg';
  root.dataset.skin = skin;
  if (st.theme === 'dark' || st.theme === 'light') root.dataset.theme = st.theme; else delete root.dataset.theme;
  root.classList.toggle('plainfont', !!st.plainfont);
  root.classList.toggle('calm', !!st.calm);
  try { localStorage.setItem('lifequest.skin', JSON.stringify({ skin, theme: st.theme || '', plain: !!st.plainfont })); } catch { }
  const light = skin === 'rpg' && (st.theme === 'light' || (!st.theme && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches));
  const meta = document.querySelector('meta[name=theme-color]');
  if (meta) meta.content = skin === 'rpg' ? (light ? RPG_THEMES.light : RPG_THEMES.dark) : '#0f0b1e';
}

// clickable rows are divs; give them a role and tab stop so a keyboard or switch user can reach them
function rpgA11y() {
  document.querySelectorAll('#app [data-act]:not(button):not(a):not(input):not(select):not(textarea):not([tabindex])').forEach(el => {
    el.setAttribute('role', 'button'); el.tabIndex = 0;
  });
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target;
  if (el && el.getAttribute && el.getAttribute('role') === 'button' && el.tagName !== 'BUTTON') { e.preventDefault(); el.click(); }
});

function rpgSettings() {
  const st = S.settings, skin = st.skin === 'classic' ? 'classic' : 'rpg', theme = st.theme || '';
  const pill = (a, v, label, on) => `<button class="${on ? 'on' : ''}" data-act="${a}" data-v="${v}">${label}</button>`;
  return `<h2>🎨 Look</h2><div class="card">
    <div class="sm dim" style="margin-bottom:6px">Style</div>
    <div class="pills">${pill('skin-set', 'rpg', '⚔️ 16-bit', skin === 'rpg')}${pill('skin-set', 'classic', '✨ Classic', skin === 'classic')}</div>
    ${skin === 'rpg' ? `<div class="sm dim" style="margin:12px 0 6px">Colors</div>
    <div class="pills">${pill('theme-set', '', '🌓 Auto', !theme)}${pill('theme-set', 'dark', '🌙 Night', theme === 'dark')}${pill('theme-set', 'light', '☀️ Daylight', theme === 'light')}</div>
    <div class="row" style="margin-top:12px"><span class="grow">Retro pixel font <span class="sm dim">(off = plain, easier on the eyes)</span></span><button class="btn sm ${st.plainfont ? 'ghost' : ''}" data-act="set" data-v="plainfont-inv">${st.plainfont ? 'Off' : 'On'}</button></div>` : ''}
  </div>`;
}

Object.assign(A, {
  'skin-set': el => { S.settings.skin = el.dataset.v; save(); applySkin(); render(); },
  'theme-set': el => { S.settings.theme = el.dataset.v; save(); applySkin(); render(); },
});
// the shared "set" toggle flips a boolean by name; "plainfont-inv" is the inverse of the visible On/Off label
{
  const base = A.set;
  A.set = el => {
    if (el.dataset.v === 'plainfont-inv') { S.settings.plainfont = !S.settings.plainfont; save(); applySkin(); render(); return; }
    base(el); if (el.dataset.v === 'calm') applySkin();
  };
}
HOOKS.config.push(rpgSettings);
applySkin();

// ── floating gain numbers: "+25 XP" rises from where you last tapped ──
let rpgLast = { x: innerWidth / 2, y: innerHeight * .4 };
document.addEventListener('pointerdown', e => { rpgLast = { x: e.clientX, y: e.clientY }; }, { passive: true, capture: true });
function popNum(text, kind = 'xp') {
  if (rpgCalm()) return;
  const host = document.getElementById('fxl'); if (!host) return;
  const el = document.createElement('div');
  el.className = 'popnum ' + kind; el.textContent = text;
  el.style.left = Math.min(innerWidth - 50, Math.max(50, rpgLast.x)) + 'px'; el.style.top = Math.max(60, rpgLast.y - 30) + 'px';
  host.appendChild(el); setTimeout(() => el.remove(), 1000);
}

// ── Menu: the pause-screen home for everything that is not in the bottom bar ──
function viewMenu() {
  const t = today(), c = sagaCheck(t), odds = Math.round(sagaOdds(c.mod, c.bonus, c.dc) * 100), best = typeof bestStreak === 'function' ? bestStreak() : 0;
  const rows = [['hero', '🦸', 'Status', 'Stats, achievements, rewards'], ['focus', '🎯', 'Dojo', 'Focus duels'], ['squad', '🏰', 'Guild', 'Party, raids, league'], ['coach', '💬', 'Sage', 'Coach and journal'], ['saga', '📜', 'Chronicle', 'Every episode so far'], ['config', '⚙️', 'Config', 'Look, sound, reminders, backup']];
  return `<div class="card"><div class="win-title">COMMAND</div>
    ${rows.map(([k, e, n, d]) => `<div class="task menurow" data-act="tab" data-v="${k}"><div class="em">${e}</div><div class="grow"><div class="nm">${n}</div><div class="sm dim">${d}</div></div><span class="dim">▶</span></div>`).join('')}
    <div class="task menurow" data-act="export"><div class="em">💾</div><div class="grow"><div class="nm">Save</div><div class="sm dim">Download a backup file</div></div><span class="dim">▶</span></div></div>
    <div class="grid2"><div class="stat"><div class="sm dim">Gold</div><b>🪙 ${S.coins}</b></div><div class="stat"><div class="sm dim">Best streak</div><b>🔥 ${best} day${best === 1 ? '' : 's'}</b></div></div>
    ${S.saga.on ? `<div class="card" style="margin-top:10px" data-act="tab" data-v="saga"><div class="win-title">TONIGHT</div><div class="row"><div style="font-size:30px">${c.boss.e}</div><div class="grow"><b>${esc(c.boss.n)}, the ${c.phase}</b><div class="sm dim">Odds ${odds}%</div></div></div></div>` : ''}`;
}
