// LifeQuest server — zero dependencies. Serves the PWA, stores your save file, optionally proxies an LLM coach.
//
// Env vars:
//   PORT              (default 4747)
//   LIFEQUEST_TOKEN   access token for /api/*. Auto-generated into data/token.txt if unset; "off" disables
//   DATA_DIR          (default ./data)
//   SQUAD_NAME        name shown on the leaderboard (default "The Squad")
//   CERT / KEY        paths to TLS cert + key -> serve HTTPS directly
//   LLM_URL           OpenAI-compatible chat endpoint, e.g. http://localhost:11434/v1/chat/completions (Ollama)
//   LLM_MODEL         model name, e.g. llama3.1
//   LLM_KEY           API key if the endpoint needs one
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const push = require('./push');
const crypto = require('crypto');
const sagaLib = require('./saga');

const PORT = +process.env.PORT || 4747;
let TOKEN = process.env.LIFEQUEST_TOKEN || '';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const PLAYERS_DIR = path.join(DATA_DIR, 'players');
const BOARD_FILE = path.join(DATA_DIR, 'board.json');
const SQUAD = process.env.SQUAD_NAME || 'The Squad';
const PUBLIC = path.join(__dirname, 'public');
const LLM_URL = process.env.LLM_URL || '';
const LLM_MODEL = process.env.LLM_MODEL || 'llama3.1';
const LLM_KEY = process.env.LLM_KEY || '';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

fs.mkdirSync(PLAYERS_DIR, { recursive: true });

// Secure by default (finances live here): an access token is generated on first run and kept in data/token.txt.
// LIFEQUEST_TOKEN=off disables it; LIFEQUEST_TOKEN=<secret> sets your own.
if (TOKEN === 'off') TOKEN = '';
else if (!TOKEN) {
  const f = path.join(DATA_DIR, 'token.txt');
  try { TOKEN = fs.readFileSync(f, 'utf8').trim(); } catch { }
  if (!TOKEN) { TOKEN = require('crypto').randomBytes(9).toString('base64url'); fs.writeFileSync(f, TOKEN); }
}

// A player's private id (X-Player) is the key to their save file, so it must never be shown to anyone else.
// Everything other players can see (board, challenges, cheers, focus rooms) uses this one-way public id instead.
const SECRET_FILE = path.join(DATA_DIR, 'secret.txt');
let SECRET = ''; try { SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim(); } catch { }
if (!SECRET) { SECRET = crypto.randomBytes(24).toString('hex'); fs.writeFileSync(SECRET_FILE, SECRET, { mode: 0o600 }); }
const pubOf = pid => crypto.createHmac('sha256', SECRET).update(pid).digest('hex').slice(0, 16);
const MAX_PLAYERS = +process.env.MAX_PLAYERS || 25;       // profiles this server will accept (disk protection)
const VAPID = push.loadVapid(DATA_DIR);
// The Saga (daily story + illustration). Settings come from environment variables, then data/config.json, then defaults.
let fileCfg = {}; try { fileCfg = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'config.json'), 'utf8')); } catch { }
const pick = (env, key, dflt) => process.env[env] || fileCfg[key] || dflt;
const saga = sagaLib.create({
  storyUrl: pick('STORY_URL', 'storyUrl', 'http://127.0.0.1:11434'), storyModel: pick('STORY_MODEL', 'storyModel', 'nova-samantha-v1'),
  sdUrl: pick('SD_URL', 'sdUrl', 'http://127.0.0.1:7860'), sdDir: pick('SD_DIR', 'sdDir', ''), sdModel: pick('SD_MODEL', 'sdModel', ''),
  sdIdleMinutes: +pick('SD_IDLE_MINUTES', 'sdIdleMinutes', 10), sdSteps: +pick('SD_STEPS', 'sdSteps', 28), dailyLimit: +pick('SAGA_DAILY_EPISODES', 'dailyEpisodes', 4), dailyImages: +pick('SAGA_DAILY_IMAGES', 'dailyImages', 6),
}, DATA_DIR);
const PUSH_FILE = path.join(DATA_DIR, 'push.json');
const pushDB = () => { try { const d = JSON.parse(fs.readFileSync(PUSH_FILE, 'utf8')); return { subs: d.subs || {}, queue: d.queue || {}, sent: d.sent || {} }; } catch { return { subs: {}, queue: {}, sent: {} }; } };
const pushSave = d => { const tmp = PUSH_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(d)); fs.renameSync(tmp, PUSH_FILE); };
// subscriptions come from clients and the server fetches their endpoint, so only well-known push gateways are allowed (blocks SSRF)
const PUSH_HOSTS = ['.googleapis.com', '.mozilla.com', '.push.apple.com', '.notify.windows.com', '.microsoft.com'];
const okEndpoint = u => { try { const x = new URL(u); return process.env.PUSH_ALLOW_ANY === '1' ? x.protocol === 'https:' : x.protocol === 'https:' && PUSH_HOSTS.some(h => x.hostname.endsWith(h)); } catch { return false; } };
const rooms = new Map();      // focus rooms live in memory only: pid -> { name, avatar, until }

