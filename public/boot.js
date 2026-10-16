'use strict';
// loads last: everything is defined, so start the app
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
setInterval(() => { if (tab === 'squad' && !document.hidden) fetchBoard(); }, 45000);
// "Snooze" tapped on a notification while the app was closed arrives as ?snooze=...
try { const sn = new URLSearchParams(location.search).get('snooze'); if (sn) { const m = JSON.parse(sn); snoozeReminder(m.tag, m.title, m.body); history.replaceState(null, '', location.pathname); } } catch { }
showLock();
render(); dailyLogin(); initSync().then(fetchBoard); checkAch();
maybeWelcomeBack();
if (typeof sagaBoot === 'function') sagaBoot();
document.addEventListener('visibilitychange', () => { if (!document.hidden) maybeWelcomeBack(); });
