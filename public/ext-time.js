'use strict';
/* Time: timeline (quests + imported calendar events), recurring quests, reschedule, "fit my day",
   estimate calibration, time-left, rest mode, and gentle capped reminders with snooze. */

const toMin = hm => { const [h, m] = String(hm).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const fmtHM = min => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const fmtDur = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m}m`;

// one list of everything with a time on a given day: time-blocked quests + imported calendar events
function dayItems(date = today()) {
  const qs = S.quests.filter(q => q.start && (q.due || today()) === date && (!q.done || (q.doneAt && dkey(new Date(q.doneAt)) === date)))
    .map(q => ({ kind: 'q', id: q.id, name: q.name, start: q.start, dur: q.dur || 30, done: !!q.done, ref: q }));
  const ev = (S.events || []).filter(e => e.date === date && !e.allDay).map(e => ({ kind: 'e', id: e.id, name: e.title, start: e.start, dur: e.dur || 60, done: false, ref: e }));
  return [...qs, ...ev].sort((a, b) => toMin(a.start) - toMin(b.start));
}
// people underestimate tasks (planning fallacy), so learn your own multiplier from quests you timed with the ▶ button
function calib() {
  const xs = S.quests.filter(q => q.done && q.dur > 0 && q.actual > 0);
  if (xs.length < 3) return 1;
  return Math.min(3, Math.max(.7, xs.reduce((n, q) => n + q.actual, 0) / xs.reduce((n, q) => n + q.dur, 0)));
}
function timelineCard() {
  const items = dayItems(), allDay = (S.events || []).filter(e => e.date === today() && e.allDay);
  if (!items.length && !allDay.length) return '';
  const now = nowMin(), planned = items.filter(i => !i.done && i.kind === 'q').reduce((n, i) => n + i.dur, 0);
  let html = allDay.map(e => `<div class="sm dim" style="padding:2px 0">📅 All day: ${esc(e.title)}</div>`).join(''), prevEnd = null, nowShown = false;
  const nowRow = () => { nowShown = true; return `<div class="row sm" style="color:var(--gold);padding:2px 0"><span style="width:46px">${fmtHM(now)}</span><span class="grow" style="border-top:2px solid var(--gold)"></span><span>now</span></div>`; };
  for (const it of items) {
    const s = toMin(it.start), e = s + it.dur;
    if (!nowShown && now < s) html += nowRow();
    if (prevEnd != null && s - prevEnd >= 20 && s > now) html += `<div class="sm dim" style="padding:2px 0 2px 46px">🕳️ ${fmtDur(s - Math.max(prevEnd, now))} free</div>`;
    const active = !it.done && now >= s && now < e, missed = !it.done && e <= now && it.kind === 'q', clash = prevEnd != null && s < prevEnd;
    const sub = `${it.start}–${fmtHM(e)} · ${fmtDur(it.dur)}${it.kind === 'e' ? ' · 📅 calendar' : ''}${active ? ' · <b style="color:var(--gold)">in progress</b>' : ''}${missed ? ' · slipped: move it or do it now' : ''}${clash ? ' · <span style="color:var(--bad)">overlaps</span>' : ''}`;
    html += `<div class="task" style="margin-bottom:4px;padding:8px 10px;${active ? 'border-color:var(--gold);background:var(--card2);' : ''}${it.kind === 'e' ? 'border-style:dashed;' : ''}" ${it.kind === 'q' ? `data-act="quest" data-id="${it.id}"` : ''}>
      ${it.kind === 'q' ? `<div class="chk" style="width:26px;height:26px">${it.done ? '✓' : ''}</div>` : '<div class="em" style="font-size:20px;width:26px;text-align:center">📅</div>'}
      <div class="grow"><div class="nm" style="font-size:.92rem;${it.done ? 'text-decoration:line-through' : ''}">${esc(it.name)}</div><div class="sm dim">${sub}</div></div>
      ${it.kind === 'q' && !it.done ? `<button class="del" data-act="resched" data-id="${it.id}" aria-label="Reschedule">⏰</button>` : ''}</div>`;
    prevEnd = Math.max(prevEnd ?? 0, e);
  }
  if (!nowShown) html += nowRow();
  const k = calib(), note = Math.abs(k - 1) > .15 ? `<div class="sm dim" style="margin-top:6px">📏 You usually take <b>${k.toFixed(1)}×</b> your estimate. "Fit my day" pads for that.</div>` : '';
  return `<h2>🕒 Today's timeline <small>${fmtDur(planned)} planned</small></h2><div class="card" style="padding:10px">${html}${note}</div>`;
}
function nextBlockStrip() {
  const now = nowMin(), it = dayItems().find(b => !b.done && toMin(b.start) + b.dur > now); if (!it) return '';
  const s = toMin(it.start), mins = s - now;
  return `<div class="task" data-act="tab" data-v="quests" style="border-color:var(--gold)"><div class="em">${it.kind === 'e' ? '📅' : '⏱️'}</div><div class="grow"><div class="nm">${now >= s ? 'Now: ' : mins <= 90 ? `In ${fmtDur(mins)}: ` : `${it.start}: `}${esc(it.name)}</div>
    <div class="sm dim">${it.start}–${fmtHM(s + it.dur)}</div></div></div>`;
}
// how much of your day is left (between your quiet hours), to make time visible
function timeLeftCard() {
  const R = S.settings.remind, start = toMin(R.quietTo), end = toMin(R.quietFrom), now = nowMin();
  if (end <= start || now < start || now >= end) return '';
  return `<div class="task" style="padding:8px 12px"><div class="em">⌛</div><div class="grow"><div class="sm dim">Time left in your day: <b style="color:var(--txt)">${fmtDur(end - now)}</b></div><div class="bar" style="height:7px"><i style="width:${(now - start) / (end - start) * 100}%"></i></div></div></div>`;
}
function overdueBar() {
  const n = S.quests.filter(q => !q.done && q.due && q.due < today()).length; if (!n) return '';
  return `<div class="card" style="border-color:var(--gold)"><b>🌱 ${n} overdue</b><p class="sm dim" style="margin:4px 0 8px">No shame. Overdue just means the plan changed. Move them all to today and decide what actually matters.</p><button class="btn sm gold" data-act="overdue-today">Fresh start: move to today</button></div>`;
}

