<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';

    type PlayerRow = { id: number; name: string; default_faction: string | null; systems_played?: string[] };

    let players = $state<PlayerRow[]>([]);

    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/players`, { credentials: 'include' });
            if (r.ok) players = await r.json();
        } catch (_) {}
    });

    let query = $state('');
    let activeSystems = $state<string[]>([]);

    const SYSTEM_LOGOS: Record<string, string> = {
        'The Old World': '/logos/tow.png',
        'The Horus Heresy': '/logos/hh.png',
        'Kill Team': '/logos/kt.png'
    };

    const SYSTEMS = ['The Old World', 'The Horus Heresy', 'Kill Team'];

    function toggleSystem(s: string) {
        if (activeSystems.includes(s)) {
            activeSystems = activeSystems.filter((x) => x !== s);
        } else {
            activeSystems = [...activeSystems, s];
        }
    }

    const filtered = $derived(
        activeSystems.length === 0 && query.trim() === ''
            ? []
            : players.filter((p: PlayerRow) => {
                  const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase());
                  const matchesSystem =
                      activeSystems.length === 0 ||
                      (p.systems_played ?? []).some((s) => activeSystems.includes(s));
                  return matchesQuery && matchesSystem;
              })
    );
</script>

<h2 class="page-heading">Player Profiles</h2>

<div class="system-grid">
    {#each SYSTEMS as s}
        <button
            type="button"
            class="system-card"
            class:active={activeSystems.includes(s)}
            onclick={() => toggleSystem(s)}
        >
            <img src={SYSTEM_LOGOS[s]} alt={s} />
        </button>
    {/each}
</div>

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
    {#if activeSystems.length === 0 && query.trim() === ''}
        <li class="empty">Select a system or search for a player.</li>
    {:else if filtered.length === 0}
        <li class="empty">No players match.</li>
    {/if}
</ul>

<style>
    .page-heading {
        font-size: 1.5rem;
        margin: 0 0 1rem;
    }

    .system-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .system-card {
        background: var(--color-sidebar-bg);
        border: 2px solid transparent;
        border-radius: 10px;
        padding: 0.75rem 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: border-color 0.15s ease, transform 0.08s ease;
    }

    .system-card:hover {
        border-color: var(--color-accent-border-soft);
    }

    .system-card:active {
        transform: scale(0.98);
    }

    .system-card.active {
        border-color: var(--color-accent);
    }

    .system-card img {
        max-width: 100%;
        max-height: 60px;
        object-fit: contain;
    }

    .field {
        margin-bottom: 1rem;
    }

    .player-list {
        list-style: none;
        padding: 0;
        margin: 1rem 0 0;
        background: var(--color-sidebar-bg);
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