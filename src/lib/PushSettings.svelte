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
    import Toggle from './Toggle.svelte';
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
    <!-- One switch for this device; the kinds below it each have their own. -->
    <div class="a-head">
        <h3 class="a-title">Notifications</h3>
        {#if view === 'on' || view === 'off'}
            <span class="a-head-end">
                <Toggle checked={view === 'on'} {busy} label="notifications on this device"
                        onchange={(on) => (on ? turnOn() : turnOff())} />
            </span>
        {:else if view === 'blocked'}
            <span class="a-state a-head-end">Blocked</span>
        {/if}
    </div>

    {#if view === 'ios-install'}
        <p class="hint">Add Call to Arms to your Home Screen first, then open it from there.</p>
    {:else if view === 'unsupported'}
        <p class="hint">Not available in this browser.</p>
    {:else if view === 'off-server'}
        <p class="hint">Coming soon.</p>
    {:else if view === 'blocked'}
        <p class="hint">Allow notifications for this site in your browser's settings, then reload.</p>
    {:else if view === 'on'}
        <ul class="kinds">
            {#each kinds as k (k.kind)}
                <li class="kind">
                    <span class="kind-name">{k.label}</span>
                    <Toggle checked={!muted.includes(k.kind)} label={k.label}
                            onchange={(on) => toggleKind(k.kind, on)} />
                </li>
            {/each}
        </ul>
        <button class="secondary-button test" type="button" disabled={busy} onclick={sendTest}>Send a test</button>
    {/if}

    {#if message}<p class="message">{message}</p>{/if}
</section>

<style>
    .hint { margin: 0.4rem 0 0; color: var(--color-text-muted); line-height: 1.5; }
    .kinds { list-style: none; margin: 0.6rem 0 0.9rem; padding: 0; }
    .kind {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        min-height: 2.9rem;
        border-top: 1px solid #1c2029;
    }
    .kind-name {
        font-family: var(--font-heading);
        font-size: 1.02rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-bright);
    }
    .message { margin: 0.8rem 0 0; font-size: 0.9rem; color: var(--color-text-dim); }
</style>
