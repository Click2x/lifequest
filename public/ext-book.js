'use strict';
/* Character page and storybooks.
   Character: the hero's portrait (newest AI picture, or one you pick), their tale so far, and the look and backstory that shape the story.
   Storybooks: every week's chapter becomes a book (cover, episode title pages, readable story pages, an end page) that can be read
   in-app or printed / saved as a PDF. Everything is built from the episodes already on your device. */

const OUTCOME_WIN = ['critical', 'success'], OUTCOME_TRAIN = ['narrow', 'setback', 'fumble'];
const epEntries = () => Object.entries(S.saga.eps).sort((a, b) => a[0] < b[0] ? -1 : 1);

// load an episode's picture into sagaRT.imgs without re-rendering the page
async function bookImg(date) {
  const e = S.saga.eps[date]; if (!e || e.img !== 'done' || sagaRT.imgs[date]) return sagaRT.imgs[date] || '';
  try { const g = await apiFetch('/api/saga/image?date=' + date); if (g.status === 200) sagaRT.imgs[date] = URL.createObjectURL(await g.blob()); } catch { }
  return sagaRT.imgs[date] || '';
}

// ───────── character page ─────────
function portraitDate() {
  const done = epEntries().filter(([, e]) => e.img === 'done');
  return S.saga.portrait && S.saga.eps[S.saga.portrait]?.img === 'done' ? S.saga.portrait : (done.length ? done[done.length - 1][0] : null);
}
function viewCharacter() {
  const A_ = S.saga, l = level(), eps = epEntries(), pk = portraitDate(), name = esc(S.profile.name || 'Hero');
  const top = STAT_KEYS.slice().sort((a, b) => (S.stats[b] || 0) - (S.stats[a] || 0))[0];
  if (pk && !sagaRT.imgs[pk]) bookImg(pk).then(() => { if (tab === 'character') render(); });
  const portrait = pk && sagaRT.imgs[pk]
    ? `<img class="portrait char-portrait" src="${sagaRT.imgs[pk]}" alt="Portrait of ${name}">`
    : `<div class="portrait-slot char-portrait" style="font-size:96px">${S.profile.avatar}</div>`;
  const wins = eps.filter(([, e]) => OUTCOME_WIN.includes(e.check?.outcome)).length, train = eps.filter(([, e]) => OUTCOME_TRAIN.includes(e.check?.outcome)).length;
  const rests = eps.filter(([, e]) => (e.check?.outcome || 'rest') === 'rest').length, bosses = (S.trophies || []).filter(t => t.kind === 'boss').length;
  const thumbs = eps.filter(([, e]) => e.img === 'done').slice(-6).reverse();
  thumbs.forEach(([d]) => { if (!sagaRT.imgs[d]) bookImg(d).then(() => { if (tab === 'character') render(); }); });
  const stat = (k, v) => `<div class="stat"><div class="sm dim">${k}</div><b>${v}</b></div>`;
  return `<div class="card"><div class="win-title">CHARACTER</div>${portrait}
      <div style="text-align:center;margin-top:12px"><b style="font-size:1.3rem">${name}</b><div class="dim sm">Lv ${l} ${titleOf(l)} · ${SAGA_CLASS[top] || 'Hero'}</div><div class="sm" style="margin-top:4px">${esc(sagaGear(l))}</div></div></div>
    <div class="card"><div class="win-title">TALE SO FAR</div><div class="grid2">
      ${stat('Episodes', eps.length)}${stat('Victories', wins)}${stat('Training days', train)}${stat('Rest days', rests)}${stat('Bosses slain', bosses)}${stat('Best streak', '🔥 ' + (S.bestStreak || 0))}</div>
      <button class="btn ghost block" style="margin-top:10px" data-act="tab" data-v="hero">Status and attributes ▶</button></div>
    ${thumbs.length > 1 ? `<h2>Portraits <small>tap to choose</small></h2><div class="card"><div class="thumbs">${thumbs.map(([d, e]) => `<button class="thumb${d === pk ? ' on' : ''}" data-act="char-portrait" data-d="${d}" aria-label="Use the portrait from ${esc(e.title)}">${sagaRT.imgs[d] ? `<img src="${sagaRT.imgs[d]}" alt="">` : '🖼️'}</button>`).join('')}</div></div>` : ''}
    <h2>Appearance and story</h2><div class="card">
      <label for="ch-look">How does your hero look? <span class="dim">(used for the pictures)</span></label>
      <input id="ch-look" maxlength="200" value="${esc(A_.look || '')}" placeholder="a young adventurer with messy dark hair and a bright red scarf">
      <label for="ch-story">Backstory <span class="dim">(optional: shapes the stories)</span></label>
      <textarea id="ch-story" maxlength="300" placeholder="Raised by a lighthouse keeper, afraid of the dark, secretly loves puns.">${esc(A_.backstory || '')}</textarea>
      <button class="btn block" style="margin-top:10px" data-act="char-save">Save</button>
      <div class="sm dim" style="margin-top:8px">Used only by your own AI. Journal text and money are never used.</div></div>`;
}

