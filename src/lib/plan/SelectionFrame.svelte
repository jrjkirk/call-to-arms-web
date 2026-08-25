<script lang="ts">
    /**
     * The manipulation frame: eight resize handles, a rotate handle, and live
     * dimensions on two edges.
     *
     * Drawn in WORLD coordinates with each handle placed by handlePoint(), so
     * the frame follows a rotated object without the handles themselves being
     * inside a rotated group — which is what keeps them square on screen and
     * the dimension text upright.
     */
    import { HANDLE_DIR, feet, handlePoint, toWorld, type Box, type Handle } from './geometry';

    let { box, scale, onstart }: {
        box: Box;
        scale: number;                       // feet per screen pixel, to size handles
        onstart: (what: Handle | 'rotate', e: PointerEvent) => void;
    } = $props();

    const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    // Handles are drawn in feet but must stay a constant size on screen, so
    // everything here is scaled by how many feet a pixel currently covers.
    const hs = $derived(Math.max(0.22, 6 * scale));
    const stroke = $derived(Math.max(0.03, 1.2 * scale));

    const corners = $derived(
        (['nw', 'ne', 'se', 'sw'] as Handle[]).map((h) => handlePoint(box, h))
    );
    const corners_ = $derived(corners.map((p) => `${p.x},${p.y}`).join(' '));

    // Rotate handle sits off the top edge, in the object's own frame so it
    // travels round with the object.
    const rotAnchor = $derived(toWorld(box, 0, -box.depth_ft / 2));
    const rotGrip = $derived(toWorld(box, 0, -box.depth_ft / 2 - Math.max(1.2, 26 * scale)));

    const CURSORS: Record<Handle, string> = {
        nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize',
        se: 'nwse-resize', s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize'
    };

    // Dimension rules sit outside the shape, along its own edges.
    const off = $derived(Math.max(0.9, 20 * scale));
    const wRule = $derived({
        a: toWorld(box, -box.width_ft / 2, box.depth_ft / 2 + off),
        b: toWorld(box, box.width_ft / 2, box.depth_ft / 2 + off),
        mid: toWorld(box, 0, box.depth_ft / 2 + off)
    });
    const dRule = $derived({
        a: toWorld(box, -box.width_ft / 2 - off, -box.depth_ft / 2),
        b: toWorld(box, -box.width_ft / 2 - off, box.depth_ft / 2),
        mid: toWorld(box, -box.width_ft / 2 - off, 0)
    });
</script>

<g class="frame">
    <polygon class="sel-box" points={corners_} stroke-width={stroke} />

    <!-- Dimensions, always upright and always outside the shape. -->
    <g class="dims" stroke-width={stroke}>
        <line x1={wRule.a.x} y1={wRule.a.y} x2={wRule.b.x} y2={wRule.b.y} />
        <line x1={dRule.a.x} y1={dRule.a.y} x2={dRule.b.x} y2={dRule.b.y} />
        <g transform="translate({wRule.mid.x} {wRule.mid.y})">
            <text font-size={Math.max(0.55, 12 * scale)}>{feet(box.width_ft)}</text>
        </g>
        <g transform="translate({dRule.mid.x} {dRule.mid.y})">
            <text font-size={Math.max(0.55, 12 * scale)}>{feet(box.depth_ft)}</text>
        </g>
    </g>

    <line class="rot-arm" x1={rotAnchor.x} y1={rotAnchor.y}
          x2={rotGrip.x} y2={rotGrip.y} stroke-width={stroke} />
    <circle class="grip rot" cx={rotGrip.x} cy={rotGrip.y} r={hs * 0.75}
            stroke-width={stroke}
            role="button" tabindex="-1" aria-label="Rotate"
            onpointerdown={(e) => onstart('rotate', e)} />

    {#each HANDLES as h}
        {@const p = handlePoint(box, h)}
        <rect class="grip" x={p.x - hs / 2} y={p.y - hs / 2} width={hs} height={hs}
              stroke-width={stroke} style="cursor: {CURSORS[h]}"
              role="button" tabindex="-1" aria-label="Resize {h}"
              onpointerdown={(e) => onstart(h, e)} />
    {/each}
</g>

<style>
    /* NOT called .outline. Under that name the element picked up
       `outline: solid 1px currentColor` from somewhere outside this file — an
       outline is drawn round an SVG element's BOUNDING BOX, so a rotated table
       gained a large pale rectangle nowhere near the table itself, growing
       with the stroke width. Renamed off the generic word, and outline
       explicitly off, so neither this nor any future collision can paint one. */
    .sel-box {
        fill: none;
        stroke: var(--color-accent);
        pointer-events: none;
        outline: none;
    }
    .frame, .frame * { outline: none; }
    .grip {
        fill: #10141a;
        stroke: var(--color-accent);
        cursor: pointer;
    }
    .grip:focus { outline: none; }
    .grip.rot { cursor: grab; }
    .rot-arm { stroke: var(--color-accent); pointer-events: none; }

    .dims line { stroke: #8fa4b8; pointer-events: none; }
    .dims text {
        fill: #cfe0ee;
        text-anchor: middle;
        dominant-baseline: middle;
        font-family: inherit;
        font-weight: 600;
        paint-order: stroke;
        stroke: #0d0f13;
        stroke-width: 0.12;
        pointer-events: none;
    }
</style>