// ── reschedule (tap ⏰ instead of dragging) ──
function reschedForm(id) {
  const q = S.quests.find(x => x.id === id); if (!q) return;
  openModal(`<h2>⏰ Move "${esc(q.name)}"</h2><div class="pills" style="margin-bottom:10px">${[['-15', '−15 min'], ['15', '+15 min'], ['60', '+1 hour']].map(([v, l]) => `<button data-act="resched-by" data-id="${id}" data-v="${v}">${l}</button>`).join('')}</div>
    <label>Or pick a time</label><input id="rs-time" type="time" value="${q.start || ''}"><button class="btn block" style="margin-top:8px" data-act="resched-set" data-id="${id}">Set time</button>
    <div class="row" style="margin-top:8px"><button class="btn ghost grow" data-act="resched-tomorrow" data-id="${id}">Tomorrow, same time</button><button class="btn ghost grow" data-act="resched-clear" data-id="${id}">Remove time</button></div>`);
}
function reschedShift(id, d) { const q = S.quests.find(x => x.id === id); if (!q) return; q.start = fmtHM(Math.max(0, Math.min(1439, toMin(q.start) + d))); save(); closeModal(); render(); }

// ── fit my day: place unscheduled quests into free gaps ──
const fitCandidates = () => S.quests.filter(q => !q.done && !q.start && q.due && q.due <= today());
function fitPlan() {
  const R = S.settings.remind, dayStart = toMin(R.quietTo), dayEnd = toMin(R.quietFrom), e = S.checkins[today()]?.energy, low = e != null && e <= 1, k = calib();
  const busy = dayItems().map(i => [toMin(i.start), toMin(i.start) + i.dur]);
  const cands = fitCandidates().sort((a, b) => (b.mit ? 1 : 0) - (a.mit ? 1 : 0) || a.due.localeCompare(b.due) || (low ? a.diff - b.diff : b.diff - a.diff));
  const cursor = Math.max(dayStart, Math.ceil((nowMin() + 5) / 5) * 5), plan = [];
  for (const q of cands) {
    const dur = Math.max(5, Math.round((q.dur || 30) * k / 5) * 5); let t = cursor;
    for (let g = 0; g < 200; g++) { const clash = busy.find(b => t < b[1] + 5 && t + dur > b[0]); if (!clash) break; t = clash[1] + 5; }
    if (t + dur > dayEnd) { plan.push({ q, dur, t: null }); continue; }
    plan.push({ q, dur, t }); busy.push([t, t + dur]);
  }
  return plan;
}
function fitCard() {
  const n = fitCandidates().length; if (!n) return '';
  return `<div class="card" style="border-color:var(--blue)"><b>🧩 ${n} quest${n > 1 ? 's' : ''} due without a time</b><p class="sm dim" style="margin:4px 0 8px">I can slot them into your free gaps${calib() !== 1 ? `, padded for how long things really take you (${calib().toFixed(1)}×)` : ''}. You approve before anything changes.</p><button class="btn sm" data-act="fit-show">Fit my day</button></div>`;
}
function fitShow() {
  const plan = fitPlan(); if (!plan.length) return toast('Nothing to place');
  openModal(`<h2>🧩 Suggested plan</h2>${plan.map(p => `<div class="row" style="padding:6px 0"><b style="width:56px">${p.t == null ? '—' : fmtHM(p.t)}</b><span class="grow">${esc(p.q.name)}<div class="sm dim">${fmtDur(p.dur)}${p.t == null ? ' · no room today' : ''}</div></span></div>`).join('')}
    <button class="btn block" style="margin-top:10px" data-act="fit-apply">Apply the plan</button><button class="btn block ghost" style="margin-top:8px" data-act="close">Cancel</button>`);
}
function fitApply() {
  let n = 0; for (const p of fitPlan()) if (p.t != null) { p.q.start = fmtHM(p.t); p.q.dur = p.dur; p.q.due = today(); n++; }
  save(); closeModal(); render(); toast(`Scheduled ${n} quest${n === 1 ? '' : 's'}`);
}

