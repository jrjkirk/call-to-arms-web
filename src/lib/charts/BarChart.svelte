<!--
  Single-series vertical bar chart (hand-rolled inline SVG). Used for discrete
  per-week counts (games-over-time) and frequency histograms (rating spread).
  Thin gilt bars with a 4px rounded top anchored to the baseline, a 2px surface
  gap between neighbours, recessive grid, per-bar hover tooltip, empty state.
-->
<script lang="ts">
    type Bar = { label: string; value: number };

    let {
        data,
        valueSuffix = '',
    }: {
        data: Bar[];
        valueSuffix?: string;
    } = $props();

    const W = 640;
    const H = 280;
    const PAD = { top: 16, right: 18, bottom: 34, left: 44 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    const maxVal = $derived(Math.max(1, ...data.map((d) => d.value)));
    const niceMax = $derived.by(() => {
        const m = maxVal;
        if (m <= 5) return 5;
        const pow = Math.pow(10, Math.floor(Math.log10(m)));
        return Math.ceil(m / (pow / 2)) * (pow / 2);
    });
    const ticks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f)));

    const GAP = 6; // viewBox-unit gap between bars (>=2px rendered)
    const bandW = $derived(data.length ? plotW / data.length : plotW);
    const barW = $derived(Math.max(2, bandW - GAP));

    function barX(i: number): number {
        return PAD.left + i * bandW + (bandW - barW) / 2;
    }
    function barH(v: number): number {
        return (v / niceMax) * plotH;
    }
    function barY(v: number): number {
        return PAD.top + plotH - barH(v);
    }

    let hovered = $state<number | null>(null);
    const labelEvery = $derived(Math.max(1, Math.ceil(data.length / 10)));
</script>

{#if data.length === 0}
    <div class="chart-empty">No data yet.</div>
{:else}
    <figure class="chart" role="img" aria-label="Bar chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
            <title>Bar chart</title>
            {#each ticks as t}
                <line class="grid" x1={PAD.left} x2={W - PAD.right} y1={barY(t)} y2={barY(t)} />
                <text class="axis-y" x={PAD.left - 8} y={barY(t) + 4} text-anchor="end">{t}</text>
            {/each}

            {#each data as d, i}
                <rect
                    class="bar"
                    class:on={hovered === i}
                    x={barX(i)}
                    y={barY(d.value)}
                    width={barW}
                    height={barH(d.value)}
                    rx="4"
                    onpointerenter={() => (hovered = i)}
                    onpointerleave={() => (hovered = null)}
                    role="presentation"
                />
                {#if i % labelEvery === 0 || i === data.length - 1}
                    <text class="axis-x" x={barX(i) + barW / 2} y={H - 12} text-anchor="middle">{d.label}</text>
                {/if}
            {/each}
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
    }
    .grid {
        stroke: var(--color-steel-border-soft);
        stroke-width: 1;
    }
    .axis-y,
    .axis-x {
        fill: var(--color-text-dim);
        font-size: 12px;
        font-family: var(--font-display);
    }
    .bar {
        fill: var(--color-accent);
        transition: fill 0.12s ease;
    }
    .bar.on {
        fill: var(--color-accent-bright);
    }
    .tooltip {
        position: absolute;
        transform: translate(-50%, calc(-100% - 10px));
        background: var(--color-surface-dark);
        border: 1px solid var(--color-accent-border);
        border-radius: var(--radius);
        padding: 0.3rem 0.5rem;
        pointer-events: none;
        white-space: nowrap;
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
    }
    .tt-label {
        font-size: 0.68rem;
        color: var(--color-text-dim);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }
    .tt-value {
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--color-text-bright);
        font-variant-numeric: tabular-nums;
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
