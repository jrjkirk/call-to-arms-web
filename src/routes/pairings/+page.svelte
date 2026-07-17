<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { fly, scale } from 'svelte/transition';
    import { factionIconUrl, systemFolder } from '$lib/factions';
    import { getSystemsConfig, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from '$lib/systemsConfig';
    import { PUBLIC_API_URL } from '$env/static/public';
    import { fetchMySystems } from '$lib/mySystems';

    // Icon folder per system comes from the backend-owned SystemConfig
    // (GET /systems); FALLBACK carries the same values until it loads.
    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);

    let { data } = $props();

    function matchKey(m: { player_a_name: string; player_b_name?: string | null }): string {
        return `${m.player_a_name}|${m.player_b_name ?? 'BYE'}`;
    }

    function cascadeDelay(i: number): number {
        return Math.min(i, 10) * 90;
    }

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
        player_a_faction: string | null;
        player_b_name: string | null;
        player_b_faction: string | null;
        is_bye: boolean;
        game_type: string | null;
        eta: string | null;
        points: number | null;
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
        pairingsLoaded = false;
        try {
            // No club param needed — the backend resolves the caller's own
            // club from the session cookie (if logged in) or, for anonymous
            // callers, this request's Origin header (subdomain-based
            // resolution), falling back to the single-active-club stopgap
            // only if neither is present.
            const params = new URLSearchParams({ system: sys, week: wk });
            const r = await fetch(`${PUBLIC_API_URL}/pairings?${params}`, { credentials: 'include' });
            pdata = r.ok ? await r.json() : EMPTY_PAIRINGS;
        } catch (_) {
            pdata = EMPTY_PAIRINGS;
        }
        pairingsLoaded = true;
    }

    // While pairings for this system/week aren't published yet, poll for
    // them so a player sitting on the page sees them appear the moment an
    // admin publishes — no manual refresh needed. Stops the instant
    // `published` flips true; the matchup cards' own `in:fly`/`in:scale`
    // transitions (below) then provide the reveal for free, since the
    // {#each} block only mounts once `pdata.published` is true.
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

    const systems = ['The Old World', 'The Horus Heresy', 'Kill Team'];

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

    const SYSTEM_LOGOS: Record<string, string> = {
        'The Old World': '/logos/tow.png',
        'The Horus Heresy': '/logos/hh.png',
        'Kill Team': '/logos/kt.png'
    };

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
        getSystemsConfig().then((c) => (systemsConfig = c));
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/me`, { credentials: 'include' });
            if (r.ok) {
                const me = await r.json();
                loggedIn = me.authenticated === true;
            }
        } catch (_) {}
        if (loggedIn) {
            mySystems = await fetchMySystems();
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

    function accentClass(gt: string | null | undefined): string {
        if (!gt) return '';
        const k = gt.toLowerCase();
        if (k === 'intro') return 'accent-intro';
        if (k === 'casual') return 'accent-casual';
        if (k === 'competitive') return 'accent-competitive';
        if (k === 'standard') return 'accent-standard';
        return '';
    }
</script>

<h2 class="page-heading">Weekly Pairings</h2>

{#if systemsResolved}
    <div class="system-grid">
        {#each tabSystems as s}
            <button
                type="button"
                class="system-card"
                class:active={system === s}
                onclick={() => selectSystem(s)}
            >
                <img src={SYSTEM_LOGOS[s]} alt={s} />
            </button>
        {/each}
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

{#key data.system}
{#if !pairingsLoaded}
    <div class="empty-state">Loading…</div>
{:else if !pdata.published}
    <div class="empty-state">No pairings published yet for this week/system.</div>
{:else if pdata.matchups.length === 0}
    <div class="empty-state">No pairings yet.</div>
{:else}
    <div class="stat-row">
        <div class="stat-card">
            <div class="stat-label">Players</div>
            <div class="stat-value">{pdata.total_players}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Matchups</div>
            <div class="stat-value">{pdata.total_matchups}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">On Standby</div>
            <div class="stat-value">{pdata.byes}</div>
        </div>
    </div>

    <div class="matchups">
        {#each pdata.matchups as m, i (matchKey(m))}
            <div
                class={`matchup-card ${m.is_bye ? 'matchup-bye' : ''} ${accentClass(m.game_type)}`}
                in:fly={{ y: 24, duration: 420, delay: cascadeDelay(i) }}
            >
                <div class="player-row player-a">
                    {#if factionIconUrl(m.player_a_faction, systemFolder(data.system, systemsConfig))}
                        <img class="matchup-icon" src={factionIconUrl(m.player_a_faction, systemFolder(data.system, systemsConfig))} alt="" />
                    {:else}
                        <div class="matchup-icon-empty"></div>
                    {/if}
                    <div class="player-text">
                        <div class="player-name">{m.player_a_name}</div>
                        <div class="player-faction">{m.player_a_faction ?? '—'}</div>
                    </div>
                </div>

                <div class="vs-divider">
                    <span class="vs-line"></span>
                    <span class="vs-label" in:scale={{ start: 0.4, duration: 250, delay: cascadeDelay(i) + 280 }}>VS</span>
                    <span class="vs-line"></span>
                </div>

                <div class="player-row player-b">
                    {#if m.player_b_name && factionIconUrl(m.player_b_faction, systemFolder(data.system, systemsConfig))}
                        <img class="matchup-icon" src={factionIconUrl(m.player_b_faction, systemFolder(data.system, systemsConfig))} alt="" />
                    {:else}
                        <div class="matchup-icon-empty"></div>
                    {/if}
                    <div class="player-text">
                        <div class="player-name">{m.player_b_name ?? 'BYE / Standby'}</div>
                        {#if m.player_b_name}
                            <div class="player-faction">{m.player_b_faction ?? '—'}</div>
                        {/if}
                    </div>
                </div>

                {#if m.game_type || m.eta || m.points}
                    <div class="matchup-meta">
                        {#if m.game_type}
                            <span class="matchup-meta-item">
                                <span class="matchup-meta-label">Type</span>
                                <span class="matchup-meta-value">{m.game_type}</span>
                            </span>
                        {/if}
                        {#if m.eta}
                            <span class="matchup-meta-item">
                                <span class="matchup-meta-label">ETA</span>
                                <span class="matchup-meta-value">{m.eta}</span>
                            </span>
                        {/if}
                        {#if m.points}
                            <span class="matchup-meta-item">
                                <span class="matchup-meta-label">Points</span>
                                <span class="matchup-meta-value">{m.points}</span>
                            </span>
                        {/if}
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    {#if loggedIn && unpaired.length > 0}
        <div class="unpaired-section">
            <p class="unpaired-notice">⚠️ Looking for a game: {unpaired.map((p) => p.player_name).join(', ')}</p>
            <p class="unpaired-note">Head to the home page and use the Re-arrange your game form.</p>
        </div>
    {/if}
{/if}
{/key}

<style>
    .page-heading { font-size: 1.5rem; margin: 0 0 1rem; }

    .system-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        margin-bottom: 0.75rem;
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

    .matchups { display: flex; flex-direction: column; gap: 14px; margin-top: 0.5rem; }

    .matchup-card {
        background: linear-gradient(135deg, rgba(30, 30, 40, 0.92) 0%, rgba(20, 20, 30, 0.95) 100%);
        border: 1px solid rgba(180, 150, 90, 0.35);
        border-radius: 12px;
        padding: 18px 20px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04);
        color: #e8e4d8;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .matchup-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }

    .player-row { display: flex; align-items: center; gap: 14px; }
    .player-row.player-a { justify-content: flex-start; }
    .player-row.player-b { justify-content: flex-start; }

    .player-text { display: flex; flex-direction: column; align-items: flex-start; flex: 1; }

    .player-name {
        font-size: 1.2rem;
        font-weight: 700;
        color: #f4e9c8;
        letter-spacing: 0.2px;
        margin-bottom: 4px;
        text-align: left;
    }

    .player-faction {
        font-size: 0.95rem;
        color: #b8a878;
        font-style: italic;
        text-align: left;
    }

    .matchup-icon {
        width: 48px;
        height: 48px;
        object-fit: contain;
        flex: 0 0 auto;
        filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
    }

    .matchup-icon-empty { width: 48px; height: 48px; flex: 0 0 auto; }

    .vs-divider {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 12px 0;
    }

    .vs-line { flex: 1; height: 1px; background: rgba(180, 150, 90, 0.35); }

    .vs-label {
        font-size: 1rem;
        font-weight: 800;
        color: var(--color-accent);
        text-shadow: 0 0 8px var(--color-accent-glow);
        letter-spacing: 1px;
    }

    .matchup-meta {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px dashed rgba(180, 150, 90, 0.25);
        display: flex;
        justify-content: center;
        gap: 22px;
        font-size: 0.88rem;
        color: #d4c8a0;
        flex-wrap: wrap;
    }

    .matchup-meta-item { display: inline-flex; align-items: center; gap: 6px; }

    .matchup-meta-label {
        opacity: 0.7;
        text-transform: uppercase;
        font-size: 0.72rem;
        letter-spacing: 0.6px;
    }

    .matchup-meta-value { font-weight: 600; color: #f0e4bc; }

    .matchup-bye .player-row.player-b .player-name {
        color: var(--color-text-faint);
        font-style: italic;
        font-weight: 400;
    }

    .accent-casual { border-left: 4px solid #6eb46e; }
    .accent-competitive { border-left: 4px solid #d25050; }
    .accent-intro { border-left: 4px solid #5a9bd4; }
    .accent-standard { border-left: 4px solid #9c8bd1; }

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

    @media (min-width: 768px) {
        .matchup-card {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            grid-template-rows: auto auto;
            align-items: center;
            gap: 16px;
        }

        .player-row.player-a {
            grid-column: 1;
            grid-row: 1;
            justify-content: flex-end;
            flex-direction: row-reverse;
            text-align: right;
        }

        .player-row.player-a .player-text { align-items: flex-end; }
        .player-row.player-a .player-name,
        .player-row.player-a .player-faction { text-align: right; }

        .player-row.player-b {
            grid-column: 3;
            grid-row: 1;
            justify-content: flex-start;
        }

        .vs-divider {
            grid-column: 2;
            grid-row: 1;
            flex-direction: column;
            margin: 0;
            gap: 0;
        }

        .vs-divider .vs-line { display: none; }

        .vs-label { font-size: 1.5rem; padding: 0 6px; }

        .matchup-meta {
            grid-column: 1 / -1;
            grid-row: 2;
        }

        .matchup-icon, .matchup-icon-empty { width: 56px; height: 56px; }
        .player-name { font-size: 1.15rem; font-weight: 600; }
        .player-faction { font-size: 0.92rem; }
    }
</style>