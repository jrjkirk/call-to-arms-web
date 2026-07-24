<script lang="ts">
    import { onMount } from 'svelte';
    import { fly, fade } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { PUBLIC_API_URL } from '$env/static/public';
    import { factionIconUrl, systemFolder } from '$lib/factions';
    import { getSystemsConfig, configFor, leagueSystems, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from '$lib/systemsConfig';
    import { getClubSlugFromHostname } from '$lib/clubSlug';
    import SystemPicker from '$lib/SystemPicker.svelte';

    // One "Leagues" page for the whole club: a row of system tiles (same
    // pattern as /pairings and /players) picks which system's league to show
    // below, sourced from has_league — which reflects THIS club's own
    // ClubSystem.league_enabled once systemsConfig is club-scoped (passing
    // the hostname-derived club slug is what makes that scoping happen).
    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);
    const leagueSystemsList = $derived(leagueSystems(systemsConfig));

    let selectedSystem = $state<string | null>(null);
    // Once the real per-club league list resolves, default to its first
    // entry (only if nothing's been picked yet — never fights a user's
    // in-progress selection).
    $effect(() => {
        if (selectedSystem === null && leagueSystemsList.length > 0) {
            selectedSystem = leagueSystemsList[0].legacy_system_name;
        }
    });

    function selectSystem(s: string) {
        selectedSystem = s;
        rankings = [];
        factions = [];
        selectedFaction = null;
        factionStats = null;
        viewingSeasonId = null; // back to the current season on a system switch
        // Loading itself is handled by the $effect watching selectedSystem.
    }

    const leagueFactions = $derived(
        selectedSystem ? configFor(systemsConfig, selectedSystem).faction_list : []
    );
    const leagueFolder = $derived(
        selectedSystem ? systemFolder(selectedSystem, systemsConfig) : undefined
    );

    let rankings = $state<any[]>([]);
    let allPlayers = $state<{ id: number; name: string }[]>([]);

    /* ---------- seasons ---------- */
    type Champion = { player_id: number; name: string; rating: number };
    type SeasonRow = { id: number; name: string; start_date: string; end_date: string | null; current: boolean; champion: Champion | null };
    let seasons = $state<SeasonRow[]>([]);
    // null = viewing the current season; otherwise an archived season's id.
    // Archived seasons are read-only (no results submission).
    let viewingSeasonId = $state<number | null>(null);
    const pastSeasons = $derived(seasons.filter((s) => !s.current && s.champion));
    const viewingSeason = $derived(seasons.find((s) => s.id === viewingSeasonId) ?? null);

    async function loadSeasons() {
        if (!selectedSystem) return;
        try {
            const params = new URLSearchParams({ system: selectedSystem });
            const r = await fetch(`${PUBLIC_API_URL}/league/seasons?${params}`, { credentials: 'include' });
            seasons = r.ok ? await r.json() : [];
        } catch (_) {
            seasons = [];
        }
    }

    function onSeasonChange(e: Event) {
        const val = (e.target as HTMLSelectElement).value;
        viewingSeasonId = val === '' ? null : Number(val);
        loadRankings();
    }

    /* ---------- faction filter ---------- */
    let factions = $state<string[]>([]);
    let selectedFaction = $state<string | null>(null);
    let factionStats = $state<{ player_id: number; player_name: string; wins: number; draws: number; losses: number; total_games: number; adjusted_win_rate: number }[] | null>(null);
    let factionStatsLoading = $state(false);

    async function loadRankings() {
        if (!selectedSystem) return;
        try {
            const params = new URLSearchParams({ system: selectedSystem });
            if (viewingSeasonId !== null) params.set('season_id', String(viewingSeasonId));
            const [rankingsResp, playersResp] = await Promise.all([
                fetch(`${PUBLIC_API_URL}/league/rankings?${params}`, { credentials: 'include' }),
                fetch(`${PUBLIC_API_URL}/players`, { credentials: 'include' }),
            ]);
            if (rankingsResp.ok) rankings = await rankingsResp.json();
            if (playersResp.ok) allPlayers = await playersResp.json();
        } catch (_) {}
    }

    async function loadFactions() {
        if (!selectedSystem) return;
        try {
            const params = new URLSearchParams({ system: selectedSystem });
            const r = await fetch(`${PUBLIC_API_URL}/league/factions?${params}`, { credentials: 'include' });
            factions = r.ok ? (await r.json()).factions : [];
        } catch (_) {
            factions = [];
        }
    }

    async function loadFactionStats(faction: string) {
        if (!selectedSystem) return;
        factionStatsLoading = true;
        factionStats = null;
        try {
            const params = new URLSearchParams({ faction, system: selectedSystem });
            const r = await fetch(`${PUBLIC_API_URL}/league/faction-stats?${params}`, { credentials: 'include' });
            if (r.ok) {
                const data = await r.json();
                factionStats = data.players;
            }
        } catch (_) {}
        factionStatsLoading = false;
    }

    function onFactionChange(e: Event) {
        const val = (e.target as HTMLSelectElement).value;
        selectedFaction = val === '' ? null : val;
        if (selectedFaction) {
            loadFactionStats(selectedFaction);
        } else {
            factionStats = null;
        }
    }

    function wdl(row: { wins: number; draws: number; losses: number }): string {
        return `${row.wins}/${row.draws}/${row.losses}`;
    }

    function medal(rank: number): string {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return '';
    }

    /* ---------- auth ---------- */
    type AuthState = {
        authenticated: boolean;
        user?: { discord_name: string; player_id: number | null };
        player?: { id: number; name: string } | null;
    };
    let auth = $state<AuthState>({ authenticated: false });
    let authLoaded = $state(false);
    let systemsConfigLoaded = $state(false);
    const pageReady = $derived(authLoaded && systemsConfigLoaded);

    let mobileFactionLabel = $state('Most Played Faction');

    if (typeof window !== 'undefined') {
        const mq = window.matchMedia('(max-width: 600px)');
        const update = () => (mobileFactionLabel = mq.matches ? 'Faction' : 'Most Played Faction');
        update();
        mq.addEventListener('change', update);
    }

    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/me`, { credentials: 'include' });
            if (r.ok) auth = await r.json();
        } catch (_) {}
        authLoaded = true;
        // Club slug is required here (unlike the old single-league page) so
        // has_league reflects THIS club's own leagues, not the platform
        // catalogue default — see leagueSystems()'s doc comment.
        const club = getClubSlugFromHostname(window.location.hostname);
        systemsConfig = await getSystemsConfig(club);
        systemsConfigLoaded = true;
    });

    // Once a system is selected (either the auto-picked default above, or a
    // user click), load its rankings + factions + seasons.
    $effect(() => {
        if (selectedSystem) {
            loadRankings();
            loadFactions();
            loadSeasons();
        }
    });

    /* ---------- players sorted for form dropdowns ---------- */
    const sortedPlayers = $derived(
        [...allPlayers].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    );

    /* ---------- submission form ---------- */
    let p1IdStr = $state('');
    let p2IdStr = $state('');
    let p1Faction = $state('— None —');
    let p2Faction = $state('— None —');
    let p1Painting = $state('— None —');
    let p2Painting = $state('— None —');
    let gameType = $state('Competitive');
    let resultValue = $state('Player 1 Victory');

    let submitting = $state(false);
    let submitSuccess = $state<{ duplicate: boolean; result?: any } | null>(null);
    let submitError = $state<string | null>(null);

    // Default Player 1 to the logged-in user's own player, once auth resolves.
    $effect(() => {
        if (auth.player && p1IdStr === '') {
            p1IdStr = String(auth.player.id);
        }
    });

    const canSubmit = $derived(
        p1IdStr !== '' && p2IdStr !== '' && p1IdStr !== p2IdStr && !submitting && !!selectedSystem
        && viewingSeasonId === null
    );

    function signedDelta(before: number | null, after: number | null): string {
        const d = Math.round(after ?? 0) - Math.round(before ?? 0);
        return d >= 0 ? `+${d}` : String(d);
    }

    async function submitLeagueResult() {
        if (!canSubmit || !selectedSystem) return;
        submitting = true;
        submitSuccess = null;
        submitError = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/league/results`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    player_1_id: Number(p1IdStr),
                    player_2_id: Number(p2IdStr),
                    player_1_faction: p1Faction === '— None —' ? null : p1Faction,
                    player_2_faction: p2Faction === '— None —' ? null : p2Faction,
                    player_1_painting_bonus: p1Painting === '— None —' ? null : p1Painting,
                    player_2_painting_bonus: p2Painting === '— None —' ? null : p2Painting,
                    game_type: gameType,
                    result: resultValue,
                    system: selectedSystem,
                }),
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                submitError = body.detail || 'Could not submit the result.';
            } else {
                submitSuccess = body;
                if (!body.duplicate) {
                    await loadRankings();
                }
            }
        } catch (_) {
            submitError = 'Network error. Please try again.';
        }
        submitting = false;
    }
