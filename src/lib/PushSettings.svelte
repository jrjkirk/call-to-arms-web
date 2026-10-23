<!--
  Push notifications for THIS device: turn them on or off, choose which kinds,
  send a test. Lives on the Account page.

  Per device because a push subscription belongs to the browser that made it:
  your phone and your laptop each say yes (or no) on their own. The server side
  is push.py; the notifications are the same news as the in-app notices.

  iPhones are the awkward case: Apple only allows push for a web app that has
  been added to the home screen and opened from there, so in Safari proper this
  explains that instead of offering a button that can't work.
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';

    type Kind = { kind: string; label: string };

    let view = $state<'loading' | 'unsupported' | 'ios-install' | 'off-server' | 'blocked' | 'off' | 'on'>('loading');
    let kinds = $state<Kind[]>([]);
    let muted = $state<string[]>([]);
    let publicKey = $state<string | null>(null);
    let busy = $state(false);
    let message = $state<string | null>(null);

    function isIos(): boolean {
        return /iPad|iPhone|iPod/.test(navigator.userAgent)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function isInstalled(): boolean {
        return window.matchMedia('(display-mode: standalone)').matches
            || (navigator as unknown as { standalone?: boolean }).standalone === true;
    }

    /** The VAPID public key, as the bytes pushManager.subscribe wants. */
    function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
        const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
        const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
        const out = new Uint8Array(new ArrayBuffer(raw.length));
        for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
        return out;
    }

    async function api(path: string, body?: unknown) {
        const r = await fetch(`${PUBLIC_API_URL}${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            credentials: 'include',
            headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.detail || 'Something went wrong. Try again.');
        return data;
    }

    async function registration(): Promise<ServiceWorkerRegistration> {
        return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js');
    }

    onMount(async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
            view = isIos() && !isInstalled() ? 'ios-install' : 'unsupported';
            return;
        }
        try {
            const info = await api('/push/key');
            kinds = info.kinds ?? [];
            publicKey = info.public_key;
            if (!info.enabled) { view = 'off-server'; return; }
            if (Notification.permission === 'denied') { view = 'blocked'; return; }
            const sub = await (await registration()).pushManager.getSubscription();
            if (!sub) { view = 'off'; return; }
            // Subscribed in this browser, but maybe for someone else's account.
            const status = await api('/push/status', { endpoint: sub.endpoint });
            muted = status.muted ?? [];
            view = status.subscribed ? 'on' : 'off';
        } catch (_) {
            view = 'unsupported';
        }
    });

    async function turnOn() {
        if (!publicKey) return;
        busy = true;
        message = null;
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                view = permission === 'denied' ? 'blocked' : 'off';
                return;
            }
            const reg = await registration();
            const sub = (await reg.pushManager.getSubscription())
                ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
            const saved = await api('/push/subscribe', sub.toJSON());
            muted = saved.muted ?? [];
            view = 'on';
            message = 'Notifications are on for this device.';
        } catch (e) {
            // The browser's own errors here ("Registration failed - push
            // service error") mean nothing to a player; ours from the API do.
            const text = e instanceof Error ? e.message : '';
            message = /registration|push service|AbortError|NotAllowed/i.test(text) || !text
                ? "This browser couldn't set up notifications. Check they're allowed for this site, then try again."
                : text;
        } finally {
            busy = false;
        }
    }

    async function turnOff() {
        busy = true;
        message = null;
        try {
            const sub = await (await registration()).pushManager.getSubscription();
            if (sub) {
                await api('/push/unsubscribe', { endpoint: sub.endpoint });
                await sub.unsubscribe();
            }
            view = 'off';
            message = 'Notifications are off for this device.';
        } catch (e) {
            message = e instanceof Error ? e.message : 'Could not turn notifications off.';
        } finally {
            busy = false;
        }
    }

    async function toggleKind(kind: string, on: boolean) {
        const next = on ? muted.filter((k) => k !== kind) : [...muted, kind];
        const previous = muted;
        muted = next;
        try {
            const sub = await (await registration()).pushManager.getSubscription();
            if (!sub) return;
            muted = (await api('/push/mute', { endpoint: sub.endpoint, muted: next })).muted ?? next;
        } catch (e) {
            muted = previous;
            message = e instanceof Error ? e.message : 'Could not save that.';
        }
    }

    async function sendTest() {
        busy = true;
        message = null;
        try {
            const r = await api('/push/test', {});
            message = r.delivered > 0
                ? `Sent. It should arrive in a few seconds${r.delivered > 1 ? ` on all ${r.delivered} of your devices` : ''}.`
                : "Nothing was delivered. Try turning notifications off and on again.";
        } catch (e) {
            message = e instanceof Error ? e.message : 'Could not send a test.';
        } finally {
            busy = false;
        }
    }
</script>

<section class="a-card push">
    <div class="a-head">
        <h3 class="a-title">Notifications</h3>
        {#if view === 'on'}<span class="a-state is-on a-head-end">On</span>{:else if view === 'off' || view === 'blocked'}<span class="a-state a-head-end">Off</span>{/if}
    </div>
    <p class="a-note">
        A buzz on this device when pairings go up, your opponent drops out, or a late signup
        finds you a game. The same news as the banners in the app.
    </p>

    {#if view === 'loading'}
        <p class="a-note">Checking this device…</p>
    {:else if view === 'ios-install'}
        <p class="hint">
            On an iPhone, notifications need the app on your home screen. In Safari, tap
            <b>Share</b>, then <b>Add to Home Screen</b>, open Call to Arms from there, and come
            back to this page.
        </p>
    {:else if view === 'unsupported'}
        <p class="hint">This browser can't receive notifications. Chrome, Edge, Firefox or Safari on a recent device can.</p>
    {:else if view === 'off-server'}
        <p class="hint">Notifications aren't switched on for Call to Arms yet. Check back soon.</p>
    {:else if view === 'blocked'}
        <p class="hint">
            Notifications are blocked for this site. Allow them in your browser's site settings
            (the icon beside the address), then reload this page.
        </p>
    {:else if view === 'off'}
        <button class="primary-button" type="button" disabled={busy} onclick={turnOn}>
            {busy ? 'Turning on…' : 'Turn on notifications on this device'}
        </button>
    {:else}
        <div class="kinds">
            {#each kinds as k (k.kind)}
                <label class="check-row">
                    <input type="checkbox" checked={!muted.includes(k.kind)}
                           onchange={(e) => toggleKind(k.kind, e.currentTarget.checked)} />
                    <span>{k.label}</span>
                </label>
            {/each}
        </div>
        <div class="actions">
            <button class="secondary-button" type="button" disabled={busy} onclick={sendTest}>Send a test</button>
            <button class="danger-button" type="button" disabled={busy} onclick={turnOff}>Turn off on this device</button>
        </div>
    {/if}

    {#if message}<p class="message">{message}</p>{/if}
</section>

<style>
    .hint { margin: 0; color: var(--color-text-muted); line-height: 1.5; }
    .hint b { color: var(--color-text-bright); }
    .kinds { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.9rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .message { margin: 0.8rem 0 0; font-size: 0.9rem; color: var(--color-text-dim); }
</style>
