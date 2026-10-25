<!--
  Single-series horizontal bars, for ranked categories like faction
  popularity. Plain HTML rather than SVG: the names are real text that wraps
  and truncates like the rest of the page, and each row can carry the
  faction's own icon. Gold bars rounded at the far end, value in bright ink
  at the right.
-->
<script lang="ts">
    import FactionIcon from '$lib/FactionIcon.svelte';

    type Row = { label: string; value: number };

    let {
        data,
        /** Icon folder for faction rows; omit for rows without icons. */
        iconFolder = '',
        limit = 8,
    }: {
        /** Pre-sorted (largest first) is expected but not required. */
        data: Row[];
        iconFolder?: string;
        limit?: number;
    } = $props();

    const rows = $derived(data.slice(0, limit));
    const maxVal = $derived(Math.max(1, ...rows.map((d) => d.value)));
</script>

{#if data.length === 0}
    <div class="chart-empty">No data yet</div>
{:else}
    <ol class="hbars" class:icons={!!iconFolder}>
        {#each rows as d}
            <li>
                {#if iconFolder}<FactionIcon faction={d.label} folder={iconFolder} class="hb-icon" />{/if}
                <span class="hb-name" title={d.label}>{d.label}</span>
                <span class="hb-track"><span class="hb-bar" style={`width: ${Math.max(2, (d.value / maxVal) * 100)}%`}></span></span>
                <b class="hb-val">{d.value}</b>
            </li>
        {/each}
    </ol>
{/if}

<style>
    .hbars {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
    }
    li {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(3rem, 1fr) 2rem;
        align-items: center;
        gap: 0.65rem;
    }
    .icons li { grid-template-columns: 1.5rem minmax(0, 1.4fr) minmax(3rem, 1fr) 2rem; }
    :global(.hb-icon) {
        width: 1.5rem;
        height: 1.5rem;
        object-fit: contain;
    }
    .hb-name {
        font-size: 0.9rem;
        color: var(--color-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .hb-track { display: block; }
    .hb-bar {
        display: block;
        height: 10px;
        border-radius: 0 4px 4px 0;
        background: var(--color-accent);
    }
    li:hover .hb-bar { background: var(--color-accent-bright); }
    .hb-val {
        font-family: var(--font-heading);
        font-size: 1.1rem;
        color: var(--color-text-bright);
        text-align: right;
        font-variant-numeric: tabular-nums;
    }
    .chart-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 140px;
        font-family: var(--font-heading);
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--color-text-faint);
    }
</style>
