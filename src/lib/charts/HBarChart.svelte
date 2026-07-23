<!--
  Single-series horizontal bar chart (hand-rolled inline SVG). Used for ranked
  categorical magnitudes like faction popularity. Category labels sit in muted
  ink at the left; each gilt bar has a 4px rounded right end and a direct value
  label. Rows are sized to the data, so the SVG height grows with the category
  count. Empty state included.
-->
<script lang="ts">
    type Row = { label: string; value: number };

    let {
        data,
    }: {
        /** Pre-sorted (largest first) is expected but not required. */
        data: Row[];
    } = $props();

    const W = 640;
    const ROW_H = 30;
    const GAP = 8;
    const PAD = { top: 8, right: 40, bottom: 8, left: 150 };
    const plotW = W - PAD.left - PAD.right;

    const H = $derived(PAD.top + PAD.bottom + data.length * ROW_H);
    const maxVal = $derived(Math.max(1, ...data.map((d) => d.value)));

    function barW(v: number): number {
        return (v / maxVal) * plotW;
    }
    function rowY(i: number): number {
        return PAD.top + i * ROW_H;
    }

    let hovered = $state<number | null>(null);

    function truncate(s: string): string {
        return s.length > 20 ? s.slice(0, 19) + '…' : s;
    }
</script>

{#if data.length === 0}
    <div class="chart-empty">No data yet.</div>
{:else}
    <figure class="chart" role="img" aria-label="Ranked horizontal bar chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            <title>Ranked bars</title>
            {#each data as d, i}
                <g
                    class="row"
                    class:on={hovered === i}
                    onpointerenter={() => (hovered = i)}
                    onpointerleave={() => (hovered = null)}
                    role="presentation"
                >
                    <!-- full-width hit target -->
                    <rect class="hit" x="0" y={rowY(i)} width={W} height={ROW_H} />
                    <text class="cat" x={PAD.left - 10} y={rowY(i) + (ROW_H - GAP) / 2 + 4} text-anchor="end">
                        {truncate(d.label)}
                    </text>
                    <rect
                        class="bar"
                        x={PAD.left}
                        y={rowY(i)}
                        width={Math.max(2, barW(d.value))}
                        height={ROW_H - GAP}
                        rx="4"
                    />
                    <text class="val" x={PAD.left + Math.max(2, barW(d.value)) + 8} y={rowY(i) + (ROW_H - GAP) / 2 + 4}>
                        {d.value}
                    </text>
                </g>
            {/each}
        </svg>
    </figure>
{/if}

<style>
    .chart {
        position: relative;
        margin: 0;
        width: 100%;
    }
    svg {
        width: 100%;
        height: auto;
        display: block;
    }
    .hit {
        fill: transparent;
    }
    .row.on .hit {
        fill: var(--color-surface-hover);
    }
    .cat {
        fill: var(--color-text-muted);
        font-size: 13px;
        font-family: var(--font-display);
    }
    .bar {
        fill: var(--color-accent);
        transition: fill 0.12s ease;
    }
    .row.on .bar {
        fill: var(--color-accent-bright);
    }
    .val {
        fill: var(--color-text-dim);
        font-size: 12px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        font-family: var(--font-display);
    }
    .chart-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 140px;
        color: var(--color-text-faint);
        font-style: italic;
        border: 1px dashed var(--color-steel-border);
        border-radius: var(--radius);
    }
    @media (prefers-reduced-motion: reduce) {
        .bar {
            transition: none;
        }
    }
</style>
