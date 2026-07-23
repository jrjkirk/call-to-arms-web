<!--
  Donut chart for part-of-whole composition (e.g. pairing weight share).
  Hand-rolled inline SVG, matching the other charts in this directory.
  Categorical (not single-hue) — each slice is a different named factor, so
  this uses a validated 7-slot categorical order (dataviz skill), not the
  single brand hue the line/bar charts use. Slice order is the CVD-safety
  mechanism, not cosmetic — don't reorder without re-validating.
  Legend always present (>=2 series); large slices get a direct % label too.
  Live/"dynamic": callers just re-pass `data` on every reactive change (e.g.
  a slider move) and the arcs animate to the new angles.
-->
<script lang="ts">
    type Slice = { label: string; value: number; color: string };

    let { data }: { data: Slice[] } = $props();

    const SIZE = 220;
    const CENTER = SIZE / 2;
    const R_OUTER = 100;
    const R_INNER = 62;
    const GAP_DEG = 1.6; // angular gap between slices, standing in for the 2px surface gap

    const total = $derived(data.reduce((sum, d) => sum + Math.max(0, d.value), 0));

    type ArcSlice = Slice & { startAngle: number; endAngle: number; pct: number };

    const arcs = $derived.by((): ArcSlice[] => {
        if (total <= 0) return [];
        let angle = -90; // start at 12 o'clock
        const out: ArcSlice[] = [];
        for (const d of data) {
            if (d.value <= 0) continue;
            const sweep = (d.value / total) * 360;
            const startAngle = angle + GAP_DEG / 2;
            const endAngle = angle + sweep - GAP_DEG / 2;
            out.push({ ...d, startAngle: Math.min(startAngle, endAngle), endAngle: Math.max(startAngle, endAngle), pct: (d.value / total) * 100 });
            angle += sweep;
        }
        return out;
    });

    function polar(angleDeg: number, r: number): [number, number] {
        const rad = (angleDeg * Math.PI) / 180;
        return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
    }

    function arcPath(a: ArcSlice): string {
        const largeArc = a.endAngle - a.startAngle > 180 ? 1 : 0;
        const [x1, y1] = polar(a.startAngle, R_OUTER);
        const [x2, y2] = polar(a.endAngle, R_OUTER);
        const [x3, y3] = polar(a.endAngle, R_INNER);
        const [x4, y4] = polar(a.startAngle, R_INNER);
        return [
            `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
            `A ${R_OUTER} ${R_OUTER} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
            `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
            `A ${R_INNER} ${R_INNER} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
            'Z',
        ].join(' ');
    }

    // Direct label only on slices big enough for the text to fit (dataviz
    // skill: selective direct labels, never one on every mark).
    function labelPos(a: ArcSlice): [number, number] {
        return polar((a.startAngle + a.endAngle) / 2, (R_OUTER + R_INNER) / 2);
    }

    let hovered = $state<number | null>(null);
</script>

{#if arcs.length === 0}
    <div class="chart-empty">No weight set.</div>
{:else}
    <div class="donut-wrap">
        <figure class="chart donut-chart" role="img" aria-label="Donut chart showing share of total weighting">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`}>
                <title>Share of total weighting</title>
                {#each arcs as a, i (a.label)}
                    <path
                        class="slice"
                        class:on={hovered === i}
                        d={arcPath(a)}
                        fill={a.color}
                        onpointerenter={() => (hovered = i)}
                        onpointerleave={() => (hovered = null)}
                        role="presentation"
                    />
                    {#if a.pct >= 8}
                        {@const [lx, ly] = labelPos(a)}
                        <text class="slice-label" x={lx} y={ly} text-anchor="middle" dominant-baseline="middle">
                            {Math.round(a.pct)}%
                        </text>
                    {/if}
                {/each}
            </svg>
            <div class="donut-center">
                {#if hovered !== null}
                    <span class="dc-value">{Math.round(arcs[hovered].pct)}%</span>
                    <span class="dc-label">{arcs[hovered].label}</span>
                {:else}
                    <span class="dc-value">{arcs.length}</span>
                    <span class="dc-label">factor{arcs.length === 1 ? '' : 's'} weighted</span>
                {/if}
            </div>
        </figure>

        <ul class="donut-legend">
            {#each arcs as a, i (a.label)}
                <li class:on={hovered === i} onpointerenter={() => (hovered = i)} onpointerleave={() => (hovered = null)}>
                    <span class="swatch" style={`background:${a.color}`}></span>
                    <span class="lg-label">{a.label}</span>
                    <span class="lg-value">{Math.round(a.pct)}%</span>
                </li>
            {/each}
        </ul>
    </div>
{/if}

<style>
    .donut-wrap {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 1.5rem;
    }
    .chart {
        position: relative;
        margin: 0;
        flex: 0 0 auto;
    }
    .donut-chart svg {
        width: 200px;
        height: 200px;
        display: block;
        overflow: visible;
    }
    .slice {
        stroke: none;
        transition: opacity 0.12s ease, filter 0.12s ease;
    }
    .slice.on {
        filter: brightness(1.15);
    }
    .donut-chart .slice {
        cursor: pointer;
    }
    .slice-label {
        fill: var(--color-bg-deep);
        font-size: 11px;
        font-weight: 700;
        font-family: var(--font-display);
        pointer-events: none;
    }
    .donut-center {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
        text-align: center;
        max-width: 110px;
    }
    .dc-value {
        font-size: 1.6rem;
        font-weight: 800;
        color: var(--color-text-bright);
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
    }
    .dc-label {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-dim);
        margin-top: 0.15rem;
    }
    .donut-legend {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        flex: 1 1 160px;
        min-width: 160px;
    }
    .donut-legend li {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.8rem;
        color: var(--color-text-muted);
        padding: 0.2rem 0.3rem;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.12s ease, color 0.12s ease;
    }
    .donut-legend li.on {
        background: var(--color-surface-hover);
        color: var(--color-text-bright);
    }
    .swatch {
        width: 10px;
        height: 10px;
        border-radius: 2px;
        flex-shrink: 0;
    }
    .lg-label {
        flex: 1;
    }
    .lg-value {
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        color: var(--color-text-dim);
    }
    .donut-legend li.on .lg-value {
        color: var(--color-accent-bright);
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
        .slice {
            transition: none;
        }
    }
</style>
