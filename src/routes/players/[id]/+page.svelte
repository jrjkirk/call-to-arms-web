<script lang="ts">
    let { data } = $props();

    const player = $derived(data.player);
    const league = $derived(data.league);
    const hasLeagueGames = $derived(league.total_games > 0);

    function formatResult(r: any): string {
        if (r.result === 'Draw') return 'Draw';
        const playerWasOne = r.player_1_id === player.id;
        const playerWon =
            (r.result === 'Player 1 Victory' && playerWasOne) ||
            (r.result === 'Player 2 Victory' && !playerWasOne);
        return playerWon ? 'Win' : 'Loss';
    }

    function opponentName(r: any): string {
        return r.player_1_id === player.id ? r.player_2_name : r.player_1_name;
    }

    function opponentFaction(r: any): string | null {
        return r.player_1_id === player.id ? r.player_2_faction : r.player_1_faction;
    }

    function playerFaction(r: any): string | null {
        return r.player_1_id === player.id ? r.player_1_faction : r.player_2_faction;
    }
</script>

<p><a href="/players">← All players</a></p>

<h1>{player.name}</h1>

{#if player.default_faction}
    <p class="default-faction">Default faction: {player.default_faction}</p>
{/if}

{#if hasLeagueGames}
    <section class="league">
        <h2>Old World League</h2>

        <div class="stats">
            <div class="stat">
                <div class="value">{league.rating?.toFixed(0) ?? '—'}</div>
                <div class="label">Rating</div>
            </div>
            <div class="stat">
                <div class="value">{league.wins}</div>
                <div class="label">Wins</div>
            </div>
            <div class="stat">
                <div class="value">{league.losses}</div>
                <div class="label">Losses</div>
            </div>
            <div class="stat">
                <div class="value">{league.draws}</div>
                <div class="label">Draws</div>
            </div>
            <div class="stat">
                <div class="value">{league.total_games}</div>
                <div class="label">Games</div>
            </div>
        </div>

        <h3>Recent results</h3>
        <ul class="results">
            {#each league.recent_results as r}
                <li class={`result result-${formatResult(r).toLowerCase()}`}>
                    <span class="outcome">{formatResult(r)}</span>
                    <span class="opponent">vs {opponentName(r)}</span>
                    {#if playerFaction(r) || opponentFaction(r)}
                        <span class="factions">
                            ({playerFaction(r) ?? '?'} vs {opponentFaction(r) ?? '?'})
                        </span>
                    {/if}
                    <span class="date">{r.result_date}</span>
                </li>
            {/each}
        </ul>
    </section>
{:else}
    <p class="empty">No Old World League games yet.</p>
{/if}

<style>
    .default-faction {
        color: #666;
        margin-top: -0.5rem;
    }

    .league {
        margin-top: 2rem;
    }

    .stats {
        display: flex;
        gap: 1.5rem;
        flex-wrap: wrap;
        margin: 1rem 0 2rem;
    }

    .stat {
        text-align: center;
    }

    .stat .value {
        font-size: 1.75rem;
        font-weight: bold;
    }

    .stat .label {
        color: #666;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .results {
        list-style: none;
        padding: 0;
    }

    .result {
        display: flex;
        gap: 0.75rem;
        align-items: baseline;
        padding: 0.4rem 0;
        border-bottom: 1px solid #eee;
        font-size: 0.95rem;
    }

    .outcome {
        font-weight: bold;
        min-width: 3rem;
    }

    .result-win .outcome { color: #1a7f37; }
    .result-loss .outcome { color: #cf222e; }
    .result-draw .outcome { color: #666; }

    .factions {
        color: #888;
        font-size: 0.85rem;
    }

    .date {
        margin-left: auto;
        color: #999;
        font-size: 0.85rem;
    }

    .empty {
        color: #666;
        font-style: italic;
    }
</style>