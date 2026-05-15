<script lang="ts">
    let { data } = $props();

    function factionToSlug(name: string | null): string | null {
        if (!name) return null;
        return name
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
    }

    function factionIconUrl(name: string | null): string | null {
        const slug = factionToSlug(name);
        return slug ? `/icons/TOW/${slug}.png` : null;
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
</script>

<h2 class="page-heading">League Rankings</h2>

<div class="table-wrap">
    <table class="league-table">
        <thead>
            <tr>
                <th class="center rank-col">Rank</th>
                <th class="center elo-col">ELO</th>
                <th>Name</th>
                <th>Most Played Faction</th>
                <th class="center wdl-col">W/D/L</th>
                <th class="center games-col">Games</th>
            </tr>
        </thead>
        <tbody>
            {#each data.rankings as row}
                <tr class={`row-rank-${row.rank <= 3 ? row.rank : 'plain'}`}>
                    <td class="center rank-col">
                        {#if medal(row.rank)}
                            <span class="medal">{medal(row.rank)}</span>
                        {:else}
                            {row.rank}
                        {/if}
                    </td>
                    <td class="center elo-col">{row.rating.toFixed(0)}</td>
                    <td>
                        <a href="/players/{row.player_id}" class="name-link">{row.name}</a>
                    </td>
                    <td>
                        {#if row.most_played_faction}
                            <span class="faction-cell">
                                {#if factionIconUrl(row.most_played_faction)}
                                    <img src={factionIconUrl(row.most_played_faction)} alt="" class="faction-icon" />
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

<style>
    .page-heading {
        font-size: 1.5rem;
        margin: 0 0 1rem;
    }

    .table-wrap {
        overflow-x: auto;
        background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-dark) 100%);
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

    .row-rank-1 td { background: linear-gradient(90deg, rgba(255, 215, 0, 0.10), transparent 60%); }
    .row-rank-2 td { background: linear-gradient(90deg, rgba(192, 192, 192, 0.10), transparent 60%); }
    .row-rank-3 td { background: linear-gradient(90deg, rgba(205, 127, 50, 0.10), transparent 60%); }
</style>