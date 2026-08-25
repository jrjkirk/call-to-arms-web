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

    /** The venue's colour-coding palette. Fill and stroke together, so every
     *  option is legible on the dark plan rather than left to chance. */
    const PALETTE: Record<string, [string, string]> = {
        slate: ['#2a4a63', '#7fa8c4'],
        blue: ['#243c6b', '#7f96d4'],
        green: ['#24402a', '#79b184'],
        amber: ['#5a4520', '#d0ae63'],
        red: ['#5c2a24', '#cf7d72'],
        purple: ['#452a5e', '#a684c9'],
        teal: ['#1f4444', '#6fb3ad'],
        grey: ['#33363d', '#8b8f99']
    };

    /**
     * Label sizing has to answer BOTH questions: does it fit the table's
     * height, and does it fit its WIDTH. Sizing on height alone let
     * "Tournament Table 12" run off the ends of a 4ft table, and stacking two
     * lines at fixed offsets made them overlap on anything shallow.
     *
     * 0.55em per character is the usual approximation of average glyph width
     * for a sans face — close enough to keep text inside the box without
     * measuring, which SVG can't do before paint anyway.
     */
    const CHAR_W = 0.55;
    const MIN_PT = 0.3;

    function fitted(text: string, maxW: number, maxH: number): number {
        const byWidth = (maxW * 0.86) / Math.max(1, text.length * CHAR_W);
        return Math.max(MIN_PT, Math.min(maxH, byWidth));
    }

    /** Cut a name that still won't fit at the minimum size, rather than let it
     *  spill over the neighbouring tables. */
    function clip(text: string, maxW: number, size: number): string {
        const fits = Math.floor((maxW * 0.86) / (size * CHAR_W));
        return text.length <= fits ? text : text.slice(0, Math.max(1, fits - 1)) + '…';
    }

    const label = $derived(String(o.name ?? o.label ?? ''));
    const sub = $derived(
        bookings.length
            ? `${bookings[0].start}–${bookings[0].end}` +
              (bookings.length > 1 ? ` +${bookings.length - 1}` : '')
            : editing && kind === 'table'
              ? `${feet(o.width_ft)} × ${feet(o.depth_ft)}`
              : ''
    );

    // Two lines share the height when there are two; one line gets it all.
    const nameSize = $derived(
        fitted(label, o.width_ft, o.depth_ft * (sub ? 0.3 : 0.4))
    );
    const subSize = $derived(sub ? fitted(sub, o.width_ft, nameSize * 0.78) : 0);
    // Stacked from the font sizes themselves, so they can never collide.
    const nameY = $derived(sub ? -subSize * 0.72 : 0);
    const subY = $derived(nameSize * 0.72);
    const shown = $derived(clip(label, o.width_ft, nameSize));

    // The venue's own colour only applies while EDITING. In Tonight the state
    // colour wins: that view exists to be read across a room at a glance, and
    // a table someone painted green would read as "free" when it isn't.
    const paint = $derived(
        kind === 'table' && state === 'idle'
            ? (PALETTE[o.color] ?? PALETTE.slate)
            : null
    );

    // Below this the text is illegible anyway and just adds noise to the plan.
    const roomForText = $derived(Math.min(o.width_ft, o.depth_ft) >= 1);
</script>

