'use strict';
/* Money extras: real envelopes (rollover + moving money + unassigned income), irregular income mode,
   split transactions, subscription detection, month-over-month comparison, net worth, hide amounts. */

// ── envelopes: base budget + this month's moves + optional rollover of last month's unspent ──
const envAdj = (cat, p = monthPrefix()) => ((S.money.adj || {})[p] || {})[cat] || 0;
function envCarry(cat) {
  if (!(S.money.rollover || {})[cat]) return 0;
  const p = prevMonthPrefix(), bud = (S.money.budgets[cat] || 0) + envAdj(cat, p);
  return bud ? Math.max(0, bud - spentIn(p, cat)) : 0;
}
const envBudget = cat => S.money.budgets[cat] ? Math.max(0, S.money.budgets[cat] + envAdj(cat) + envCarry(cat)) : 0;
function envForm(cat) {
  const [e, n] = MCATS[cat], cur = S.money.budgets[cat] || 0, carry = envCarry(cat);
  openModal(`<h2>${e} ${n} envelope</h2><label>Monthly budget</label><input id="f-amt" inputmode="decimal" value="${cur ? cur / 100 : ''}" placeholder="0.00">
    <label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input id="f-roll" type="checkbox" style="width:auto" ${(S.money.rollover || {})[cat] ? 'checked' : ''}> Roll unspent money into next month${carry ? ` (${fmtMoney(carry)} carried in now)` : ''}</label>
    ${envAdj(cat) ? `<p class="sm dim">This month you've moved ${fmtMoney(Math.abs(envAdj(cat)))} ${envAdj(cat) > 0 ? 'into' : 'out of'} this envelope.</p>` : ''}
    <br><button class="btn block" data-act="env-save" data-cat="${cat}">Save</button>
    ${cur ? `<button class="btn block ghost" style="margin-top:8px" data-act="env-move" data-cat="${cat}">Move money between envelopes</button><button class="btn block red" style="margin-top:8px" data-act="env-del" data-cat="${cat}">Remove envelope</button>` : ''}`);
}
function moveForm(to) {
  const others = Object.keys(S.money.budgets).filter(c => c !== to);
  if (!others.length) return toast('Set a budget on another envelope first');
  openModal(`<h2>Move money into ${MCATS[to][0]} ${MCATS[to][1]}</h2><label>Take it from</label>
    <select id="mv-from">${others.map(c => `<option value="${c}">${MCATS[c][0]} ${MCATS[c][1]} (${fmtMoney(envBudget(c) - spentIn(monthPrefix(), c))} left)</option>`).join('')}</select>
    <label>Amount</label><input id="mv-amt" inputmode="decimal" placeholder="0.00"><br><button class="btn block" data-act="env-move-go" data-cat="${to}">Move it</button>`);
}
function unassignedCard() {
  const inc = incomeIn(monthPrefix()); if (!inc || !Object.keys(S.money.budgets).length) return '';
  const assigned = Object.keys(S.money.budgets).reduce((n, c) => n + S.money.budgets[c] + envAdj(c), 0), free = inc - assigned;
  return `<div class="card sm" style="border-color:${free < 0 ? 'var(--bad)' : 'var(--line)'}"><b>To be budgeted: ${fmtMoney(free)}</b><div class="dim">${fmtMoney(inc)} income this month minus ${fmtMoney(assigned)} assigned to envelopes.${free < 0 ? ' You have assigned more than you have earned so far.' : free > 0 ? ' Give every dollar a job by growing an envelope or saving it.' : ' Every dollar has a job. 🎯'}</div></div>`;
}

// ── irregular income: allowance from the larger of "baseline" and what has actually arrived, minus a tax reserve ──
function irregularAllowance() {
  const I = S.money.irregular, p = monthPrefix(), inc = incomeIn(p), pool = Math.round(Math.max(I.baseline, inc) * (1 - I.tax / 100)), spent = spentIn(p);
  const todaySpent = spentOn([today()]), perDay = Math.max(0, Math.floor((pool - spent + todaySpent) / monthDaysLeft()));
  return { perDay, todaySpent, safe: Math.max(0, perDay - todaySpent), over: pool - spent < 0, pool };
}
function irregularCard() {
  const I = S.money.irregular || { on: false };
  if (!I.on) return `<div class="card sm"><b>🌊 Irregular income?</b><div class="dim" style="margin:4px 0 8px">If your income varies, "safe to spend" can be based on a baseline plus what has actually arrived, with a tax reserve held back.</div><button class="btn sm ghost" data-act="irr-edit">Set up</button></div>`;
  const reserve = Math.round(incomeIn(monthPrefix()) * I.tax / 100);
  return `<div class="card sm"><b>🌊 Irregular-income mode</b><div class="dim" style="margin:4px 0 8px">Pool = larger of ${fmtMoney(I.baseline)} baseline or income so far, minus ${I.tax}% tax reserve${reserve ? `. <b style="color:var(--txt)">Set aside ${fmtMoney(reserve)}</b> for taxes this month.` : '.'}</div><button class="btn sm ghost" data-act="irr-edit">Edit</button></div>`;
}
function irrForm() {
  const I = S.money.irregular || { on: false, baseline: 0, tax: 0 };
  openModal(`<h2>🌊 Irregular income</h2><p class="dim sm">Use your <b>lowest typical month</b> as a baseline so a slow week never shows a scary red number.</p>
    <label>Baseline monthly income</label><input id="i-base" inputmode="decimal" value="${I.baseline ? I.baseline / 100 : ''}" placeholder="0.00">
    <label>Tax reserve (% of income to set aside)</label><input id="i-tax" type="number" inputmode="numeric" min="0" max="60" value="${I.tax || 0}">
    <br><button class="btn block" data-act="irr-save">Turn on</button>${I.on ? '<button class="btn block ghost" style="margin-top:8px" data-act="irr-off">Turn off</button>' : ''}`);
}

// ── split a purchase across categories ──
function splitForm(id) {
  const t = S.money.tx.find(x => x.id === id); if (!t) return;
  draft = { splitId: id };
  openModal(`<h2>✂️ Split ${fmtMoney(t.amt)}</h2><p class="sm dim">${esc(t.note || MCATS[t.cat]?.[1] || '')}. Parts must add up to the total.</p>
    ${[0, 1, 2].map(i => `<div class="row" style="margin-bottom:6px"><input id="sp-a${i}" inputmode="decimal" placeholder="amount" ${i === 0 ? `value="${t.amt / 100}"` : ''} style="flex:1"><select id="sp-c${i}" style="flex:1">${Object.entries(MCATS).map(([k, [em, nm]]) => `<option value="${k}" ${k === (i === 0 ? t.cat : 'home') ? 'selected' : ''}>${em} ${nm}</option>`).join('')}</select></div>`).join('')}
    <button class="btn block" style="margin-top:8px" data-act="split-go">Split</button>`);
}
function splitGo() {
  const t = S.money.tx.find(x => x.id === draft.splitId); if (!t) return;
  const parts = [0, 1, 2].map(i => ({ amt: toCents(val('sp-a' + i)), cat: val('sp-c' + i) })).filter(p => p.amt > 0);
  if (parts.length < 2) return toast('Use at least two parts');
  if (Math.abs(parts.reduce((n, p) => n + p.amt, 0) - t.amt) > 1) return toast(`Parts must add up to ${fmtMoney(t.amt)}`);
  S.money.tx = S.money.tx.filter(x => x.id !== t.id).concat(parts.map(p => ({ id: uid(), date: t.date, amt: p.amt, type: 'out', cat: p.cat, note: (t.note || '').slice(0, 32) + ' (split)' })));
  S.money.tx.sort((a, b) => a.date.localeCompare(b.date)); save(); closeModal(); render(); toast('Split ✂️');
}

// ── subscriptions: repeating monthly charges found in your history, plus price increases ──
const normNote = s => String(s || '').toLowerCase().replace(/[0-9#*]+/g, ' ').replace(/\s+/g, ' ').trim();
function detectSubs() {
  const groups = {};
  for (const t of S.money.tx) if (t.type === 'out' && normNote(t.note).length >= 3) (groups[normNote(t.note)] ||= []).push(t);
  const known = S.money.bills.map(b => normNote(b.name)), out = [];
  for (const [key, list] of Object.entries(groups)) {
    if (list.length < 3 || known.some(k => k && (key.includes(k) || k.includes(key)))) continue;
    list.sort((a, b) => a.date.localeCompare(b.date));
    const gaps = list.slice(1).map((t, i) => dayDiff(list[i].date, t.date)).sort((a, b) => a - b), med = gaps[Math.floor(gaps.length / 2)];
    if (med < 26 || med > 35) continue;
    const amts = list.map(t => t.amt).sort((a, b) => a - b), base = amts[Math.floor(amts.length / 2)], last = list.at(-1), prev = list.at(-2);
    if (Math.abs(last.amt - base) / base > .5) continue;
    out.push({ key, name: last.note, amt: last.amt, day: +last.date.slice(8), cat: last.cat, n: list.length, up: last.amt > prev.amt * 1.03 ? last.amt - prev.amt : 0 });
  }
  return out.sort((a, b) => b.amt - a.amt);
}
function subsCard() {
  const subs = detectSubs(); if (!subs.length) return '';
  const total = subs.reduce((n, s) => n + s.amt, 0);
  return `<h2>🔁 Repeating charges <small>${fmtMoney(total)}/mo</small></h2><div class="card sm dim" style="margin-bottom:8px">Found in your history. Add the ones that are real bills so they get reminders.</div>
    ${subs.map((s, i) => `<div class="task"><div class="em">${MCATS[s.cat]?.[0] || '🔁'}</div><div class="grow"><div class="nm" style="font-size:.95rem">${esc(s.name)} · ${fmtMoney(s.amt)}</div><div class="sm ${s.up ? '' : 'dim'}" style="${s.up ? 'color:var(--gold)' : ''}">${s.up ? `⚠️ Price went up ${fmtMoney(s.up)} · ` : ''}seen ${s.n} times, around the ${s.day}th</div></div><button class="btn sm gold" data-act="sub-add" data-i="${i}">Add bill</button></div>`).join('')}`;
}
function momCard() {
  const cur = monthPrefix(), prev = prevMonthPrefix(), rows = Object.entries(MCATS).map(([k, [e, n]]) => ({ e, n, a: spentIn(cur, k), b: spentIn(prev, k) })).filter(r => r.a || r.b);
  if (!rows.length || !txIn(prev).length) return '';
  const frac = new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  return `<h2>📊 vs last month</h2><div class="card sm">${rows.sort((x, y) => y.a - x.a).slice(0, 6).map(r => {
    const pace = r.b ? (r.a / (r.b * frac) - 1) * 100 : null;
    return `<div class="row" style="padding:3px 0"><span style="width:26px">${r.e}</span><span class="grow">${r.n}</span><span>${fmtMoney(r.a)}</span><span class="dim" style="width:96px;text-align:right">${r.b ? 'of ' + fmtMoney(r.b) : 'new'}${pace != null && Math.abs(pace) >= 15 ? (pace > 0 ? ' 📈' : ' 📉') : ''}</span></div>`; }).join('')}
    <div class="dim" style="font-size:.72rem;margin-top:6px">Arrows compare your pace so far with last month's pace at this point.</div></div>`;
}

// ── net worth: accounts + a trend you update when you like ──
function nwTotal() { return (S.money.accounts || []).reduce((n, a) => n + (a.kind === 'debt' ? -a.bal : a.bal), 0); }
function nwSpark() {
  const h = (S.money.nwHist || []).slice(-24); if (h.length < 2) return '';
  const vals = h.map(x => x.total), mn = Math.min(...vals), mx = Math.max(...vals), span = mx - mn || 1;
  const pts = h.map((x, i) => `${(i / (h.length - 1) * 280).toFixed(1)},${(46 - (x.total - mn) / span * 40).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 280 52" width="100%" height="52" style="display:block;margin:6px 0"><polyline points="${pts}" fill="none" stroke="#c4b5fd" stroke-width="2"/></svg>`;
}
function netWorthCard() {
  const A_ = S.money.accounts || [], h = S.money.nwHist || [], total = nwTotal(), prev = h.length >= 2 ? h.at(-2).total : null;
  return `<h2>🏛️ Net worth</h2><div class="card">${A_.length ? `<div class="row"><b style="font-size:1.5rem" class="grow">${fmtMoney(total)}</b>${prev != null ? `<span class="sm" style="color:${total >= prev ? 'var(--good)' : 'var(--bad)'}">${total >= prev ? '▲' : '▼'} ${fmtMoney(Math.abs(total - prev))}</span>` : ''}</div>${nwSpark()}
    ${A_.map(a => `<div class="row sm" style="padding:2px 0"><span class="grow">${a.kind === 'debt' ? '💳' : '🏦'} ${esc(a.name)}</span><span>${a.kind === 'debt' ? '−' : ''}${fmtMoney(a.bal)}</span></div>`).join('')}`
    : '<div class="dim sm">Track what you own and owe. Update balances now and then to see the trend, with no bank link needed.</div>'}
    <button class="btn block ghost" style="margin-top:8px" data-act="nw-edit">${A_.length ? 'Update balances' : 'Add accounts'}</button></div>`;
}
function nwForm() {
  const A_ = S.money.accounts || [];
  openModal(`<h2>🏛️ Balances</h2>${A_.map((a, i) => `<div class="row" style="margin-bottom:6px"><span class="grow sm">${a.kind === 'debt' ? '💳' : '🏦'} ${esc(a.name)}</span><input id="nw-b${i}" inputmode="decimal" value="${a.bal / 100}" style="width:120px"><button class="del" data-act="nw-del" data-i="${i}">🗑</button></div>`).join('')}
    <label>Add an account</label><div class="row"><input id="nw-n" placeholder="e.g. Savings, Car loan" style="flex:2"><select id="nw-k" style="flex:1"><option value="asset">Asset</option><option value="debt">Debt</option></select></div>
    <br><button class="btn block" data-act="nw-save">Save snapshot</button>`);
}
function nwSave() {
  S.money.accounts = S.money.accounts || [];
  S.money.accounts.forEach((a, i) => { const v = $('#nw-b' + i); if (v) a.bal = Math.max(0, toCents(v.value)); });
  const name = val('nw-n').trim(); if (name) S.money.accounts.push({ id: uid(), name: name.slice(0, 24), kind: val('nw-k'), bal: 0 });
  const h = S.money.nwHist = S.money.nwHist || [], t = today(), tot = nwTotal();
  if (h.length && h.at(-1).date === t) h.at(-1).total = tot; else h.push({ date: t, total: tot });
  save(); closeModal(); render(); if (name) nwForm();
}

// ── hide amounts (for screenshots or shoulder-surfers) ──
function privacyCard() {
  return `<div class="row" style="margin-bottom:8px"><span class="sm dim grow">${S.settings.hideAmt ? 'Amounts are hidden' : 'Amounts are visible'}</span><button class="btn sm ghost" data-act="hide-amt">${S.settings.hideAmt ? '👁 Show' : '🙈 Hide'} amounts</button></div>`;
}

HOOKS['money-top'].push(privacyCard, unassignedCard);
HOOKS.money.push(irregularCard, subsCard, momCard, netWorthCard);
Object.assign(A, {
  'm-budget': el => envForm(el.dataset.cat),
  'env-save': el => {
    const c = el.dataset.cat, amt = toCents(val('f-amt'));
    if (amt) S.money.budgets[c] = amt; else delete S.money.budgets[c];
    (S.money.rollover = S.money.rollover || {})[c] = !!($('#f-roll') || {}).checked; save(); closeModal(); render();
  },
  'env-del': el => { delete S.money.budgets[el.dataset.cat]; save(); closeModal(); render(); },
  'env-move': el => moveForm(el.dataset.cat),
  'env-move-go': el => {
    const to = el.dataset.cat, from = val('mv-from'), amt = toCents(val('mv-amt')), p = monthPrefix();
    if (!amt) return toast('Enter an amount');
    if (amt > envBudget(from) - spentIn(p, from)) return toast('Not that much left in that envelope');
    const adj = (S.money.adj = S.money.adj || {})[p] = (S.money.adj[p] || {}); adj[from] = (adj[from] || 0) - amt; adj[to] = (adj[to] || 0) + amt;
    save(); closeModal(); render(); toast('Moved ' + fmtMoney(amt));
  },
  'irr-edit': irrForm,
  'irr-save': () => { S.money.irregular = { on: true, baseline: toCents(val('i-base')), tax: Math.max(0, Math.min(60, parseInt(val('i-tax')) || 0)) }; save(); closeModal(); render(); },
  'irr-off': () => { S.money.irregular.on = false; save(); closeModal(); render(); },
  'tx-split': el => splitForm(el.dataset.id), 'split-go': splitGo,
  'sub-add': el => {
    const s = detectSubs()[+el.dataset.i]; if (!s) return;
    S.money.bills.push({ id: uid(), name: s.name.slice(0, 30), amt: s.amt, day: s.day, cat: s.cat === 'other' ? 'bills' : s.cat, paid: { [monthPrefix()]: true } });
    save(); render(); toast('Added as a bill');
  },
  'nw-edit': nwForm, 'nw-save': nwSave,
  'nw-del': el => { S.money.accounts.splice(+el.dataset.i, 1); save(); nwForm(); },
  'hide-amt': () => { S.settings.hideAmt = !S.settings.hideAmt; save(); render(); },
});