// ───────── storybooks ─────────
function bookGroups() {
  const g = {};
  for (const [d, e] of epEntries()) { const k = weekKey(new Date(d + 'T12:00:00')); (g[k] = g[k] || []).push([d, e]); }
  return Object.keys(g).sort().map((k, i) => ({ key: k, no: i + 1, eps: g[k] })).reverse();
}
const bookRange = b => { const f = d => new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); return f(b.eps[0][0]) + ' to ' + f(b.eps[b.eps.length - 1][0]); };
const bookBoss = b => (b.eps.find(([, e]) => e.check?.boss)?.[1].check.boss) || { n: 'The Saga', e: '📖' };
const bookWins = b => b.eps.filter(([, e]) => OUTCOME_WIN.includes(e.check?.outcome)).length;

function viewBooks() {
  const books = bookGroups(), thisWeek = weekKey(new Date());
  return `<h2>📚 Storybooks <small>${books.length}</small></h2>
    <div class="sm dim" style="margin:0 4px 10px">One book per week. Read them here, or print one as a keepsake.</div>
    ${books.map(b => {
      const boss = bookBoss(b), cover = b.eps.find(([d, e]) => e.img === 'done' && sagaRT.imgs[d]);
      if (!cover) { const c = b.eps.find(([, e]) => e.img === 'done'); if (c) bookImg(c[0]).then(() => { if (tab === 'books') render(); }); }
      return `<div class="task bookrow" data-act="book-open" data-k="${b.key}"><div class="bkthumb">${cover ? `<img src="${sagaRT.imgs[cover[0]]}" alt="">` : `<span>${boss.e}</span>`}</div>
        <div class="grow"><div class="nm">Chapter ${b.no}: ${esc(boss.n)}</div><div class="sm dim">${bookRange(b)} · ${b.eps.length} episode${b.eps.length === 1 ? '' : 's'} · ${bookWins(b)} win${bookWins(b) === 1 ? '' : 's'}</div>${b.key === thisWeek ? '<div class="sm" style="color:var(--acc)">In progress</div>' : ''}</div><span class="dim">▶</span></div>`;
    }).join('') || '<div class="empty">Your first storybook opens after your first episode.<br>Each week becomes one book.</div>'}`;
}

async function buildBook(key) {
  const b = bookGroups().find(x => x.key === key); if (!b) return null;
  await Promise.all(b.eps.map(([d]) => bookImg(d)));
  const boss = bookBoss(b), name = esc(S.profile.name || 'Hero'), pages = [], img = d => sagaRT.imgs[d] ? `<img class="portrait" src="${sagaRT.imgs[d]}" alt="">` : '';
  const first = b.eps.find(([d]) => sagaRT.imgs[d]);
  pages.push(`<div class="bk-cover"><div class="bk-kicker">CHAPTER ${b.no}</div>${first ? img(first[0]) : `<div class="bk-emoji">${boss.e}</div>`}<h1>${esc(boss.n)}</h1><div class="bk-sub">The Saga of ${name}</div><div class="bk-sub">${bookRange(b)} · ${b.eps.length} episode${b.eps.length === 1 ? '' : 's'}</div></div>`);
  for (const [d, e] of b.eps) {
    pages.push(`<div class="bk-ep">${img(d)}<div class="bk-kicker">EPISODE ${e.n} · ${d}</div><h2>${esc(e.title)}</h2><div class="bk-dice">${esc(diceLine(e.check))}</div></div>`);
    const chunks = btPages(e.story); chunks.forEach((c, i) => pages.push(`<div class="bk-text"><div class="bk-kicker">${esc(e.title)}</div><p>${esc(c)}</p>${i === chunks.length - 1 && e.teaser ? `<p class="bk-tease">${esc(e.teaser)}</p>` : ''}</div>`));
  }
  const glyphs = b.eps.map(([, e]) => (SAGA_OUTCOME[e.check?.outcome] || SAGA_OUTCOME.rest)[0]).join(' ');
  pages.push(`<div class="bk-end"><h2>The End of Chapter ${b.no}</h2><div class="bk-glyphs">${glyphs}</div><p>${bookWins(b)} victor${bookWins(b) === 1 ? 'y' : 'ies'} in ${b.eps.length} episode${b.eps.length === 1 ? '' : 's'}.</p><p class="bk-tease">Every page was earned by something ${name} really did.</p></div>`);
  return { b, boss, pages };
}