// ── focus straight from a quest (tiny first step, 5-minute start); records actual time for calibration ──
function startFocusFor(id, min) {
  const q = S.quests.find(x => x.id === id); if (!q) return;
  S.focus.min = min; S.focus.stat = q.stat;
  S.focus.active = { start: Date.now(), endAt: Date.now() + min * 60000, min, task: q.first ? `${q.name}: ${q.first}` : q.name, stat: q.stat, questId: id, buddy: typeof roomOthers === 'function' && roomOthers() > 0 };
  if (typeof onFocusStart === 'function') onFocusStart();
  save(); tab = 'focus'; try { navigator.wakeLock?.request('screen').then(l => wakeLock = l).catch(() => { }); } catch { } render();
}

// ── calendar import/export (.ics) ──
const icsUnfold = t => t.replace(/\r?\n[ \t]/g, '');
const icsText = v => String(v || '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
function icsDate(v) {
  const m = String(v).trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/); if (!m) return null;
  if (m[4] == null) return { date: `${m[1]}-${m[2]}-${m[3]}`, allDay: true };
  if (m[7]) { const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))); return { date: dkey(d), min: d.getHours() * 60 + d.getMinutes(), t: d.getTime() }; }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, min: +m[4] * 60 + +m[5] };      // floating or TZID: treated as local time
}
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
function icsOccurrences(start, rr, exdates, winStart, winEnd) {
  const inWin = d => d >= winStart && d <= winEnd && !exdates.has(d);
  if (!rr) return inWin(start) ? [start] : [];
  const BD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 }, interval = +rr.INTERVAL || 1, count = +rr.COUNT || 0;
  const until = rr.UNTIL ? `${rr.UNTIL.slice(0, 4)}-${rr.UNTIL.slice(4, 6)}-${rr.UNTIL.slice(6, 8)}` : '9999-12-31';
  const wanted = (rr.BYDAY || '').split(',').map(s => BD[s.slice(-2)]).filter(x => x != null);
  const sd = new Date(start + 'T12:00:00'), startMon = addDays(start, -((sd.getDay() + 6) % 7)), out = []; let matched = 0;
  for (let i = 0; i < 1500; i++) {
    const d = addDays(start, i); if (d > winEnd || d > until) break;
    const dt = new Date(d + 'T12:00:00'); let ok = false;
    if (rr.FREQ === 'DAILY') ok = i % interval === 0;
    else if (rr.FREQ === 'WEEKLY') ok = (wanted.length ? wanted.includes(dt.getDay()) : dt.getDay() === sd.getDay()) && Math.floor(dayDiff(startMon, d) / 7) % interval === 0;
    else if (rr.FREQ === 'MONTHLY') ok = dt.getDate() === sd.getDate() && ((dt.getFullYear() - sd.getFullYear()) * 12 + dt.getMonth() - sd.getMonth()) % interval === 0;
    else if (rr.FREQ === 'YEARLY') ok = dt.getDate() === sd.getDate() && dt.getMonth() === sd.getMonth() && (dt.getFullYear() - sd.getFullYear()) % interval === 0;
    if (!ok) continue;
    matched++; if (inWin(d)) out.push(d); if (count && matched >= count) break;
  }
  return out;
}
function parseIcs(text) {
  const winStart = today(), winEnd = addDays(today(), 90), events = [];
  for (const block of icsUnfold(text).split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0], p = {}, ex = new Set();
    for (const line of body.split(/\r?\n/)) {
      const i = line.indexOf(':'); if (i < 0) continue;
      const name = line.slice(0, i).split(';')[0].toUpperCase(), v = line.slice(i + 1);
      if (name === 'EXDATE') v.split(',').forEach(x => { const d = icsDate(x); if (d) ex.add(d.date); }); else p[name] = v;
    }
    if (/CANCELLED/i.test(p.STATUS || '') || !p.DTSTART) continue;
    const s = icsDate(p.DTSTART); if (!s) continue; const e = p.DTEND ? icsDate(p.DTEND) : null;
    let rr = null; if (p.RRULE) { rr = {}; p.RRULE.split(';').forEach(kv => { const [k, v] = kv.split('='); rr[k] = v; }); }
    const title = icsText(p.SUMMARY) || 'Event', uidv = p.UID || title + p.DTSTART;
    let dur = 60;
    if (!s.allDay) dur = e && s.t && e.t ? Math.round((e.t - s.t) / 60000) : e && e.date === s.date && e.min != null ? e.min - s.min : 60;
    dur = Math.min(600, Math.max(5, dur || 60));
    const spanDays = s.allDay && e && e.date > s.date ? Math.min(7, dayDiff(s.date, e.date)) : 1;
    for (const d of icsOccurrences(s.date, rr, ex, winStart, winEnd)) for (let k = 0; k < spanDays; k++)
      events.push({ id: uid(), src: 'ics', uid: uidv, title, date: k ? addDays(d, k) : d, allDay: !!s.allDay, start: s.allDay ? '' : fmtHM(s.min), dur });
  }
  return events;
}
function importIcs(text) {
  const evs = parseIcs(text); if (!evs.length) return toast('No upcoming events found in that file');
  S.events = (S.events || []).filter(e => e.src !== 'ics' || e.date < today()).concat(evs);
  save(); render(); toast(`Imported ${evs.length} calendar event${evs.length === 1 ? '' : 's'}`);
}
function exportIcs() {
  const items = S.quests.filter(q => !q.done && q.start && q.due).map(q => {
    const d = q.due.replace(/-/g, ''), s = toMin(q.start), e = s + (q.dur || 30);
    return `BEGIN:VEVENT\r\nUID:${q.id}@lifequest\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z\r\nDTSTART:${d}T${pad(Math.floor(s / 60))}${pad(s % 60)}00\r\nDTEND:${d}T${pad(Math.floor(e / 60) % 24)}${pad(e % 60)}00\r\nSUMMARY:${q.name.replace(/[,;]/g, ' ')}\r\nEND:VEVENT`;
  });
  if (!items.length) return toast('No time-blocked quests to export');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//LifeQuest//EN\r\n${items.join('\r\n')}\r\nEND:VCALENDAR`], { type: 'text/calendar' }));
  a.download = `lifequest-plan-${today()}.ics`; a.click();
}
function calendarCard() {
  const n = (S.events || []).filter(e => e.src === 'ics' && e.date >= today()).length;
  return `<div class="card sm"><b>📅 Calendar</b><div class="dim" style="margin:4px 0 8px">${n ? `${n} imported events show on your timeline as fixed blocks.` : 'Bring your existing calendar in (export an .ics file from Google/Apple/Outlook) so your day is in one place.'}</div>
    <div class="row"><button class="btn sm ghost grow" data-act="ics-import">Import .ics</button><button class="btn sm ghost grow" data-act="ics-export">Export plan</button>${n ? '<button class="btn sm ghost grow" data-act="ics-clear">Clear</button>' : ''}</div><input type="file" id="icsin" accept=".ics,text/calendar" class="hidden"></div>`;
}
document.addEventListener('change', e => {
  if (e.target.id !== 'icsin' || !e.target.files[0]) return;
  const r = new FileReader(); r.onload = () => importIcs(String(r.result)); r.readAsText(e.target.files[0]); e.target.value = '';
});

