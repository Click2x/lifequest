'use strict';
// 16-bit Saga skin: switching, settings card, and accessibility helpers. Styles live in theme-rpg.css (docs/UI-REFRESH.md).

const RPG_THEMES = { dark: '#08091a', light: '#e9dcb8' };
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
    <div class="pills">${pill('theme-set', '', '🌓 Auto', !theme)}${pill('theme-set', 'dark', '🌙 Night', theme === 'dark')}${pill('theme-set', 'light', '📜 Parchment', theme === 'light')}</div>
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
HOOKS.hero.push(rpgSettings);
applySkin();
