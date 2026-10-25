<script lang="ts">
    import { getMe } from '$lib/session';
    import PageSkeleton from '$lib/PageSkeleton.svelte';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition';
    import { systemFolder } from '$lib/factions';
    import FactionIcon from '$lib/FactionIcon.svelte';
    import { getSystemsConfig, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from '$lib/systemsConfig';
    import { getClubSlugFromHostname } from '$lib/clubSlug';
    import { PUBLIC_API_URL } from '$env/static/public';
    import { fetchMySystems } from '$lib/mySystems';
    import SystemPicker from '$lib/SystemPicker.svelte';
    import NightPicker from '$lib/NightPicker.svelte';
    import GameList from '$lib/home/GameList.svelte';
    import { fetchHome, fetchPairings, peekHome, peekPairings, gameLabel, myMatchup, sides, weekday, type HomeNight } from '$lib/home/api';

    // Icon folder per system comes from the backend-owned SystemConfig
    // (GET /systems); FALLBACK carries the same values until it loads.
    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);

    let { data } = $props();

    let system = $state(data.system);
    let week = $state(data.week);

    $effect(() => {
        system = data.system;
        week = data.week;
    });

    // Pairings content is fetched client-side (never SSR) so the request
    // carries the caller's session cookie via credentials:'include'. The
    // backend scopes to the authenticated user's own club and ignores the
    // hostname-derived `club` slug — closing the cross-club leak where a
    // logged-in member of one club was served another club's pairings. For a
    // genuinely anonymous visitor there's no session, so the `club` slug (from
    // the hostname / subdomain) resolves the shared-link club exactly as before.
    type Matchup = {
        player_a_name: string;
        player_a_id: number | null;
        player_a_faction: string | null;
        // Self-reported experience off the signup ("New" / "Some" / "Veteran").
        player_a_experience: string | null;
        player_a_level: number | null;
        player_b_name: string | null;
        player_b_id: number | null;
        player_b_faction: string | null;
        player_b_experience: string | null;
        player_b_level: number | null;
        is_bye: boolean;
        game_type: string | null;
        eta: string | null;
        points: string | number | null;
        id?: number;
        prearranged?: boolean;
        table?: string | null;
    };
    type PairingsData = {
        published: boolean;
        matchups: Matchup[];
        total_players: number;
        total_matchups: number;
        byes: number;
    };
    const EMPTY_PAIRINGS: PairingsData = {
        published: false, matchups: [], total_players: 0, total_matchups: 0, byes: 0
    };
    let pdata = $state<PairingsData>(EMPTY_PAIRINGS);
    let pairingsLoaded = $state(false);

    async function loadPairings(sys: string, wk: string) {
        // What this visit last saw for this night (here, or on Home, which
        // loads the same pairings), shown straight away while the fresh copy
        // comes in. Only a first look waits.
        const seen = peekPairings(sys, wk);
        if (seen) {
            pdata = seen as PairingsData;
            pairingsLoaded = true;
        } else {
            pairingsLoaded = false;
        }
        // No club param needed: the backend resolves the caller's own club
        // from the session cookie (if logged in) or, for anonymous callers,
        // this request's Origin header (subdomain-based resolution).
        pdata = (await fetchPairings(sys, wk)) as PairingsData;
        pairingsLoaded = true;
    }

    // While pairings for this system/week aren't published yet, poll for
    // them so a player sitting on the page sees them appear the moment an
    // admin publishes — no manual refresh needed. Stops the instant
    // `published` flips true; the matchup cards' own `in:fly`/`in:scale`
    // transitions (below) then provide the reveal for free, since each
    // card only enters `pdata.matchups` (and the keyed {#each}) once.
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    function startPolling(sys: string, wk: string) {
        stopPolling();
        pollTimer = setInterval(async () => {
            await loadPairings(sys, wk);
            if (pdata.published) stopPolling();
        }, 6000);
    }

    // Re-fetch whenever the resolved system/week changes (initial mount too).
    $effect(() => {
        const sys = data.system;
        const wk = data.week;
        loadPairings(sys, wk).then(() => {
            if (!pdata.published) startPolling(sys, wk);
            else stopPolling();
        });
        return stopPolling;
    });

    // Systems come from the catalogue (systemsConfig starts as the offline
    // fallback and updates once GET /systems loads), not a hardcoded list.
    const systems = $derived(systemsConfig.map((s) => s.legacy_system_name));

    // The caller's own club's actually-enabled systems (GET /systems/mine,
    // authenticated). null until resolved or if unauthenticated/failed —
    // falls back to the full `systems` list so anonymous browsing (e.g. a
    // shared pairings link) is unaffected. Only restricts which tabs are
    // offered — never force-navigates away from whatever `system` the URL
    // already requested, so a direct link to a since-disabled system's
    // published pairings still works.
    let mySystems = $state<string[] | null>(null);
    const tabSystems = $derived(mySystems ?? systems);
    // Gates the system-selector row so it renders once, already filtered to the
    // club's systems — never flashing the full list before /systems/mine
    // resolves. True after resolution (or immediately for anonymous visitors).
    let systemsResolved = $state(false);

    // Once the club's real system list resolves, if the SSR default system
    // ("The Old World") isn't one this club runs, switch to the first one it
    // does — so a Kill-Team-only club doesn't land on an Old World tab it has
    // no data for. Mirrors the homepage. Never fires for anonymous visitors
    // (mySystems stays null), so a direct shared link to any system still works.
    $effect(() => {
        if (mySystems && mySystems.length > 0 && !mySystems.includes(system)) {
            selectSystem(mySystems[0]);
        }
    });

    function selectSystem(s: string) {
        if (s === system) return;
        system = s;
        goto(`/pairings?${new URLSearchParams({ system: s })}`, { invalidateAll: true });
    }

    function applyWeek() {
        const params = new URLSearchParams({ system, week });
        goto(`/pairings?${params}`, { invalidateAll: true });
    }

    let showWeekField = $state(false);


    /* ---------- the caller's nights and own game ---------- */
    // Signed-in only (GET /home needs an account). A visitor following a
    // shared link keeps the plain system tiles and no "Your game" card.
    let nights = $state<HomeNight[] | null>(null);
    let myPlayerId = $state<number | null>(null);
    const night = $derived(nights?.find((n) => n.system === data.system) ?? null);
    const myGame = $derived(pdata.published ? myMatchup(pdata.matchups, myPlayerId) : null);
    const seat = $derived(myGame ? sides(myGame, myPlayerId) : null);
    const myGameIndex = $derived(myGame ? pdata.matchups.filter((m) => !m.is_bye).indexOf(myGame) : -1);
    const nightName = $derived(night && night.week === data.week ? weekday(night.date) : data.week);

    /* ---------- auth + unpaired ---------- */
    type UnpairedPlayer = { player_id: number; player_name: string; signup_id: number };
    let loggedIn = $state(false);
    let unpaired = $state<UnpairedPlayer[]>([]);

    async function loadUnpaired(sys: string, wk: string) {
        try {
            const params = new URLSearchParams({ system: sys, week: wk });
            const r = await fetch(`${PUBLIC_API_URL}/signups/unpaired?${params}`, { credentials: 'include' });
            unpaired = r.ok ? await r.json() : [];
        } catch (_) {
            unpaired = [];
        }
    }

    onMount(async () => {
        // Club slug is required so has_league/vibe overrides reflect THIS
        // club's own config, not the platform catalogue default — see
        // leagueSystems()'s doc comment in systemsConfig.ts.
        const club = getClubSlugFromHostname(window.location.hostname);
        getSystemsConfig(club).then((c) => (systemsConfig = c));
        loggedIn = (await getMe())?.authenticated === true;
        if (loggedIn) {
            // The nights from earlier in this visit (Home loads the same), shown
            // at once and refreshed behind; only a first look waits for them.
            const seen = peekHome();
            const fresh = fetchHome().then((home) => {
                nights = home?.nights ?? null;
                myPlayerId = home?.player_id ?? null;
            });
            if (seen) {
                nights = seen.nights;
                myPlayerId = seen.player_id;
                mySystems = await fetchMySystems();
            } else {
                [mySystems] = await Promise.all([fetchMySystems(), fresh]);
            }
        }
        systemsResolved = true;
    });

    $effect(() => {
        const _sys = data.system;
        const _wk = data.week;
        if (loggedIn) {
            loadUnpaired(_sys, _wk);
        } else {
            unpaired = [];
        }
    });

