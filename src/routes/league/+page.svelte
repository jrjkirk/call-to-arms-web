<script lang="ts">
    let { data } = $props();

    function recordString(r: { wins: number; losses: number; draws: number }): string {
        const parts = [`${r.wins}W`, `${r.losses}L`];
        if (r.draws > 0) parts.push(`${r.draws}D`);
        return parts.join(' ');
    }

    function rankClass(rank: number): string {
        if (rank === 1) return 'rank-gold';
        if (rank === 2) return 'rank-silver';
        if (rank === 3) return 'rank-bronze';
        return '';
    }
</script>

<h1>Old World League</h1>

<table>
    <thead>
        <tr>
            <th class="rank-col">#</th>
            <th>Player</th>
            <th class="rating-col">Rating</th>
            <th class="record-col">Record</th>
            <th class="games-col">Games</th>
        </tr>
    </thead>
    <tbody>
        {#each data.rankings as row}
            <tr class={rankClass(row.rank)}>
                <td class="rank-col">{row.rank}</td>
                <td>
                    <a href="/players/{row.player_id}">{row.name}</a>
                    {#if row.default_faction}
                        <span class="faction">— {row.default_faction}</span>
                    {/if}
                </td>
                <td class="rating-col">{row.rating.toFixed(0)}</td>
                <td class="record-col">{recordString(row)}</td>
                <td class="games-col">{row.total_games}</td>
            </tr>
        {/each}
    </tbody>
</table>

<style>
    table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1rem;
    }

    th, td {
        text-align: left;
        padding: 0.6rem 0.5rem;
        border-bottom: 1px solid #eee;
    }

    th {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #666;
        font-weight: 600;
    }

    .rank-col {
        text-align: center;
        width: 3rem;
    }

    .rating-col,
    .record-col,
    .games-col {
        text-align: right;
        width: 6rem;
        font-variant-numeric: tabular-nums;
    }

    a {
        text-decoration: none;
        color: inherit;
        font-weight: 500;
    }

    a:hover {
        text-decoration: underline;
    }

    .faction {
        color: #888;
        font-weight: normal;
        font-size: 0.9em;
    }

    .rank-gold td.rank-col { color: #d4a017; font-weight: bold; font-size: 1.1em; }
    .rank-silver td.rank-col { color: #999; font-weight: bold; }
    .rank-bronze td.rank-col { color: #b87333; font-weight: bold; }
</style>