// ── recurring quests: finishing one schedules the next ──
function nextDue(q) {
  let d = q.due || today(); const step = q.repeat === 'weekly' ? 7 : 1;
  do { d = addDays(d, step); } while (d <= today() || (q.repeat === 'weekdays' && [0, 6].includes(new Date(d + 'T12:00:00').getDay())));
  return d;
}
function spawnNext(q) {
  const id = uid(); S.quests.push({ id, name: q.name, stat: q.stat, diff: q.diff, done: false, due: nextDue(q), start: q.start || '', dur: q.dur || 0, repeat: q.repeat, plan: q.plan, first: q.first || '', mute: q.mute });
  q.spawned = id; toast('🔁 Next one scheduled');
}

// ── rest mode: pauses streak penalties and stakes (illness, travel, a hard week) ──
const isRest = d => !!(S.rest && S.rest.from && d >= S.rest.from && d <= S.rest.to);
function restBanner() {
  if (!isRest(today())) return '';
  return `<div class="card" style="border-color:var(--blue)"><b>😴 Rest mode until ${S.rest.to}</b><p class="sm dim" style="margin:4px 0 8px">Streaks, stakes and slip warnings are paused. Do what you feel like; it still earns XP.</p><button class="btn sm ghost" data-act="rest-end">End rest mode</button></div>`;
}
function restForm() {
  openModal(`<h2>😴 Rest mode</h2><p class="dim sm">Life happens: illness, travel, a rough patch. Pause streak-breaking and stakes for a while. Nothing is lost, and you can end it early.</p>
    <div class="pills">${[3, 7, 14].map(n => `<button data-act="rest-set" data-v="${n}">${n} days</button>`).join('')}</div>`);
}

