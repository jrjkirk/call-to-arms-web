/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// One cache per deploy. `version` is VERCEL_GIT_COMMIT_SHA (deterministic per
// commit — see the svelte.config.js note), so a new deploy makes a fresh cache
// and the activate step below evicts the old ones.
const CACHE = `cta-cache-${version}`;

// Hashed, immutable build output + static files — safe to serve cache-first.
const PRECACHE = [...build, ...files];
const PRECACHE_SET = new Set(PRECACHE);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);
	// Only touch our own origin. API calls (api.calltoarms.app) and any other
	// cross-origin request pass straight through to the network, untouched.
	if (url.origin !== sw.location.origin) return;

	// Immutable hashed assets: cache-first (fall back to network if somehow
	// missing, e.g. a cache that was partially evicted).
	if (PRECACHE_SET.has(url.pathname)) {
		event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
		return;
	}

	// Navigations and everything else: network-first so users always get fresh
	// HTML; fall back to the cached response (then the app shell) when offline.
	event.respondWith(
		fetch(req)
			.then((res) => {
				if (res.ok && req.mode === 'navigate') {
					const copy = res.clone();
					caches.open(CACHE).then((cache) => cache.put(req, copy));
				}
				return res;
			})
			.catch(async () => (await caches.match(req)) ?? (await caches.match('/')) ?? Response.error())
	);
});
