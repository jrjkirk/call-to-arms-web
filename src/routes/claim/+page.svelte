<script lang="ts">
    import { onMount } from 'svelte';
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { goto } from '$app/navigation';
    import { PUBLIC_API_URL } from '$env/static/public';

    type AuthState = {
        authenticated: boolean;
        user?: { id: number; discord_name: string; player_id: number | null };
        player?: { name: string } | null;
        claim_candidates?: Array<{ id: number; name: string; default_faction: string | null }>;
    };

    let auth = $state<AuthState>({ authenticated: false });
    let loaded = $state(false);
    let query = $state('');
    let selectedId = $state<number | null>(null);
    let submitting = $state(false);
    let errorMsg = $state<string | null>(null);

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

    const candidates = $derived(auth.claim_candidates ?? []);
    const alreadyLinked = $derived(auth.user?.player_id != null);
    const filtered = $derived(
        candidates.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    );

    async function claim() {
        if (selectedId == null || submitting) return;
        submitting = true;
        errorMsg = null;
        try {
            const response = await fetch(`${PUBLIC_API_URL}/auth/claim/${selectedId}`, {
                method: 'POST',
                credentials: 'include'
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                errorMsg = body.detail || 'Could not claim that profile.';
                submitting = false;
                return;
            }
            // Trigger the layout to refresh its auth state so the sidebar updates,
            // then navigate home.
            const refresh = (window as any).__refreshAuth;
            if (typeof refresh === 'function') await refresh();
            goto('/');
        } catch (_) {
            errorMsg = 'Network error. Please try again.';
            submitting = false;
        }
    }

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
            goto('/');
        } catch (_) {
            newErrorMsg = 'Network error. Please try again.';
            newSubmitting = false;
        }
    }
</script>

{#if !loaded}
<h2 class="page-heading">Link your player profile</h2>
<p class="lead-sub">Loading…</p>
{:else}
<div class="page-reveal" in:fly={{ y: 24, duration: 550, easing: cubicOut }}>

<h2 class="page-heading">Link your player profile</h2>

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
        Welcome, <strong>{auth.user?.discord_name}</strong>.
        Pick your existing player profile from the list below so your previous signups,
        games, and rankings are linked to your Discord account.
    </p>
    <p class="lead-sub">
        Once linked, you'll be able to sign up for sessions and submit league results.
    </p>

    <div class="field">
        <label class="field-label" for="filter">Filter players</label>
        <input
            id="filter"
            class="field-input"
            type="text"
            placeholder="Type your name…"
            bind:value={query}
        />
    </div>

    <ul class="player-list">
        {#each filtered as c}
            <li class="player-row" class:selected={selectedId === c.id}>
                <button class="player-link" onclick={() => (selectedId = c.id)} type="button">
                    <span class="player-name">{c.name}</span>
                    {#if c.default_faction}
                        <span class="player-faction">— {c.default_faction}</span>
                    {/if}
                </button>
            </li>
        {/each}
        {#if filtered.length === 0}
            <li class="empty">No players match.</li>
        {/if}
    </ul>

    {#if errorMsg}
        <div class="error">{errorMsg}</div>
    {/if}

    <div class="actions">
        <button
            class="confirm-button"
            onclick={claim}
            disabled={selectedId == null || submitting}
            type="button"
        >
            {#if submitting}
                Linking…
            {:else if selectedId == null}
                Pick a player above
            {:else}
                {@const picked = candidates.find((c) => c.id === selectedId)}
                Confirm: I am {picked?.name}
            {/if}
        </button>
    </div>

    <div class="divider"></div>

    <section class="new-player-section">
        <h3 class="new-player-heading">New to the club?</h3>
        <p class="lead-sub">
            If you've never played with us before, create a fresh profile here.
        </p>

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
    .player-faction {
        color: var(--color-text-dim);
        font-style: italic;
        font-weight: 400;
        font-size: 0.9em;
        margin-left: 0.4rem;
    }
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

    .divider {
        border: none;
        border-top: 1px solid var(--color-accent-border-soft);
        margin: 2rem 0 1.5rem;
    }
    .new-player-section { }
    .new-player-heading {
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--color-text-bright);
        margin: 0 0 0.25rem;
    }
    .optional { font-weight: 400; color: var(--color-text-dim); font-size: 0.85em; }
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
