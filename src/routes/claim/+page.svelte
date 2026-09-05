<script lang="ts">
    import { onMount } from 'svelte';
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { PUBLIC_API_URL } from '$env/static/public';

    /** Where onboarding ends.
     *
     *  The last hop of join -> claim -> here. `next` is the page the player was
     *  originally trying to reach, threaded through from the Discord callback;
     *  without it a first-timer who followed a "sign up for Thursday" link
     *  finished on the club's front page having never seen the signup form.
     */
    function destination(): string {
        const next = page.url.searchParams.get('next');
        return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    }

    type AuthState = {
        authenticated: boolean;
        user?: { id: number; discord_name: string; player_id: number | null };
        player?: { name: string } | null;
        active_club?: { id: number; slug: string; name: string } | null;
    };

    let auth = $state<AuthState>({ authenticated: false });
    let loaded = $state(false);

    // New-player form
    let newName = $state('');
    let consentChecked = $state(false);
    let newSubmitting = $state(false);
    let newErrorMsg = $state<string | null>(null);

    async function loadAuth() {
        try {
            const response = await fetch(`${PUBLIC_API_URL}/auth/me`, { credentials: 'include' });
            if (response.ok) auth = await response.json();
        } catch (_) {}
        loaded = true;
    }

    onMount(() => {
        loadAuth();
    });

    // Multi-club network model: "already linked" is per active club — keyed off
    // auth.player (the active-club player /auth/me returns), not the legacy
    // home-club auth.user.player_id.
    const alreadyLinked = $derived(auth.player != null);

    async function createProfile() {
        if (newSubmitting) return;
        newErrorMsg = null;
        const name = newName.trim();
        if (!name) { newErrorMsg = 'Please enter your name.'; return; }
        if (!consentChecked) { newErrorMsg = 'Please accept the privacy notice to continue.'; return; }
        newSubmitting = true;
        try {
            const response = await fetch(`${PUBLIC_API_URL}/auth/create-profile`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                newErrorMsg = body.detail || 'Could not create profile.';
                newSubmitting = false;
                return;
            }
            const refresh = (window as any).__refreshAuth;
            if (typeof refresh === 'function') await refresh();
            goto(destination());
        } catch (_) {
            newErrorMsg = 'Network error. Please try again.';
            newSubmitting = false;
        }
    }
</script>

{#if !loaded}
<h2 class="page-heading">Create your profile</h2>
<p class="lead-sub">Loading…</p>
{:else}
<div class="page-reveal" in:fly={{ y: 24, duration: 550, easing: cubicOut }}>

<h2 class="page-heading">Create your profile</h2>

{#if !auth.authenticated}
    <div class="empty-state">
        You need to be signed in. <a href="/">Go back home</a> and click Sign in with Discord.
    </div>
{:else if alreadyLinked}
    <div class="empty-state">
        Your Discord account is already linked to <strong>{auth.player?.name}</strong>.
        <a href="/">Go home</a>
    </div>
{:else}
    <p class="lead">
        Welcome, <strong>{auth.user?.discord_name}</strong>{#if auth.active_club} to
        <strong>{auth.active_club.name}</strong>{/if}.
        Create your player profile below to sign up for sessions and submit league results.
    </p>

    <section class="new-player-section">
        <div class="field">
            <label class="field-label" for="new-name">Your name</label>
            <input
                id="new-name"
                class="field-input"
                type="text"
                placeholder="How you'd like to appear on the roster"
                bind:value={newName}
            />
        </div>

        <div class="privacy-notice">
            <p>
                Your name will be stored in our club database and shown to other
                members on the signup sheets and league standings. Your Discord username is
                linked to your profile so you can manage your own signups. We don't share
                your information with third parties.
            </p>
        </div>

        <label class="consent-label">
            <input type="checkbox" bind:checked={consentChecked} />
            I understand and agree to the above
        </label>

        {#if newErrorMsg}
            <div class="error">{newErrorMsg}</div>
        {/if}

        <div class="actions">
            <button
                class="confirm-button"
                onclick={createProfile}
                disabled={!newName.trim() || !consentChecked || newSubmitting}
                type="button"
            >
                {newSubmitting ? 'Creating…' : 'Create my profile'}
            </button>
        </div>
    </section>
{/if}

</div>
{/if}

<style>
    .page-heading { font-size: 1.5rem; margin: 0 0 0.75rem; }
    .lead { color: var(--color-text-base); margin: 0 0 0.4rem; line-height: 1.5; }
    .lead-sub { color: var(--color-text-dim); font-size: 0.88rem; font-style: italic; margin: 0 0 1.25rem; }
    .error {
        background: rgba(210, 80, 80, 0.12);
        border: 1px solid rgba(210, 80, 80, 0.5);
        color: var(--color-text-bright);
        padding: 0.7rem 1rem;
        border-radius: var(--radius);
        margin: 0.75rem 0 0;
        font-size: 0.9rem;
    }
    .actions { margin-top: 1rem; }
    .confirm-button {
        background: var(--color-accent);
        border: 1px solid var(--color-accent);
        color: #1b1206;
        padding: 0.7rem 1.25rem;
        border-radius: var(--radius);
        font-size: 0.95rem;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.1s ease, border-color 0.1s ease;
    }
    .confirm-button:hover:not(:disabled) {
        background: var(--color-accent-soft);
        box-shadow: 0 4px 16px var(--color-accent-glow);
    }
    .confirm-button:disabled { opacity: 0.5; cursor: not-allowed; }

    .privacy-notice {
        background: rgba(201, 161, 74, 0.06);
        border: 1px solid var(--color-accent-border-soft);
        border-radius: var(--radius);
        padding: 0.75rem 1rem;
        margin: 0.75rem 0 0.75rem;
        font-size: 0.85rem;
        color: var(--color-text-dim);
        line-height: 1.5;
    }
    .privacy-notice p { margin: 0; }
    .consent-label {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.9rem;
        color: var(--color-text-base);
        cursor: pointer;
        user-select: none;
    }
    .consent-label input[type='checkbox'] { accent-color: var(--color-accent); width: 1rem; height: 1rem; cursor: pointer; }

    .field { margin-bottom: 0.75rem; }
    .field-label { display: block; font-size: 0.85rem; color: var(--color-text-dim); margin-bottom: 0.3rem; }
    .field-input {
        width: 100%;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-accent-border-soft);
        border-radius: var(--radius);
        padding: 0.55rem 0.75rem;
        color: var(--color-text-bright);
        font-family: inherit;
        font-size: 0.95rem;
        box-sizing: border-box;
    }
    .field-input::placeholder { color: var(--color-text-dim); }
    .field-input:focus { outline: none; border-color: var(--color-accent); }
</style>
