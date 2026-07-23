<!--
  Single-series line chart (hand-rolled inline SVG, no chart lib).
  Used for time-series like signups-over-time. One brand-gilt data hue on the
  gunmetal chart surface (validated for contrast, dataviz skill). Recessive
  grid/axes, crosshair + tooltip on hover, empty state, reduced-motion aware.
-->
<script lang="ts">
    type Point = { label: string; value: number };

    let {
        data,
        yLabel = '',
        valueSuffix = '',
    }: {
        /** Ordered oldest→newest. `label` is the x-axis tick (e.g. a short date). */
        data: Point[];
        yLabel?: string;
        valueSuffix?: string;
    } = $props();

    // viewBox space; CSS scales the SVG responsively, so tooltip positions are
    // expressed as percentages of these constants and stay correct at any size.
    const W = 640;
    const H = 280;
    const PAD = { top: 16, right: 18, bottom: 34, left: 44 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    const maxVal = $derived(Math.max(1, ...data.map((d) => d.value)));
    // "Nice" top so gridlines land on round numbers.
    const niceMax = $derived.by(() => {
        const m = maxVal;
        if (m <= 5) return 5;
        const pow = Math.pow(10, Math.floor(Math.log10(m)));
        return Math.ceil(m / (pow / 2)) * (pow / 2);
    });
    const ticks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f)));

    function x(i: number): number {
        if (data.length <= 1) return PAD.left + plotW / 2;
        return PAD.left + (i / (data.length - 1)) * plotW;
    }
    function y(v: number): number {
        return PAD.top + plotH - (v / niceMax) * plotH;
    }

    const linePath = $derived(
        data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ')
    );
    const areaPath = $derived(
        data.length
            ? `${linePath} L ${x(data.length - 1).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} L ${x(0).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`
            : ''
    );

    let hovered = $state<number | null>(null);

    function onMove(e: PointerEvent) {
        const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * W;
        // nearest index
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < data.length; i++) {
            const d = Math.abs(x(i) - px);
            if (d < bestDist) { bestDist = d; best = i; }
        }
        hovered = best;
    }

    // Show a subset of x labels when crowded to avoid collisions.
    const labelEvery = $derived(Math.max(1, Math.ceil(data.length / 8)));
</script>

{#if data.length === 0}
    <div class="chart-empty">No data yet.</div>
{:else}
    <figure class="chart" role="img" aria-label={`Line chart. ${yLabel || 'value'} over time.`}>
        <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            onpointermove={onMove}
            onpointerleave={() => (hovered = null)}
        >
            <title>{yLabel || 'Trend'} over time</title>
            <!-- gridlines + y ticks -->
            {#each ticks as t}
                <line class="grid" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
                <text class="axis-y" x={PAD.left - 8} y={y(t) + 4} text-anchor="end">{t}</text>
            {/each}

            <!-- area + line -->
            <path class="area" d={areaPath} />
            <path class="line" d={linePath} />

            <!-- markers -->
            {#each data as d, i}
                <circle class="dot" class:on={hovered === i} cx={x(i)} cy={y(d.value)} r={hovered === i ? 5 : 3} />
                {#if i % labelEvery === 0 || i === data.length - 1}
                    <text class="axis-x" x={x(i)} y={H - 12} text-anchor="middle">{d.label}</text>
                {/if}
            {/each}

            <!-- crosshair -->
            {#if hovered !== null}
                <line class="crosshair" x1={x(hovered)} x2={x(hovered)} y1={PAD.top} y2={PAD.top + plotH} />
            {/if}
        </svg>

        {#if hovered !== null}
            <div
                class="tooltip"
                style={`left:${(x(hovered) / W) * 100}%; top:${(y(data[hovered].value) / H) * 100}%;`}
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
        touch-action: none;
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
    .area {
        fill: var(--color-accent);
        opacity: 0.1;
    }
    .line {
        fill: none;
        stroke: var(--color-accent);
        stroke-width: 2;
        stroke-linejoin: round;
        stroke-linecap: round;
    }
    .dot {
        fill: var(--color-accent-bright);
        stroke: var(--color-bg-deep);
        stroke-width: 1.5;
        transition: r 0.1s ease;
    }
    .dot.on {
        fill: var(--color-accent-bright);
    }
    .crosshair {
        stroke: var(--color-accent-border);
        stroke-width: 1;
        stroke-dasharray: 3 3;
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
        .dot {
            transition: none;
        }
    }
</style>
