<!--
  Single-series line chart (hand-rolled inline SVG, no chart lib).
  Used for time-series like signups-over-time. One gold series, so no legend:
  the card's title names it. A 2px line over an area that fades to nothing,
  three recessive gridlines and no y-axis (the card's headline number carries
  the scale), and only the latest value is labelled; hovering shows the rest.
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
    // Drawn at the width it is shown at, so labels stay real-size text on a
    // phone instead of shrinking with a scaled-down picture.
    let cw = $state(640);
    const W = $derived(Math.max(240, Math.round(cw)));
    const H = 200;
    const PAD = { top: 26, right: 14, bottom: 28, left: 14 };
    const plotW = $derived(W - PAD.left - PAD.right);
    const plotH = H - PAD.top - PAD.bottom;

    // Each chart on the page needs its own gradient id.
    const gid = `lc-fade-${Math.random().toString(36).slice(2, 8)}`;

    const maxVal = $derived(Math.max(1, ...data.map((d) => d.value)));
    const top = $derived(maxVal * 1.1);

    function x(i: number): number {
        if (data.length <= 1) return PAD.left + plotW / 2;
        return PAD.left + (i / (data.length - 1)) * plotW;
    }
    function y(v: number): number {
        return PAD.top + plotH - (v / top) * plotH;
    }

    const linePath = $derived(
        data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ')
    );
    const areaPath = $derived(
        data.length
            ? `${linePath} L ${x(data.length - 1).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} L ${x(0).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`
            : ''
    );
    const last = $derived(data.length - 1);

    let hovered = $state<number | null>(null);

    function onMove(e: PointerEvent) {
        const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * W;
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < data.length; i++) {
            const d = Math.abs(x(i) - px);
            if (d < bestDist) { bestDist = d; best = i; }
        }
        hovered = best;
    }

    // Show a subset of x labels when crowded to avoid collisions.
    const labelEvery = $derived(Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(W / 80)))));
</script>

{#if data.length === 0}
    <div class="chart-empty">No data yet</div>
{:else}
    <figure class="chart" bind:clientWidth={cw} role="img" aria-label={`${yLabel || 'Value'} over time, latest ${data[last].value}`}>
        <svg
            viewBox={`0 0 ${W} ${H}`}
            
            onpointermove={onMove}
            onpointerleave={() => (hovered = null)}
        >
            <defs>
                <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stop-color="var(--color-accent)" stop-opacity="0.24" />
                    <stop offset="1" stop-color="var(--color-accent)" stop-opacity="0" />
                </linearGradient>
            </defs>
            {#each [1 / 3, 2 / 3, 1] as f}
                <line class="grid" x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH * (1 - f)} y2={PAD.top + plotH * (1 - f)} />
            {/each}
            <line class="base" x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} />

            <path d={areaPath} fill={`url(#${gid})`} />
            <path class="line" d={linePath} />

            {#each data as d, i}
                {#if (i % labelEvery === 0 && last - i >= labelEvery) || i === last}
                    <text class="axis-x" x={x(i)} y={H - 8} text-anchor={i === last ? 'end' : i === 0 ? 'start' : 'middle'}>{d.label}</text>
                {/if}
            {/each}

            {#if hovered !== null}
                <line class="crosshair" x1={x(hovered)} x2={x(hovered)} y1={PAD.top} y2={PAD.top + plotH} />
                <circle class="dot" cx={x(hovered)} cy={y(data[hovered].value)} r="5" />
            {/if}
            <circle class="dot" cx={x(last)} cy={y(data[last].value)} r="5" />
            {#if hovered === null}
                <text class="latest" x={x(last) - 10} y={y(data[last].value) - 10} text-anchor="end">{data[last].value}{valueSuffix}</text>
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
        overflow: visible;
    }
    .grid {
        stroke: var(--color-steel-border-soft);
        stroke-width: 1;
    }
    .base {
        stroke: var(--color-steel-border);
        stroke-width: 1;
    }
    .axis-x {
        fill: var(--color-text-faint);
        font-size: 13px;
        font-family: var(--font-body);
    }
    .line {
        fill: none;
        stroke: var(--color-accent);
        stroke-width: 2.5;
        stroke-linejoin: round;
        stroke-linecap: round;
    }
    .dot {
        fill: var(--color-accent);
        stroke: var(--color-surface);
        stroke-width: 2.5;
    }
    .latest {
        fill: var(--color-text-bright);
        font-size: 16px;
        font-weight: 700;
        font-family: var(--font-body);
        font-variant-numeric: tabular-nums;
    }
    .crosshair {
        stroke: var(--color-accent-border);
        stroke-width: 1;
        stroke-dasharray: 3 3;
    }
    .tooltip {
        position: absolute;
        transform: translate(-50%, calc(-100% - 12px));
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
</style>