function pruneSnaps(pid) {
  const all = fs.readdirSync(PLAYERS_DIR).filter(f => f.startsWith(pid + '.snap-')).sort().reverse();
  for (const f of all.slice(14)) fs.unlinkSync(path.join(PLAYERS_DIR, f));
}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function readBoard() {
  try { const b = JSON.parse(fs.readFileSync(BOARD_FILE, 'utf8')); return { players: b.players || {}, cheers: b.cheers || {}, challenges: b.challenges || {} }; }
  catch { return { players: {}, cheers: {}, challenges: {} }; }
}
function writeBoard(b) {
  const tmp = BOARD_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(b)); fs.renameSync(tmp, BOARD_FILE);
}

function authed(req) {
  if (!TOKEN) return true;
  const h = req.headers['authorization'] || '';
  return h === 'Bearer ' + TOKEN;
}

async function api(req, res, url) {
  if (url.pathname === '/api/info') {
    const hp = String(req.headers['x-player'] || '');
    return send(res, 200, { hosts: authed(req) ? hostList() : [], you: authed(req) && /^[a-z0-9]{8,40}$/.test(hp) ? pubOf(hp) : '', name: 'LifeQuest', squad: SQUAD, ai: !!LLM_URL, tokenRequired: !!TOKEN, authed: authed(req) });
  }
  if (!authed(req)) return send(res, 401, { error: 'unauthorized' });

  const pid = String(req.headers['x-player'] || '');
  const validPid = /^[a-z0-9]{8,40}$/.test(pid), pub = validPid ? pubOf(pid) : '';

  // each player has their own save file, so friends never overwrite each other
  if (url.pathname === '/api/state') {
    if (!validPid) return send(res, 400, { error: 'missing player id' });
    const file = path.join(PLAYERS_DIR, pid + '.json');
    if (req.method === 'GET') {
      if (!fs.existsSync(file)) return send(res, 200, { state: null });
      return send(res, 200, { state: JSON.parse(fs.readFileSync(file, 'utf8')) });
    }
    if (req.method === 'PUT') {
      if (!fs.existsSync(file) && fs.readdirSync(PLAYERS_DIR).filter(f => /^[a-z0-9]+\.json$/.test(f)).length >= MAX_PLAYERS) return send(res, 403, { error: 'this server is full' });
      const incoming = JSON.parse(await readBody(req));
      if (!incoming || typeof incoming !== 'object' || incoming.v !== 1) return send(res, 400, { error: 'bad state' });
      if (fs.existsSync(file)) fs.copyFileSync(file, file.replace(/\.json$/, '.backup.json'));
      const day = new Date().toISOString().slice(0, 10), snap = path.join(PLAYERS_DIR, pid + '.snap-' + day + '.json');
      if (fs.existsSync(file) && !fs.existsSync(snap)) { fs.copyFileSync(file, snap); pruneSnaps(pid); }
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(incoming));
      fs.renameSync(tmp, file);
      return send(res, 200, { ok: true });
    }
  }

  // squad leaderboard: players opt in by publishing a small public "card" (no habits, journal or chat)
  if (url.pathname === '/api/board') {
    if (!validPid) return send(res, 400, { error: 'missing player id' });
    const board = readBoard();
    if (req.method === 'GET') {
      const cheers = board.cheers[pub] || [];
      if (cheers.length) { delete board.cheers[pub]; writeBoard(board); }
      return send(res, 200, { you: pub, squad: SQUAD, players: Object.values(board.players), cheers });
    }
    if (req.method === 'PUT') {
      const c = JSON.parse(await readBody(req, 10 * 1024));
      if (!board.players[pub] && Object.keys(board.players).length >= 50) return send(res, 400, { error: 'squad full' });
      const num = (x, max = 1e7) => Math.max(0, Math.min(max, Math.round(+x) || 0));
      const str = (s, n) => String(s ?? '').slice(0, n);
      board.players[pub] = {
        pid: pub, name: str(c.name, 20) || 'Hero', avatar: str(c.avatar, 8), level: num(c.level, 999), xp: num(c.xp),
        week: str(c.week, 10), weekXp: num(c.weekXp), lastWeekXp: num(c.lastWeekXp), streak: num(c.streak, 9999),
        focusWeek: num(c.focusWeek, 99999), trophies: num(c.trophies, 9999),
        month: str(c.month, 7), monthXp: num(c.monthXp), lastMonthXp: num(c.lastMonthXp), div: num(c.div, 9), updated: Date.now(),
      };
      writeBoard(board);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'DELETE') { delete board.players[pub]; writeBoard(board); return send(res, 200, { ok: true }); }
  }

  // squad challenges: members create them; each client computes and reports its own score
  if (url.pathname === '/api/challenges') {
    if (!validPid) return send(res, 400, { error: 'missing player id' });
    const board = readBoard();
    if (req.method === 'GET') return send(res, 200, { challenges: Object.values(board.challenges) });
    if (req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 4096));
      const me = board.players[pub];
      if (!me) return send(res, 403, { error: 'join the leaderboard first' });
      const isDate = x => /^\d{4}-\d{2}-\d{2}$/.test(x);
      const person = { name: me.name, avatar: me.avatar, score: 0 };
      if (b.action === 'create') {
        const METRICS = ['xp', 'focus', 'habits', 'quests', 'journal', 'days'];
        if (!METRICS.includes(b.metric) || !isDate(b.start) || !isDate(b.end) || b.end < b.start) return send(res, 400, { error: 'bad challenge' });
        if ((new Date(b.end) - new Date(b.start)) / 864e5 > 31) return send(res, 400, { error: 'too long' });
        const cutoff = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
        for (const [id, c] of Object.entries(board.challenges)) if (c.end < cutoff) delete board.challenges[id];
        if (Object.values(board.challenges).filter(c => c.end >= b.start).length >= 20) return send(res, 400, { error: 'too many active challenges' });
        const id = require('crypto').randomBytes(5).toString('hex');
        board.challenges[id] = { id, title: String(b.title || '').slice(0, 40) || 'Challenge', metric: b.metric, start: b.start, end: b.end, creator: pub, creatorName: me.name, participants: { [pub]: person } };
        writeBoard(board);
        return send(res, 200, { ok: true, id });
      }
      const ch = board.challenges[b.id];
      if (!ch) return send(res, 404, { error: 'no such challenge' });
      if (b.action === 'join') {
        if (isDate(b.today) && b.today > ch.end) return send(res, 400, { error: 'already ended' });
        if (Object.keys(ch.participants).length >= 50) return send(res, 400, { error: 'full' });
        ch.participants[pub] = ch.participants[pub] || person; writeBoard(board);
        return send(res, 200, { ok: true });
      }
      if (b.action === 'score') {
        if (!ch.participants[pub]) return send(res, 403, { error: 'not joined' });
        ch.participants[pub].score = Math.max(0, Math.min(1e7, Math.round(+b.score) || 0)); writeBoard(board);
        return send(res, 200, { ok: true });
      }
      if (b.action === 'delete') {
        if (ch.creator !== pub) return send(res, 403, { error: 'only the creator can delete' });
        delete board.challenges[b.id]; writeBoard(board);
        return send(res, 200, { ok: true });
      }
    }
  }

  // restore points: one snapshot per day of use, newest 14 kept
  if (url.pathname === '/api/snapshots') {
    if (!validPid) return send(res, 400, { error: 'missing player id' });
    const date = url.searchParams.get('date');
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: 'bad date' });
      const f = path.join(PLAYERS_DIR, pid + '.snap-' + date + '.json');
      return fs.existsSync(f) ? send(res, 200, { state: JSON.parse(fs.readFileSync(f, 'utf8')) }) : send(res, 404, { error: 'no snapshot' });
    }
    const snaps = fs.readdirSync(PLAYERS_DIR).filter(f => f.startsWith(pid + '.snap-')).sort().reverse()
      .map(f => ({ date: f.slice(pid.length + 6, -5), size: fs.statSync(path.join(PLAYERS_DIR, f)).size }));
    return send(res, 200, { snapshots: snaps });
  }

  // focus rooms (body doubling): only the fact that you are focusing is shared, never what you are working on
  if (url.pathname === '/api/room') {
    if (!validPid) return send(res, 400, { error: 'missing player id' });
    const now = Date.now(); for (const [k, v] of rooms) if (v.until < now) rooms.delete(k);
    if (req.method === 'GET') return send(res, 200, { room: [...rooms.entries()].map(([k, v]) => ({ pid: k, ...v })) });
    if (req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 1024)), me = readBoard().players[pub];
      if (!me) return send(res, 403, { error: 'join the leaderboard first' });
      if (b.action === 'stop') { rooms.delete(pub); return send(res, 200, { ok: true }); }
      const until = Math.min(+b.until || 0, now + 2 * 3600e3); if (until <= now) return send(res, 400, { error: 'bad time' });
      rooms.set(pub, { name: me.name, avatar: me.avatar, until, task: '' });
      return send(res, 200, { ok: true });
    }
  }

  // web push: the client uploads its upcoming reminders; pushTick() delivers each at its time, even if the app is closed
  if (url.pathname.startsWith('/api/push/')) {
    if (!validPid) return send(res, 400, { error: 'missing player id' });
    const op = url.pathname.slice(10), db = pushDB(), str = (x, n) => String(x ?? '').slice(0, n);
    if (op === 'key' && req.method === 'GET') return send(res, 200, { key: VAPID.publicB64 });
    if (op === 'sub' && req.method === 'POST') {
      const { sub } = JSON.parse(await readBody(req, 4096));
      if (!sub || !okEndpoint(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return send(res, 400, { error: 'unsupported push service' });
      db.subs[pid] = (db.subs[pid] || []).filter(x => x.endpoint !== sub.endpoint).concat({ endpoint: sub.endpoint, keys: { p256dh: str(sub.keys.p256dh, 200), auth: str(sub.keys.auth, 100) } }).slice(-5);
      pushSave(db); return send(res, 200, { ok: true });
    }
    if (op === 'unsub' && req.method === 'POST') {
      const { endpoint } = JSON.parse(await readBody(req, 2048));
      db.subs[pid] = (db.subs[pid] || []).filter(x => x.endpoint !== endpoint); pushSave(db); return send(res, 200, { ok: true });
    }
    if (op === 'schedule' && req.method === 'POST') {
      const { items = [] } = JSON.parse(await readBody(req, 100 * 1024)), now = Date.now(), done = db.sent[pid] || {};
      db.queue[pid] = items.slice(0, 200).map(i => ({ id: str(i.id, 80), at: Math.round(+i.at), title: str(i.title, 80), body: str(i.body, 160), tag: str(i.tag, 80), url: /^\/[\w?=&.-]*$/.test(String(i.url || '')) ? String(i.url).slice(0, 80) : '/', badge: Math.max(0, Math.min(99, +i.badge || 0)) }))
        .filter(i => i.id && i.at > now - 3600e3 && i.at < now + 72 * 3600e3 && !done[i.id]);
      pushSave(db); return send(res, 200, { ok: true, queued: db.queue[pid].length });
    }
    if (op === 'test' && req.method === 'POST') {
      const subs = db.subs[pid] || []; if (!subs.length) return send(res, 404, { error: 'no subscription' });
      const statuses = await Promise.all(subs.map(x => push.sendPush(VAPID, x, { title: '🔔 LifeQuest test', body: 'Push works. Reminders will reach you even when the app is closed.', tag: 'test' }).catch(() => 0)));
      return send(res, statuses.some(c => c >= 200 && c < 300) ? 200 : 502, { ok: statuses.some(c => c >= 200 && c < 300), statuses });
    }
  }

  // the Saga: daily episode text + illustration, generated by your own local models
  if (url.pathname.startsWith('/api/saga/')) {
    if (!validPid) return send(res, 400, { error: 'missing player id' });
    const op = url.pathname.slice(10), okDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
    if (op === 'status' && req.method === 'GET') return send(res, 200, await saga.status());
    if (op === 'episode' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 20 * 1024)); if (!okDate(b.date)) return send(res, 400, { error: 'bad date' });
      if (!saga.allow(pid, 'ep')) return send(res, 429, { error: 'daily story limit reached' });
      return send(res, 202, { status: saga.startEpisode(pid, b.date, String(b.input || '').slice(0, 6000)).status });
    }
    if (op === 'episode' && req.method === 'GET') {
      const date = url.searchParams.get('date'); if (!okDate(date)) return send(res, 400, { error: 'bad date' });
      const job = saga.episodeJob(pid, date);
      if (!job) return send(res, 404, { error: 'no such episode job' });
      if (job.status === 'done') return send(res, 200, { episode: job.episode });
      if (job.status === 'error') return send(res, 502, { error: job.error });
      return send(res, 202, { status: job.status });
    }
    if (op === 'image' && req.method === 'POST') {
      const b = JSON.parse(await readBody(req, 8 * 1024)); if (!okDate(b.date)) return send(res, 400, { error: 'bad date' });
      if (!saga.allow(pid, 'img')) return send(res, 429, { error: 'daily image limit reached' });
      const job = saga.startImage(pid, b.date, { look: b.look, gear: b.gear, scene: b.scene, mood: b.mood }, b.seed);
      return send(res, 202, { status: job.status });
    }
    if (op === 'image' && req.method === 'GET') {
      const date = url.searchParams.get('date'); if (!okDate(date)) return send(res, 400, { error: 'bad date' });
      const job = saga.jobFor(pid, date);
      if (job && job.status !== 'done' && job.status !== 'error') return send(res, 202, { status: job.status });
      if (saga.hasImage(pid, date)) return send(res, 200, fs.readFileSync(saga.imgPath(pid, date)), 'image/png');
      if (job && job.status === 'error') return send(res, 500, { status: 'error', error: job.error });
      return send(res, 404, { error: 'no image' });
    }
  }

  if (url.pathname === '/api/cheer' && req.method === 'POST') {
    if (!validPid) return send(res, 400, { error: 'missing player id' });
    const { to, from } = JSON.parse(await readBody(req, 1024));
    const board = readBoard();
    if (!board.players[to] || to === pub) return send(res, 400, { error: 'no such player' });
    const list = board.cheers[to] = (board.cheers[to] || []).slice(-19);
    list.push({ from: String(from || 'A friend').slice(0, 20), t: Date.now() });
    writeBoard(board);
    return send(res, 200, { ok: true });
  }

  if (url.pathname === '/api/chat' && req.method === 'POST') {
    if (!LLM_URL) return send(res, 501, { error: 'LLM not configured on server' });
    const { messages = [], context = '' } = JSON.parse(await readBody(req, 200 * 1024));
    const system = 'You are the in-app life coach for LifeQuest, a gamified self-improvement app. ' +
      'Be warm, concise (under 120 words), practical and a little playful. Give one concrete next step. ' +
      'Never give medical or crisis advice beyond suggesting professional help when appropriate.\n\nPlayer snapshot:\n' + context;
    const r = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(LLM_KEY ? { Authorization: 'Bearer ' + LLM_KEY } : {}) },
      body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: 'system', content: system }, ...messages.slice(-12)], stream: false }),
    });
    if (!r.ok) return send(res, 502, { error: 'LLM error ' + r.status });
    const j = await r.json();
    return send(res, 200, { reply: j.choices?.[0]?.message?.content || '…' });
  }
  return send(res, 404, { error: 'not found' });
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const research = p === '/research.md';
  const file = research ? path.join(__dirname, 'docs', 'RESEARCH.md') : path.normalize(path.join(PUBLIC, p));
  if (!research && !file.startsWith(PUBLIC)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': research ? 'text/plain; charset=utf-8' : MIME[ext] || 'application/octet-stream',
      // app code must revalidate every time so updates show immediately; only the icons are cached
      'Cache-Control': file.endsWith('.png') ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(data);
  });
}

