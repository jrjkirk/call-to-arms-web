<script lang="ts">
    import { onMount } from 'svelte';
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { PUBLIC_API_URL } from '$env/static/public';
    import { fetchMySystems } from '$lib/mySystems';
    import { SYSTEMS as ALL_SYSTEMS } from '$lib/signupOptions';
    import SystemPicker from '$lib/SystemPicker.svelte';

    type PlayerRow = { id: number; name: string; default_faction: string | null; systems_played?: string[] };

    let players = $state<PlayerRow[]>([]);

    // The caller's own club's enabled systems (GET /systems/mine,
    // authenticated). null until resolved or if the call fails — falls back to
    // the full ALL_SYSTEMS list. Scopes the system-filter buttons to the club,
    // matching the homepage and pairings tabs; without this the buttons showed
    // every system regardless of club (e.g. a Kill-Team-only club still saw
    // Old World / Horus Heresy buttons).
    let mySystems = $state<string[] | null>(null);
    // Gates the system-filter row so it renders once, already scoped to the
    // club's systems — never flashing the full list before /systems/mine
    // resolves.
    let systemsResolved = $state(false);

    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/players`, { credentials: 'include' });
            if (r.ok) players = await r.json();
        } catch (_) {}
        mySystems = await fetchMySystems();
        systemsResolved = true;
    });

    let query = $state('');
    let activeSystems = $state<string[]>([]);


    const SYSTEMS = $derived(mySystems ?? ALL_SYSTEMS);

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

{#if systemsResolved}
<div class="page-reveal" in:fly={{ y: 24, duration: 550, easing: cubicOut }}>

<h2 class="page-heading">Player Profiles</h2>

<SystemPicker
    systems={SYSTEMS}
    isActive={(s) => activeSystems.includes(s)}
    onSelect={toggleSystem}
/>

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
    {#each filtered as player, i}
        <li class="player-row" in:fly={{ y: 12, duration: 350, delay: Math.min(i, 8) * 45 }}>
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

</div>
{/if}

<style>
    .page-heading {
        font-size: 1.5rem;
        margin: 0 0 1rem;
    }

    .field {
        margin-bottom: 1rem;
    }

    .player-list {
        list-style: none;
        padding: 0;
        margin: 1rem 0 0;
        background: var(--color-surface);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        overflow: hidden;
    }

    .player-row {
        border-bottom: 1px solid var(--color-steel-border-soft);
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