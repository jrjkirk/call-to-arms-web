<script lang="ts">
    import { goto } from '$app/navigation';
    import { PUBLIC_API_URL } from '$env/static/public';
    import { invalidateAll } from '$app/navigation';

    let { data } = $props();

    const auth = $derived(data.auth);
    const candidates = $derived(auth?.claim_candidates ?? []);
    const alreadyLinked = $derived(auth?.user?.player_id != null);

    let query = $state('');
    let selectedId = $state<number | null>(null);
    let submitting = $state(false);
    let errorMsg = $state<string | null>(null);

    const filtered = $derived(
        candidates.filter((c: { name: string }) =>
            c.name.toLowerCase().includes(query.toLowerCase())
        )
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
            // Re-fetch the layout's auth data so the banner disappears and the
            // sidebar shows the linked player.
            await invalidateAll();
            goto('/');
        } catch (e) {
            errorMsg = 'Network error. Please try again.';
            submitting = false;
        }
    }
</script>

<h2 class="page-heading">Link your player profile</h2>

{#if !auth?.authenticated}
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
        Welcome, <strong>{auth.user.discord_name}</strong>.
        Pick your existing player profile from the list below so your previous signups,
        games, and rankings are linked to your Discord account.
    </p>
    <p class="lead-sub">
        Can only see your own profile? That's fine — once linked, you'll be able to
        sign up for sessions and submit league results.
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
                {@const picked = candidates.find((c: any) => c.id === selectedId)}
                Confirm: I am {picked?.name}
            {/if}
        </button>
    </div>
{/if}

<style>
    .page-heading { font-size: 1.5rem; margin: 0 0 0.75rem; }

    .lead {
        color: var(--color-text-base);
        margin: 0 0 0.4rem;
        line-height: 1.5;
    }

    .lead-sub {
        color: var(--color-text-dim);
        font-size: 0.88rem;
        font-style: italic;
        margin: 0 0 1.25rem;
    }

    .player-list {
        list-style: none;
        padding: 0;
        margin: 0.5rem 0;
        max-height: 360px;
        overflow-y: auto;
        background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-dark) 100%);
        border: 1px solid var(--color-accent-border);
        border-radius: 12px;
    }

    .player-row {
        border-bottom: 1px dashed var(--color-accent-border-soft);
    }

    .player-row:last-child {
        border-bottom: none;
    }

    .player-row.selected {
        background: rgba(201, 161, 74, 0.15);
    }

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

    .empty {
        padding: 1rem;
        color: var(--color-text-dim);
        font-style: italic;
        text-align: center;
    }

    .error {
        background: rgba(210, 80, 80, 0.12);
        border: 1px solid rgba(210, 80, 80, 0.5);
        color: var(--color-text-bright);
        padding: 0.7rem 1rem;
        border-radius: 10px;
        margin: 0.75rem 0 0;
        font-size: 0.9rem;
    }

    .actions {
        margin-top: 1rem;
    }

    .confirm-button {
        background: rgba(201, 161, 74, 0.18);
        border: 1px solid rgba(201, 161, 74, 0.55);
        color: var(--color-text-bright);
        padding: 0.7rem 1.25rem;
        border-radius: 10px;
        font-size: 0.95rem;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.1s ease, border-color 0.1s ease;
    }

    .confirm-button:hover:not(:disabled) {
        background: rgba(201, 161, 74, 0.30);
        border-color: var(--color-accent);
    }

    .confirm-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>