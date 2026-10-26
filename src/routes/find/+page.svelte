<!--
  Clubs: change club, for a member, and find one, for anyone else. Rebuilt
  2026-10-26 to the app's design rules: capitals for labels, system logos
  rather than pills, colour as a bar beside a row, and no paragraphs.

  Search narrows by name or town, NEAR ME sorts by distance, the system logos
  filter to clubs that run them. The map and the list show the same clubs,
  and either picks one: tap a pin for its card (SWITCH, or CURRENT), or a row
  to go straight there. A member's own club is marked CURRENT and listed
  first. Every club gets a pin: one whose admin hasn't placed it yet is put
  at its address.
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import ClubMap, { type MapPin } from '$lib/map/ClubMap.svelte';
    import { FALLBACK_SYSTEMS_CONFIG, getSystemsConfig, systemLogoUrl, type SystemConfig } from '$lib/systemsConfig';
    import { getMe } from '$lib/session';
    import { peek, revalidate } from '$lib/swr';
    import { placeOf, placeUnpinned } from '$lib/map/placeClubs';

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

    const seenClubs = peek<FinderClub[]>('/clubs');
    let clubs = $state<FinderClub[]>(seenClubs ?? []);
    let loaded = $state(!!seenClubs);
    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);
    let currentSlug = $state<string | null>(null);

    let search = $state('');
    let selected = $state<Set<string>>(new Set());
    let near = $state<{ lat: number; lng: number } | null>(null);
    let locating = $state(false);
    let locateFailed = $state(false);
    let focused = $state<string | null>(null);

    onMount(async () => {
        getSystemsConfig().then((c) => (systemsConfig = c));
        getMe().then((me) => (currentSlug = me?.active_club?.slug ?? null));
        await revalidate<FinderClub[]>('/clubs', (v) => (clubs = v));
        loaded = true;
        // Clubs with an address but no pin are placed at it ($lib/map/placeClubs).
        placeUnpinned(clubs, () => (placedCount += 1));
    });

    // Bumped as each unpinned club is placed, so the pins recompute.
    let placedCount = $state(0);
    function where(c: FinderClub): { lat: number; lng: number } | null {
        placedCount;
        return placeOf(c);
    }

    function nearMe() {
        if (near) {
            near = null;
            return;
        }
        if (!navigator.geolocation) {
            locateFailed = true;
            return;
        }
        locating = true;
        locateFailed = false;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                near = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                locating = false;
            },
            () => {
                locateFailed = true;
                locating = false;
            },
            { timeout: 10000, maximumAge: 60000 }
        );
    }

    function miles(c: FinderClub): number | null {
        const at = where(c);
        if (!near || !at) return null;
        const rad = (d: number) => (d * Math.PI) / 180;
        const dLat = rad(at.lat - near.lat);
        const dLon = rad(at.lng - near.lng);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(near.lat)) * Math.cos(rad(at.lat)) * Math.sin(dLon / 2) ** 2;
        return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /** "Manchester" out of "12 High St, Manchester M1 1AE": the part a list
     *  needs. Falls back to the region. */
    function town(c: FinderClub): string {
        const parts = (c.address ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        const pick = parts.length > 1 ? parts[parts.length - 1] : parts[0];
        const cleaned = (pick ?? '').replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i, '').replace(/\b(UK|United Kingdom)\b/i, '').trim();
        return cleaned || (parts.length > 1 ? parts[parts.length - 2] : '') || c.region || '';
    }

    // Only systems some club actually runs get a filter tile.
    const allSystems = $derived.by(() => {
        const m = new Map<string, FinderSystem>();
        for (const c of clubs) for (const s of c.systems) m.set(s.legacy_system_name, s);
        return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
    });

    function toggle(name: string) {
        const next = new Set(selected);
        next.has(name) ? next.delete(name) : next.add(name);
        selected = next;
    }

    const shown = $derived.by(() => {
        const q = search.trim().toLowerCase();
        const list = clubs.filter((c) => {
            if (selected.size && !c.systems.some((s) => selected.has(s.legacy_system_name))) return false;
            if (q && !`${c.name} ${c.address ?? ''} ${c.region ?? ''}`.toLowerCase().includes(q)) return false;
            return true;
        });
        return list.sort((a, b) => {
            if (a.slug === currentSlug) return -1;
            if (b.slug === currentSlug) return 1;
            const da = miles(a), db = miles(b);
            if (da != null && db != null) return da - db;
            if (da != null) return -1;
            if (db != null) return 1;
            return a.name.localeCompare(b.name);
        });
    });

    const pins = $derived<MapPin[]>(
        shown.flatMap((c) => {
            const at = where(c);
            return at ? [{ id: c.slug, lat: at.lat, lng: at.lng, label: c.name, active: c.slug === focused }] : [];
        })
    );

    const focusedClub = $derived(shown.find((c) => c.slug === focused) ?? null);

    /* A pin picks its club: the card on the map, and (beside the map, on a
       wide screen) its row in the list. */
    function pick(slug: string | number) {
        focused = focused === String(slug) ? null : String(slug);
        if (focused && window.matchMedia('(min-width: 781px)').matches) {
            document.getElementById(`club-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    const clubUrl = (slug: string) => `https://${slug}.calltoarms.app`;
</script>

<svelte:head>
    <meta name="description" content="Find a wargaming club near you, and the systems it plays." />
</svelte:head>

<h1 class="page-title">Clubs</h1>

<div class="controls">
    <input class="field-input search" type="search" placeholder="Club or town" aria-label="Search clubs" bind:value={search} />
    <button type="button" class="secondary-button near" class:on={near} aria-pressed={!!near} disabled={locating} onclick={nearMe}>
        {locating ? 'Locating…' : 'Near me'}
    </button>
</div>
{#if locateFailed}<p class="field-error">Location is off for this site.</p>{/if}

{#if allSystems.length > 1}
    <div class="systems" role="group" aria-label="Plays">
        {#each allSystems as s (s.legacy_system_name)}
            {@const logo = systemLogoUrl(s.legacy_system_name, systemsConfig)}
            <button type="button" class="sys" aria-pressed={selected.has(s.legacy_system_name)} title={s.name} onclick={() => toggle(s.legacy_system_name)}>
                {#if logo}<img src={logo} alt={s.name} />{:else}<span>{s.name}</span>{/if}
            </button>
        {/each}
    </div>
{/if}

<div class="layout">
    <div class="map">
        <ClubMap {pins} user={near} onselect={pick} onbackground={() => (focused = null)} />
        {#if focusedClub}
            {@const c = focusedClub}
            {@const mi = miles(c)}
            {@const current = c.slug === currentSlug}
            <div class="pick-card" role="dialog" aria-label={c.name}>
                <span class="bar" class:current></span>
                <div class="pick-main">
                    <b class="club-name">{c.name}</b>
                    <span class="club-where">{town(c)}{#if mi != null}<b class="club-mi">{mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi</b>{/if}</span>
                    {#if c.systems.length}
                        <span class="club-sys">
                            {#each c.systems as s (s.legacy_system_name)}
                                {@const logo = systemLogoUrl(s.legacy_system_name, systemsConfig)}
                                {#if logo}<img src={logo} alt={s.name} title={s.name} />{:else}<small>{s.name}</small>{/if}
                            {/each}
                        </span>
                    {/if}
                </div>
                {#if current}
                    <span class="club-state">Current</span>
                {:else}
                    <a class="primary-button pick-go" href={clubUrl(c.slug)}>{currentSlug ? 'Switch' : 'Visit'}</a>
                {/if}
                <button type="button" class="pick-close" aria-label="Close" onclick={() => (focused = null)}>×</button>
            </div>
        {/if}
    </div>

    <div class="list">
        {#if loaded && shown.length === 0}
            <p class="empty">No clubs match</p>
        {/if}
        {#each shown as c (c.id)}
            {@const mi = miles(c)}
            {@const current = c.slug === currentSlug}
            <a id={`club-${c.slug}`} class="club" class:focused={focused === c.slug} href={clubUrl(c.slug)}>
                <span class="bar" class:current></span>
                <span class="club-main">
                    <span class="club-top">
                        <b class="club-name">{c.name}</b>
                        {#if current}<span class="club-state">Current</span>{/if}
                    </span>
                    <span class="club-where">
                        {town(c)}{#if mi != null}<b class="club-mi">{mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi</b>{/if}
                    </span>
                    {#if c.systems.length}
                        <span class="club-sys">
                            {#each c.systems as s (s.legacy_system_name)}
                                {@const logo = systemLogoUrl(s.legacy_system_name, systemsConfig)}
                                {#if logo}<img src={logo} alt={s.name} title={s.name} loading="lazy" />{:else}<small>{s.name}</small>{/if}
                            {/each}
                        </span>
                    {/if}
                </span>
                <span class="club-go" aria-hidden="true">›</span>
            </a>
        {/each}
    </div>
</div>

<div class="add">
    <span class="add-label">Not here?</span>
    <a class="secondary-button" href="/request-club">Add your club</a>
</div>

<style>
    .page-title {
        font-size: 2.4rem;
        font-weight: 700;
        line-height: 1;
        text-transform: uppercase;
        margin: 0 0 1rem;
    }

    .controls { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
    .search { flex: 1; min-width: 0; min-height: 46px; font-size: 1rem; }
    .near { min-height: 46px; }
    .near.on { background: var(--color-accent); color: #111; border-color: var(--color-accent); }

    .systems {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
        gap: 6px;
        margin-bottom: 1rem;
    }
    .sys {
        min-height: 46px;
        padding: 6px 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0f1218;
        border: 1px solid #232733;
        border-radius: 5px;
        color: var(--color-text-muted);
        font: inherit;
        font-size: 0.8rem;
        cursor: pointer;
    }
    .sys img { width: 100%; height: 26px; object-fit: contain; }
    .sys[aria-pressed='true'] { border-color: var(--color-accent); background: rgba(201, 161, 74, 0.12); }

    .layout {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
        gap: 1rem;
        align-items: start;
    }
    .map { position: sticky; top: 1rem; height: min(70vh, 560px); }

    /* The picked club, over the foot of the map. */
    .pick-card {
        position: absolute;
        left: 10px;
        right: 10px;
        bottom: 10px;
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 0.8rem 0.9rem;
        background: #13161e;
        border: 1px solid #343a47;
        border-radius: 6px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    }
    .pick-card .bar { background: var(--color-accent); }
    .pick-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; }
    .pick-go { flex: none; }
    .pick-close {
        position: absolute;
        top: 2px;
        right: 6px;
        background: none;
        border: none;
        color: var(--color-text-faint);
        font-size: 1.1rem;
        line-height: 1;
        padding: 4px;
        cursor: pointer;
    }

    .list {
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 6px;
        overflow: hidden;
    }
    .empty {
        margin: 0;
        padding: 1.25rem;
        font-family: var(--font-heading);
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--color-text-faint);
    }

    .club {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 0.85rem 1rem;
        border-top: 1px solid #1c2029;
        color: inherit;
        text-decoration: none;
        scroll-margin: 1rem;
    }
    .club:first-child { border-top: none; }
    .club:hover, .club.focused { background: rgba(201, 161, 74, 0.06); }
    .bar {
        align-self: stretch;
        width: 4px;
        flex: none;
        border-radius: 2px;
        background: #232733;
    }
    .club.focused .bar { background: var(--color-accent); }
    .bar.current { background: var(--color-win); }
    .club-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
    .club-top { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
    .club-name { color: var(--color-text-bright); font-size: 1.05rem; }
    .club-state {
        font-family: var(--font-heading);
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--color-win);
    }
    .club-where { font-size: 0.88rem; color: var(--color-text-dim); }
    .club-mi { color: var(--color-accent); margin-left: 0.6rem; }
    .club-sys { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem; }
    .club-sys img { height: 18px; width: auto; max-width: 5.5rem; object-fit: contain; }
    .club-sys small { font-size: 0.75rem; color: var(--color-text-muted); }
    .club-go { flex: none; color: var(--color-text-faint); font-size: 1.4rem; }

    .add {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.9rem;
        margin-top: 1.25rem;
    }
    .add-label {
        font-family: var(--font-heading);
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--color-text-dim);
    }

    @media (max-width: 780px) {
        .page-title { font-size: 2.1rem; }
        .layout { grid-template-columns: minmax(0, 1fr); }
        .map { position: relative; height: 340px; }
        .add { justify-content: space-between; }
    }
</style>