// ── reminders: opt-in, capped, quiet hours, snooze, shame-free wording ──
function notify(title, body, tag) {
  toast(`🔔 ${title}`); buzz([60, 40, 60]);
  try { if ('Notification' in window && Notification.permission === 'granted') navigator.serviceWorker?.ready.then(r => r.showNotification(title, { body, tag, icon: '/icon-192.png', data: { title, body }, actions: [{ action: 'snooze', title: 'Snooze 10 min' }] })); } catch { }
}
function snoozeReminder(tag, title, body) { (S.snoozed = S.snoozed || {})[tag] = { at: Date.now() + 10 * 60000, title, body }; save(); }
navigator.serviceWorker?.addEventListener('message', e => {
  const m = e.data || {};
  if (m.snooze) { snoozeReminder(m.snooze.tag, m.snooze.title, m.snooze.body); toast('Snoozed for 10 minutes 😴'); }
  if (m.toast) toast(m.toast);
});
// reminder candidates for any date (used by the local ticker and by server push scheduling)
function reminderEventsFor(d) {
  const R = S.settings.remind, out = [], isToday = d === today(), dow = new Date(d + 'T12:00:00').getDay();
  for (const it of dayItems(d).filter(b => !b.done)) {
    if (it.ref.mute) continue;
    const s = toMin(it.start), pre = it.kind === 'e' ? 'ev' : 'b';
    if (R.lead > 0) out.push({ id: `${pre}:${it.id}:lead:${d}`, at: s - R.lead, d, title: `${it.name} starts in ${R.lead} min`, body: `${it.start} · ${fmtDur(it.dur)}.${it.kind === 'q' ? ' Wrap up what you are doing.' : ''}` });
    out.push({ id: `${pre}:${it.id}:go:${d}`, at: s, d, title: it.kind === 'q' ? `Time for: ${it.name}` : `Now: ${it.name}`, body: it.kind === 'q' ? 'Just begin. Two minutes is enough to start.' : `${it.start}` });
    if (it.kind === 'q') out.push({ id: `b:${it.id}:late:${d}`, at: s + 10, d, title: `Still planning to start "${it.name}"?`, body: 'Even 2 minutes counts, or move it with ⏰. No guilt.' });
  }
  for (const h of S.habits) {
    if (!h.time || h.mute || h.archived) continue;
    const due = isToday ? todaysHabits().includes(h) && !h.log[d] : !h.freq && h.days.includes(dow) && liteOK(h);
    if (due) out.push({ id: `h:${h.id}:${d}`, at: toMin(h.time), d, title: `${h.emoji} ${h.name}`, body: h.cue || 'Ready when you are.' });
  }
  for (const b of S.money.bills) if (!billPaid(b) && billDue(b) === d) out.push({ id: `bill:${b.id}:${d}`, at: 9 * 60, d, title: `🧾 ${b.name} is due today`, body: fmtMoney(b.amt) });
  if (!isToday || S.checkins[d]?.mood == null) out.push({ id: `checkin:${d}`, at: toMin(R.checkin), d, title: '💜 30-second check-in?', body: 'How are you feeling today?' });
  return out;
}
const inQuiet = (R, min) => { const qf = toMin(R.quietFrom), qt = toMin(R.quietTo); return qf > qt ? (min >= qf || min < qt) : (min >= qf && min < qt); };
function reminderTick() {
  const R = S.settings.remind; if (!R.on || !S.profile.name || S.settings.pushOn) return;     // with server push on, the server delivers
  const now = nowMin(); if (inQuiet(R, now) || isRest(today())) return;
  const d = today(); if (S.remFired.date !== d) S.remFired = { date: d, ids: {}, n: 0 };
  for (const [tag, s] of Object.entries(S.snoozed || {})) if (Date.now() >= s.at) { delete S.snoozed[tag]; notify(s.title, s.body, tag); save(); }
  for (const ev of reminderEventsFor(d)) {
    if (S.remFired.ids[ev.id] || S.remFired.n >= R.max) continue;
    if (now >= ev.at && now <= ev.at + 10) { S.remFired.ids[ev.id] = true; S.remFired.n++; notify(ev.title, ev.body, ev.id); save(); }
  }
}
function remindForm() {
  const R = S.settings.remind;
  openModal(`<h2>🔔 Reminders</h2><p class="dim sm">Gentle, capped and never judgmental. Without push they fire while the app is open or recently active.</p>
    <label>Heads-up before a time block (minutes, 0 = off)</label><input id="r-lead" type="number" inputmode="numeric" min="0" max="60" value="${R.lead}">
    <label>Quiet hours (also sets the start and end of "time left today")</label><div class="row"><input id="r-qf" type="time" value="${R.quietFrom}"><span>to</span><input id="r-qt" type="time" value="${R.quietTo}"></div>
    <label>Evening check-in nudge</label><input id="r-ci" type="time" value="${R.checkin}">
    <label>Max reminders per day</label><input id="r-max" type="number" inputmode="numeric" min="1" max="20" value="${R.max}">
    <br><button class="btn block" data-act="remind-save">Save</button><button class="btn block ghost" style="margin-top:8px" data-act="remind-test">Send a test</button>
    ${typeof pushControls === 'function' ? pushControls() : ''}`);
}
setInterval(reminderTick, 20000);
// keep clocks fresh without disturbing typing
setInterval(() => { if ((tab === 'today' || tab === 'quests') && !document.hidden && $('#modal').classList.contains('hidden') && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) render(); }, 60000);

