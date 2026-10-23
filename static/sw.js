/*
 * Call to Arms service worker: push notifications ONLY.
 *
 * There is deliberately no fetch handler and no cache. A caching service worker
 * is the classic way to pin people to an old build, and stale files after a
 * deploy have already cost this app one bad afternoon (2026-10-23). Every page
 * and file still comes straight from the network, exactly as without this.
 *
 * The server sends { title, body, url, tag } (push.py). `tag` replaces an
 * earlier notification about the same week instead of stacking a second one.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (_) {
        data = { body: event.data ? event.data.text() : '' };
    }
    event.waitUntil(
        self.registration.showNotification(data.title || 'Call to Arms', {
            body: data.body || '',
            icon: '/icon-192.png',
            badge: '/favicon-48.png',
            tag: data.tag || undefined,
            data: { url: data.url || '/' }
        })
    );
});

// Tapping a notification opens its page: in a tab the app already has open
// if there is one, otherwise a new one.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
            for (const w of wins) {
                if (w.url.startsWith(self.location.origin) && 'navigate' in w) {
                    return w.navigate(target).then((nw) => (nw || w).focus());
                }
            }
            return self.clients.openWindow(target);
        })
    );
});