// /phone: a QR page for signing a phone in. It shows the access token, so it is served ONLY to this PC itself
// (loopback, and never through a reverse proxy such as `tailscale serve`, which adds forwarding headers).
// optional public HTTPS address (e.g. `tailscale serve`): LIFEQUEST_PUBLIC_URL or "publicUrl" in data/config.json. Installing, offline mode and closed-app push need https.
const PUBLIC_URL = String(process.env.LIFEQUEST_PUBLIC_URL || fileCfg.publicUrl || '').replace(/\/+$/, '');
function hostList() {
  const proto = useTls ? 'https' : 'http', out = [];
  if (/^https:\/\/[\w.-]+(:\d+)?$/.test(PUBLIC_URL)) out.push({ label: 'Installable app (HTTPS: push, offline)', origin: PUBLIC_URL });
  for (const [name, list] of Object.entries(os.networkInterfaces()))
    for (const i of list || []) {
      if (i.family !== 'IPv4' || i.internal || /vethernet|wsl|hyper-v|virtual|vmware|docker/i.test(name)) continue;
      const tailnet = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(i.address);
      out.push({ label: tailnet ? 'Anywhere (Tailscale app on the phone)' : 'Home Wi-Fi (phone on the same network)', origin: `${proto}://${i.address}:${PORT}` });
    }
  return out;
}
function phonePage(req, res) {
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  if (!local || req.headers['x-forwarded-for'] || req.headers['tailscale-user-login']) return send(res, 403, 'Open this page on the PC that runs LifeQuest.', 'text/plain');
  const proto = useTls ? 'https' : 'http', links = [];
  if (/^https:\/\/[\w.-]+(:\d+)?$/.test(PUBLIC_URL)) links.push({ label: 'Installable app (HTTPS: push notifications, offline, Add to Home Screen)', url: `${PUBLIC_URL}/${TOKEN ? '#token=' + TOKEN : ''}` });
  for (const [name, list] of Object.entries(os.networkInterfaces()))
    for (const i of list || []) {
      if (i.family !== 'IPv4' || i.internal || /vethernet|wsl|hyper-v|virtual|vmware|docker/i.test(name)) continue;
      const tailnet = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(i.address);
      links.push({ label: tailnet ? 'Anywhere (Tailscale app on the phone)' : 'Home Wi-Fi (phone on the same network)', url: `${proto}://${i.address}:${PORT}/${TOKEN ? '#token=' + TOKEN : ''}` });
    }
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LifeQuest on your phone</title>
<style>body{font:16px system-ui;background:#0f0b1e;color:#f1eeff;margin:0;padding:24px;max-width:760px;margin:auto}h1{margin-top:0}.c{background:#1f1942;border:1px solid #3a3170;border-radius:16px;padding:18px;margin:14px 0;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.q{background:#fff;padding:10px;border-radius:10px;min-width:180px;min-height:180px}code{word-break:break-all;color:#c4b5fd}.d{color:#a39cd0}ol{line-height:1.7}</style>
<h1>⚔️ LifeQuest on your phone</h1><p class="d">Scan a code with your phone's camera. It signs the phone in. Treat these links like passwords.</p>
${links.map((l, n) => `<div class="c"><div class="q" id="q${n}"></div><div style="flex:1;min-width:220px"><b>${esc(l.label)}</b><br><code>${esc(l.url)}</code></div></div>`).join('') || '<p>No network address found. Is this PC connected?</p>'}
<h3>Then add it to the home screen</h3><ol><li><b>Android (Chrome):</b> ⋮ menu → <b>Add to Home screen</b></li><li><b>iPhone (Safari):</b> Share button → <b>Add to Home Screen</b></li></ol>
<p class="d">Over plain http the app needs the server to be reachable (no offline mode or closed-app push; those need an https link).</p>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>const L=${JSON.stringify(links.map(l => l.url)).replace(/</g, '\\u003c')};L.forEach((u,i)=>{try{new QRCode(document.getElementById('q'+i),{text:u,width:180,height:180,correctLevel:QRCode.CorrectLevel.M})}catch(e){document.getElementById('q'+i).textContent='(QR unavailable offline, type the link)'}});</script>`);
}

const handler = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname === '/phone') return phonePage(req, res);
    serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'server error' });
  }
};

// delivers queued reminders when they come due; remembers what it sent so a re-upload cannot repeat a reminder
async function pushTick() {
  const snap = pushDB(), now = Date.now(), touched = new Set(), dead = [], sent = [];
  for (const [pid, q] of Object.entries(snap.queue)) {
    const due = q.filter(i => i.at <= now && i.at > now - 20 * 60000 && !(snap.sent[pid] || {})[i.id]);
    if (q.some(i => i.at <= now)) touched.add(pid);
    for (const it of due) {
      sent.push([pid, it.id]);
      for (const sub of snap.subs[pid] || []) {
        try { const st = await push.sendPush(VAPID, sub, { title: it.title, body: it.body, tag: it.tag, url: it.url || '/', badge: it.badge || 0 }); if (st === 404 || st === 410) dead.push([pid, sub.endpoint]); else if (st >= 400) console.log('push gateway answered', st); }
        catch (e) { console.log('push error:', e.message); }
      }
    }
  }
  if (!touched.size && !dead.length) return;
  const db = pushDB();
  for (const pid of touched) db.queue[pid] = (db.queue[pid] || []).filter(i => i.at > now);
  for (const [pid, id] of sent) (db.sent[pid] = db.sent[pid] || {})[id] = now;
  for (const pid of Object.keys(db.sent)) for (const id of Object.keys(db.sent[pid])) if (db.sent[pid][id] < now - 48 * 3600e3) delete db.sent[pid][id];
  for (const [pid, ep] of dead) db.subs[pid] = (db.subs[pid] || []).filter(x => x.endpoint !== ep);
  pushSave(db);
}
setInterval(() => pushTick().catch(e => console.log('pushTick', e.message)), 15000);

const useTls = process.env.CERT && process.env.KEY;
const server = useTls
  ? https.createServer({ cert: fs.readFileSync(process.env.CERT), key: fs.readFileSync(process.env.KEY) }, handler)
  : http.createServer(handler);

server.listen(PORT, '0.0.0.0', () => {
  const proto = useTls ? 'https' : 'http';
  console.log(`\n  LifeQuest is running\n  This PC:  ${proto}://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) console.log(`  Phone:    ${proto}://${i.address}:${PORT}/${TOKEN ? '#token=' + TOKEN : ''}   (same Wi-Fi)`);
  console.log(`  Data:     ${DATA_DIR}`);
  console.log(`  Auth:     ${TOKEN ? 'token required (open the Phone link above once; it signs the device in)' : 'OFF'}`);
  console.log(`  AI coach: ${LLM_URL ? LLM_URL : 'off (set LLM_URL to enable)'}\n`);
});
