<script lang="ts">
    /** One table or fixture on the plan: its shape, and its upright label. */
    import { feet } from './geometry';

    let {
        o, kind, state = 'free', selected = false, clash = false,
        editing = true, bookings = [], onpick
    }: {
        o: any;
        kind: 'table' | 'feature';
        state?: string;
        selected?: boolean;
        clash?: boolean;
        editing?: boolean;
        bookings?: any[];
        onpick?: (e: PointerEvent) => void;
    } = $props();

    const FEATURE_FILL: Record<string, string> = {
        bar: '#6b4f2a', door: '#2f2f38', pillar: '#3a3a44', shelves: '#4a3d2c',
        stairs: '#3a3a44', toilets: '#2f3a3a', wall: '#4a4a54'
    };

    // Labels shrink with the SMALLER side, so a long thin table doesn't get a
    // caption taller than the table itself.
    const scale = $derived(Math.min(o.width_ft, o.depth_ft));
</script>

<g class="{kind} {state}" class:sel={selected} class:clash class:editing
   onpointerdown={onpick} role="button" tabindex="-1"
   aria-label={o.name ?? o.label ?? kind}>
    <g transform="translate({o.pos_x} {o.pos_y}) rotate({o.rotation})">
        {#if o.shape === 'round'}
            {@const r = Math.min(o.width_ft, o.depth_ft) / 2}
            <circle class="body" cx="0" cy="0" r={r} />
        {:else if o.shape === 'oval'}
            <ellipse class="body" cx="0" cy="0" rx={o.width_ft / 2} ry={o.depth_ft / 2} />
        {:else}
            <rect class="body" x={-o.width_ft / 2} y={-o.depth_ft / 2}
                  width={o.width_ft} height={o.depth_ft} rx="0.2" />
        {/if}
    </g>

    <!-- The shape turns; the label doesn't. A rotated table is a real thing at
         an angle, but a name printed sideways is only harder to read. -->
    <g transform="translate({o.pos_x} {o.pos_y})" class="labels">
        {#if kind === 'table'}
            <text x="0" y={bookings.length ? -0.25 : 0.3} class="name"
                  font-size={Math.min(1.15, scale * 0.34)}>{o.name}</text>
            {#if bookings.length}
                <text x="0" y="1.0" class="sub" font-size={Math.min(0.85, scale * 0.26)}>
                    {bookings[0].start}–{bookings[0].end}{bookings.length > 1 ? ` +${bookings.length - 1}` : ''}
                </text>
            {:else if editing}
                <text x="0" y="1.0" class="sub" font-size={Math.min(0.75, scale * 0.22)}>
                    {feet(o.width_ft)} × {feet(o.depth_ft)}
                </text>
            {/if}
        {:else if o.label && scale >= 1.2}
            <text x="0" y="0" class="sub" font-size={Math.min(1, scale * 0.55)}>{o.label}</text>
        {/if}
    </g>
</g>

<style>
    g { cursor: grab; }
    g:focus { outline: none; }
    .labels { pointer-events: none; }

    .table .body {
        fill: #2a4a63;
        stroke: #7fa8c4;
        stroke-width: 0.1;
        transition: fill 0.15s;
    }
    .table.off .body { fill: #23252b; stroke: #4a4c55; }
    .table.busy .body { fill: #6b3320; stroke: #d4835c; }
    .table.event .body { fill: #5a3570; stroke: #b98fd0; }
    .table.held .body { fill: #5a4520; stroke: #d0ae63; }
    .table.free .body { fill: #24402a; stroke: #79b184; }

    .feature .body { fill: #44444e; stroke: #00000060; stroke-width: 0.08; }
    .feature.bar .body { fill: #6b4f2a; }
    .feature.door .body { fill: #2f2f38; }
    .feature.pillar .body { fill: #3a3a44; }
    .feature.shelves .body { fill: #4a3d2c; }
    .feature.stairs .body { fill: #3a3a44; }
    .feature.toilets .body { fill: #2f3a3a; }
    .feature.wall .body { fill: #4a4a54; }

    .sel .body { stroke: var(--color-accent); stroke-width: 0.18; }
    /* Dashed rather than a colour swap: the table's real state is still worth
       seeing while you untangle it. */
    .clash .body {
        stroke: var(--color-loss);
        stroke-width: 0.2;
        stroke-dasharray: 0.5 0.35;
    }

    .name {
        fill: #f2f2f5;
        text-anchor: middle;
        dominant-baseline: middle;
        font-weight: 700;
        font-family: inherit;
    }
    .sub {
        fill: #c8c8d0;
        text-anchor: middle;
        dominant-baseline: middle;
        font-family: inherit;
    }
</style>
