<script lang="ts">
    let { data } = $props();

    const player = $derived(data.player);
    const league = $derived(data.league);
    const hasLeagueGames = $derived(league.total_games > 0);

    function formatOutcome(r: any): string {
        if (r.result === 'Draw') return 'Draw';
        const isP1 = r.player_1_id === player.id;
        const won = (r.result === 'Player 1 Victory' && isP1) || (r.result === 'Player 2 Victory' && !isP1);
        return won ? 'Win' : 'Loss';
    }

    function outcomeClass(r: any): string {
        const o = formatOutcome(r);
        return o === 'Win' ? 'outcome-win' : o === 'Loss' ? 'outcome-loss' : 'outcome-draw';
    }

    function opponent(r: any): { name: string; faction: string | null } {
        const isP1 = r.player_1_id === player.id;
        return {
            name: isP1 ? r.player_2_name : r.player_1_name,
            faction: isP1 ? r.player_2_faction : r.player_1_faction
        };
    }

    function playerFaction(r: any): string | null {
        return r.player_1_id === player.id ? r.player_1_faction : r.player_2_faction;
    }
</script>

<p class="back-link"><a href="/players">← All players</a></p>

<div class="name-banner card">
    <h1>{player.name}</h1>
    {#if player.default_faction}
        <p class="default-faction">{player.default_faction}</p>
    {/if}
</div>

{#if hasLeagueGames}
    <div class="section-title">The Old World League</div>

    <div class="stat-row">
        <div class="stat-card">
            <div class="stat-label">ELO</div>
            <div class="stat-value">{league.rating.toFixed(0)}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Rank</div>
            <div class="stat-value">#{league.rank}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">W / D / L</div>
            <div class="stat-value">{league.wins}/{league.draws}/{league.losses}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">League Games</div>
            <div class="stat-value">{league.total_games}</div>
        </div>
    </div>

    <div class="section-title">Recent League Results</div>

    <ul class="results">
        {#each league.recent_results as r}
            {@const opp = opponent(r)}
            <li class="result">
                <span class="result-date">{r.result_date}</span>
                <span class={outcomeClass(r)}>{formatOutcome(r).toUpperCase()}</span>
                <span class="result-detail">
                    <em>{playerFaction(r) ?? '?'}</em>
                    vs
                    <strong>{opp.name}</strong>
                    ({opp.faction ?? '?'})
                </span>
            </li>
        {/each}
    </ul>
{:else}
    <p class="empty">No Old World League games yet.</p>
{/if}

<style>
    .back-link {
        margin: 0 0 1rem;
        color: var(--color-text-dim);
    }

    .back-link a {
        text-decoration: none;
    }

    .back-link a:hover {
        color: var(--color-text-bright);
    }

    .name-banner {
        padding: 1.1rem 1.4rem;
        margin-bottom: 1rem;
    }

    .name-banner h1 {
        font-size: 1.7rem;
        margin: 0;
    }

    .default-faction {
        color: var(--color-text-dim);
        font-style: italic;
        margin: 0.25rem 0 0;
    }

    .results {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .result {
        display: flex;
        align-items: baseline;
        gap: 1rem;
        padding: 0.55rem 0.25rem;
        border-bottom: 1px dashed var(--color-accent-border-soft);
        font-size: 0.95rem;
        flex-wrap: wrap;
    }

    .result:last-child {
        border-bottom: none;
    }

    .result-date {
        color: var(--color-text-dim);
        font-variant-numeric: tabular-nums;
        min-width: 6rem;
    }

    .result-detail {
        color: var(--color-text-muted);
    }

    .result-detail em {
        color: var(--color-text-bright);
        font-style: italic;
    }

    .result-detail strong {
        color: var(--color-text-bright);
        font-weight: 600;
    }

    .empty {
        color: var(--color-text-dim);
        font-style: italic;
    }
</style>