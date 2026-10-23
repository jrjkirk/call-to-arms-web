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
    import {
        deviceStatus, friendlyPushError, isInstalled, isIos, pushApi as api, pushInfo,
        pushRegistration as registration, pushSupported, subscribeDevice, type PushKind as Kind
    } from './push';

    let view = $state<'loading' | 'unsupported' | 'ios-install' | 'off-server' | 'blocked' | 'off' | 'on'>('loading');
    let kinds = $state<Kind[]>([]);
    let muted = $state<string[]>([]);
    let publicKey = $state<string | null>(null);
    let busy = $state(false);
    let message = $state<string | null>(null);

    onMount(async () => {
        if (!pushSupported()) {
            view = isIos() && !isInstalled() ? 'ios-install' : 'unsupported';
            return;
        }
        try {
            const info = await pushInfo();
            kinds = info.kinds ?? [];
            publicKey = info.public_key;
            if (!info.enabled) { view = 'off-server'; return; }
            if (Notification.permission === 'denied') { view = 'blocked'; return; }
            // Subscribed in this browser, but maybe for someone else's account.
            const status = await deviceStatus();
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
            const saved = await subscribeDevice(publicKey);
            muted = saved.muted ?? [];
            view = 'on';
            message = 'Notifications are on for this device.';
        } catch (e) {
            message = friendlyPushError(e);
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
