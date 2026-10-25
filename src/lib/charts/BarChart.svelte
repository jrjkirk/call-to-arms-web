<!--
  Single-series vertical bar chart (hand-rolled inline SVG). Used for discrete
  per-week counts (games-over-time) and frequency histograms (rating spread).
  Gold bars rounded at the top only (anchored flat on the baseline), a small
  gap between neighbours, recessive grid and no y-axis. With `highlightLast`
  (a time series) the latest bar is full gold and labelled, the rest dimmed;
  a histogram has no "latest", so it leaves every bar the same.
-->
<script lang="ts">
    type Bar = { label: string; value: number };

    let {
        data,
        valueSuffix = '',
        highlightLast = false,
    }: {
        data: Bar[];
        valueSuffix?: string;
        highlightLast?: boolean;
    } = $props();

    // Drawn at the width it is shown at, so labels stay real-size text on a
    // phone instead of shrinking with a scaled-down picture.
    let cw = $state(640);
    const W = $derived(Math.max(240, Math.round(cw)));
    const H = 200;
    const PAD = { top: 26, right: 4, bottom: 28, left: 4 };
    const plotW = $derived(W - PAD.left - PAD.right);
    const plotH = H - PAD.top - PAD.bottom;

    const maxVal = $derived(Math.max(1, ...data.map((d) => d.value)));
    const top = $derived(maxVal * 1.1);

    const GAP = 4;
    const bandW = $derived(data.length ? plotW / data.length : plotW);
    const barW = $derived(Math.max(2, bandW - GAP));
    const last = $derived(data.length - 1);

    function barX(i: number): number {
        return PAD.left + i * bandW + (bandW - barW) / 2;
    }
    function barY(v: number): number {
        return PAD.top + plotH - (v / top) * plotH;
    }
    /** Rounded top corners, square on the baseline. */
    function barPath(i: number, v: number): string {
        const x0 = barX(i), x1 = x0 + barW, y0 = barY(v), base = PAD.top + plotH;
        const r = Math.min(4, barW / 2, Math.max(0, base - y0));
        return `M${x0},${base} L${x0},${y0 + r} Q${x0},${y0} ${x0 + r},${y0} L${x1 - r},${y0} Q${x1},${y0} ${x1},${y0 + r} L${x1},${base} Z`;
    }

    let hovered = $state<number | null>(null);
    const labelEvery = $derived(Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(W / 80)))));
</script>

{#if data.length === 0}
    <div class="chart-empty">No data yet</div>
{:else}
    <figure class="chart" bind:clientWidth={cw} role="img" aria-label="Bar chart">
        <svg viewBox={`0 0 ${W} ${H}`} >
            {#each [0.5, 1] as f}
                <line class="grid" x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH * (1 - f)} y2={PAD.top + plotH * (1 - f)} />
            {/each}

            {#each data as d, i}
                <path
                    class="bar"
                    class:dim={highlightLast && i !== last && hovered !== i}
                    class:on={hovered === i}
                    d={barPath(i, d.value)}
                />
                <!-- The hit target is the whole column, so short bars are as
                     easy to hover as tall ones. -->
                <rect
                    class="hit"
                    x={PAD.left + i * bandW}
                    y={PAD.top}
                    width={bandW}
                    height={plotH}
                    onpointerenter={() => (hovered = i)}
                    onpointerleave={() => (hovered = null)}
                    role="presentation"
                />
                {#if (i % labelEvery === 0 && last - i >= labelEvery) || i === last}
                    <text class="axis-x" x={barX(i) + barW / 2} y={H - 8} text-anchor="middle">{d.label}</text>
                {/if}
            {/each}
            {#if highlightLast && hovered === null}
                <text class="latest" x={barX(last) + barW / 2} y={barY(data[last].value) - 8} text-anchor="middle">{data[last].value}{valueSuffix}</text>
            {/if}
        </svg>

        {#if hovered !== null}
            <div
                class="tooltip"
                style={`left:${((barX(hovered) + barW / 2) / W) * 100}%; top:${(barY(data[hovered].value) / H) * 100}%;`}
            >
                <span class="tt-label">{data[hovered].label}</span>
                <span class="tt-value">{data[hovered].value}{valueSuffix}</span>
            </div>
        {/if}
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
        overflow: visible;
    }
    .grid {
        stroke: var(--color-steel-border-soft);
        stroke-width: 1;
    }
    .axis-x {
        fill: var(--color-text-faint);
        font-size: 13px;
        font-family: var(--font-body);
    }
    .bar {
        fill: var(--color-accent);
        transition: fill 0.12s ease, opacity 0.12s ease;
    }
    .bar.dim { opacity: 0.42; }
    .bar.on { fill: var(--color-accent-bright); }
    .hit { fill: transparent; }
    .latest {
        fill: var(--color-text-bright);
        font-size: 16px;
        font-weight: 700;
        font-family: var(--font-body);
        font-variant-numeric: tabular-nums;
    }
    .tooltip {
        position: absolute;
        transform: translate(-50%, calc(-100% - 10px));
        background: var(--color-bg-deep);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        padding: 0.3rem 0.55rem;
        pointer-events: none;
        white-space: nowrap;
        display: flex;
        flex-direction: column;
        gap: 0.05rem;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    }
    .tt-label {
        font-family: var(--font-heading);
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--color-text-dim);
        text-transform: uppercase;
        letter-spacing: 0.1em;
    }
    .tt-value {
        font-family: var(--font-heading);
        font-size: 1.3rem;
        font-weight: 700;
        line-height: 1;
        color: var(--color-text-bright);
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
    @media (prefers-reduced-motion: reduce) {
        .bar { transition: none; }
    }
</style>
