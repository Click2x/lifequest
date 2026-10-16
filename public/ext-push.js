'use strict';
/* True push reminders: your server sends them even when the app is closed (needs HTTPS, e.g. your Tailscale link).
   The client uploads its upcoming reminders; the server delivers each one at its time via Web Push. */

const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const urlB64 = s => { const raw = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c => c.charCodeAt(0))); };

async function enablePush() {
  if (!pushSupported()) return toast('This browser does not support push (iPhone: add to Home Screen first)');
  if (!window.isSecureContext) return toast('Push needs HTTPS. Use your Tailscale link.');
  try {
    if (await Notification.requestPermission() !== 'granted') return toast('Notifications were not allowed');
    const reg = await navigator.serviceWorker.ready, kr = await apiFetch('/api/push/key'); if (!kr.ok) throw new Error('server');
    const { key } = await kr.json();
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(key) });
    const r = await apiFetch('/api/push/sub', { method: 'POST', body: JSON.stringify({ sub: sub.toJSON() }) }); if (!r.ok) throw new Error('save');
    S.settings.pushOn = true; S.settings.remind.on = true; save(); await pushSync(); closeModal(); render(); toast('Push reminders on 🔔', 'gold');
  } catch (e) { toast('Could not enable push: ' + (e.message || e)); }
}
async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) { await apiFetch('/api/push/unsub', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
  } catch { }
  S.settings.pushOn = false; save(); closeModal(); render(); toast('Push off');
}
let pushTimer = 0;
function schedulePushSync() { if (!S.settings.pushOn) return; clearTimeout(pushTimer); pushTimer = setTimeout(pushSync, 4000); }
// upload today's and tomorrow's remaining reminders (already filtered by quiet hours, the daily cap, rest mode)
async function pushSync() {
  if (!S.settings.pushOn || !net.info || net.status === 'offline') return;
  const R = S.settings.remind, items = [];
  if (R.on) for (const d of [today(), addDays(today(), 1)]) {
    if (isRest(d)) continue;
    const [y, m, dd] = d.split('-').map(Number), base = new Date(y, m - 1, dd).getTime(), fired = d === today() ? S.remFired : { ids: {} };
    reminderEventsFor(d).filter(e => !inQuiet(R, e.at) && !(fired.ids || {})[e.id]).sort((a, b) => a.at - b.at).slice(0, R.max)
      .forEach(e => items.push({ id: e.id, at: base + e.at * 60000, title: e.title, body: e.body, tag: e.id }));
  }
  try { await apiFetch('/api/push/schedule', { method: 'POST', body: JSON.stringify({ items }) }); } catch { }
}
async function pushTest() {
  try { const r = await apiFetch('/api/push/test', { method: 'POST', body: '{}' }); toast(r.ok ? 'Sent. It should arrive in a moment.' : 'Server has no subscription for this device'); } catch { toast('Could not reach the server'); }
}
function pushControls() {
  if (!pushSupported()) return '<p class="sm dim" style="margin-top:12px">Closed-app push is not available in this browser.</p>';
  return `<div class="card sm" style="margin-top:14px"><b>📲 Reminders when the app is closed</b><p class="dim" style="margin:4px 0 8px">Your own server sends them, with nothing sent to third-party services beyond your phone's push gateway. Needs your HTTPS link${window.isSecureContext ? '' : ' (you are on plain http right now)'}. iPhone: add to Home Screen first.</p>
    ${S.settings.pushOn ? '<button class="btn sm ghost" data-act="push-test">Send a test push</button> <button class="btn sm red" data-act="push-off">Turn off</button>' : '<button class="btn sm gold" data-act="push-on">Turn on</button>'}</div>`;
}
Object.assign(A, { 'push-on': enablePush, 'push-off': disablePush, 'push-test': pushTest });
