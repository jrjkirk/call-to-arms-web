<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import { tick } from 'svelte';
    import { exportPlanPng } from './exportPng';
    import PlanObject from './PlanObject.svelte';
    import { WALL_FT } from './geometry';

    /**
     * The floor plan as a READ-ONLY picture of one date.
     *
     * Deliberately not the editor with its handles turned off. The editor
     * carries selection, gestures, undo and a save cycle, none of which mean
     * anything here, and a diary that could accidentally drag a table is worse
     * than one that can't show a plan at all.
     */
    let { date, tableId = null, refresh = 0, onpick }: {
        date: string;
        tableId?: number | null;
        /** Bump to re-read the day. Laying tonight's games out changes what
         *  every table on this plan is doing, and the plan can't see that
         *  happen from inside its own component. */
        refresh?: number;
        /** What the table is doing travels with the pick — the caller can't
         *  answer "why is it gold?" or "who's on it?" on its own. */
        onpick?: (id: number | null, info?: {
            held?: any; seated?: any; spare?: any;
        } | null) => void;
    } = $props();

    let rooms = $state<any[]>([]);
    let tables = $state<any[]>([]);
    let features = $state<any[]>([]);
    let occupancy = $state<any>(null);
    let roomId = $state<number | null>(null);
    let loading = $state(true);
    let at = $state('');                     // '' = the whole day

    // Zoom and scroll, same as the editor: staff print this and walk the room
    // with it, and a 40-table venue is unreadable fitted to a laptop panel.
    let zoom = $state(1);
    let wrapEl = $state<HTMLDivElement | null>(null);
    let svgEl = $state<SVGSVGElement | null>(null);
    let boxW = $state(800);
    let boxH = $state(460);
    let exportError = $state<string | null>(null);

    async function loadLayout() {
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/layout`, { credentials: 'include' });
        if (!r.ok) return;
        const body = await r.json();
        rooms = body.rooms;
        tables = body.tables;
        features = body.features;
        if (!rooms.find((x) => x.id === roomId)) roomId = rooms[0]?.id ?? null;
    }
    async function loadOccupancy() {
        const q = at ? `&at=${at}` : '';
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/layout/occupancy?date=${date}${q}`,
                              { credentials: 'include' });
        occupancy = r.ok ? await r.json() : null;
        // Whatever the caller is showing about the picked table came from the
        // occupancy we just replaced. Re-emit it, or moving a game leaves the
        // panel describing where it used to be. Doesn't loop: the id is
        // unchanged, so nothing this effect depends on moves.
        if (tableId !== null) {
            const t = tables.find((x) => x.id === tableId);
            if (t) onpick?.(tableId, { held: heldBy(t), seated: seatedOn(t), spare: spareOn(t) });
        }
    }

    onMount(async () => {
        await loadLayout();
        await loadOccupancy();
        loading = false;
    });
    // The layout barely changes; the day and time change constantly.
    $effect(() => { date; at; refresh; if (!loading) loadOccupancy(); });

    const room = $derived(rooms.find((r) => r.id === roomId) ?? null);
    const roomTables = $derived(tables.filter((t) => t.room_id === roomId));
    const roomStructure = $derived(
        features.filter((f) => f.room_id === roomId && f.kind !== 'note')
    );
    const roomNotes = $derived(features.filter((f) => f.room_id === roomId && f.kind === 'note'));

    const bookingsFor = (t: any) =>
        !occupancy || t.id === null ? [] : (occupancy.tables[String(t.id)] ?? []);

    /** Which club night has this table, if any. */
    const heldBy = (t: any) => occupancy?.held_by?.[String(t.id)] ?? null;
    /** The game sitting on it, once tonight's pairings have been laid out. */
    const seatedOn = (t: any) => occupancy?.seated_by?.[String(t.id)] ?? null;
    /** Held for a night that turns out not to need it. */
    const spareOn = (t: any) => occupancy?.spare_by?.[String(t.id)] ?? null;

    const PALETTE: Record<string, [string, string]> = {
        amber: ['#5a4520', '#d0ae63'],
        blue: ['#243c6b', '#7f96d4'],
        green: ['#24402a', '#79b184'],
        red: ['#5c2a24', '#cf7d72'],
        purple: ['#452a5e', '#a684c9'],
        teal: ['#1f4444', '#6fb3ad'],
        slate: ['#2a4a63', '#7fa8c4'],
        grey: ['#33363d', '#8b8f99']
    };

    function stateOf(t: any): string {
        if (!t.active) return 'off';
        const b = bookingsFor(t);
        if (b.some((x: any) => x.is_event)) return 'event';
        if (b.length) return 'busy';
        // "Held" splits three ways once the pairings are out, and the venue
        // needs all three: a table with a game on it, one the night is holding
        // and won't use, and one it has handed back. Spare is checked before
        // held because a spare table is still technically held — and "still
        // held" is exactly the thing staff can't see and need to.
        if (seatedOn(t)) return 'seated';
        const sp = spareOn(t);
        if (sp) return sp.released ? 'released' : 'spare';
        if (heldBy(t)) return 'held';
        return 'free';
    }

    /** A held table wears its NIGHT's colour, so a venue running four game
     *  nights can see which one has the far corner. Everything else keeps the
     *  state colours, which mean the same thing whatever night it is. */
    function paintOf(t: any): string | undefined {
        const st = stateOf(t);
        // A released table is nobody's any more, so it takes the free colours
        // rather than the night's — that IS the message.
        const h = st === 'held' ? heldBy(t)
            : st === 'seated' ? seatedOn(t)
            : st === 'spare' ? spareOn(t)
            : null;
        if (!h) return undefined;
        const [fill, edge] = PALETTE[h.color] ?? PALETTE.amber;
        return `--fill:${fill};--edge:${edge}`;
    }

    /** The nights actually holding tables today, for the key. */
    const heldNights = $derived.by(() => {
        const seen = new Map<number, { name: string; color: string; n: number;
                                       playing: number; spare: number }>();
        for (const t of roomTables) {
            const st = stateOf(t);
            const h = st === 'held' ? heldBy(t)
                : st === 'seated' ? seatedOn(t)
                : st === 'spare' ? spareOn(t)
                : null;
            if (!h) continue;
            const e = seen.get(h.night_id)
                ?? { name: h.name ?? h.night, color: h.color, n: 0, playing: 0, spare: 0 };
            e.n++;
            if (st === 'seated') e.playing++;
            if (st === 'spare') e.spare++;
            seen.set(h.night_id, e);
        }
        return [...seen.values()];
    });

    const releasedCount = $derived(roomTables.filter((t) => stateOf(t) === 'released').length);

    const tally = $derived.by(() => {
        const c: Record<string, number> =
            { busy: 0, event: 0, held: 0, seated: 0, spare: 0, released: 0, free: 0, off: 0 };
        for (const t of roomTables) c[stateOf(t)]++;
        return c;
    });

    /** The window worth scrubbing: what's actually on, padded, else an evening. */
    const span = $derived.by(() => {
        const mins = (s: string) => {
            const [h, m] = s.split(':').map(Number);
            return h * 60 + m;
        };
        let lo = 24 * 60, hi = 0;
        for (const t of roomTables)
            for (const b of bookingsFor(t)) {
                lo = Math.min(lo, mins(b.start));
                hi = Math.max(hi, mins(b.end));
            }
        if (lo > hi) return { lo: 10 * 60, hi: 23 * 60 };
        return { lo: Math.max(0, lo - 60), hi: Math.min(24 * 60, hi + 60) };
    });
    const atMins = $derived(at ? Number(at.slice(0, 2)) * 60 + Number(at.slice(3, 5)) : span.lo);
    const hhmm = (m: number) =>
        `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

    const pad = 1.5;
    const view = $derived(room
        ? { x: -pad, y: -pad, w: room.width_ft + pad * 2, h: room.depth_ft + pad * 2 }
        : { x: 0, y: 0, w: 10, h: 10 });

    /** Fit the room to the box in BOTH axes, then apply zoom. */
    const fit = $derived.by(() => {
        const k = Math.min(boxW / view.w, boxH / view.h) * zoom;
        return { w: Math.max(1, view.w * k), h: Math.max(1, view.h * k), k };
    });

    /**
     * Measured ONLY from the ResizeObserver — never from an effect that also
     * reads boxW/boxH. That version zoomed until the wrapper gained a
     * scrollbar, which shrank clientWidth, which rewrote boxW, which reran the
     * effect: an update loop that froze the whole component at about 300%.
     */
    function measure() {
        if (!wrapEl) return;
        boxW = Math.max(200, wrapEl.clientWidth);
        boxH = Math.max(200, Math.round(Math.min(680, window.innerHeight * 0.62)));
    }
    $effect(() => {
        if (!wrapEl) return;
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(wrapEl);
        return () => ro.disconnect();
    });

    /** Ctrl/cmd+wheel zooms about the cursor; a plain wheel scrolls the page,
     *  as it does everywhere else. */
    async function onWheel(e: WheelEvent) {
        if (!wrapEl || (!e.ctrlKey && !e.metaKey)) return;
        e.preventDefault();
        const rect = wrapEl.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const fx = (wrapEl.scrollLeft + cx) / Math.max(1, fit.w);
        const fy = (wrapEl.scrollTop + cy) / Math.max(1, fit.h);
        const next = Math.min(6, Math.max(0.3, zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
        if (next === zoom) return;
        zoom = next;
        await tick();
        wrapEl.scrollLeft = fx * fit.w - cx;
        wrapEl.scrollTop = fy * fit.h - cy;
    }

    /** A printed sheet has to say which night it is and what the colours mean,
     *  or it's just rectangles. */
    async function exportPng() {
        if (!svgEl || !room) return;
        exportError = null;
        // Whichever table you happened to click is not part of the room. Drop
        // the selection first: its ring is copied as an inline style before any
        // furniture is stripped, so it would print as a gold box round one
        // table for no reason anyone reading the sheet could work out.
        if (tableId !== null) {
            onpick?.(null, null);
            await tick();
        }
        const pretty = new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
            weekday: 'long', day: 'numeric', month: 'long'
        });
        const legend = [
            ...heldNights.map((h) => `${h.name}: ${h.playing} playing`
                + (h.spare ? `, ${h.spare} spare` : '')),
            tally.busy ? `${tally.busy} booked` : '',
            releasedCount ? `${releasedCount} back on sale` : '',
            `${tally.free} free`,
            occupancy?.unseated_games ? `${occupancy.unseated_games} GAME(S) WITH NO TABLE` : ''
        ].filter(Boolean);
        try {
            await exportPlanPng(svgEl, {
                view,
                name: `${room.name}-${date}`,
                caption: [`${room.name} — ${pretty}`, legend.join('  ·  ')]
            });
        } catch (_) {
            exportError = "Couldn't render the plan to an image.";
        }
    }
</script>

{#if loading}
    <p class="a-note">Loading the plan…</p>
{:else if !room}
    <p class="a-note">No floor plan yet — build one under Tables &amp; plan.</p>
{:else}
    <div class="planview">
        <div class="pv-bar">
            {#if rooms.length > 1}
                <span class="pv-rooms">
                    {#each rooms as r (r.id)}
                        <button class="pv-room" class:active={r.id === roomId}
                                onclick={() => (roomId = r.id)}>{r.name}</button>
                    {/each}
                </span>
            {/if}

            <span class="pv-key">
                <span class="k busy"></span>{tally.busy} booked
                {#if tally.event}<span class="k event"></span>{tally.event} event{/if}
                {#each heldNights as h}
                    <span class="k" style="background: {PALETTE[h.color]?.[0]}; border: 1px solid {PALETTE[h.color]?.[1]}"></span>{h.n}
                    {h.name}<span class="pv-sub">{#if h.playing || h.spare}
                        ({[h.playing ? `${h.playing} playing` : '',
                           h.spare ? `${h.spare} spare` : ''].filter(Boolean).join(', ')})
                    {/if}</span>
                {/each}
                {#if releasedCount}<span class="k spare"></span>{releasedCount} back on sale{/if}
                <span class="k free"></span>{tally.free} free
                {#if occupancy?.unseated_games}
                    <span class="k none"></span>{occupancy.unseated_games} with no table
                {/if}
            </span>

            <span class="pv-time">
                <button class="pv-chip" class:active={!at} onclick={() => (at = '')}>All day</button>
                <!-- Scrubbing the evening is the point: "what does the room look
                     like at eight" is the question staff actually ask, and a
                     date alone can't answer it. -->
                <input class="pv-slider" type="range"
                       min={span.lo} max={span.hi} step="15"
                       value={atMins}
                       oninput={(e) => (at = hhmm(Number((e.currentTarget as HTMLInputElement).value)))}
                       aria-label="Time of day" />
                <span class="pv-clock" class:muted={!at}>{at || 'whole day'}</span>
            </span>

            <span class="pv-tools">
                <button class="icon-btn" type="button" title="Zoom out"
                        onclick={() => (zoom = Math.max(0.3, zoom - 0.15))}>−</button>
                <span class="zoom-read">{Math.round(zoom * 100)}%</span>
                <button class="icon-btn" type="button" title="Zoom in"
                        onclick={() => (zoom = Math.min(6, zoom + 0.15))}>+</button>
                <button class="icon-btn wide" type="button" title="Fit to the window"
                        onclick={() => (zoom = 1)}>FIT</button>
                <button class="secondary-button pv-export" type="button" onclick={exportPng}>
                    Export PNG
                </button>
            </span>
        </div>

        {#if exportError}<p class="field-error">{exportError}</p>{/if}

        <!-- Scrolls rather than shrinks: a printed plan is no use if the only
             way to see the whole room is to make every table unreadable. -->
        <div class="pv-wrap" bind:this={wrapEl} onwheel={onWheel} style="height: {boxH}px">
        <svg class="pv-canvas" bind:this={svgEl}
             viewBox="{view.x} {view.y} {view.w} {view.h}"
             width={fit.w} height={fit.h}
             role="img" aria-label="{room.name} on {date}">
            <rect class="pv-floor" x="0" y="0" width={room.width_ft} height={room.depth_ft} />
            <rect class="pv-walls"
                  x={WALL_FT / 2} y={WALL_FT / 2}
                  width={Math.max(0.1, room.width_ft - WALL_FT)}
                  height={Math.max(0.1, room.depth_ft - WALL_FT)}
                  stroke-width={WALL_FT} />

            {#each roomStructure as f (f.id)}
                <PlanObject o={f} kind="feature" state={f.kind} editing={false} />
            {/each}

            {#each roomTables as t (t.id)}
                <PlanObject o={t} kind="table" state={stateOf(t)}
                            selected={tableId === t.id}
                            editing={false}
                            paint={paintOf(t)}
                            note={seatedOn(t) ? `${seatedOn(t).a} v ${seatedOn(t).b}` : ''}
                            bookings={bookingsFor(t)}
                            onpick={() => (tableId === t.id
                                ? onpick?.(null, null)
                                : onpick?.(t.id, { held: heldBy(t), seated: seatedOn(t),
                                                   spare: spareOn(t) }))} />
            {/each}

            {#each roomNotes as f (f.id)}
                <PlanObject o={f} kind="feature" state={f.kind} editing={false} />
            {/each}
        </svg>
        </div>
    </div>
{/if}

<style>
    .planview { margin-bottom: 0.8rem; }

    .pv-bar {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        flex-wrap: wrap;
        margin-bottom: 0.5rem;
    }

    .pv-rooms { display: inline-flex; gap: 0.25rem; }
    .pv-room {
        background: transparent;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 0.72rem;
        font-weight: 600;
        padding: 0.18rem 0.5rem;
        cursor: pointer;
    }
    .pv-room.active {
        color: var(--color-text-bright);
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 12%, transparent);
    }

    .pv-key {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.72rem;
        color: var(--color-text-muted);
    }
    .k { width: 9px; height: 9px; border-radius: 2px; display: inline-block; margin-left: 0.35rem; }
    .k:first-child { margin-left: 0; }
    .k.busy { background: #6b3320; border: 1px solid #d4835c; }
    .k.event { background: #5a3570; border: 1px solid #b98fd0; }
    .k.free { background: #24402a; border: 1px solid #79b184; }
    /* Spare reads as free-with-a-caveat, because that is what it is: nobody is
       using it, but it hasn't been put back on sale yet. */
    .k.spare { background: #24402a; border: 1px dashed #d0ae63; }
    .k.none { background: transparent; border: 1px dashed var(--color-loss); }
    .pv-sub { color: var(--color-text-faint); }

    .pv-time { display: inline-flex; align-items: center; gap: 0.4rem; margin-left: auto; }
    .pv-chip {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 0.7rem;
        padding: 0.15rem 0.45rem;
        cursor: pointer;
    }
    .pv-chip.active {
        color: var(--color-text-bright);
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    }
    .pv-slider { width: 11rem; }
    .pv-clock {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--color-text-bright);
        width: 4.4rem;
    }
    .pv-clock.muted { color: var(--color-text-faint); font-weight: 400; }

    .pv-tools { display: inline-flex; align-items: center; gap: 0.25rem; margin-left: auto; }
    .zoom-read { width: 3rem; text-align: center; font-size: 0.72rem;
                 color: var(--color-text-faint); }
    .pv-export { min-height: 1.8rem; font-size: 0.72rem; padding: 0 10px; margin-left: 0.3rem; }

    .icon-btn {
        background: transparent;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 0.8rem;
        line-height: 1;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
    }
    .icon-btn:hover { color: var(--color-text-bright); border-color: var(--color-accent); }
    .icon-btn.wide { font-size: 0.66rem; font-weight: 700; }

    .pv-wrap {
        overflow: auto;
        background: #0d0f13;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
    }

    .pv-canvas {
        display: block;
        background: #0d0f13;
        user-select: none;
    }
    .pv-canvas :global(*:focus) { outline: none; }

    .pv-floor { fill: #14171d; }
    .pv-walls { fill: none; stroke: #6d7280; shape-rendering: crispEdges; }
</style>
