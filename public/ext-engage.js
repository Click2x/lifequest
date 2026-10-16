'use strict';
// Engagement: gentle, opt-in nudges that bring you back to the game. They ride the existing reminder pipeline, so quiet hours,
// the daily cap, rest mode, snooze and server push all apply. Needs Reminders turned on (Hero > Reminder settings).

const ENG_DEFAULT = { story: true, odds: true, streak: true };
const engOn = k => (S.settings.engage ? S.settings.engage[k] !== false : ENG_DEFAULT[k]);

// number of daily rituals still to do today; shown on the app icon where the browser supports it
function ritualsLeft() { return todaysHabits().filter(h => !h.log[today()]).length; }
function updateBadge() {
  try {
    if (!navigator.setAppBadge) return;
    const n = S.profile?.name && S.settings.remind?.on ? ritualsLeft() : 0;
    if (n > 0) navigator.setAppBadge(n); else navigator.clearAppBadge && navigator.clearAppBadge();
  } catch { }
}

function engagementEvents(d) {
  const out = [], isToday = d === today(), prev = addDays(d, -1);
  // 1. morning: yesterday's actions became an episode
  if (engOn('story') && S.saga?.on && sagaDay(prev).any) {
    out.push({ id: `eng:story:${d}`, at: toMin('08:30'), d, url: '/?go=today', title: '📖 Your hero\'s story is waiting', body: 'See what your real actions did yesterday.' });
  }
  // 2. evening: odds for tonight's encounter, and what would raise them
  if (engOn('odds') && S.saga?.on) {
    const day = sagaDay(d), c = sagaCheck(d, day), odds = Math.round(sagaOdds(c.mod, c.bonus, c.dc) * 100), better = Math.round(sagaOdds(c.mod, c.bonus + 1, c.dc) * 100);
    if (!S.perfect[d] && odds < 95) {
      out.push({ id: `eng:odds:${d}`, at: toMin('18:30'), d, url: '/?go=today', title: `⚔️ ${c.boss.n}: ${odds}% tonight`,
        body: better > odds ? `One more ritual or focus session lifts your roll to ${better}%.` : 'Your preparation is looking solid. Finish strong.' });
    }
  }
  // 3. evening: a streak that is still saveable today (never shaming, and only for streaks worth caring about)
  if (engOn('streak') && isToday) {
    const risk = todaysHabits().filter(h => !h.log[d] && !h.mute && streak(h) >= 3).sort((a, b) => streak(b) - streak(a))[0];
    if (risk) out.push({ id: `eng:streak:${d}`, at: toMin('20:30'), d, url: '/?go=today', title: `🔥 ${risk.emoji} ${risk.name}: ${streak(risk)}-day streak`, body: 'Still time tonight. Two minutes keeps it alive.' });
  }
  return out;
}

// plug into the reminder candidates (used by the local ticker and by server push scheduling)
{
  const base = reminderEventsFor;
  reminderEventsFor = d => base(d).concat(S.settings.remind?.on ? engagementEvents(d) : []);
}

// open the screen a notification asked for (?go=today|saga)
function engageRoute() {
  try {
    const go = new URLSearchParams(location.search).get('go');
    if (go) { tab = ['today', 'quests', 'saga', 'money', 'menu', 'focus', 'squad', 'coach', 'hero', 'config'].includes(go) ? go : 'today'; history.replaceState(null, '', location.pathname); }
  } catch { }
}

function engageSettings() {
  if (!S.settings.remind?.on) return '';
  const pill = (k, label) => `<div class="row" style="margin-top:8px"><span class="grow">${label}</span><button class="btn sm ${engOn(k) ? '' : 'ghost'}" data-act="engage-toggle" data-v="${k}">${engOn(k) ? 'On' : 'Off'}</button></div>`;
  return `<h2>💌 Nudges</h2><div class="card"><div class="sm dim">Optional extras that bring you back to the game. They follow your quiet hours and daily cap.</div>
    ${pill('story', '📖 Morning: your story is waiting')}${pill('odds', '⚔️ Evening: tonight\'s odds')}${pill('streak', '🔥 Evening: a streak you can still save')}</div>`;
}
Object.assign(A, {
  'engage-toggle': el => { S.settings.engage = { ...ENG_DEFAULT, ...(S.settings.engage || {}) }; S.settings.engage[el.dataset.v] = !engOn(el.dataset.v); save(); render(); schedulePushSync(); },
});
HOOKS.config.push(engageSettings);

// keep the badge fresh whenever the screen redraws or the app returns to the foreground
{
  const r = render;
  render = function () { r.apply(this, arguments); updateBadge(); };
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { updateBadge(); schedulePushSync(); } });
engageRoute();
