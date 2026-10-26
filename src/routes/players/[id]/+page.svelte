<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { setPageTitle } from '$lib/pageTitle';
    import { PUBLIC_API_URL } from '$env/static/public';
    import { systemFolder } from '$lib/factions';
    import FactionIcon from '$lib/FactionIcon.svelte';
    import { getSystemsConfig, systemLogoUrl, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from '$lib/systemsConfig';
    import LevelBar, { type LevelProgress } from '$lib/LevelBar.svelte';
    import { getClubSlugFromHostname } from '$lib/clubSlug';

    let apiData = $state<any>(null);
    let pageLoading = $state(true);
    let notFound = $state(false);
    let loadError = $state<string | null>(null);
    // Icon folder per system comes from backend-owned SystemConfig
    // (GET /systems); FALLBACK carries the same values until it loads.
    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);

    onMount(async () => {
        const club = getClubSlugFromHostname(window.location.hostname);
        getSystemsConfig(club).then((c) => (systemsConfig = c));
        try {
            const r = await fetch(`${PUBLIC_API_URL}/players/${page.params.id}`, { credentials: 'include' });
            if (r.status === 404) {
                notFound = true;
            } else if (!r.ok) {
                loadError = 'Failed to load player.';
            } else {
                apiData = await r.json();
            }
        } catch (_) {
            loadError = 'Network error.';
        }
        pageLoading = false;
    });

    const player = $derived(apiData?.player ?? { name: '' });
    const club = $derived(apiData?.club ?? null);
    const titles = $derived<string[]>(apiData?.titles ?? []);
    /** The colour an admin gave each title; uncoloured ones are gold. */
    const titleColors = $derived<Record<string, string>>(apiData?.title_colors ?? {});
    const achievements = $derived(apiData?.achievements ?? []);
    const signupCounts = $derived(apiData?.signup_counts ?? {});

    // Level per system, fetched once the systems this player has actually
    // played are known — one request per system, and a player plays one or two.
    let levelsList = $state<LevelProgress[]>([]);
    $effect(() => {
        const systems = visibleSystems;
        const id = page.params.id;
        if (!id || systems.length === 0) {
            levelsList = [];
            return;
        }
        Promise.all(
            systems.map((sys) =>
                fetch(
                    `${PUBLIC_API_URL}/signups/level?system=${encodeURIComponent(sys)}&player_id=${id}`,
                    { credentials: 'include' }
                )
                    .then((r) => (r.ok ? r.json() : null))
                    .catch(() => null)
            )
        ).then((rows) => (levelsList = rows.filter(Boolean) as LevelProgress[]));
    });
    const factionUsage = $derived(apiData?.faction_usage ?? {});
    // One entry per league-enabled system this player has actually played
    // in — a club can run more than one system's league now, so this is a
    // list, not a single object. Each entry carries its own system_name for
    // the section heading (e.g. "The Old World League", "Age of Sigmar
    // League").
    const leagues = $derived<any[]>(apiData?.leagues ?? []);

    // System display order comes from the catalogue (systemsConfig starts as
    // the offline fallback and updates once GET /systems loads), not a
    // hardcoded list.
    const systemsInOrder = $derived(systemsConfig.map((s) => s.legacy_system_name));

    const visibleSystems = $derived(
        systemsInOrder.filter((s) => (signupCounts[s] ?? 0) > 0)
    );

    const discord = $derived(apiData?.discord ?? null);
    const recentGamesBySystem = $derived(apiData?.recent_games_by_system ?? {});

    // This route had no <title> of its own, so a visitor arriving from another
    // tab kept whatever title that page had left behind. See $lib/pageTitle.
    $effect(() => {
        setPageTitle(page.route.id, player?.name ? `${player.name} · Call to Arms` : null);
    });

    function factionUsageRows(facs: Record<string, number>) {
        const entries = Object.entries(facs).sort((a, b) => b[1] - a[1]);
        const max = entries.length ? Math.max(...entries.map(([, c]) => c)) : 1;
        return entries.map(([name, count]) => ({
            name,
            count,
            pct: Math.round((100 * count) / max)
        }));
    }

    /* The profile is one panel per system the player has played: league,
       level, factions and recent games together, rather than four sections
       that each repeat every system. */
    const panelSystems = $derived(
        systemsInOrder.filter((s) =>
            (signupCounts[s] ?? 0) > 0 || s in factionUsage || (recentGamesBySystem[s] ?? []).length > 0
            || leagues.some((l) => l.system === s))
    );

    function ordinal(n: number): string {
        const sfx = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (sfx[(v - 20) % 10] || sfx[v] || sfx[0]);
    }

    /** The faction they've played most, across every system, for the header. */
    const RESULT_WORD: Record<string, string> = { W: 'Win', L: 'Loss', D: 'Draw' };
    const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    /** "DD/MM/YYYY" → "28 Oct". */
    function shortDate(week: string): string {
        const [d, m] = (week ?? '').split('/').map(Number);
        return d && m ? `${d} ${MONTHS_SHORT[m - 1]}` : week;
    }


    let brokenLogos = $state<Record<string, boolean>>({});