<g class="{kind} {state}" class:sel={selected} class:clash class:editing
   onpointerdown={onpick} role="button" tabindex="-1"
   aria-label={o.name ?? o.label ?? kind}>
    <g transform="translate({o.pos_x} {o.pos_y}) rotate({o.rotation})">
        {#if kind === 'feature' && o.kind === 'enclosure'}
            <!-- A room, not a block: hollow, so tables inside it stay visible
                 and a door can be dropped into the wall line. -->
            <rect class="body enclosure" x={-o.width_ft / 2} y={-o.depth_ft / 2}
                  width={o.width_ft} height={o.depth_ft} />
        {:else if kind === 'feature' && o.kind === 'door'}
            <!-- Drawn as a gap with a swing arc, the way a plan shows a door,
                 so it reads as an opening rather than a small dark block. -->
            <rect class="door-gap" x={-o.width_ft / 2} y={-o.depth_ft / 2}
                  width={o.width_ft} height={o.depth_ft} />
            <path class="door-swing" fill="none"
                  d="M {-o.width_ft / 2} {o.depth_ft / 2}
                     A {o.width_ft} {o.width_ft} 0 0 1 {o.width_ft / 2} {o.depth_ft / 2 - o.width_ft}" />
            <line class="door-leaf" x1={-o.width_ft / 2} y1={o.depth_ft / 2}
                  x2={-o.width_ft / 2} y2={o.depth_ft / 2 - o.width_ft} />
        {:else if o.shape === 'round'}
            {@const r = Math.min(o.width_ft, o.depth_ft) / 2}
            <circle class="body" style={paint ? `--fill:${paint[0]};--edge:${paint[1]}` : undefined} cx="0" cy="0" r={r} />
        {:else if o.shape === 'oval'}
            <ellipse class="body" style={paint ? `--fill:${paint[0]};--edge:${paint[1]}` : undefined} cx="0" cy="0" rx={o.width_ft / 2} ry={o.depth_ft / 2} />
        {:else}
            <!-- No corner radius: these are tables, and a plan reads as a plan
                 because its rectangles are rectangles. -->
            <rect class="body" x={-o.width_ft / 2} y={-o.depth_ft / 2}
                  width={o.width_ft} height={o.depth_ft}
                  style={paint ? `--fill:${paint[0]};--edge:${paint[1]}` : undefined} />
        {/if}
    </g>

    <!-- The shape turns; the label doesn't. A rotated table is a real thing at
         an angle, but a name printed sideways is only harder to read. -->
    <g transform="translate({o.pos_x} {o.pos_y})" class="labels">
        {#if roomForText && label}
            <text x="0" y={nameY} class={kind === 'table' ? 'name' : 'sub'}
                  font-size={nameSize}>{shown}</text>
            {#if sub}
                <text x="0" y={subY} class="sub" font-size={subSize}>{sub}</text>
            {/if}
        {/if}
    </g>
</g>

<style>
    g { cursor: grab; }
    g:focus { outline: none; }
    .labels { pointer-events: none; }

    /* The venue's colour arrives as --fill/--edge, NOT as inline fill/stroke.
       An inline declaration beats every stylesheet rule, so a coloured table
       stopped showing its selection and overlap strokes altogether. As custom
       properties the cascade below still decides. */
    .table .body {
        fill: var(--fill, #2a4a63);
        stroke: var(--edge, #7fa8c4);
        stroke-width: 0.1;
        transition: fill 0.15s;
    }
    .table.off .body { fill: #23252b; stroke: #4a4c55; }
    .table.busy .body { fill: #6b3320; stroke: #d4835c; }
    .table.event .body { fill: #5a3570; stroke: #b98fd0; }
    .table.held .body { fill: #5a4520; stroke: #d0ae63; }
    .table.free .body { fill: #24402a; stroke: #79b184; }

    .feature .body { fill: #44444e; stroke: #00000060; stroke-width: 0.08; }

    /* Specificity matters here: `.feature .body` is two classes and would
       otherwise win, filling the room in solid grey. Matched at the same depth
       so the hollow wins.

       pointer-events on the STROKE only, so clicking inside an enclosure picks
       the table standing there rather than dragging the whole room away. */
    .feature .body.enclosure {
        fill: none;
        stroke: #6d7280;
        stroke-width: 0.5;
        pointer-events: stroke;
    }
    .feature.sel .body.enclosure { stroke: var(--color-accent); }

    .door-gap { fill: #14171d; stroke: none; }
    .door-swing { stroke: #7e838f; stroke-width: 0.09; stroke-dasharray: 0.3 0.25; }
    .door-leaf { stroke: #aeb3bf; stroke-width: 0.16; }
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
