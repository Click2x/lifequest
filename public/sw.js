const CACHE = 'lifequest-v6';
const SHELL = ['/', '/index.html', '/app.js', '/ext-habits.js', '/ext-time.js', '/ext-money.js', '/ext-life.js', '/ext-push.js', '/ext-saga.js', '/ext-engage.js', '/ext-rpg.js', '/theme-rpg.css', '/boot.js', '/style.css', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network-first for the app shell (so updates arrive), cache fallback for offline. API is never cached.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(m => m || caches.match('/index.html')))
  );
});

// ── web push: reminders sent by your own server, delivered even when the app is closed ──
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch { }
  e.waitUntil((async () => {
    const cs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (cs.some(c => c.visibilityState === 'visible')) { cs.forEach(c => c.postMessage({ toast: '🔔 ' + (d.title || 'Reminder') })); return; }   // app is open: show it in-app instead
    try { if (d.badge && self.navigator.setAppBadge) await self.navigator.setAppBadge(d.badge); } catch { }
    await self.registration.showNotification(d.title || 'LifeQuest', { body: d.body || '', tag: d.tag, icon: '/icon-192.png', badge: '/icon-192.png', data: d, actions: [{ action: 'open', title: 'Open' }, { action: 'snooze', title: 'Snooze 10 min' }] });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const d = e.notification.data || {};
  e.waitUntil((async () => {
    const cs = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (e.action === 'snooze') {
      const m = { tag: e.notification.tag, title: d.title, body: d.body };
      if (cs.length) cs.forEach(c => c.postMessage({ snooze: m })); else await clients.openWindow('/?snooze=' + encodeURIComponent(JSON.stringify(m)));
      return;
    }
    const url = d.url || '/';
    if (cs.length) { cs[0].postMessage({ go: url }); return cs[0].focus(); } return clients.openWindow(url);
  })());
});
