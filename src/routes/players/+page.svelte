<script lang="ts">
    import PageSkeleton from '$lib/PageSkeleton.svelte';
    import FactionIcon from '$lib/FactionIcon.svelte';
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import { fetchMySystems } from '$lib/mySystems';
    import { getMe } from '$lib/session';
    import { SYSTEMS as ALL_SYSTEMS } from '$lib/signupOptions';
    import { getSystemsConfig, systemLogoUrl, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from '$lib/systemsConfig';
    import { systemFolder } from '$lib/factions';
    import { getClubSlugFromHostname } from '$lib/clubSlug';

    type PlayerRow = {
        id: number;
        name: string;
        default_faction: string | null;
        systems_played?: string[];
        /** ISO date of the last session they came to, or null. */
        last_played?: string | null;
        /** Their most-played (system, faction), for the icon. */
        usual_system?: string | null;
        usual_faction?: string | null;
        /** Their most-played faction in each system they've played. */
        faction_by_system?: Record<string, string>;
    };

    let players = $state<PlayerRow[]>([]);
    let myId = $state<number | null>(null);
    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);

    // The caller's own club's enabled systems, so the filter only offers what
    // this club runs. Null falls back to every system.
    let mySystems = $state<string[] | null>(null);
    let systemsResolved = $state(false);

    onMount(async () => {
        getSystemsConfig(getClubSlugFromHostname(window.location.hostname)).then((c) => (systemsConfig = c));
        const [list, me, systems] = await Promise.all([
            fetch(`${PUBLIC_API_URL}/players`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
            getMe(),
            fetchMySystems()
        ]);
        players = list;
        myId = me?.player?.id ?? null;
        mySystems = systems;
        systemsResolved = true;
    });

    let query = $state('');
    /** One system, or null for everyone. */
    let activeSystem = $state<string | null>(null);

    const SYSTEMS = $derived(mySystems ?? ALL_SYSTEMS);

    // Everyone, straight away: most recently played first, then by name. The
    // old page showed nobody until a system was picked, which made a list of
    // the club's players look empty.
    const filtered = $derived(
        players
            .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
            .filter((p) => !activeSystem || (p.systems_played ?? []).includes(activeSystem))
            .sort((a, b) =>
                (b.last_played ?? '').localeCompare(a.last_played ?? '') || a.name.localeCompare(b.name)
            )
    );

    const PAGE_SIZE = 30;
    let page = $state(1);
    const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
    const pageItems = $derived(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
    $effect(() => {
        query;
        activeSystem;
        page = 1;
    });

    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /** "Played Wed", "2 weeks ago", "Played in Mar". */
    function playedLabel(iso: string | null | undefined): string {
        if (!iso) return 'Not played yet';
        const [y, m, d] = iso.split('-').map(Number);
        const when = new Date(y, m - 1, d);
        const now = new Date();
        const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - when.getTime()) / 86400000);
        if (days <= 0) return 'Played today';
        if (days < 7) return `Played ${DAYS[when.getDay()]}`;
        if (days < 28) return `${Math.floor(days / 7)} ${days < 14 ? 'week' : 'weeks'} ago`;
        return when.getFullYear() === now.getFullYear()
            ? `Played in ${MONTHS[when.getMonth()]}`
            : `Played ${MONTHS[when.getMonth()]} ${when.getFullYear()}`;
    }

    let brokenLogos = $state<Record<string, boolean>>({});
</script>

