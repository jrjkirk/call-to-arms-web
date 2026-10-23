<!--
  The one-tap way in to notifications, for signed-in members.

  A browser will only ask for notification permission after the person taps
  something, so they can't simply be switched on for everyone. This gets as
  close as the platforms allow:
    - permission already granted (the browser said yes before) and this device
      isn't subscribed for this account: subscribe silently, no card at all;
    - never asked: a small card, "Turn on" or "Not now". One tap, approve the
      browser's prompt, and every kind is on (change them under Account);
    - "Not now" hides it for two weeks; a refusal in the browser's own prompt,
      or a browser that can't do push, means it never shows.
  iPhones outside the home-screen app can't receive push at all, so they get
  nothing here; the Account page explains the home-screen step.
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { fly } from 'svelte/transition';
    import { page } from '$app/state';
    import { deviceStatus, friendlyPushError, pushInfo, pushSupported, subscribeDevice } from './push';

    let { authed }: { authed: boolean } = $props();

    const DISMISSED_KEY = 'cta_push_prompt_dismissed_at';
    const QUIET_FOR_MS = 14 * 24 * 60 * 60 * 1000;

    let show = $state(false);
    let busy = $state(false);
    let done = $state<string | null>(null);
    let error = $state<string | null>(null);
    let publicKey: string | null = null;
    let checked = false;

    function dismissedRecently(): boolean {
        try {
            const at = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
            return at > 0 && Date.now() - at < QUIET_FOR_MS;
        } catch (_) {
            return false;
        }
    }

    async function check() {
        if (checked || !pushSupported()) return;
        checked = true;
        try {
            const info = await pushInfo();
            if (!info.enabled || !info.public_key) return;
            publicKey = info.public_key;
            if (Notification.permission === 'denied') return;
            if ((await deviceStatus()).subscribed) return;
            if (Notification.permission === 'granted') {
                // Already allowed in this browser: nothing to ask, just sign
                // this device up for this account.
                await subscribeDevice(publicKey);
                return;
            }
            if (dismissedRecently()) return;
            // A moment after the page settles, not on top of it loading.
            setTimeout(() => (show = true), 1500);
        } catch (_) {
            /* push is a nicety: never let it surface an error unasked */
        }
    }

    $effect(() => {
        if (authed) check();
    });

    async function turnOn() {
        if (!publicKey) return;
        busy = true;
        error = null;
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                show = false;
                return;
            }
            await subscribeDevice(publicKey);
            done = "You're set. Change what you get under Account.";
            setTimeout(() => (show = false), 3500);
        } catch (e) {
            error = friendlyPushError(e);
        } finally {
            busy = false;
        }
    }

    function notNow() {
        try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch (_) {}
        show = false;
    }

    onMount(() => {
        if (authed) check();
    });
</script>

{#if show && page.url.pathname !== '/account'}
    <div class="push-prompt" role="dialog" aria-labelledby="push-prompt-title" transition:fly={{ y: 20, duration: 220 }}>
        {#if done}
            <p class="title" id="push-prompt-title">Notifications on</p>
            <p class="text">{done}</p>
        {:else}
            <p class="title" id="push-prompt-title">Get a buzz when pairings go up</p>
            <p class="text">And if your opponent drops out, or a late signup finds you a game.</p>
            {#if error}<p class="error">{error}</p>{/if}
            <div class="actions">
                <button type="button" class="on" disabled={busy} onclick={turnOn}>{busy ? 'Turning on…' : 'Turn on'}</button>
                <button type="button" class="later" disabled={busy} onclick={notNow}>Not now</button>
            </div>
        {/if}
    </div>
{/if}

<style>
    .push-prompt {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 850;
        width: min(360px, calc(100vw - 32px));
        padding: 16px 18px;
        background: #13161e;
        border: 1px solid var(--color-accent);
        border-radius: 8px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
    }

    @media (max-width: 768px) {
        /* Just above the bottom tab bar. */
        .push-prompt {
            left: 16px;
            right: 16px;
            width: auto;
            bottom: calc(76px + env(safe-area-inset-bottom));
        }
    }

    .title {
        margin: 0;
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.25rem;
        text-transform: uppercase;
        color: var(--color-text-bright);
    }

    .text { margin: 4px 0 0; color: var(--color-text-muted); font-size: 0.92rem; }
    .error { margin: 8px 0 0; color: #d4786c; font-size: 0.88rem; }

    .actions { margin-top: 12px; display: flex; gap: 8px; }

    .actions button {
        min-height: 44px;
        padding: 0 18px;
        border-radius: 5px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
    }

    .on { flex: 1; background: var(--color-accent); border: none; color: #15120a; }
    .on:hover:not(:disabled) { background: var(--color-accent-bright); }
    .later { background: none; border: 1px solid var(--color-accent-border); color: var(--color-accent); }
    button:disabled { opacity: 0.6; cursor: default; }
</style>