</script>

{#if pageReady}
<div class="page-reveal" in:fly={{ y: 24, duration: 550, easing: cubicOut }}>

{#if leagueSystemsList.length > 0}
    <SystemPicker
        systems={leagueSystemsList.map((s) => s.legacy_system_name)}
        {systemsConfig}
        isActive={(s) => selectedSystem === s}
        onSelect={selectSystem}
    />
{:else}
    <p class="muted">This club doesn't have any leagues set up yet.</p>
{/if}

{#if selectedSystem}
{#if seasons.length > 1}
    <div class="faction-filter-row season-select-row">
        <label class="faction-filter-label" for="season-select">Season</label>
        <select id="season-select" class="field-select faction-filter-select" value={viewingSeasonId ?? ''} onchange={onSeasonChange}>
            {#each seasons as s}
                <option value={s.id}>{s.name}{s.current ? ' (current)' : ''}</option>
            {/each}
        </select>
    </div>
{/if}

{#if viewingSeason && !viewingSeason.current}
    <p class="archive-banner">
        Viewing the archived <strong>{viewingSeason.name}</strong> season
        ({viewingSeason.start_date} – {viewingSeason.end_date ?? 'ongoing'}).
        {#if viewingSeason.champion}Champion: <strong>{viewingSeason.champion.name}</strong> ({Math.round(viewingSeason.champion.rating)}).{/if}
        <button type="button" class="link-button" onclick={() => { viewingSeasonId = null; loadRankings(); }}>Back to current season</button>
    </p>
{/if}

{#if pastSeasons.length > 0}
    <details class="champions-section">
        <summary class="submit-toggle">Hall of Champions</summary>
        <ul class="champions-list">
            {#each pastSeasons as s}
                <li>
                    <span class="champion-season">{s.name}</span>
                    <span class="champion-name">🏆 {s.champion?.name}</span>
                    <span class="muted small">({Math.round(s.champion?.rating ?? 0)})</span>
                </li>
            {/each}
        </ul>
    </details>
{/if}

<div class="faction-filter-row">
    <label class="faction-filter-label" for="faction-filter">Filter by faction</label>
    <select id="faction-filter" class="field-select faction-filter-select" onchange={onFactionChange}>
        <option value="">All factions</option>
        {#each factions as f}
            <option value={f}>{f}</option>
        {/each}
    </select>
</div>

{#if !selectedFaction}
    <div class="table-wrap">
        <table class="league-table">
            <thead>
                <tr>
                    <th class="center rank-col">Rank</th>
                    <th class="rank-change-col"></th>
                    <th class="center elo-col">ELO</th>
                    <th>Name</th>
                    <th class="center faction-col">{mobileFactionLabel}</th>
                    <th class="center wdl-col">W/D/L</th>
                    <th class="center games-col">Games</th>
                </tr>
            </thead>
            <tbody>
                {#each rankings as row, i}
                    <tr class={`row-rank-${row.rank <= 3 ? row.rank : 'plain'}`} in:fade={{ duration: 300, delay: Math.min(i, 10) * 40 }}>
                        <td class="center rank-col">
                            {#if medal(row.rank)}
                                <span class="medal">{medal(row.rank)}</span>
                            {:else}
                                {row.rank}
                            {/if}
                        </td>
                        <td class="rank-change-col">
                            {#if row.previous_rank != null && row.previous_rank !== row.rank}
                                {@const delta = row.previous_rank - row.rank}
                                <span class="rank-change {delta > 0 ? 'rank-up' : 'rank-down'}">
                                    {delta > 0 ? '▲' : '▼'}{Math.abs(delta)}
                                </span>
                            {/if}
                        </td>
                        <td class="center elo-col">{row.rating.toFixed(0)}</td>
                        <td>
                            <a href="/players/{row.player_id}" class="name-link">{row.name}</a>
                        </td>
                        <td class="center faction-col">
                            {#if row.most_played_faction}
                                <span class="faction-cell">
                                    {#if factionIconUrl(row.most_played_faction, leagueFolder)}
                                        <img src={factionIconUrl(row.most_played_faction, leagueFolder)} alt={row.most_played_faction} class="faction-icon" />
                                    {/if}
                                    <em class="faction-name">{row.most_played_faction}</em>
                                </span>
                            {:else}
                                <span class="faction-empty">—</span>
                            {/if}
                        </td>
                        <td class="center wdl-col">{wdl(row)}</td>
                        <td class="center games-col">{row.total_games}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{:else}
    <p class="faction-filter-label faction-showing-label">Showing results for {selectedFaction}</p>
    <div class="table-wrap">
        <table class="league-table">
            <thead>
                <tr>
                    <th class="center rank-col">Rank</th>
                    <th>Name</th>
                    <th class="center wdl-col">W/D/L</th>
                    <th class="center winrate-col">
                        BAYESIAN WIN RATE
                        <span
                            class="info-tooltip"
                            title="Bayesian-adjusted win rate — draws count as half a win. Players with fewer games are weighted toward 50% to account for small samples. After around 10 games your record speaks for itself. Formula: (wins + 0.5 × draws + 2.5) / (games + 5)"
                        >ⓘ</span>
                    </th>
                    <th class="center games-col">Games</th>
                </tr>
            </thead>
            <tbody>
                {#if factionStatsLoading}
                    <tr><td colspan="5" class="center loading-cell">Loading…</td></tr>
                {:else if factionStats !== null && factionStats.length === 0}
                    <tr><td colspan="5" class="center empty-cell">No league games recorded with this faction yet.</td></tr>
                {:else if factionStats !== null}
                    {#each factionStats as row, i}
                        {@const rank = i + 1}
                        <tr class={`row-rank-${rank <= 3 ? rank : 'plain'}`} in:fade={{ duration: 300, delay: Math.min(i, 10) * 40 }}>
                            <td class="center rank-col">
                                {#if medal(rank)}
                                    <span class="medal">{medal(rank)}</span>
                                {:else}
                                    {rank}
                                {/if}
                            </td>
                            <td>
                                <a href="/players/{row.player_id}" class="name-link">{row.player_name}</a>
                            </td>
                            <td class="center wdl-col">{wdl(row)}</td>
                            <td class="center winrate-col">{Math.round(row.adjusted_win_rate * 100)}%</td>
                            <td class="center games-col">{row.total_games}</td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>
{/if}

<details class="submit-section">
    <summary class="submit-toggle">Results Submission</summary>
    <div class="submit-body">
        {#if viewingSeason && !viewingSeason.current}
            <p class="muted">
                Results can only be submitted to the current season.
                <button type="button" class="link-button" onclick={() => { viewingSeasonId = null; loadRankings(); }}>Switch to the current season</button> to submit a result.
            </p>
        {:else if !authLoaded}
            <p class="muted">Loading…</p>
        {:else if !auth.authenticated || !auth.player}
            <p class="sign-in-prompt">
                <a href={`${PUBLIC_API_URL}/auth/discord/login`}>Sign in with Discord</a> to submit a league result.
            </p>
        {:else}
            {#if submitSuccess}
                {#if submitSuccess.duplicate}
                    <div class="result-msg result-msg--info">
                        This exact league result has already been submitted, so a duplicate was not created.
                    </div>
                {:else}
                    <div class="result-msg result-msg--success">
                        <strong>Result submitted!</strong><br />
                        {#if submitSuccess.result}
                            {submitSuccess.result.player_1_name}: {signedDelta(submitSuccess.result.player_1_rating_before, submitSuccess.result.player_1_rating_after)} → {Math.round(submitSuccess.result.player_1_rating_after ?? 0)}<br />
                            {submitSuccess.result.player_2_name}: {signedDelta(submitSuccess.result.player_2_rating_before, submitSuccess.result.player_2_rating_after)} → {Math.round(submitSuccess.result.player_2_rating_after ?? 0)}
                        {/if}
                    </div>
                {/if}
            {/if}

            {#if submitError}
                <div class="result-msg result-msg--error">{submitError}</div>
            {/if}

            <form class="submit-form" onsubmit={(e) => { e.preventDefault(); submitLeagueResult(); }}>
                <div class="form-row">
                    <div class="field">
                        <label class="field-label" for="lr-p1">Player 1</label>
                        <select id="lr-p1" class="field-select" bind:value={p1IdStr}>
                            <option value="">— None —</option>
                            {#each sortedPlayers as p}
                                <option value={String(p.id)}>#{p.id} — {p.name}</option>
                            {/each}
                        </select>
                    </div>
                    <div class="field">
                        <label class="field-label" for="lr-p2">Player 2</label>
                        <select id="lr-p2" class="field-select" bind:value={p2IdStr}>
                            <option value="">— None —</option>
                            {#each sortedPlayers as p}
                                <option value={String(p.id)}>#{p.id} — {p.name}</option>
                            {/each}
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="field">
                        <label class="field-label" for="lr-p1-faction">Player 1 Faction</label>
                        <select id="lr-p1-faction" class="field-select" bind:value={p1Faction}>
                            <option>— None —</option>
                            {#each leagueFactions as f}
                                <option>{f}</option>
                            {/each}
                        </select>
                    </div>
                    <div class="field">
                        <label class="field-label" for="lr-p2-faction">Player 2 Faction</label>
                        <select id="lr-p2-faction" class="field-select" bind:value={p2Faction}>
                            <option>— None —</option>
                            {#each leagueFactions as f}
                                <option>{f}</option>
                            {/each}
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="field">
                        <label class="field-label" for="lr-p1-paint">Player 1 Painting Bonus</label>
                        <select id="lr-p1-paint" class="field-select" bind:value={p1Painting}>
                            <option>— None —</option>
                            <option>Partially Painted</option>
                            <option>Fully Painted</option>
                        </select>
                    </div>
                    <div class="field">
                        <label class="field-label" for="lr-p2-paint">Player 2 Painting Bonus</label>
                        <select id="lr-p2-paint" class="field-select" bind:value={p2Painting}>
                            <option>— None —</option>
                            <option>Partially Painted</option>
                            <option>Fully Painted</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="field">
                        <label class="field-label" for="lr-game-type">Game Type</label>
                        <select id="lr-game-type" class="field-select" bind:value={gameType}>
                            <option>Competitive</option>
                            <option>Casual</option>
                        </select>
                        <p class="field-caption">Casual and Competitive use different rating weights (K values) — see this system's league settings in the admin panel.</p>
                    </div>
                    <div class="field">
                        <label class="field-label" for="lr-result">Result</label>
                        <select id="lr-result" class="field-select" bind:value={resultValue}>
                            <option>Player 1 Victory</option>
                            <option>Player 2 Victory</option>
                            <option>Draw</option>
                        </select>
                    </div>
                </div>

                {#if p1IdStr && p2IdStr && p1IdStr === p2IdStr}
                    <p class="field-error">Player 1 and Player 2 must be different.</p>
                {/if}

                <button type="submit" class="primary-button" disabled={!canSubmit}>
                    {submitting ? 'Submitting…' : 'Submit Result'}
                </button>
            </form>
        {/if}
    </div>
</details>
{/if}

</div>
{/if}

<style>
    .page-heading {
        font-size: 1.6rem;
        margin: 0 0 1.1rem;
    }

    .muted {
        color: var(--color-text-muted);
        font-style: italic;
    }

    .table-wrap {
        overflow-x: auto;
        background: var(--color-surface);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.34);
    }

    .league-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        color: var(--color-text-base);
    }

    .league-table thead th {
        background: rgba(0, 0, 0, 0.22);
        color: var(--color-accent);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 1.1px;
        font-weight: 700;
        padding: 12px 14px;
        text-align: left;
        border-bottom: 1px solid var(--color-steel-border);
    }

    .league-table thead th.center {
        text-align: center;
    }

    .league-table tbody td {
        padding: 13px 14px;
        border-bottom: 1px solid var(--color-steel-border-soft);
        font-size: 0.95rem;
        vertical-align: middle;
    }

    .league-table tbody tr:last-child td {
        border-bottom: none;
    }

    .league-table tbody tr:hover {
        background: var(--color-surface-hover);
    }

    .center { text-align: center; }
    .rank-col { width: 64px; font-weight: 700; color: var(--color-text-bright); font-size: 1.02rem; }
    /* ELO is the headline metric of the standings — give it weight. */
    .elo-col  { width: 84px; font-weight: 700; color: var(--color-accent-bright); font-size: 1.05rem; }
    .wdl-col  { width: 96px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
    .games-col { width: 80px; color: var(--color-text-dim); }

    .medal {
        font-size: 1.3rem;
        line-height: 1;
    }

    .name-link {
        color: var(--color-text-bright);
        font-weight: 600;
        text-decoration: none;
    }

    .name-link:hover {
        text-decoration: underline;
    }

    .faction-cell {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
    }

    .faction-icon {
        width: 26px;
        height: 26px;
        object-fit: contain;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4));
    }

    .faction-name {
        color: var(--color-text-muted);
        font-style: italic;
    }

    .faction-empty {
        color: var(--color-text-faint);
    }

    /* Podium: a flat gilt tint + a gilt edge on the champion's first cell, so
       the leader reads as the leader at a glance. Silver and bronze get
       quieter tints of the same idea. */
    .row-rank-1 td { background: rgba(201, 161, 74, 0.16); }
    .row-rank-1 td:first-child { box-shadow: inset 3px 0 0 var(--color-accent); }
    .row-rank-1 .elo-col { color: var(--color-accent-bright); }
    .row-rank-2 td { background: rgba(192, 200, 214, 0.06); }
    .row-rank-2 td:first-child { box-shadow: inset 3px 0 0 rgba(192, 200, 214, 0.5); }
    .row-rank-3 td { background: rgba(184, 115, 51, 0.08); }
    .row-rank-3 td:first-child { box-shadow: inset 3px 0 0 rgba(184, 115, 51, 0.6); }
    .rank-change {
        font-size: 0.7rem;
        font-weight: 600;
        white-space: nowrap;
    }
    .rank-up { color: rgb(110, 180, 110); }
    .rank-down { color: rgb(210, 80, 80); }

    .league-table thead tr th.rank-change-col,
    .league-table tbody tr td.rank-change-col {
        width: 28px;
        padding: 0 2px;
        text-align: center;
    }

    @media (max-width: 600px) {
        .league-table thead th,
        .league-table tbody td {
            padding: 8px 6px;
            font-size: 0.85rem;
        }

        .games-col { display: none; }

        .faction-col { width: 44px; }

        .faction-cell {
            justify-content: center;
        }

        .faction-name {
            display: none;
        }

        .faction-icon {
            width: 24px;
            height: 24px;
        }

        .medal { font-size: 1.1rem; }
    }

    /* ---------- faction filter ---------- */

    .faction-filter-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .faction-filter-label {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--color-accent);
        white-space: nowrap;
    }

    .faction-filter-select {
        max-width: 260px;
    }

    .faction-showing-label {
        margin: 0 0 0.6rem;
    }

    .season-select-row {
        margin-bottom: 0.75rem;
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

    .archive-banner {
        background: rgba(148, 163, 184, 0.1);
        border: 1px solid rgba(148, 163, 184, 0.3);
        border-radius: var(--radius);
        padding: 10px 14px;
        font-size: 0.85rem;
        color: var(--color-text-muted);
        margin: 0 0 1rem;
        line-height: 1.5;
    }

    .champions-section {
        margin-bottom: 1rem;
        background: var(--color-surface);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        overflow: hidden;
    }

    .champions-list {
        list-style: none;
        margin: 0;
        padding: 0.75rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .champions-list li {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        font-size: 0.9rem;
    }

    .champion-season {
        font-weight: 700;
        color: var(--color-text-bright);
        min-width: 5rem;
    }

    .champion-name {
        color: var(--color-accent);
    }

    .winrate-col { width: 96px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }

    .info-tooltip {
        display: inline-block;
        margin-left: 3px;
        cursor: help;
        opacity: 0.75;
        font-size: 0.85em;
    }

    .info-tooltip:hover {
        opacity: 1;
    }

    .loading-cell,
    .empty-cell {
        padding: 18px 12px;
        color: var(--color-text-muted);
        font-style: italic;
        font-size: 0.9rem;
    }

    /* ---------- submission section ---------- */

    .submit-section {
        margin-top: 2rem;
        background: var(--color-surface);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.34);
        overflow: hidden;
    }

    .submit-toggle {
        padding: 14px 16px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--color-accent);
        background: rgba(0, 0, 0, 0.25);
        border-bottom: 1px solid transparent;
        user-select: none;
        list-style: none;
    }

    .submit-section[open] .submit-toggle {
        border-bottom-color: var(--color-steel-border);
    }

    .submit-toggle::-webkit-details-marker { display: none; }
    .submit-toggle::before {
        content: '▶ ';
        font-size: 0.65rem;
        vertical-align: middle;
        transition: transform 0.15s;
        display: inline-block;
    }
    .submit-section[open] .submit-toggle::before {
        transform: rotate(90deg);
    }

    .submit-body {
        padding: 1.25rem 1rem;
    }

    .sign-in-prompt {
        color: var(--color-text-muted);
        font-size: 0.95rem;
        margin: 0;
    }

    .sign-in-prompt a {
        color: var(--color-accent);
        font-weight: 600;
        text-decoration: none;
    }

    .sign-in-prompt a:hover {
        text-decoration: underline;
    }

    .submit-form {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    @media (max-width: 560px) {
        .form-row {
            grid-template-columns: 1fr;
        }
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }

    .field-label {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--color-accent);
    }

    .field-select {
        background: var(--color-surface-dark);
        border: 1px solid var(--color-accent-border);
        border-radius: var(--radius);
        color: var(--color-text-base);
        padding: 7px 10px;
        font-size: 0.9rem;
        width: 100%;
        cursor: pointer;
    }

    .field-select:focus {
        outline: none;
        border-color: var(--color-accent);
    }

    .field-caption {
        font-size: 0.75rem;
        color: var(--color-text-muted);
        margin: 0;
    }

    .field-error {
        font-size: 0.8rem;
        color: #f87171;
        margin: 0;
    }

    .primary-button {
        align-self: flex-start;
        background: var(--color-accent);
        color: #111;
        border: none;
        border-radius: var(--radius);
        padding: 9px 20px;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
        transition: opacity 0.15s;
    }

    .primary-button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }

    .primary-button:not(:disabled):hover {
        opacity: 0.85;
    }

    .result-msg {
        border-radius: var(--radius);
        padding: 10px 14px;
        font-size: 0.9rem;
        line-height: 1.5;
    }

    .result-msg--success {
        background: rgba(74, 222, 128, 0.12);
        border: 1px solid rgba(74, 222, 128, 0.35);
        color: #86efac;
    }

    .result-msg--info {
        background: rgba(148, 163, 184, 0.1);
        border: 1px solid rgba(148, 163, 184, 0.3);
        color: var(--color-text-muted);
    }

    .result-msg--error {
        background: rgba(248, 113, 113, 0.12);
        border: 1px solid rgba(248, 113, 113, 0.35);
        color: #fca5a5;
    }
</style>
