'use strict';
/* Life extras: weekly review ritual, focus rooms (body doubling), app lock PIN, server snapshot restore. */

// ── weekly review: one calm screen tying habits, money, tasks and mood together ──
const last7 = () => Array.from({ length: 7 }, (_, i) => addDays(today(), -i));
const reviewKey = () => new Date().getDay() >= 5 || new Date().getDay() === 0 ? weekKey() : weekDays(-1)[0];   // Fri–Sun review this week; Mon–Thu review last week
function reviewDue() { const d = new Date().getDay(); return (d === 0 || d === 1) && !(S.reviews || {})[reviewKey()] && Object.keys(S.history).length >= 3; }
function reviewCard() {
  if (!reviewDue()) return '';
  return `<div class="task" data-act="review-open" style="border-color:var(--acc)"><div class="em">📝</div><div class="grow"><div class="nm">Weekly review</div><div class="sm dim">5 calm minutes: look back, plan one change (+30 XP)</div></div><span class="chip">Start</span></div>`;
}
function reviewStats() {
  const d7 = last7(), prev7 = d7.map(d => addDays(d, -7));
  const xp = d7.reduce((n, d) => n + (S.history[d] || 0), 0), checks = S.habits.reduce((n, h) => n + d7.filter(d => h.log[d]).length, 0);
  const focus = S.focus.sessions.filter(s => d7.includes(s.date)).reduce((n, s) => n + s.min, 0);
  const qd = S.quests.filter(q => q.done && q.doneAt && d7.includes(dkey(new Date(q.doneAt)))).length;
  const moods = d7.map(d => S.checkins[d]?.mood).filter(x => x != null), mood = moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length + 1).toFixed(1) : '–';
  return { xp, checks, focus, qd, mood, spent: spentOn(d7), pspent: spentOn(prev7), perfect: d7.filter(d => S.perfect[d]).length };
}
function reviewForm() {
  const s = reviewStats(), open = S.quests.filter(q => !q.done);
  openModal(`<h2>📝 Weekly review</h2><div class="grid2" style="margin-bottom:10px"><div class="stat">XP<br><b>${s.xp}</b></div><div class="stat">Habit check-ins<br><b>${s.checks}</b></div><div class="stat">Focus<br><b>${fmtMin(s.focus)}</b></div><div class="stat">Quests done<br><b>${s.qd}</b></div><div class="stat">Avg mood<br><b>${s.mood}</b></div><div class="stat">Spent<br><b>${fmtMoney(s.spent)}</b><div class="sm dim">last week ${fmtMoney(s.pspent)}</div></div></div>
    ${s.perfect ? `<p class="sm">🌟 ${s.perfect} perfect day${s.perfect > 1 ? 's' : ''} this week.</p>` : ''}
    <label>A win from this week, however small</label><input id="rv-win" maxlength="140">
    <label>What got in the way?</label><input id="rv-fric" maxlength="140">
    <label>One thing I'll change next week</label><input id="rv-chg" maxlength="140" placeholder="e.g. Walk right after lunch">
    ${open.length ? `<label>Star one quest as next week's most important thing</label><select id="rv-mit"><option value="">None</option>${open.map(q => `<option value="${q.id}">${esc(q.name)}</option>`).join('')}</select>` : ''}
    <br><button class="btn block" data-act="review-save">Finish review (+30 XP)</button>`);
}
function reviewSave() {
  const k = reviewKey(), win = val('rv-win').trim(), fric = val('rv-fric').trim(), chg = val('rv-chg').trim(), mit = val('rv-mit');
  (S.reviews = S.reviews || {})[k] = Date.now();
  S.journal.push({ id: uid(), date: today(), prompt: 'Weekly review', text: `Win: ${win || '–'}\nIn the way: ${fric || '–'}\nChange: ${chg || '–'}` });
  if (mit) { S.quests.forEach(q => q.mit = false); const q = S.quests.find(x => x.id === mit); if (q) q.mit = true; }
  if (chg) S.quests.push({ id: uid(), name: 'Try: ' + chg, stat: 'spirit', diff: 1, done: false, due: addDays(dkey(weekStart()), 7), plan: '' });   // next Monday
  award(30, 10, 'spirit'); sfx.chest(); save(); checkAch(); closeModal(); render(); toast('Review saved 📝', 'gold');
}

// ── focus rooms: body doubling with your squad ──
const room = { list: [], at: 0 };
const roomOthers = () => room.list.filter(r => r.pid !== net.pub && r.until > Date.now()).length;
async function fetchRoom() {
  if (!S.settings.board) return;
  try { const r = await apiFetch('/api/room'); if (r.ok) { room.list = (await r.json()).room; room.at = Date.now(); } } catch { }
}
async function roomPost(body) { try { await apiFetch('/api/room', { method: 'POST', body: JSON.stringify(body) }); } catch { } }
function onFocusStart() { const a = S.focus.active; if (S.settings.board && a) roomPost({ action: 'start', until: a.endAt, task: a.task }); }
function onFocusEnd() { if (S.settings.board) roomPost({ action: 'stop' }); }
function roomCard() {
  const live = room.list.filter(r => r.until > Date.now()), mine = S.focus.active;
  if (!live.length && !mine) return `<div class="card sm dim">🧑‍💻 <b style="color:var(--txt)">Focus room</b> is empty. Start a focus session and your squad can join you (working alongside someone helps a lot of people get started, and you earn +10% XP).</div>`;
  return `<div class="card"><b>🧑‍💻 Focus room</b><div class="sm dim" style="margin-bottom:6px">${live.length} focusing now. Join for a body-double bonus: +10% XP.</div>
    ${live.map(r => { const m = Math.max(1, Math.ceil((r.until - Date.now()) / 60000)); return `<div class="row" style="padding:3px 0"><span style="width:28px">${esc(r.avatar)}</span><span class="grow">${esc(r.name)}${r.pid === net.pub ? ' <span class="dim sm">(you)</span>' : ''}<div class="sm dim">${esc(r.task || 'focusing')} · ${m} min left</div></span>
      ${r.pid !== net.pub && !mine && m >= 3 ? `<button class="btn sm gold" data-act="room-join" data-m="${m}">Join</button>` : ''}</div>`; }).join('')}</div>`;
}

// ── app lock: a PIN gate for this device (a convenience lock, not encryption) ──
const hasPin = () => { try { return !!localStorage.getItem('lifequest.pin'); } catch { return false; } };
async function hashPin(pin, salt) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function showLock() {
  if (!hasPin() || document.getElementById('lock')) return;
  const d = document.createElement('div'); d.id = 'lock';
  d.style.cssText = 'position:fixed;inset:0;z-index:100;background:var(--bg);display:grid;place-items:center;padding:24px;text-align:center';
  d.innerHTML = `<div style="max-width:320px;width:100%"><div style="font-size:56px">🔒</div><h2 style="justify-content:center">LifeQuest is locked</h2><input id="lock-pin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN" style="text-align:center;font-size:1.6rem;letter-spacing:.3em;margin:10px 0"><button class="btn block" id="lock-go">Unlock</button><p class="sm dim" id="lock-msg"></p></div>`;
  document.body.appendChild(d);
  const go = async () => {
    const [salt, hash] = (localStorage.getItem('lifequest.pin') || ':').split(':');
    if (await hashPin($('#lock-pin').value, salt) === hash) d.remove(); else { $('#lock-msg').textContent = 'Wrong PIN'; $('#lock-pin').value = ''; buzz(80); }
  };
  $('#lock-go').onclick = go; $('#lock-pin').addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); setTimeout(() => $('#lock-pin')?.focus(), 50);
}
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 120000) showLock();
});
function pinForm() {
  openModal(`<h2>🔒 App lock</h2><p class="dim sm">Asks for a PIN when you open the app or return after 2 minutes away. It keeps casual snoopers out on this device. It is a convenience lock, not encryption. If you forget the PIN, clearing this site's data removes it (your server copy stays safe).</p>
    <label>New PIN (4–8 digits)</label><input id="pin-a" type="password" inputmode="numeric" maxlength="8"><label>Repeat PIN</label><input id="pin-b" type="password" inputmode="numeric" maxlength="8">
    <br><button class="btn block" data-act="pin-save">Set PIN</button>${hasPin() ? '<button class="btn block ghost" style="margin-top:8px" data-act="pin-off">Turn off app lock</button>' : ''}`);
}
function securityCard() {
  return `<h2>🔒 Privacy</h2><div class="card"><div class="row"><span class="grow">App lock <span class="sm dim">(PIN on this device)</span></span><button class="btn sm ${hasPin() ? '' : 'ghost'}" data-act="pin-edit">${hasPin() ? 'On' : 'Off'}</button></div><br>
    <div class="row"><span class="grow">Hide money amounts</span><button class="btn sm ${S.settings.hideAmt ? '' : 'ghost'}" data-act="hide-amt">${S.settings.hideAmt ? 'On' : 'Off'}</button></div><br>
    <button class="btn sm ghost block" data-act="review-open">📝 Do a weekly review now</button><br>
    <button class="btn sm ghost block" data-act="snap-list">🗂️ Restore from a server snapshot</button></div>`;
}

// ── server snapshots: a daily restore point so a bad sync can never cost you a streak ──
async function snapList() {
  try {
    const r = await apiFetch('/api/snapshots'); if (!r.ok) throw 0; const { snapshots } = await r.json();
    openModal(`<h2>🗂️ Restore points</h2><p class="dim sm">The server keeps a snapshot from the start of each day it was used (last 14). Restoring replaces your current data on this device.</p>
      ${snapshots.length ? snapshots.map(s => `<div class="row" style="padding:6px 0"><span class="grow">${s.date}<div class="sm dim">${Math.round(s.size / 1024)} KB</div></span><button class="btn sm" data-act="snap-restore" data-d="${s.date}">Restore</button></div>`).join('') : '<div class="empty">No snapshots yet. They appear after the first full day of use.</div>'}
      <button class="btn block ghost" style="margin-top:8px" data-act="close">Cancel</button>`);
  } catch { toast('Could not reach the server'); }
}
async function snapRestore(date) {
  try {
    const r = await apiFetch('/api/snapshots?date=' + date); if (!r.ok) throw 0; const { state } = await r.json();
    if (!state || !confirm(`Replace your current data with the snapshot from ${date}?`)) return;
    S = migrate(state); S.updatedAt = Date.now(); save(); closeModal(); render(); toast('Restored from ' + date);
  } catch { toast('Could not load that snapshot'); }
}

HOOKS.today.push(reviewCard);
HOOKS.config.push(securityCard);
HOOKS.board.push(roomCard);
Object.assign(A, {
  'review-open': reviewForm, 'review-save': reviewSave,
  'room-join': el => { const m = Math.min(60, Math.max(5, +el.dataset.m)); S.focus.min = m; S.focus.active = { start: Date.now(), endAt: Date.now() + m * 60000, min: m, task: 'Together with the squad', stat: S.focus.stat, buddy: true }; onFocusStart(); save(); tab = 'focus'; render(); },
  'pin-edit': pinForm,
  'pin-save': async () => {
    const a = val('pin-a'), b = val('pin-b'); if (!/^\d{4,8}$/.test(a)) return toast('Use 4 to 8 digits'); if (a !== b) return toast('PINs do not match');
    const salt = uid() + uid(); localStorage.setItem('lifequest.pin', salt + ':' + await hashPin(a, salt)); closeModal(); render(); toast('App lock on 🔒');
  },
  'pin-off': () => { localStorage.removeItem('lifequest.pin'); closeModal(); render(); toast('App lock off'); },
  'snap-list': snapList, 'snap-restore': el => snapRestore(el.dataset.d),
});

// ── link another device: same profile on your phone and laptop (the link is a password; it opens your whole profile) ──
let linkSel = 0;
function linkOrigins() {
  const h = (net.info && net.info.hosts) || [];
  return /^(localhost$|127\.|\[::1\])/.test(location.hostname) && h.length ? h : [{ label: 'This address', origin: location.origin }];
}
const linkUrl = () => linkOrigins()[linkSel % linkOrigins().length].origin + '/#' + (net.token ? 'token=' + net.token + '&' : '') + 'pid=' + net.pid;
function linkCard() {
  return '<h2>📱 Your devices</h2><div class="card sm"><div class="dim" style="margin-bottom:8px">Each device you sign in on starts as its own profile. To use the <b>same</b> profile on another phone or computer, link it.</div><button class="btn sm ghost block" data-act="link-device">Link another device</button></div>';
}
function drawLinkQr() {
  const u = linkUrl(), box = $('#lk-qr'); if (!box) return; box.innerHTML = ''; $('#lk-url').value = u;
  const draw = () => { try { new QRCode(box, { text: u, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M }); } catch { box.textContent = 'Copy the link below'; } };
  if (window.QRCode) draw(); else { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = draw; s.onerror = () => { box.textContent = 'Copy the link below'; }; document.head.appendChild(s); }
}
function linkForm() {
  const os_ = linkOrigins();
  openModal('<h2>📱 Link another device</h2><p class="sm dim">Scan this on the other device, or open the link there. It signs that device in <b>as you</b>, so treat it like a password and never share it with friends. (To invite a friend, give them the server QR instead; they get their own profile.)</p>' +
    (os_.length > 1 ? '<div class="pills" style="margin-bottom:8px">' + os_.map((o, i) => '<button class="' + (i === linkSel % os_.length ? 'on' : '') + '" data-act="link-origin" data-i="' + i + '">' + esc(o.label) + '</button>').join('') + '</div>' : '') +
    '<div id="lk-qr" style="background:#fff;padding:10px;border-radius:10px;width:200px;margin:10px auto;min-height:200px"></div><input id="lk-url" readonly onclick="this.select()" style="font-size:.8rem"><br><br><button class="btn block ghost" data-act="close">Done</button>');
  drawLinkQr();
}
HOOKS.config.push(linkCard);
Object.assign(A, { 'link-device': linkForm, 'link-origin': el => { linkSel = +el.dataset.i; linkForm(); } });
