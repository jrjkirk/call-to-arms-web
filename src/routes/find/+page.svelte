<script lang="ts">
    import { onMount } from 'svelte';
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { PUBLIC_API_URL } from '$env/static/public';
    import ClubFinderMap from '$lib/ClubFinderMap.svelte';
    import ClubRequestForm from '$lib/ClubRequestForm.svelte';

    type FinderSystem = { slug: string; name: string; legacy_system_name: string };
    type FinderClub = {
        id: number;
        name: string;
        slug: string;
        address: string | null;
        latitude: number | null;
        longitude: number | null;
        region: string | null;
        systems: FinderSystem[];
    };

    let clubs = $state<FinderClub[]>([]);
    let loaded = $state(false);
    let search = $state('');
    // Selected systems (by legacy_system_name). Empty = no system filter.
    let selected = $state<Set<string>>(new Set());
    let userLoc = $state<{ lat: number; lng: number } | null>(null);
    let geoBusy = $state(false);
    let geoError = $state<string | null>(null);

    function useMyLocation() {
        if (!navigator.geolocation) {
            geoError = "Location isn't available in this browser.";
            return;
        }
        geoBusy = true;
        geoError = null;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                geoBusy = false;
            },
            () => {
                geoError = "Couldn't get your location — check the browser permission.";
                geoBusy = false;
            },
            { timeout: 10000, maximumAge: 60000 }
        );
    }

    function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 3958.8;
        const toRad = (d: number) => (d * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function distanceMi(c: FinderClub): number | null {
        if (!userLoc || c.latitude == null || c.longitude == null) return null;
        return haversineMi(userLoc.lat, userLoc.lng, c.latitude, c.longitude);
    }

    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/clubs`);
            if (r.ok) clubs = await r.json();
        } catch (_) {}
        loaded = true;
    });

    // The union of systems any club runs — only offer a filter chip for a
    // system that at least one club actually plays.
    const allSystems = $derived.by(() => {
        const map = new Map<string, FinderSystem>();
        for (const c of clubs) for (const s of c.systems) map.set(s.legacy_system_name, s);
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    });

    function toggleSystem(name: string) {
        const next = new Set(selected);
        next.has(name) ? next.delete(name) : next.add(name);
        selected = next;
    }

    const filtered = $derived.by(() => {
        const q = search.trim().toLowerCase();
        return clubs.filter((c) => {
            // System filter: club runs at least one of the selected systems.
            if (selected.size > 0) {
                const has = c.systems.some((s) => selected.has(s.legacy_system_name));
                if (!has) return false;
            }
            if (q) {
                const hay = `${c.name} ${c.address ?? ''} ${c.region ?? ''}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    });

    // Once we have the visitor's location, put the nearest clubs first (clubs
    // without coordinates sink to the bottom).
    const sorted = $derived.by(() => {
        if (!userLoc) return filtered;
        return [...filtered].sort((a, b) => {
            const da = distanceMi(a);
            const db = distanceMi(b);
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return da - db;
        });
    });

    function clubUrl(slug: string): string {
        return `https://${slug}.calltoarms.app`;
    }
</script>

<svelte:head>
    <title>Find a club — Call to Arms</title>
    <meta name="description" content="Find a wargaming club near you — search by location and filter by the systems you play." />
</svelte:head>

