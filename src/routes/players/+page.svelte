<script lang="ts">
    let { data } = $props();

    let query = $state('');

    const filtered = $derived(
        data.players.filter((p: { name: string }) =>
            p.name.toLowerCase().includes(query.toLowerCase())
        )
    );
</script>

<h2 class="page-heading">Player Profiles</h2>

<div class="field">
    <label class="field-label" for="filter">Filter players</label>
    <input
        id="filter"
        class="field-input"
        type="text"
        placeholder="Type a name…"
        bind:value={query}
    />
</div>

<ul class="player-list">
    {#each filtered as player}
        <li class="player-row">
            <a href="/players/{player.id}" class="player-link">
                <span class="player-name">{player.name}</span>
                {#if player.default_faction}
                    <span class="player-faction">— {player.default_faction}</span>
                {/if}
            </a>
        </li>
    {/each}
    {#if filtered.length === 0}
        <li class="empty">No players match.</li>
    {/if}
</ul>

<style>
    .page-heading {
        font-size: 1.5rem;
        margin: 0 0 1rem;
    }

    .player-list {
        list-style: none;
        padding: 0;
        margin: 1rem 0 0;
        background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-dark) 100%);
        border: 1px solid var(--color-accent-border);
        border-radius: 12px;
        overflow: hidden;
    }

    .player-row {
        border-bottom: 1px dashed var(--color-accent-border-soft);
    }

    .player-row:last-child {
        border-bottom: none;
    }

    .player-link {
        display: block;
        padding: 0.7rem 1rem;
        color: var(--color-text-bright);
        text-decoration: none;
        font-weight: 500;
        transition: background 0.1s ease;
    }

    .player-link:hover {
        background: var(--color-surface-hover);
    }

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
</style>