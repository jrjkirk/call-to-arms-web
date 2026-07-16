<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import { factionIconUrl, systemFolder } from '$lib/factions';
    import { getSystemsConfig, configFor, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from '$lib/systemsConfig';

    // The league is The Old World only — its faction dropdowns and the
    // most-played-faction icons both use TOW's backend-owned ruleset,
    // sourced from GET /systems (with FALLBACK until it loads).
    const LEAGUE_SYSTEM = 'The Old World';
    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);
    const leagueFactions = $derived(configFor(systemsConfig, LEAGUE_SYSTEM).faction_list);
    const leagueFolder = $derived(systemFolder(LEAGUE_SYSTEM, systemsConfig));

    let rankings = $state<any[]>([]);
    let allPlayers = $state<{ id: number; name: string }[]>([]);

    /* ---------- faction filter ---------- */
    let factions = $state<string[]>([]);
    let selectedFaction = $state<string | null>(null);
    let factionStats = $state<{ player_id: number; player_name: string; wins: number; draws: number; losses: number; total_games: number; adjusted_win_rate: number }[] | null>(null);
    let factionStatsLoading = $state(false);

    async function loadRankings() {
        try {
            const [rankingsResp, playersResp] = await Promise.all([
                fetch(`${PUBLIC_API_URL}/league/rankings`, { credentials: 'include' }),
                fetch(`${PUBLIC_API_URL}/players`, { credentials: 'include' }),
            ]);
            if (rankingsResp.ok) rankings = await rankingsResp.json();
            if (playersResp.ok) allPlayers = await playersResp.json();
        } catch (_) {}
    }

    async function loadFactionStats(faction: string) {
        factionStatsLoading = true;
        factionStats = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/league/faction-stats?faction=${encodeURIComponent(faction)}`, { credentials: 'include' });
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
        getSystemsConfig().then((c) => (systemsConfig = c));
        // No club param needed — the backend resolves the caller's own club
        // from the session cookie (if logged in) or this request's Origin
        // header (subdomain-based resolution) for anonymous callers.
        await Promise.all([
            loadRankings(),
            fetch(`${PUBLIC_API_URL}/league/factions`, { credentials: 'include' }).then(r => r.ok ? r.json() : { factions: [] }).then(d => { factions = d.factions; }).catch(() => {}),
        ]);
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
        p1IdStr !== '' && p2IdStr !== '' && p1IdStr !== p2IdStr && !submitting
    );

    function signedDelta(before: number | null, after: number | null): string {
        const d = Math.round(after ?? 0) - Math.round(before ?? 0);
        return d >= 0 ? `+${d}` : String(d);
    }

    async function submitLeagueResult() {
        if (!canSubmit) return;
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

<h2 class="page-heading">League Rankings</h2>

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
                {#each rankings as row}
                    <tr class={`row-rank-${row.rank <= 3 ? row.rank : 'plain'}`}>
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
                        <tr class={`row-rank-${rank <= 3 ? rank : 'plain'}`}>
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
    <summary class="submit-toggle">⚔️ Results Submission</summary>
    <div class="submit-body">
        {#if !authLoaded}
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
                        <p class="field-caption">Casual uses K=10, Competitive uses K=40.</p>
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

<style>
    .page-heading {
        font-size: 1.5rem;
        margin: 0 0 1rem;
    }

    .table-wrap {
        overflow-x: auto;
        background: var(--color-sidebar-bg);
        border: 1px solid var(--color-accent-border);
        border-radius: 12px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
    }

    .league-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        color: var(--color-text-base);
    }

    .league-table thead th {
        background: rgba(0, 0, 0, 0.25);
        color: var(--color-accent);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        font-weight: 700;
        padding: 10px 12px;
        text-align: left;
        border-bottom: 1px solid var(--color-accent-border);
    }

    .league-table thead th.center {
        text-align: center;
    }

    .league-table tbody td {
        padding: 10px 12px;
        border-bottom: 1px dashed var(--color-accent-border-soft);
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
    .rank-col { width: 64px; font-weight: 700; color: var(--color-text-bright); }
    .elo-col  { width: 78px; font-weight: 700; color: var(--color-text-bright); }
    .wdl-col  { width: 96px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
    .games-col { width: 80px; color: var(--color-text-muted); }

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

    .row-rank-1 td { background: rgba(255, 215, 0, 0.06); }
    .row-rank-2 td { background: rgba(192, 192, 192, 0.06); }
    .row-rank-3 td { background: rgba(205, 127, 50, 0.06); }
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
        background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-dark) 100%);
        border: 1px solid var(--color-accent-border);
        border-radius: 12px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
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
        border-bottom-color: var(--color-accent-border);
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

    .muted {
        color: var(--color-text-muted);
        font-style: italic;
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
        border-radius: 6px;
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
        border-radius: 8px;
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
        border-radius: 8px;
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