</script>

{#if pageLoading}
    <h1 class="page-title">Player</h1>
    <div class="skeleton"></div>
{:else if notFound}
    <h1 class="page-title">Player</h1>
    <p class="empty">Player not found. <a href="/players">All players</a></p>
{:else if loadError}
    <h1 class="page-title">Player</h1>
    <p class="empty">{loadError}</p>
{:else}
<div class="page-reveal">

<h1 class="page-title">{player.name}</h1>

<section class="panel header">
    {#if discord?.avatar_url}
        <img class="header-avatar" src={discord.avatar_url} alt="" />
    {/if}
    <div class="header-text">
        <!-- Each title its own tag: a bar and the title in the colour an
             admin gave it (gold if none). -->
        {#if titles.length}
            <div class="titles">
                {#each titles as t}
                    <span class="title-tag" style={`--tc: ${titleColors[t] ?? 'var(--color-accent)'}`}>{t}</span>
                {/each}
            </div>
        {/if}
        <div class="header-sub">
            {#if club}<span>{club.name}</span>{/if}{#if discord}<span>{discord.discord_name} on Discord</span>{/if}
        </div>
    </div>
</section>

{#each panelSystems as sysName (sysName)}
    {@const lg = leagues.find((l) => l.system === sysName)}
    {@const lv = levelsList.find((l) => l.system === sysName)}
    {@const games = recentGamesBySystem[sysName] ?? []}
    {@const logo = systemLogoUrl(sysName, systemsConfig)}
    <section class="panel system">
        <header class="system-head">
            {#if logo && !brokenLogos[sysName]}
                <img src={logo} alt={sysName} onerror={() => (brokenLogos = { ...brokenLogos, [sysName]: true })} />
            {:else}
                <h2>{sysName}</h2>
            {/if}
            {#if lg?.rank}
                <span class="system-rank">{ordinal(lg.rank)} <small>in the league</small></span>
            {/if}
        </header>

        {#if lg}
            <div class="block">
                <div class="record">
                    <div class="rec rec-w"><b>{lg.wins}</b><span>W</span></div>
                    <div class="rec rec-d"><b>{lg.draws}</b><span>D</span></div>
                    <div class="rec rec-l"><b>{lg.losses}</b><span>L</span></div>
                    <div class="rec rec-rating"><b>{lg.rating != null ? Math.round(lg.rating).toLocaleString('en-GB') : '—'}</b><span>Rating</span></div>
                </div>
                {#if lg.elo_history && lg.elo_history.length > 1}
                    {@const elos = lg.elo_history.map((h: any) => h.elo)}
                    {@const yMin = Math.min(...elos) - 20}
                    {@const yMax = Math.max(yMin + 40, Math.max(...elos) + 20)}
                    {@const range = yMax - yMin}
                    {@const n = lg.elo_history.length}
                    <div class="elo-chart">
                        <svg viewBox="0 0 600 200" preserveAspectRatio="none" class="elo-svg" role="img" aria-label="Rating over the season">
                            {#each [0, 1, 2, 3, 4] as i}
                                <line x1="40" x2="580" y1={16 + (i / 4) * 168} y2={16 + (i / 4) * 168} stroke="#1c2029" stroke-width="1" />
                                <text x="34" y={16 + (i / 4) * 168 + 4} fill="#767c8a" font-size="10" text-anchor="end">{Math.round(yMax - (i / 4) * range)}</text>
                            {/each}
                            <polyline fill="none" stroke="#c9a14a" stroke-width="2.5"
                                points={lg.elo_history.map((h: any, i: number) => `${40 + (i / Math.max(1, n - 1)) * 540},${16 + ((yMax - h.elo) / range) * 168}`).join(' ')} />
                            {#each lg.elo_history as h, i}
                                <circle cx={40 + (i / Math.max(1, n - 1)) * 540} cy={16 + ((yMax - h.elo) / range) * 168} r="4.5" fill="#f4e9c8" stroke="#c9a14a" stroke-width="2">
                                    <title>{h.label}{h.date ? ` (${h.date})` : ''}: {h.elo}</title>
                                </circle>
                            {/each}
                        </svg>
                    </div>
                {/if}
            </div>
        {/if}

        {#if lv}
            <div class="block block-level">
                <LevelBar {lv} />
            </div>
        {/if}

        {#if factionUsage[sysName]}
            <div class="block">
                <h3 class="block-label">Factions</h3>
                {#each factionUsageRows(factionUsage[sysName]) as row}
                    <div class="faction-row">
                        <span class="faction-icon">
                            {#if row.name}<FactionIcon faction={row.name} folder={systemFolder(sysName, systemsConfig)} class="fi" />{/if}
                        </span>
                        <div class="faction-main">
                            <span class="faction-name">{row.name || 'No faction'}</span>
                            <span class="faction-track"><span class="faction-fill" style={`width: ${row.pct}%`}></span></span>
                        </div>
                        <b class="faction-count">{row.count}</b>
                    </div>
                {/each}
            </div>
        {/if}

        {#if games.length}
            <div class="block block-games">
                <h3 class="block-label">Recent games</h3>
            </div>
            <ul class="games">
                {#each games as g}
                    {@const r = g.result === 'Win' ? 'W' : g.result === 'Loss' ? 'L' : g.result === 'Draw' ? 'D' : ''}
                    <li class={`game game-${r || 'none'}`}>
                        <span class="game-icon">
                            {#if g.opponent_faction}<FactionIcon faction={g.opponent_faction} folder={systemFolder(sysName, systemsConfig)} class="fi" />{/if}
                        </span>
                        <span class="game-who">
                            {#if g.opponent_name}
                                <b>{g.opponent_name}</b>
                                <span>{g.opponent_faction ?? 'Faction not given'}</span>
                            {:else}
                                <b>Sat out</b>
                            {/if}
                        </span>
                        <span class="game-end">
                            {#if r}<span class="game-result">{RESULT_WORD[r]}</span>{/if}
                            <span class="game-date">{shortDate(g.week)}</span>
                        </span>
                    </li>
                {/each}
            </ul>
        {/if}
    </section>
{/each}

{#if achievements.length > 0}
    <section class="panel achievements">
        <h2 class="section-title">Achievements</h2>
        <div class="achievement-grid">
            {#each achievements as ach}
                <div class="achievement">
                    <b>{ach.name}</b>
                    {#if ach.description}<span>{ach.description}</span>{/if}
                </div>
            {/each}
        </div>
    </section>
{/if}
</div>
{/if}

<style>
    .page-title {
        font-size: 2.4rem;
        font-weight: 700;
        line-height: 1;
        text-transform: uppercase;
        margin: 0 0 1rem;
    }

    .skeleton {
        height: 240px;
        border-radius: 6px;
        border: 1px solid #232733;
        background: #13161e;
    }

    .empty { color: var(--color-text-dim); }
    .empty a { color: var(--color-accent); }

    .panel {
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 6px;
        margin-bottom: 14px;
        overflow: hidden;
    }

    /* ── Header ── */
    .header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 18px;
    }

    .header-avatar { width: 60px; height: 60px; border-radius: 50%; flex: none; }

    .header-text { flex: 1; min-width: 0; }

    .titles { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-bottom: 6px; }
    .title-tag {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.05rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--tc);
    }
    .title-tag::before {
        content: '';
        width: 4px;
        height: 1.1em;
        border-radius: 2px;
        background: var(--tc);
    }

    .header-sub { display: flex; flex-wrap: wrap; gap: 0 14px; margin-top: 2px; font-size: 0.85rem; color: var(--color-text-faint); }


    /* ── One system ── */
    .system-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 18px;
        border-bottom: 1px solid #232733;
    }

    .system-head img { height: 28px; width: auto; max-width: 200px; object-fit: contain; object-position: left center; }
    .system-head h2 { font-size: 1.2rem; text-transform: uppercase; }

    .system-rank {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.9rem;
        line-height: 1;
        color: var(--color-text-bright);
    }

    .system-rank small { font-size: 0.95rem; color: var(--color-text-dim); }

    .block { padding: 14px 18px 4px; }
    .block-level { padding-bottom: 8px; }
    .block-games { padding-bottom: 8px; }

    .block-label {
        margin: 0 0 4px;
        font-family: var(--font-heading);
        font-weight: 600;
        font-size: 0.85rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--color-accent);
    }

    .record {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr)) 1.3fr;
        gap: 8px;
    }

    .rec {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 0;
        background: #0f1218;
        border: 1px solid #1c2029;
        border-radius: 5px;
    }

    .rec b { font-family: var(--font-heading); font-size: 1.8rem; line-height: 1; font-variant-numeric: tabular-nums; }
    .rec span { margin-top: 4px; font-family: var(--font-heading); font-weight: 700; font-size: 0.82rem; letter-spacing: 0.15em; text-transform: uppercase; }
    .rec-w { color: var(--color-win); }
    .rec-d { color: var(--color-text-muted); }
    .rec-l { color: #d4786c; }
    .rec-rating b { color: var(--color-text-bright); }
    .rec-rating span { color: var(--color-text-dim); }

    .elo-chart { margin-top: 12px; }
    .elo-svg { width: 100%; height: 150px; display: block; }

    .faction-row {
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr) 32px;
        align-items: center;
        gap: 10px;
        margin: 8px 0;
    }

    .faction-icon :global(.fi) { width: 28px; height: 28px; display: block; }
    .faction-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .faction-name { font-size: 0.92rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .faction-track { height: 6px; border-radius: 3px; background: #1c2029; }
    .faction-fill { display: block; height: 6px; border-radius: 3px; background: var(--color-accent); }
    .faction-count { font-family: var(--font-heading); font-size: 1.15rem; color: var(--color-text-bright); text-align: right; }

    .games { list-style: none; margin: 0; padding: 0; }

    /* A game: the result's colour as a bar, their faction's icon, who and
       what they played, and the result word over the date. */
    .game {
        display: grid;
        grid-template-columns: 4px 36px minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 12px 18px;
        border-top: 1px solid #1c2029;
    }
    .game::before {
        content: '';
        align-self: stretch;
        min-height: 36px;
        border-radius: 2px;
        background: var(--result, #232733);
    }
    .game-W { --result: var(--color-win); }
    .game-L { --result: #d4786c; }
    .game-D { --result: var(--color-text-muted); }

    .game-icon :global(.fi) { width: 36px; height: 36px; display: block; object-fit: contain; }
    .game-who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .game-who b { color: var(--color-text-bright); font-size: 1.02rem; font-weight: 700; }
    .game-who span { font-size: 0.85rem; color: var(--color-text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .game-end { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .game-result {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--result);
    }
    .game-date { font-size: 0.82rem; color: var(--color-text-faint); font-variant-numeric: tabular-nums; white-space: nowrap; }

    /* ── Achievements ── */
    .achievements { padding: 16px 18px; }
    .achievements .section-title { margin: 0 0 10px; }

    .achievement-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 8px;
    }

    .achievement {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 10px 12px;
        background: #0f1218;
        border: 1px solid #1c2029;
        border-radius: 5px;
    }

    .achievement b { color: var(--color-accent-bright); font-size: 0.92rem; }
    .achievement span { font-size: 0.8rem; color: var(--color-text-dim); }

    @media (max-width: 560px) {
        .page-title { font-size: 2.1rem; }
        .header { padding: 14px; gap: 12px; }
        .system-head, .block { padding-left: 14px; padding-right: 14px; }
        .game { padding: 11px 14px; gap: 10px; }
        .achievement-grid { grid-template-columns: 1fr 1fr; }
    }
</style>