let BK = null;
async function openBook(key) {
  if (BK) return; toast('Opening the book…');
  const built = await buildBook(key); if (!built) return;
  BK = { ...built, i: 0, last: document.activeElement };
  const host = document.getElementById('book'); host.classList.remove('hidden'); document.body.classList.add('bt-open');
  host.innerHTML = `<div class="bk-top"><button data-bk="close" aria-label="Close the book">✕</button><span class="bk-title">Chapter ${BK.b.no} · ${esc(BK.boss.n)}</span><button data-bk="print">Print</button></div>
    <div class="bk-page" id="bk-page" tabindex="0" role="group" aria-roledescription="page"></div>
    <div class="bk-nav"><button data-bk="prev">◀ Prev</button><span id="bk-count" aria-live="polite"></span><button data-bk="next">Next ▶</button></div>`;
  host.onclick = e => { const k = e.target.closest('[data-bk]')?.dataset.bk; if (!k) return; if (k === 'close') closeBook(); else if (k === 'print') printBook(); else bookGo(k === 'next' ? 1 : -1); };
  host.onkeydown = e => { if (e.key === 'Escape') closeBook(); else if (e.key === 'ArrowRight') bookGo(1); else if (e.key === 'ArrowLeft') bookGo(-1); };
  let x0 = null; host.ontouchstart = e => { x0 = e.touches[0].clientX; }; host.ontouchend = e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) bookGo(dx < 0 ? 1 : -1); };
  bookShow();
}
function bookShow() {
  const pg = document.getElementById('bk-page'); if (!pg || !BK) return;
  pg.innerHTML = BK.pages[BK.i]; pg.scrollTop = 0;
  document.getElementById('bk-count').textContent = (BK.i + 1) + ' / ' + BK.pages.length;
  host_btn('prev').disabled = BK.i === 0; host_btn('next').disabled = BK.i === BK.pages.length - 1;
}
const host_btn = k => document.querySelector('#book [data-bk="' + k + '"]');
function bookGo(d) { if (!BK) return; const n = BK.i + d; if (n < 0 || n >= BK.pages.length) return; BK.i = n; bookShow(); }
function closeBook() {
  if (!BK) return; const host = document.getElementById('book'); host.classList.add('hidden'); host.innerHTML = '';
  document.body.classList.remove('bt-open'); try { BK.last && BK.last.focus && BK.last.focus({ preventScroll: true }); } catch { } BK = null;
}
// a plain, paper-friendly version of the whole book; the browser's print dialog can also "Save as PDF"
function printBook() {
  if (!BK) return; const { b, boss } = BK, name = esc(S.profile.name || 'Hero');
  let el = document.getElementById('book-print'); if (!el) { el = document.createElement('div'); el.id = 'book-print'; document.body.append(el); }
  el.innerHTML = `<section class="pp"><h1>${esc(boss.n)}</h1><p>Chapter ${b.no} · The Saga of ${name}<br>${bookRange(b)}</p></section>` +
    b.eps.map(([d, e]) => `<section class="pp"><h2>${esc(e.title)}</h2><p><em>Episode ${e.n} · ${d} · ${esc(diceLine(e.check))}</em></p>${sagaRT.imgs[d] ? `<img src="${sagaRT.imgs[d]}" alt="">` : ''}${String(e.story).split('\n').filter(x => x.trim()).map(p => `<p>${esc(p)}</p>`).join('')}${e.teaser ? `<p><em>${esc(e.teaser)}</em></p>` : ''}</section>`).join('');
  document.body.classList.add('printing-book'); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('printing-book'), 500); }, 100);
}

Object.assign(A, {
  'book-open': el => openBook(el.dataset.k),
  'char-portrait': el => { S.saga.portrait = el.dataset.d; save(); render(); toast('Portrait updated'); },
  'char-save': () => { S.saga.look = val('ch-look').trim().slice(0, 200); S.saga.backstory = val('ch-story').replace(/\s+/g, ' ').trim().slice(0, 300); save(); toast('Saved. Your next story and picture use this.'); },
});
