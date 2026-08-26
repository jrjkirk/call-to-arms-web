<script lang="ts">
    /** One table or fixture on the plan: its shape, and its upright label. */
    import { feet, WALL_FT } from './geometry';

    /**
     * One stroke width for every state.
     *
     * SVG centres a stroke on its path, so a 6x4 rect drawn at its nominal
     * bounds actually covers 6.1 x 4.1 — which is why tables kept biting into
     * walls they were snapped against. Every shape below is inset by half of
     * this, putting the OUTER EDGE OF THE OUTLINE exactly on the stated size,
     * so what the plan measures is what the plan draws.
     *
     * It has to be constant across states for that to hold: a thicker stroke
     * when selected would need a different inset and the footprint would move
     * as you clicked it. Selection and overlap change colour and dash instead.
     */
    const STROKE = 0.12;

    /**
     * Only TABLES are outlined.
     *
     * Everything else is drawn as bare fill, for two reasons that turn out to
     * be the same reason. Adjacent fixtures then MERGE — two terrain shelves
     * meeting at a corner read as one L-shaped run rather than two rectangles
     * with a seam — which is how a plan should show a continuous thing.
     *
     * And it fixes a sizing bug: shapes were inset by half of STROKE, but
     * fixtures only stroked at 0.08 (walls at none at all), so a wall declared
     * 0.5 thick was drawn 0.38 and refused to line up with a room's 0.5 wall.
     * With no stroke there's nothing to inset for, and the drawn size IS the
     * stated size.
     *
     * Tables keep their outline deliberately: they're the things that must
     * stay distinct from each other.
     */
    const outlined = $derived(kind === 'table');
    const inset = $derived(outlined ? STROKE / 2 : 0);

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
    /**
     * The cap. This is what a 6x4 table's name renders at, and nothing gets
     * bigger — a 20ft toilet block was taking the same rule as a table and
     * ending up with lettering a foot and a half tall.
     */
    const MAX_PT = 1.2;
    const LINE = 1.15;                       // line height, in multiples of size

    /** Greedy wrap into exactly `n` lines, or null if it won't go. */
    function wrapInto(words: string[], n: number): string[] | null {
        if (words.length < n) return null;
        const per = Math.ceil(words.length / n);
        const lines: string[] = [];
        for (let i = 0; i < words.length; i += per) lines.push(words.slice(i, i + per).join(' '));
        return lines.length === n ? lines : null;
    }

    /**
     * Lay a label out at the largest size it can have, wrapping BEFORE
     * shrinking. One long word can't wrap, so that still shrinks — and if it
     * still won't fit at the minimum, it's cut rather than allowed to spill
     * over the neighbouring tables.
     */
    function layout(text: string, maxW: number, maxH: number, cap = MAX_PT) {
        const words = text.trim().split(/\s+/).filter(Boolean);
        if (!words.length) return { lines: [] as string[], size: 0 };

        let best = { lines: [text], size: 0 };
        for (let n = 1; n <= Math.min(3, words.length); n++) {
            const lines = wrapInto(words, n);
            if (!lines) continue;
            const longest = Math.max(...lines.map((l) => l.length));
            const byWidth = (maxW * 0.86) / (longest * CHAR_W);
            const byHeight = maxH / (n * LINE);
            const size = Math.min(cap, byWidth, byHeight);
            if (size > best.size) best = { lines, size };
        }

        if (best.size < MIN_PT) {
            const fits = Math.max(1, Math.floor((maxW * 0.86) / (MIN_PT * CHAR_W)));
            const flat = best.lines.join(' ');
            best = {
                lines: [flat.length <= fits ? flat : flat.slice(0, fits - 1) + '…'],
                size: MIN_PT
            };
        }
        return best;
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

    // Two lines of content share the height; one gets it all.
    const head = $derived(layout(label, o.width_ft, o.depth_ft * (sub ? 0.52 : 0.72)));
    const subSize = $derived(
        sub ? Math.min(head.size * 0.78, layout(sub, o.width_ft, o.depth_ft * 0.22).size) : 0
    );

    /** Every line's baseline, stacked about the centre so they can't collide. */
    const blockH = $derived(head.lines.length * head.size * LINE + (sub ? subSize * LINE : 0));
    const firstY = $derived(-blockH / 2 + head.size * 0.72);

    // The venue's own colour only applies while EDITING. In Tonight the state
    // colour wins: that view exists to be read across a room at a glance, and
    // a table someone painted green would read as "free" when it isn't.
    const STRUCTURAL = ['enclosure', 'wall', 'door'];

    const paint = $derived(
        kind === 'table'
            ? (state === 'idle' ? (PALETTE[o.color] ?? PALETTE.slate) : null)
            : STRUCTURAL.includes(o.kind)
              ? null
              : (PALETTE[o.color] ?? PALETTE.grey)
    );

    // Below this the text is illegible anyway and just adds noise to the plan.
    const roomForText = $derived(Math.min(o.width_ft, o.depth_ft) >= 1);
</script>

<g class="{kind} {state}" class:sel={selected} class:clash class:editing
   onpointerdown={onpick} role="button" tabindex="-1"
   aria-label={o.name ?? o.label ?? kind}>
    <!-- The mirror sits INSIDE the rotation, so flipping a door that's already
         turned onto a side wall still swaps its hinge rather than its
         orientation. Scaling by -1 about the local origin is exactly a mirror
         through the object's own centre, which is what "flip" means here. -->
    <g transform="translate({o.pos_x} {o.pos_y}) rotate({o.rotation}) scale({o.flip_h ? -1 : 1} {o.flip_v ? -1 : 1})">
        {#if kind === 'feature' && o.kind === 'note'}
            <!-- Annotation is text only, and text lives in the labels group,
                 which takes no pointer events — so there was nothing to grab
                 and a note couldn't be moved once placed. This is its handle:
                 invisible, but the size of its box. -->
            <rect class="note-hit" x={-o.width_ft / 2} y={-o.depth_ft / 2}
                  width={o.width_ft} height={o.depth_ft} />
            <!-- Annotation: text only. Areas like "Shop" or "Staff only" aren't
                 objects on the floor, so drawing a box round them would be a
                 lie about what's there. -->
        {:else if kind === 'feature' && o.kind === 'enclosure'}
            <!-- A room, not a block: hollow, so tables inside it stay visible
                 and a door can be dropped into the wall line.
                 The stroke is centred on a path INSET by half a wall, which
                 puts the outer face exactly on the bounding box — so a wall
                 snapped to this room's edge meets it, instead of missing by
                 half a wall's thickness. -->
            <rect class="body enclosure"
                  x={-o.width_ft / 2 + WALL_FT / 2} y={-o.depth_ft / 2 + WALL_FT / 2}
                  width={Math.max(0.1, o.width_ft - WALL_FT)}
                  height={Math.max(0.1, o.depth_ft - WALL_FT)}
                  stroke-width={WALL_FT} />
        {:else if kind === 'feature' && o.kind === 'door'}
            <!-- The standard plan symbol: an opening punched through the wall,
                 a leaf hinged at one jamb, and a quarter-circle showing where it
                 swings.
                 The previous version drew the arc from the hinge to the far
                 jamb with the wrong centre, so it bulged off in a direction the
                 door could never open in. The arc is centred ON THE HINGE, runs
                 from the open leaf's tip round to the far jamb, and its radius
                 is the leaf's length — which is what makes it read as a door. -->
            {@const w = o.width_ft}
            {@const hx = -w / 2}
            <rect class="door-gap" x={hx} y={-o.depth_ft / 2}
                  width={w} height={o.depth_ft} />
            <!-- Swings toward +y, so a door dropped on the top wall opens INTO
                 the room. Rotate it for the other three walls, which is how a
                 plan flips a door anyway. -->
            <path class="door-swing" fill="none"
                  d="M {hx} {w} A {w} {w} 0 0 0 {w / 2} 0" />
            <line class="door-leaf" x1={hx} y1="0" x2={hx} y2={w} />
        {:else if o.shape === 'round'}
            {@const r = Math.max(0.05, Math.min(o.width_ft, o.depth_ft) / 2 - inset)}
            <circle class="body" style={paint ? `--fill:${paint[0]};--edge:${paint[1]}` : undefined} cx="0" cy="0" r={r} />
        {:else if o.shape === 'oval'}
            <ellipse class="body" style={paint ? `--fill:${paint[0]};--edge:${paint[1]}` : undefined}
                     cx="0" cy="0"
                     rx={Math.max(0.05, o.width_ft / 2 - inset)}
                     ry={Math.max(0.05, o.depth_ft / 2 - inset)} />
        {:else}
            <!-- No corner radius: these are tables, and a plan reads as a plan
                 because its rectangles are rectangles. -->
            <rect class="body"
                  x={-o.width_ft / 2 + inset} y={-o.depth_ft / 2 + inset}
                  width={Math.max(0.05, o.width_ft - inset * 2)}
                  height={Math.max(0.05, o.depth_ft - inset * 2)}
                  style={paint ? `--fill:${paint[0]};--edge:${paint[1]}` : undefined} />
        {/if}
    </g>

    <!-- The shape turns; the label doesn't. A rotated table is a real thing at
         an angle, but a name printed sideways is only harder to read. -->
    <g transform="translate({o.pos_x} {o.pos_y})" class="labels">
        {#if roomForText && head.lines.length}
            {#each head.lines as line, i}
                <text x="0" y={firstY + i * head.size * LINE}
                      class={kind === 'feature' && o.kind === 'note'
                             ? 'note-text'
                             : kind === 'table' ? 'name' : 'sub'}
                      font-size={head.size}
                      style={kind === 'feature' && o.kind === 'note' && paint
                             ? `--edge:${paint[1]}` : undefined}>{line}</text>
            {/each}
            {#if sub}
                <text x="0" y={firstY + head.lines.length * head.size * LINE}
                      class="sub" font-size={subSize}>{sub}</text>
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
        stroke-width: 0.12;
        transition: fill 0.15s;
    }

    /* Invisible but hittable — `fill: none` would let clicks straight through. */
    .note-hit { fill: transparent; stroke: none; pointer-events: all; }
    .sel .note-hit {
        stroke: var(--color-accent);
        stroke-width: 0.06;
        stroke-dasharray: 0.3 0.25;
    }
    .table.off .body { fill: #23252b; stroke: #4a4c55; }
    .table.busy .body { fill: #6b3320; stroke: #d4835c; }
    .table.event .body { fill: #5a3570; stroke: #b98fd0; }
    .table.held .body { fill: #5a4520; stroke: #d0ae63; }
    .table.free .body { fill: #24402a; stroke: #79b184; }

    /* No outline — see `outlined` above. Fixtures butted together become one
       shape, and their drawn size is their stated size. */
    .feature .body {
        fill: var(--fill, #44444e);
        stroke: none;
    }

    /* A standalone wall is the SAME MATERIAL as a room's wall — same colour,
       same thickness — so the two meet cleanly and read as one run. */
    .feature.wall .body { fill: #6d7280; }

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

    /* The opening itself: floor colour, so it reads as a hole punched
       through the wall rather than a block sitting in front of it. */
    .door-gap { fill: #14171d; stroke: none; }
    .door-swing { stroke: #7e838f; stroke-width: 0.09; stroke-dasharray: 0.3 0.25; }
    .door-leaf { stroke: #aeb3bf; stroke-width: 0.16; }


    /* Only on tables: adding a stroke to an un-outlined fixture would change
       its drawn size the moment it was selected. The selection frame rings
       everything else already. */
    .table.sel .body { stroke: var(--color-accent); }
    /* Dashed rather than a colour swap: the table's real state is still worth
       seeing while you untangle it. */
    .table.clash .body {
        stroke: var(--color-loss);
        stroke-dasharray: 0.5 0.35;
    }

    .name {
        fill: #f2f2f5;
        text-anchor: middle;
        dominant-baseline: middle;
        font-weight: 700;
        font-family: inherit;
    }
    .note-text {
        fill: var(--edge, #c8c8d0);
        text-anchor: middle;
        dominant-baseline: middle;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-family: inherit;
    }

    .sub {
        fill: #c8c8d0;
        text-anchor: middle;
        dominant-baseline: middle;
        font-family: inherit;
    }
</style>