HOOKS.today.push(timeLeftCard);
HOOKS.plan.push(fitCard, calendarCard);
Object.assign(A, {
  'overdue-today': () => { S.quests.forEach(q => { if (!q.done && q.due && q.due < today()) q.due = today(); }); save(); toast('Fresh start 🌱'); render(); },
  'rest-new': restForm, 'rest-set': el => { S.rest = { from: today(), to: addDays(today(), +el.dataset.v - 1) }; save(); closeModal(); render(); toast('Rest well 😴'); },
  'rest-end': () => { S.rest = null; save(); render(); },
  resched: el => reschedForm(el.dataset.id),
  'resched-by': el => reschedShift(el.dataset.id, +el.dataset.v),
  'resched-set': el => { const q = S.quests.find(x => x.id === el.dataset.id), t = val('rs-time'); if (!q || !t) return toast('Pick a time'); q.start = t; save(); closeModal(); render(); },
  'resched-tomorrow': el => { const q = S.quests.find(x => x.id === el.dataset.id); if (!q) return; q.due = addDays(q.due || today(), 1); save(); closeModal(); render(); toast('Moved to tomorrow'); },
  'resched-clear': el => { const q = S.quests.find(x => x.id === el.dataset.id); if (!q) return; q.start = ''; q.dur = 0; save(); closeModal(); render(); },
  'fit-show': fitShow, 'fit-apply': fitApply,
  'q-focus': el => startFocusFor(el.dataset.id, 5),
  'ics-import': () => $('#icsin').click(), 'ics-export': exportIcs,
  'ics-clear': () => { S.events = (S.events || []).filter(e => e.src !== 'ics'); save(); render(); },
  'remind-toggle': async () => {
    const R = S.settings.remind;
    if (!R.on) { try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch { } }
    R.on = !R.on; save(); render(); if (R.on) toast('Reminders on. Gentle and capped.');
  },
  'remind-edit': remindForm,
  'remind-save': () => {
    const R = S.settings.remind;
    Object.assign(R, { lead: Math.max(0, Math.min(60, parseInt(val('r-lead')) || 0)), quietFrom: val('r-qf') || '22:00', quietTo: val('r-qt') || '07:30', checkin: val('r-ci') || '20:00', max: Math.max(1, Math.min(20, parseInt(val('r-max')) || 6)) });
    save(); closeModal(); toast('Saved');
  },
  'remind-test': () => notify('Test reminder', 'This is what a reminder looks like.', 'test'),
  'habit-grad': el => {
    const h = S.habits.find(x => x.id === el.dataset.id); if (!h) return; h.archived = true;
    S.trophies.push({ week: today(), name: 'Graduated: ' + h.name, emoji: '🎓', kind: 'grad' }); award(50, 25, 'spirit'); confetti(120); sfx.level(); save(); closeModal(); render();
  },
});