{#if !loaded}
    <div class="loading-state"></div>
{:else}
    <div class="page-reveal" in:fly={{ y: 24, duration: 550, easing: cubicOut }}>
        <a class="back-home" href="/">← Home</a>
        <header class="finder-head">
            <h1 class="finder-title">Find a club</h1>
            <p class="finder-sub">
                Search for a wargaming club near you and filter by the systems you play. Not
                listed? <a href="#add-club">Get your club added</a>.
            </p>
        </header>

        <div class="finder-controls">
            <div class="finder-row">
                <input
                    class="finder-search"
                    type="search"
                    placeholder="Search by club name or town…"
                    bind:value={search}
                />
                <button class="loc-btn" type="button" onclick={useMyLocation} disabled={geoBusy} class:on={userLoc != null}>
                    {geoBusy ? 'Locating…' : userLoc ? '✓ Sorted by distance' : '📍 Use my location'}
                </button>
            </div>
            {#if geoError}<p class="geo-error">{geoError}</p>{/if}
            {#if allSystems.length > 0}
                <div class="system-chips" role="group" aria-label="Filter by system">
                    {#each allSystems as s}
                        <button
                            type="button"
                            class="chip"
                            class:on={selected.has(s.legacy_system_name)}
                            aria-pressed={selected.has(s.legacy_system_name)}
                            title={s.name}
                            onclick={() => toggleSystem(s.legacy_system_name)}
                        >
                            <img class="chip-icon" src={`/logos/${s.slug}.png`} alt="" loading="lazy" />
                            <span>{s.name}</span>
                        </button>
                    {/each}
                    {#if selected.size > 0}
                        <button type="button" class="chip chip-clear" onclick={() => (selected = new Set())}>
                            Clear
                        </button>
                    {/if}
                </div>
            {/if}
        </div>

        <p class="finder-count">
            {filtered.length} club{filtered.length === 1 ? '' : 's'}{selected.size > 0 || search ? ' match your filters' : ''}
        </p>

        <div class="finder-layout">
            <div class="finder-map-col">
                <ClubFinderMap clubs={sorted} userLat={userLoc?.lat ?? null} userLng={userLoc?.lng ?? null} />
            </div>

            <div class="finder-list">
                {#if sorted.length === 0}
                    <div class="empty-state">
                        No clubs match. Try clearing filters — or <a href="#add-club">add your club</a>.
                    </div>
                {:else}
                    {#each sorted as c (c.id)}
                        {@const dist = distanceMi(c)}
                        <article class="club-card">
                            <div class="club-card-body">
                                <h3 class="club-name">{c.name}</h3>
                                {#if c.address || c.region}
                                    <p class="club-loc">
                                        {c.address ?? c.region}{#if dist != null} · <span class="dist">{dist.toFixed(dist < 10 ? 1 : 0)} mi away</span>{/if}
                                    </p>
                                {:else if dist != null}
                                    <p class="club-loc"><span class="dist">{dist.toFixed(dist < 10 ? 1 : 0)} mi away</span></p>
                                {/if}
                                {#if c.systems.length > 0}
                                    <div class="club-systems">
                                        {#each c.systems as s}
                                            <span class="sys-tag" class:on={selected.has(s.legacy_system_name)}>{s.name}</span>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                            <a class="visit-btn" href={clubUrl(c.slug)}>Visit →</a>
                        </article>
                    {/each}
                {/if}
            </div>
        </div>

        <section id="add-club" class="add-club-section">
            <ClubRequestForm />
        </section>
    </div>
{/if}

<style>
    .back-home {
        display: inline-block;
        margin-bottom: 0.9rem;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--color-text-dim);
        text-decoration: none;
    }
    .back-home:hover { color: var(--color-accent); }

    .finder-head { margin-bottom: 1.25rem; }
    .finder-title {
        font-family: var(--font-display);
        font-size: clamp(1.7rem, 4vw, 2.4rem);
        font-weight: 700;
        color: var(--color-text-bright);
        margin: 0 0 0.3rem;
    }
    .finder-sub { color: var(--color-text-muted); margin: 0; line-height: 1.5; }
    .finder-sub a, .empty-state a { color: var(--color-accent); }

    .finder-controls { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
    .finder-row { display: flex; gap: 0.5rem; }
    .finder-row .finder-search { flex: 1; }

    .loc-btn {
        flex: 0 0 auto;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--color-accent);
        background: var(--color-surface-dark);
        border: 1px solid var(--color-accent-border);
        border-radius: var(--radius);
        padding: 0 0.9rem;
        cursor: pointer;
        font-family: inherit;
        white-space: nowrap;
        transition: background 0.12s ease;
    }
    .loc-btn:hover:not(:disabled) { background: var(--color-surface-hover); }
    .loc-btn:disabled { opacity: 0.6; cursor: default; }
    .loc-btn.on { color: #1b1206; background: var(--color-accent); border-color: var(--color-accent); }

    .geo-error { color: var(--color-danger, #d25050); font-size: 0.82rem; margin: 0; }
    .dist { color: var(--color-accent); font-weight: 600; }

    .add-club-section { margin-top: 2.5rem; scroll-margin-top: 1rem; }

    .finder-search {
        width: 100%;
        box-sizing: border-box;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-accent-border-soft, var(--color-steel-border));
        border-radius: var(--radius);
        padding: 0.7rem 0.9rem;
        color: var(--color-text-bright);
        font-family: inherit;
        font-size: 1rem;
    }
    .finder-search::placeholder { color: var(--color-text-dim); }
    .finder-search:focus { outline: none; border-color: var(--color-accent); }

    .system-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--color-text-dim);
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        border-radius: 999px;
        padding: 0.3rem 0.75rem 0.3rem 0.4rem;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
    }
    .chip-icon {
        width: 22px;
        height: 22px;
        object-fit: contain;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.25);
        padding: 2px;
        flex: 0 0 auto;
    }
    .chip:hover { color: var(--color-text-bright); border-color: var(--color-accent-border); }
    .chip.on {
        color: #1b1206;
        background: var(--color-accent);
        border-color: var(--color-accent);
    }
    .chip-clear { color: var(--color-text-faint); padding-left: 0.75rem; }

    .finder-count { color: var(--color-text-dim); font-size: 0.85rem; margin: 0 0 1rem; }

    .finder-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 1.25rem;
        align-items: start;
    }
    .finder-map-col { position: sticky; top: 1rem; height: 70vh; }

    .finder-list { display: flex; flex-direction: column; gap: 0.6rem; max-height: 70vh; overflow-y: auto; padding-right: 0.25rem; }

    .club-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.85rem 1rem;
        background: var(--color-surface);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
    }
    .club-card:hover { border-color: var(--color-accent-border); }
    .club-card-body { min-width: 0; }
    .club-name { margin: 0 0 0.15rem; font-size: 1.05rem; color: var(--color-text-bright); }
    .club-loc { margin: 0 0 0.4rem; font-size: 0.85rem; color: var(--color-text-dim); }
    .club-systems { display: flex; flex-wrap: wrap; gap: 0.3rem; }
    .sys-tag {
        font-size: 0.72rem;
        color: var(--color-text-muted);
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        border-radius: 999px;
        padding: 0.1rem 0.5rem;
    }
    .sys-tag.on { color: var(--color-accent); border-color: var(--color-accent-border); }

    .visit-btn {
        flex: 0 0 auto;
        font-size: 0.85rem;
        font-weight: 700;
        color: var(--color-accent);
        text-decoration: none;
        border: 1px solid var(--color-accent-border);
        border-radius: var(--radius);
        padding: 0.45rem 0.8rem;
        white-space: nowrap;
        transition: background 0.12s ease;
    }
    .visit-btn:hover { background: var(--color-surface-hover); }

    @media (max-width: 780px) {
        .finder-layout { grid-template-columns: 1fr; }
        .finder-map-col { position: static; height: 320px; order: -1; }
        .finder-list { max-height: none; overflow: visible; }
    }
</style>