{#if systemsResolved}
<div class="page-reveal">

<h1 class="page-title">Players</h1>

<label class="search">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
    <span class="sr-only">Find a player</span>
    <input type="search" placeholder="Find a player" bind:value={query} />
</label>

<div class="filters" role="group" aria-label="System">
    <button type="button" class="filter" aria-pressed={activeSystem === null} onclick={() => (activeSystem = null)}>
        <span class="filter-all">All</span>
    </button>
    {#each SYSTEMS as s (s)}
        {@const logo = systemLogoUrl(s, systemsConfig)}
        <button type="button" class="filter" aria-pressed={activeSystem === s} title={s}
                onclick={() => (activeSystem = activeSystem === s ? null : s)}>
            {#if logo && !brokenLogos[s]}
                <img src={logo} alt={s} onerror={() => (brokenLogos = { ...brokenLogos, [s]: true })} />
            {:else}
                <span class="filter-name">{s}</span>
            {/if}
        </button>
    {/each}
</div>

<div class="list-head">
    <h2 class="section-title">{activeSystem ?? 'Everyone'}</h2>
    <span class="list-count">{filtered.length} {filtered.length === 1 ? 'player' : 'players'} · most recent first</span>
</div>

<ul class="player-list">
    {#each pageItems as p (p.id)}
        <!-- A faction only means something within one system, so it shows
             only once one is picked, and it's their faction in that system. -->
        {@const faction = activeSystem ? (p.faction_by_system?.[activeSystem] ?? null) : null}
        <li>
            <a href="/players/{p.id}" class="player" class:me={p.id === myId}>
                {#if activeSystem}
                    <span class="icon">
                        {#if faction}
                            <FactionIcon {faction} folder={systemFolder(activeSystem, systemsConfig)} class="player-icon" />
                        {/if}
                    </span>
                {/if}
                <span class="who">
                    <span class="name">{p.name}{#if p.id === myId}<small>You</small>{/if}</span>
                    {#if activeSystem}<span class="faction">{faction ?? 'No faction yet'}</span>{/if}
                </span>
                <span class="meta">
                    <span class="logos">
                        {#each (p.systems_played ?? []).slice(0, 3) as s}
                            {@const logo = systemLogoUrl(s, systemsConfig)}
                            {#if logo && !brokenLogos[s]}<img src={logo} alt={s} title={s} />{/if}
                        {/each}
                    </span>
                    <span class="played">{playedLabel(p.last_played)}</span>
                </span>
            </a>
        </li>
    {/each}
    {#if filtered.length === 0}
        <li class="empty">No players match.</li>
    {/if}
</ul>

{#if filtered.length > PAGE_SIZE}
    <div class="pager">
        <button class="pager-btn" type="button" disabled={page <= 1} onclick={() => (page = Math.max(1, page - 1))}>← Prev</button>
        <span class="pager-info">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
        </span>
        <button class="pager-btn" type="button" disabled={page >= totalPages} onclick={() => (page = Math.min(totalPages, page + 1))}>Next →</button>
    </div>
{/if}

</div>
{:else}
    <PageSkeleton title="Players" />
{/if}

<style>
    .page-title {
        font-size: 2.4rem;
        font-weight: 700;
        line-height: 1;
        text-transform: uppercase;
        margin: 0 0 1rem;
    }

    .search {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 46px;
        padding: 0 14px;
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 6px;
        color: var(--color-text-faint);
    }

    .search:focus-within { border-color: var(--color-accent-border); }

    .search input {
        flex: 1;
        min-width: 0;
        background: none;
        border: none;
        outline: none;
        color: var(--color-text-bright);
        font: inherit;
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
    }

    .filters {
        margin-top: 10px;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 6px;
    }

    .filter {
        height: 46px;
        padding: 0 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #12141c;
        border: 1px solid #232733;
        border-radius: 5px;
        color: var(--color-text-muted);
        font: inherit;
        cursor: pointer;
    }

    .filter:hover { border-color: var(--color-accent-border); }

    .filter[aria-pressed='true'] {
        border-color: var(--color-accent);
        background: rgba(201, 161, 74, 0.12);
    }

    .filter img { width: 100%; height: 20px; object-fit: contain; }

    .filter-all {
        font-family: var(--font-heading);
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-text-bright);
    }

    .filter-name { font-size: 0.72rem; font-weight: 600; line-height: 1.1; text-align: center; }

    .list-head {
        margin: 1.25rem 0 0.6rem;
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
    }

    .list-head .section-title { margin: 0; }
    .list-count { font-size: 0.85rem; color: var(--color-text-dim); }

    .player-list {
        list-style: none;
        margin: 0;
        padding: 0;
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 6px;
        overflow: hidden;
    }

    .player-list li + li { border-top: 1px solid #1c2029; }

    .player {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 11px 16px;
        color: inherit;
        text-decoration: none;
        transition: background 0.1s ease;
    }

    .player:hover { background: rgba(201, 161, 74, 0.05); }
    .player.me { background: rgba(201, 161, 74, 0.08); }

    .icon { width: 38px; height: 38px; flex: none; }
    .icon :global(.player-icon) { width: 38px; height: 38px; }

    .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }

    .name { font-weight: 600; color: var(--color-text-bright); }
    .player.me .name { color: var(--color-accent-bright); }

    .name small {
        margin-left: 6px;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-accent);
    }

    .faction {
        font-size: 0.85rem;
        color: var(--color-text-dim);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .meta { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .logos { display: flex; gap: 6px; }
    .logos img { height: 15px; width: 48px; object-fit: contain; object-position: right center; }
    .played { font-size: 0.75rem; color: var(--color-text-faint); }

    .empty {
        padding: 1rem;
        color: var(--color-text-dim);
        font-style: italic;
        text-align: center;
    }

    @media (max-width: 560px) {
        .page-title { font-size: 2.1rem; }
        .filters { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .filter img { height: 16px; }
        .player { padding: 10px 12px; gap: 10px; }
        .logos img { width: 40px; height: 13px; }
    }
</style>