</script>

{#if systemsResolved}
<div class="page-reveal flow" in:fade={{ duration: 140 }}>

<div class="title-row">
    <h1 class="page-title">Pairings</h1>
</div>

{#if nights && nights.length}
    <NightPicker {nights} {systemsConfig} active={system} onSelect={selectSystem} />
{:else}
    <div class="system-picker-theme">
        <SystemPicker
            systems={tabSystems}
            {systemsConfig}
            isActive={(s) => system === s}
            onSelect={selectSystem}
        />
    </div>
{/if}

<div class="next-session-row">
    <span>Showing: <strong>{data.week}</strong></span>
    <button type="button" class="link-button" onclick={() => (showWeekField = !showWeekField)}>
        {showWeekField ? 'Cancel' : 'Change week'}
    </button>
</div>

{#if showWeekField}
    <div class="field week-field">
        <label class="field-label" for="week">Week (DD/MM/YYYY)</label>
        <input id="week" class="field-input" type="text" bind:value={week} onblur={applyWeek} />
    </div>
{/if}

{#if !pairingsLoaded}
    <div class="empty-state">Loading…</div>
{:else if !pdata.published}
    <div class="empty-state">Pairings for {nightName} aren't out yet. This page shows them the moment they are.</div>
{:else if pdata.matchups.length === 0}
    <div class="empty-state">No pairings yet.</div>
{/if}

{#if pairingsLoaded && pdata.published && pdata.matchups.length > 0}
    {#if myGame && seat}
        <section class="your-game">
            <div class="your-head">
                <h2>Your game</h2>
                {#if myGame.is_bye}
                    <span class="your-when">Sitting out</span>
                {:else}
                    <span class="your-when">{gameLabel(myGame, myGameIndex)}{#if myGame.eta} · {myGame.eta}{/if}</span>
                {/if}
            </div>
            {#if myGame.is_bye}
                <p class="your-bye">You're sitting out this one. If someone drops, you're first in line for their opponent.</p>
            {:else}
                <div class="your-vs">
                    <div class="your-side">
                        <FactionIcon faction={seat.me.faction} folder={systemFolder(data.system, systemsConfig)} class="your-icon" />
                        <div><div class="your-name">You</div><div class="your-faction">{seat.me.faction ?? '—'}</div></div>
                    </div>
                    <span class="your-v">VS</span>
                    <div class="your-side your-side-b">
                        <div><div class="your-name">{seat.them.name}</div><div class="your-faction">{seat.them.faction ?? '—'}</div></div>
                        <FactionIcon faction={seat.them.faction} folder={systemFolder(data.system, systemsConfig)} class="your-icon" />
                    </div>
                </div>
            {/if}
            <div class="your-links">
                <a href={`/signup?${new URLSearchParams({ system: data.system })}#rearrange`}>Re-arrange</a>
                <a href={`/signup?${new URLSearchParams({ system: data.system })}#drop`}>Can't make it</a>
            </div>
        </section>
    {/if}

    <h2 class="section-title">Every game</h2>
    <div class="games-card">
        <GameList matchups={pdata.matchups} playerId={myPlayerId} folder={systemFolder(data.system, systemsConfig)} detail />
    </div>
{/if}

{#if loggedIn && unpaired.length > 0}
    <div class="unpaired-section">
        <p class="unpaired-notice">⚠️ Looking for a game: {unpaired.map((p) => p.player_name).join(', ')}</p>
        <p class="unpaired-note">Use <a href={`/signup?${new URLSearchParams({ system: data.system })}#rearrange`}>Re-arrange your game</a> on the signup page to give them one.</p>
    </div>
{/if}

</div>
{:else}
    <PageSkeleton title="Pairings" />
{/if}

<style>
    .page-title {
        font-size: 2.4rem;
        font-weight: 700;
        line-height: 1;
        text-transform: uppercase;
        margin: 0 0 1rem;
    }

    .your-game {
        margin-bottom: 1.25rem;
        padding: 16px 18px;
        border: 1px solid var(--color-accent);
        border-radius: 6px;
        background: rgba(201, 161, 74, 0.08);
    }

    .your-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }

    .your-head h2 {
        font-size: 0.95rem;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--color-accent);
    }

    .your-when {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.25rem;
        color: var(--color-text-bright);
    }

    .your-vs {
        margin-top: 12px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: 12px;
    }

    .your-side { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .your-side-b { justify-content: flex-end; text-align: right; }
    .your-side :global(.your-icon) { width: 48px; height: 48px; flex: none; }

    .your-name { font-weight: 700; font-size: 1.1rem; color: var(--color-text-bright); }
    .your-faction { font-size: 0.85rem; color: var(--color-text-dim); }

    .your-v {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.1rem;
        letter-spacing: 0.15em;
        color: var(--color-accent);
    }

    .your-bye { margin: 10px 0 0; color: var(--color-text-muted); }

    .your-links {
        margin-top: 12px;
        display: flex;
        gap: 18px;
        font-size: 0.9rem;
        font-weight: 600;
    }

    .your-links a { color: var(--color-accent); }


    .games-card {
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 6px;
        overflow: hidden;
    }

    .unpaired-note a { color: var(--color-accent); }

    @media (max-width: 560px) {
        .page-title { font-size: 2.1rem; }
        .your-game { padding: 14px; }
        .your-side :global(.your-icon) { width: 40px; height: 40px; }
        .your-name { font-size: 1rem; }
    }

    /* This page's system tiles look slightly different from the other
       pages' (SystemPicker.svelte's defaults) — preserved via custom
       property overrides rather than duplicating the component. */
    .system-picker-theme {
        display: contents;
    }

    .next-session-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.9rem;
        color: var(--color-text-base);
        margin-bottom: 1rem;
    }

    .link-button {
        background: none;
        border: none;
        color: var(--color-accent);
        font-family: inherit;
        font-size: 0.85rem;
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
    }

    .week-field {
        margin-bottom: 1rem;
    }

    .unpaired-section {
        margin-top: 1.25rem;
        padding: 0.75rem 1rem;
        background: rgba(210, 165, 50, 0.07);
        border: 1px solid rgba(210, 165, 50, 0.22);
        border-radius: 10px;
    }

    .unpaired-notice {
        margin: 0 0 0.25rem;
        color: var(--color-text-base);
        font-size: 0.9rem;
    }

    .unpaired-note {
        margin: 0;
        color: var(--color-text-dim);
        font-size: 0.82rem;
        font-style: italic;
    }
</style>