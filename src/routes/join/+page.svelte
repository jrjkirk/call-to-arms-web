<script lang="ts">
    import { onMount } from 'svelte';
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { loginHref, loginHrefTo } from '$lib/loginUrl';
    import { signInProviders } from '$lib/signInProviders';
    import { PUBLIC_API_URL } from '$env/static/public';

    type Club = { id: number; name: string; slug: string };

    let clubs = $state<Club[]>([]);
    let loaded = $state(false);
    let loadError = $state<string | null>(null);
    let selectedId = $state<number | null>(null);
    let submitting = $state(false);
    let errorMsg = $state<string | null>(null);
    let sessionExpired = $state(false);

    async function loadClubs() {
        try {
            const response = await fetch(`${PUBLIC_API_URL}/clubs`);
            if (!response.ok) {
                loadError = 'Could not load the list of clubs. Please try again.';
            } else {
                clubs = await response.json();
            }
        } catch (_) {
            loadError = 'Network error loading clubs. Please try again.';
        }
        loaded = true;
    }

    /** How this half-finished sign-up arrived. Anyone here through Google, an
     *  email link or a password is warned before an account exists: a club
     *  regular should sign in with Discord and add the new method from their
     *  account page, or they end up with a second, empty account and their
     *  games, level and league record left on the first one. The email-match
     *  offer can't catch them, because no Discord emails are held. */
    let pendingProvider = $state<string | null>(null);
    const PROVIDER_LABELS: Record<string, string> = { google: 'Google', email: 'email', password: 'a password' };
    const arrivedLabel = $derived(pendingProvider ? (PROVIDER_LABELS[pendingProvider] ?? pendingProvider) : null);
    let dismissedWarning = $state(false);

    onMount(() => {
        loadClubs();
        loadPending();
    });

    async function loadPending() {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/pending`, { credentials: 'include' });
            if (r.ok) {
                const d = await r.json();
                if (d.pending && d.provider && d.provider !== 'discord') pendingProvider = d.provider;
            }
        } catch (_) {
            /* the picker still works without the warning */
        }
    }

    // The page the player was originally trying to reach, handed over by
    // /auth/discord/callback. Onboarding is three hops — join, claim, then
    // wherever they wanted — and each one has to pass this along or a player
    // who followed a "sign up for Thursday" link finishes on the front page
    // wondering what happened.
    const nextPath = $derived(page.url.searchParams.get('next'));

    function loginUrl(): string {
        // Signing in again from here must not lose the destination either.
        return nextPath ? loginHrefTo(nextPath) : loginHref(null);
    }

    async function completeSignup() {
        if (selectedId == null || submitting) return;
        submitting = true;
        errorMsg = null;
        sessionExpired = false;
        try {
            const response = await fetch(`${PUBLIC_API_URL}/auth/complete-signup`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ club_id: selectedId })
            });
            if (response.status === 400) {
                sessionExpired = true;
                submitting = false;
                return;
            }
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                errorMsg = body.detail || 'Could not complete signup with that club. Please pick again.';
                selectedId = null;
                submitting = false;
                return;
            }
            const refresh = (window as any).__refreshAuth;
            if (typeof refresh === 'function') await refresh();
            goto(nextPath ? `/claim?next=${encodeURIComponent(nextPath)}` : '/claim');
        } catch (_) {
            errorMsg = 'Network error. Please try again.';
            submitting = false;
        }
    }
</script>

{#if !loaded}
<h2 class="page-heading">Which club are you joining?</h2>
<p class="lead-sub">Loading…</p>
{:else}
<div class="page-reveal" in:fly={{ y: 24, duration: 550, easing: cubicOut }}>

<h2 class="page-heading">Which club are you joining?</h2>

{#if sessionExpired}
    <div class="empty-state">
        Your signup session has expired.
        {#if $signInProviders.length > 1}
            <a href={`/signin?next=${encodeURIComponent(nextPath ?? '/')}`}>Sign in again</a> to restart.
        {:else}
            <a href={loginUrl()}>Sign in with Discord again</a> to restart.
        {/if}
    </div>
{:else if loadError}
    <div class="empty-state">{loadError}</div>
{:else}
    {#if pendingProvider && !dismissedWarning && !page.url.searchParams.get('existing_account')}
        <div class="existing-account">
            <strong>Already play at a club that uses this?</strong>
            Sign in the way you normally do, then add {arrivedLabel} from your account page.
            Carrying on here makes a second account, and your games, level and league record
            stay on the first one.
            <div class="join-warning-actions">
                <a class="primary-button" href="/signin?next=%2Faccount">Sign in the usual way</a>
                <button class="secondary-button" type="button" onclick={() => (dismissedWarning = true)}>
                    I'm new here
                </button>
            </div>
        </div>
    {/if}
    {#if page.url.searchParams.get('existing_account')}
        <!-- Decision C (API ACCOUNT_OVERHAUL.md §8): the email this sign-in
             came with is already verified on an account. Nothing was joined;
             this is the offer to use that account instead of a second one. -->
        <div class="existing-account">
            <strong>You may already have an account.</strong>
            That email is on an existing Call to Arms account. If it's yours,
            <a href="/signin?next=%2Faccount">sign in the way you usually do</a> and add this from your account page instead.
            Otherwise, carry on below.
        </div>
    {/if}
    <p class="lead">
        You're almost signed up. Pick your club below to continue.
    </p>
    <p class="lead-sub">
        Once you've chosen, you'll be able to link or create your player profile.
    </p>

    <ul class="player-list">
        {#each clubs as c}
            <li class="player-row" class:selected={selectedId === c.id}>
                <button class="player-link" onclick={() => (selectedId = c.id)} type="button">
                    <span class="player-name">{c.name}</span>
                </button>
            </li>
        {/each}
        {#if clubs.length === 0}
            <li class="empty">No clubs available.</li>
        {/if}
    </ul>

    {#if errorMsg}
        <div class="error">{errorMsg}</div>
    {/if}

    <div class="actions">
        <button
            class="confirm-button"
            onclick={completeSignup}
            disabled={selectedId == null || submitting}
            type="button"
        >
            {#if submitting}
                Continuing…
            {:else if selectedId == null}
                Pick a club above
            {:else}
                {@const picked = clubs.find((c) => c.id === selectedId)}
                Continue with {picked?.name}
            {/if}
        </button>
    </div>
{/if}

</div>
{/if}

<style>
    .page-heading { font-size: 1.5rem; margin: 0 0 0.75rem; }
    .lead { color: var(--color-text-base); margin: 0 0 0.4rem; line-height: 1.5; }
    .lead-sub { color: var(--color-text-dim); font-size: 0.88rem; font-style: italic; margin: 0 0 1.25rem; }
    .player-list {
        list-style: none;
        padding: 0;
        margin: 0.5rem 0;
        max-height: 360px;
        overflow-y: auto;
        background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-dark) 100%);
        border: 1px solid var(--color-accent-border);
        border-radius: var(--radius);
    }
    .player-row { border-bottom: 1px dashed var(--color-accent-border-soft); }
    .player-row:last-child { border-bottom: none; }
    .player-row.selected { background: rgba(201, 161, 74, 0.15); }
    .player-link {
        display: block;
        width: 100%;
        text-align: left;
        padding: 0.7rem 1rem;
        color: var(--color-text-bright);
        background: none;
        border: none;
        font-family: inherit;
        font-size: 0.95rem;
        cursor: pointer;
    }
    .player-link:hover { background: var(--color-surface-hover); }
    .empty { padding: 1rem; color: var(--color-text-dim); font-style: italic; text-align: center; }
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
    .existing-account {
        border: 1px solid var(--color-accent-border);
        border-left: 3px solid var(--color-accent);
        border-radius: var(--radius);
        background: var(--color-surface-dark);
        padding: 0.8rem 1rem;
        margin: 0 0 1rem;
        color: var(--color-text-base);
        line-height: 1.5;
    }
    /* Not the action button: it is gold already, and colouring its label gold
       too made it read as an empty gold rectangle. */
    .existing-account a:not(.primary-button) { color: var(--color-accent); }
    .join-warning-actions {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
        margin-top: 0.8rem;
    }
</style>
