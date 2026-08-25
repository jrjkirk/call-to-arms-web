<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from './HelpTip.svelte';

    /**
     * The venue's floor plan: an editor, and a live view of the room.
     *
     * Everything is in FEET, and every position is the CENTRE of a thing —
     * rotation is then one SVG transform about that point, with no offset
     * arithmetic and no drift when a table is turned.
     *
     * The SVG's viewBox IS the room in feet, so a 30x20 room is
     * `viewBox="0 0 30 20"`. Nothing here converts to pixels: pointer positions
     * come back through the SVG's own inverse transform, which means dragging
     * stays exact at any zoom and on any screen.
     */

    type Room = { id: number; name: string; width_ft: number; depth_ft: number; notes: string | null };
    type Table = {
        id: number | null; name: string; room_id: number | null;
        pos_x: number | null; pos_y: number | null;
        width_ft: number; depth_ft: number; rotation: number;
        seats: number; active: boolean; notes: string | null; size_label?: string | null;
    };
    type Feature = {
        id: number | null; room_id: number; kind: string; label: string | null;
        pos_x: number; pos_y: number; width_ft: number; depth_ft: number; rotation: number;
    };

    let rooms = $state<Room[]>([]);
    let tables = $state<Table[]>([]);
    let features = $state<Feature[]>([]);
    let deletedTables = $state<number[]>([]);
    let deletedFeatures = $state<number[]>([]);

    let roomId = $state<number | null>(null);
    let sel = $state<{ kind: 'table' | 'feature'; idx: number } | null>(null);
    let dirty = $state(false);
    let saving = $state(false);
    let error = $state<string | null>(null);
    let message = $state<string | null>(null);
    let loading = $state(true);

    let snap = $state(0.5);              // feet
    let showGrid = $state(true);
    let mode = $state<'edit' | 'live'>('edit');

    // Live view
    let liveDate = $state(new Date().toISOString().slice(0, 10));
    let liveAt = $state('');
    let occupancy = $state<any>(null);

    let svgEl: SVGSVGElement | null = $state(null);

    const PRESETS = [
        { label: '6×4', w: 6, d: 4, seats: 2 },
        { label: '4×4', w: 4, d: 4, seats: 2 },
        { label: '8×4', w: 8, d: 4, seats: 4 },
        { label: '6×3', w: 6, d: 3, seats: 2 },
        { label: 'Round 4′', w: 4, d: 4, seats: 4 }
    ];
    const FEATURES = [
        { kind: 'bar', label: 'Bar', w: 10, d: 2 },
        { kind: 'door', label: 'Door', w: 3, d: 0.6 },
        { kind: 'pillar', label: 'Pillar', w: 1.5, d: 1.5 },
        { kind: 'shelves', label: 'Terrain', w: 6, d: 1.5 },
        { kind: 'stairs', label: 'Stairs', w: 4, d: 3 },
        { kind: 'toilets', label: 'Toilets', w: 6, d: 5 },
        { kind: 'wall', label: 'Wall', w: 8, d: 0.5 }
    ];

    const room = $derived(rooms.find((r) => r.id === roomId) ?? null);
    const roomTables = $derived(tables.filter((t) => t.room_id === roomId));
    const roomFeatures = $derived(features.filter((f) => f.room_id === roomId));
    const unplaced = $derived(tables.filter((t) => t.room_id === null));
    const seatsHere = $derived(roomTables.filter((t) => t.active).reduce((n, t) => n + t.seats, 0));

    async function load() {
        loading = true;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/layout`, { credentials: 'include' });
        if (r.ok) {
            const body = await r.json();
            apply(body);
            roomId = rooms[0]?.id ?? null;
        } else error = 'Could not load the plan.';
        loading = false;
    }

    function apply(body: any) {
        rooms = body.rooms;
        tables = body.tables;
        features = body.features;
        deletedTables = [];
        deletedFeatures = [];
        dirty = false;
        sel = null;
    }

    onMount(load);

    async function save() {
        saving = true; error = null; message = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/layout`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tables, features,
                deleted_table_ids: deletedTables,
                deleted_feature_ids: deletedFeatures
            })
        });
        if (r.ok) { apply(await r.json()); message = 'Plan saved.'; }
        else error = (await r.json().catch(() => ({}))).detail || 'Save failed.';
        saving = false;
    }

    // ---- geometry -------------------------------------------------------
    const snapTo = (v: number) => (snap > 0 ? Math.round(v / snap) * snap : v);

    /** Pointer position in ROOM FEET. Goes through the SVG's own inverse
     *  transform rather than measuring the element, so it stays exact however
     *  the canvas is scaled or scrolled. */
    function atPointer(e: PointerEvent): { x: number; y: number } | null {
        if (!svgEl) return null;
        const pt = svgEl.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const ctm = svgEl.getScreenCTM();
        if (!ctm) return null;
        const p = pt.matrixTransform(ctm.inverse());
        return { x: p.x, y: p.y };
    }

    let drag: { kind: 'table' | 'feature'; idx: number; dx: number; dy: number } | null = null;

    function startDrag(e: PointerEvent, kind: 'table' | 'feature', idx: number) {
        if (mode === 'live') return;
        e.stopPropagation();
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        const p = atPointer(e);
        if (!p) return;
        const item: any = kind === 'table' ? tables[idx] : features[idx];
        sel = { kind, idx };
        drag = { kind, idx, dx: p.x - (item.pos_x ?? 0), dy: p.y - (item.pos_y ?? 0) };
    }

    function onDrag(e: PointerEvent) {
        if (!drag || !room) return;
        const p = atPointer(e);
        if (!p) return;
        const item: any = drag.kind === 'table' ? tables[drag.idx] : features[drag.idx];
        // Clamped to the room so nothing can be dragged out of the building and
        // lost off-canvas.
        item.pos_x = Math.max(0, Math.min(room.width_ft, snapTo(p.x - drag.dx)));
        item.pos_y = Math.max(0, Math.min(room.depth_ft, snapTo(p.y - drag.dy)));
        if (drag.kind === 'table') tables = tables;
        else features = features;
        dirty = true;
    }

    function endDrag(e: PointerEvent) {
        if (drag) (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
        drag = null;
    }

    const selected = $derived(
        sel === null ? null : (sel.kind === 'table' ? tables[sel.idx] : features[sel.idx])
    );

    function rotateSel(by: number) {
        if (!selected) return;
        (selected as any).rotation = (((selected as any).rotation + by) % 360 + 360) % 360;
        tables = tables; features = features;
        dirty = true;
    }

    function nudge(dx: number, dy: number) {
        if (!selected || !room) return;
        const step = snap || 0.5;
        (selected as any).pos_x = Math.max(0, Math.min(room.width_ft, ((selected as any).pos_x ?? 0) + dx * step));
        (selected as any).pos_y = Math.max(0, Math.min(room.depth_ft, ((selected as any).pos_y ?? 0) + dy * step));
        tables = tables; features = features;
        dirty = true;
    }

    function addTable(p: (typeof PRESETS)[number]) {
        if (!room) return;
        const n = tables.length + 1;
        tables = [...tables, {
            id: null, name: `Table ${n}`, room_id: room.id,
            pos_x: snapTo(room.width_ft / 2), pos_y: snapTo(room.depth_ft / 2),
            width_ft: p.w, depth_ft: p.d, rotation: 0,
            seats: p.seats, active: true, notes: null
        }];
        sel = { kind: 'table', idx: tables.length - 1 };
        dirty = true;
    }

    function addFeature(f: (typeof FEATURES)[number]) {
        if (!room) return;
        features = [...features, {
            id: null, room_id: room.id, kind: f.kind, label: f.label,
            pos_x: snapTo(room.width_ft / 2), pos_y: snapTo(room.depth_ft / 2),
            width_ft: f.w, depth_ft: f.d, rotation: 0
        }];
        sel = { kind: 'feature', idx: features.length - 1 };
        dirty = true;
    }

    function removeSelected() {
        if (!sel) return;
        if (sel.kind === 'table') {
            const t = tables[sel.idx];
            if (t.id !== null) deletedTables = [...deletedTables, t.id];
            tables = tables.filter((_, i) => i !== sel!.idx);
        } else {
            const f = features[sel.idx];
            if (f.id !== null) deletedFeatures = [...deletedFeatures, f.id];
            features = features.filter((_, i) => i !== sel!.idx);
        }
        sel = null;
        dirty = true;
    }

    function duplicateSelected() {
        if (!sel || sel.kind !== 'table') return;
        const t = tables[sel.idx];
        tables = [...tables, {
            ...t, id: null, name: `${t.name} copy`,
            pos_x: (t.pos_x ?? 0) + 2, pos_y: (t.pos_y ?? 0) + 2
        }];
        sel = { kind: 'table', idx: tables.length - 1 };
        dirty = true;
    }

    function placeUnplaced(t: Table) {
        if (!room) return;
        t.room_id = room.id;
        t.pos_x = snapTo(room.width_ft / 2);
        t.pos_y = snapTo(room.depth_ft / 2);
        tables = tables;
        sel = { kind: 'table', idx: tables.indexOf(t) };
        dirty = true;
    }

    function onKey(e: KeyboardEvent) {
        if (mode === 'live') return;
        const el = e.target as HTMLElement;
        if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
        if (!sel) return;
        const map: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
        };
        if (map[e.key]) { e.preventDefault(); nudge(...map[e.key]); }
        else if (e.key === 'r' || e.key === 'R') rotateSel(e.shiftKey ? -15 : 15);
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
        else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); duplicateSelected(); }
        else if (e.key === 'Escape') sel = null;
    }

    // ---- rooms ----------------------------------------------------------
    async function saveRoom(r: Room | null, patch: Partial<Room>) {
        error = null;
        const res = await fetch(`${PUBLIC_API_URL}/venue/admin/layout/rooms`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: r?.id ?? null, name: patch.name ?? r?.name ?? 'Room',
                                   width_ft: patch.width_ft ?? r?.width_ft ?? 30,
                                   depth_ft: patch.depth_ft ?? r?.depth_ft ?? 20 })
        });
        if (res.ok) {
            const body = await res.json();
            const keep = dirty ? { tables, features, deletedTables, deletedFeatures } : null;
            rooms = body.rooms;
            if (!keep) { tables = body.tables; features = body.features; }
            if (!rooms.find((x) => x.id === roomId)) roomId = rooms[0]?.id ?? null;
        } else error = (await res.json().catch(() => ({}))).detail || 'Could not save the room.';
    }

    async function deleteRoom() {
        if (!room) return;
        if (!confirm(`Delete ${room.name}? Its tables come off the plan but aren't deleted.`)) return;
        const res = await fetch(`${PUBLIC_API_URL}/venue/admin/layout/rooms/${room.id}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (res.ok) {
            const body = await res.json();
            apply(body);
            roomId = rooms[0]?.id ?? null;
            if (body.unplaced) message = `${body.unplaced} table(s) came off the plan — drag them back on.`;
        } else error = (await res.json().catch(() => ({}))).detail || 'Could not delete the room.';
    }

    // ---- live view ------------------------------------------------------
    async function loadOccupancy() {
        const at = liveAt ? `&at=${liveAt}` : '';
        const r = await fetch(
            `${PUBLIC_API_URL}/venue/admin/layout/occupancy?date=${liveDate}${at}`,
            { credentials: 'include' }
        );
        occupancy = r.ok ? await r.json() : null;
    }

    $effect(() => {
        if (mode === 'live') { liveDate; liveAt; loadOccupancy(); }
    });

    function bookingsFor(t: Table) {
        if (!occupancy || t.id === null) return [];
        return occupancy.tables[String(t.id)] ?? [];
    }
    function isHeld(t: Table) {
        return occupancy && t.id !== null && occupancy.held_table_ids.includes(t.id);
    }
    function stateOf(t: Table): 'off' | 'busy' | 'event' | 'held' | 'free' {
        if (!t.active) return 'off';
        const b = bookingsFor(t);
        if (b.some((x: any) => x.is_event)) return 'event';
        if (b.length) return 'busy';
        if (isHeld(t)) return 'held';
        return 'free';
    }

    const liveCount = $derived(
        mode === 'live' && occupancy
            ? {
                  busy: roomTables.filter((t) => stateOf(t) === 'busy' || stateOf(t) === 'event').length,
                  held: roomTables.filter((t) => stateOf(t) === 'held').length,
                  free: roomTables.filter((t) => stateOf(t) === 'free').length
              }
            : null
    );

    /** Half-extents of a rotated rectangle, projected onto the axes. Good
     *  enough to catch "these two are on top of each other" without a full
     *  separating-axis test — this is a warning, not a physics engine. */
    function extents(o: { width_ft: number; depth_ft: number; rotation: number }) {
        const a = (o.rotation * Math.PI) / 180;
        const c = Math.abs(Math.cos(a));
        const s2 = Math.abs(Math.sin(a));
        return {
            hx: (o.width_ft * c + o.depth_ft * s2) / 2,
            hy: (o.width_ft * s2 + o.depth_ft * c) / 2
        };
    }

    const overlapping = $derived.by(() => {
        const bad = new Set<number>();
        const list = roomTables;
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const a = list[i], b = list[j];
                if (a.pos_x == null || b.pos_x == null) continue;
                const ea = extents(a), eb = extents(b);
                // A hair of tolerance so two tables pushed exactly edge to edge
                // — which venues do on purpose — aren't flagged.
                if (Math.abs(a.pos_x - b.pos_x) < ea.hx + eb.hx - 0.05 &&
                    Math.abs((a.pos_y ?? 0) - (b.pos_y ?? 0)) < ea.hy + eb.hy - 0.05) {
                    bad.add(tables.indexOf(a));
                    bad.add(tables.indexOf(b));
                }
            }
        }
        return bad;
    });

    function gridLines(r: Room) {
        const out: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
        for (let x = 1; x < r.width_ft; x++)
            out.push({ x1: x, y1: 0, x2: x, y2: r.depth_ft, major: x % 5 === 0 });
        for (let y = 1; y < r.depth_ft; y++)
            out.push({ x1: 0, y1: y, x2: r.width_ft, y2: y, major: y % 5 === 0 });
        return out;
    }

    const FEATURE_FILL: Record<string, string> = {
        bar: '#6b4f2a', door: '#2f2f38', pillar: '#3a3a44', shelves: '#4a3d2c',
        stairs: '#3a3a44', toilets: '#2f3a3a', wall: '#4a4a54'
    };
</script>

<svelte:window on:keydown={onKey} />

{#if loading}
    <p class="a-note">Loading the plan…</p>
{:else}
<div class="a-card plan-card">
    <div class="a-head">
        <h2 class="a-title">Floor plan</h2>
        <HelpTip
            label="floor plan"
            text={"Your venue drawn to scale, in feet. Drag to move, R to turn, arrow keys to nudge, Delete to remove.\n\nSwitch to Tonight to see the same room with its bookings on it — which table is busy, which is held for a club night, which is free."}
        />
        <span class="a-head-end mode-toggle">
            <button class="view-btn" class:active={mode === 'edit'} onclick={() => (mode = 'edit')}>Edit</button>
            <button class="view-btn" class:active={mode === 'live'} onclick={() => (mode = 'live')}>Tonight</button>
        </span>
    </div>

    <div class="room-tabs">
        {#each rooms as r (r.id)}
            <button class="room-tab" class:active={r.id === roomId} onclick={() => { roomId = r.id; sel = null; }}>
                {r.name}
            </button>
        {/each}
        {#if mode === 'edit'}
            <button class="room-tab add" onclick={() => saveRoom(null, { name: `Room ${rooms.length + 1}` })}>+ Room</button>
        {/if}
    </div>

    {#if room}
        {#if mode === 'edit'}
            <div class="toolbar">
                <span class="tool-group">
                    <span class="tool-label">Add table</span>
                    {#each PRESETS as p}
                        <button class="chip" onclick={() => addTable(p)}>{p.label}</button>
                    {/each}
                </span>
                <span class="tool-group">
                    <span class="tool-label">Add fixture</span>
                    {#each FEATURES as f}
                        <button class="chip subtle" onclick={() => addFeature(f)}>{f.label}</button>
                    {/each}
                </span>
                <span class="tool-group">
                    <label class="tool-label" for="snap">Snap</label>
                    <select id="snap" class="mini-select" bind:value={snap}>
                        <option value={0}>Off</option>
                        <option value={0.25}>3″</option>
                        <option value={0.5}>6″</option>
                        <option value={1}>1 ft</option>
                    </select>
                    <label class="check-row">
                        <input type="checkbox" bind:checked={showGrid} />
                        <span>Grid</span>
                    </label>
                </span>
            </div>
        {:else}
            <div class="toolbar">
                <label class="tool-label" for="live-date">Date</label>
                <input id="live-date" class="mini-input" type="date" bind:value={liveDate} />
                <label class="tool-label" for="live-at">At</label>
                <input id="live-at" class="mini-input" type="time" bind:value={liveAt} />
                {#if liveAt}
                    <button class="chip subtle" onclick={() => (liveAt = '')}>Whole day</button>
                {/if}
                {#if liveCount}
                    <span class="live-key">
                        <span class="key busy"></span> {liveCount.busy} busy
                        <span class="key held"></span> {liveCount.held} held
                        <span class="key free"></span> {liveCount.free} free
                    </span>
                {/if}
            </div>
            {#if occupancy?.club_nights?.length}
                <p class="a-note">
                    {occupancy.club_nights.map((n: any) => n.system + (n.start_time ? ` from ${n.start_time}` : '')).join(' · ')}
                </p>
            {/if}
        {/if}

        <div class="canvas-wrap">
            <svg
                bind:this={svgEl}
                class="canvas"
                viewBox="-1 -1 {room.width_ft + 2} {room.depth_ft + 4}"
                role="application"
                aria-label="{room.name} floor plan"
                onpointerdown={() => (sel = null)}
            >
                <rect class="floor" x="0" y="0" width={room.width_ft} height={room.depth_ft} />

                {#if showGrid && mode === 'edit'}
                    {#each gridLines(room) as l}
                        <line class="grid" class:major={l.major}
                              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
                    {/each}
                {/if}

                <rect class="walls" x="0" y="0" width={room.width_ft} height={room.depth_ft} />

                {#each roomFeatures as f (f.id ?? `n${features.indexOf(f)}`)}
                    {@const i = features.indexOf(f)}
                    <g transform="translate({f.pos_x} {f.pos_y}) rotate({f.rotation})"
                       class="feature" class:sel={sel?.kind === 'feature' && sel.idx === i}
                       onpointerdown={(e) => startDrag(e, 'feature', i)}
                       onpointermove={onDrag}
                       onpointerup={endDrag}
                       role="button" tabindex="-1">
                        <rect x={-f.width_ft / 2} y={-f.depth_ft / 2}
                              width={f.width_ft} height={f.depth_ft}
                              fill={FEATURE_FILL[f.kind] ?? '#44444e'} />
                    </g>
                    {#if f.label && f.width_ft >= 3}
                        <g transform="translate({f.pos_x} {f.pos_y})" class="labels">
                            <text x="0" y="0" class="feature-label"
                                  font-size={Math.min(1.1, Math.min(f.width_ft, f.depth_ft) * 0.6)}>{f.label}</text>
                        </g>
                    {/if}
                {/each}

                {#each roomTables as t (t.id ?? `n${tables.indexOf(t)}`)}
                    {@const i = tables.indexOf(t)}
                    {@const st = mode === 'live' ? stateOf(t) : (t.active ? 'free' : 'off')}
                    {@const bk = mode === 'live' ? bookingsFor(t) : []}
                    <g class="table {st}"
                       class:sel={sel?.kind === 'table' && sel.idx === i}
                       class:editing={mode === 'edit'}
                       class:clash={mode === 'edit' && overlapping.has(i)}
                       onpointerdown={(e) => startDrag(e, 'table', i)}
                       onpointermove={onDrag}
                       onpointerup={endDrag}
                       role="button" tabindex="-1">
                        <!-- The shape turns; the LABEL DOESN'T. A rotated table
                             is a real thing at an angle, but a name printed
                             sideways is just harder to read — which is why every
                             floor-plan tool keeps its labels upright. Two groups
                             rather than counter-rotating the text, so the label
                             never swings about the table's centre. -->
                        <g transform="translate({t.pos_x} {t.pos_y}) rotate({t.rotation})">
                            <rect class="top" x={-t.width_ft / 2} y={-t.depth_ft / 2}
                                  width={t.width_ft} height={t.depth_ft} rx="0.2" />
                        </g>
                        <g transform="translate({t.pos_x} {t.pos_y})" class="labels">
                            <text x="0" y={bk.length ? -0.25 : 0.35} class="tname"
                                  font-size={Math.min(1.2, Math.min(t.width_ft, t.depth_ft) * 0.34)}>{t.name}</text>
                            {#if bk.length}
                                <text x="0" y="1.05" class="tsub"
                                      font-size={Math.min(0.9, Math.min(t.width_ft, t.depth_ft) * 0.26)}>
                                    {bk[0].start}–{bk[0].end}{bk.length > 1 ? ` +${bk.length - 1}` : ''}
                                </text>
                            {:else if mode === 'edit'}
                                <text x="0" y="1.0" class="tsub"
                                      font-size={Math.min(0.8, Math.min(t.width_ft, t.depth_ft) * 0.22)}>
                                    {t.width_ft}×{t.depth_ft}
                                </text>
                            {/if}
                        </g>
                    </g>
                {/each}

                <!-- Scale bar: without it "30 wide" is just a number, and the
                     first thing anyone asks of a plan is how big it really is. -->
                <line class="scale" x1="0" y1={room.depth_ft + 1.4}
                      x2="10" y2={room.depth_ft + 1.4} />
                <line class="scale" x1="0" y1={room.depth_ft + 1.15} x2="0" y2={room.depth_ft + 1.65} />
                <line class="scale" x1="10" y1={room.depth_ft + 1.15} x2="10" y2={room.depth_ft + 1.65} />
                <text x="5" y={room.depth_ft + 2.5} class="scale-label" font-size="0.8">10 ft</text>
            </svg>
        </div>

        {#if mode === 'edit'}
            <div class="below">
                <div class="inspector">
                    {#if selected}
                        {#if sel?.kind === 'table'}
                            {@const t = selected as Table}
                            <div class="insp-row">
                                <input class="field-input insp-name" bind:value={t.name}
                                       oninput={() => (dirty = true)} aria-label="Table name" />
                                <label class="insp-num">
                                    <span class="field-label-hint">Wide</span>
                                    <input class="field-input" type="number" step="0.5" min="1" max="100"
                                           bind:value={t.width_ft} oninput={() => (dirty = true)} />
                                </label>
                                <label class="insp-num">
                                    <span class="field-label-hint">Deep</span>
                                    <input class="field-input" type="number" step="0.5" min="1" max="100"
                                           bind:value={t.depth_ft} oninput={() => (dirty = true)} />
                                </label>
                                <label class="insp-num">
                                    <span class="field-label-hint">Seats</span>
                                    <input class="field-input" type="number" min="1" max="20"
                                           bind:value={t.seats} oninput={() => (dirty = true)} />
                                </label>
                                <label class="check-row">
                                    <input type="checkbox" bind:checked={t.active}
                                           onchange={() => (dirty = true)} />
                                    <span>Bookable</span>
                                </label>
                            </div>
                        {:else}
                            {@const f = selected as Feature}
                            <div class="insp-row">
                                <input class="field-input insp-name" bind:value={f.label}
                                       oninput={() => (dirty = true)} aria-label="Fixture label" />
                                <label class="insp-num">
                                    <span class="field-label-hint">Wide</span>
                                    <input class="field-input" type="number" step="0.5" min="0.5" max="200"
                                           bind:value={f.width_ft} oninput={() => (dirty = true)} />
                                </label>
                                <label class="insp-num">
                                    <span class="field-label-hint">Deep</span>
                                    <input class="field-input" type="number" step="0.5" min="0.5" max="200"
                                           bind:value={f.depth_ft} oninput={() => (dirty = true)} />
                                </label>
                            </div>
                        {/if}
                        <div class="insp-row">
                            <span class="field-label-hint">Turn</span>
                            <button class="chip" onclick={() => rotateSel(-90)}>⟲ 90°</button>
                            <button class="chip" onclick={() => rotateSel(-15)}>−15°</button>
                            <span class="rot-read">{Math.round((selected as any).rotation)}°</span>
                            <button class="chip" onclick={() => rotateSel(15)}>+15°</button>
                            <button class="chip" onclick={() => rotateSel(90)}>⟳ 90°</button>
                            {#if sel?.kind === 'table'}
                                <button class="chip subtle" onclick={duplicateSelected}>Duplicate</button>
                            {/if}
                            <button class="danger-button insp-del" onclick={removeSelected}>Remove</button>
                        </div>
                    {:else}
                        <p class="a-note insp-hint">
                            Click something to edit it. Drag to move · <kbd>R</kbd> to turn ·
                            arrows to nudge · <kbd>Del</kbd> to remove.
                        </p>
                    {/if}
                </div>

                <div class="room-box">
                    <div class="insp-row">
                        <input class="field-input insp-name" value={room.name}
                               onchange={(e) => saveRoom(room, { name: (e.currentTarget as HTMLInputElement).value })}
                               aria-label="Room name" />
                        <label class="insp-num">
                            <span class="field-label-hint">Width ft</span>
                            <input class="field-input" type="number" step="1" min="4" max="400"
                                   value={room.width_ft}
                                   onchange={(e) => saveRoom(room, { width_ft: Number((e.currentTarget as HTMLInputElement).value) })} />
                        </label>
                        <label class="insp-num">
                            <span class="field-label-hint">Depth ft</span>
                            <input class="field-input" type="number" step="1" min="4" max="400"
                                   value={room.depth_ft}
                                   onchange={(e) => saveRoom(room, { depth_ft: Number((e.currentTarget as HTMLInputElement).value) })} />
                        </label>
                        {#if rooms.length > 1}
                            <button class="danger-button" onclick={deleteRoom}>Delete room</button>
                        {/if}
                    </div>
                    <p class="a-note room-stats">
                        {roomTables.length} table{roomTables.length === 1 ? '' : 's'} ·
                        {seatsHere} seats · {room.width_ft}×{room.depth_ft} ft
                    </p>
                    {#if overlapping.size}
                        <p class="field-error room-stats">
                            {overlapping.size} tables are on top of each other. Staff set the room
                            out from this plan — it needs to be somewhere they could actually stand.
                        </p>
                    {/if}
                </div>
            </div>

            {#if unplaced.length}
                <div class="tray">
                    <span class="field-label-hint">Not on the plan</span>
                    {#each unplaced as t}
                        <button class="chip" onclick={() => placeUnplaced(t)}>{t.name} ↗</button>
                    {/each}
                </div>
            {/if}
        {/if}
    {/if}

    {#if error}<p class="field-error">{error}</p>{/if}
    {#if message}<p class="pairing-message">{message}</p>{/if}

    {#if mode === 'edit'}
        <div class="save-row">
            <button class="primary-button" disabled={saving || !dirty} onclick={save}>
                {saving ? 'Saving…' : dirty ? 'Save plan' : 'Saved'}
            </button>
            {#if dirty}<span class="a-note unsaved">Unsaved changes</span>{/if}
        </div>
    {/if}
</div>
{/if}

<style>
    .plan-card { --panel-accent: var(--color-accent); }

    .mode-toggle { display: inline-flex; gap: 0.25rem; }
    .view-btn {
        background: transparent;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 0.7rem;
        font-weight: 700;
        padding: 0.2rem 0.55rem;
        cursor: pointer;
    }
    .view-btn.active {
        color: var(--color-text-bright);
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    }

    .room-tabs { display: flex; gap: 0.3rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
    .room-tab {
        background: transparent;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 0.76rem;
        font-weight: 600;
        padding: 0.28rem 0.7rem;
        cursor: pointer;
    }
    .room-tab.active {
        color: var(--color-text-bright);
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 12%, transparent);
    }
    .room-tab.add { color: var(--color-text-faint); }

    .toolbar {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        flex-wrap: wrap;
        padding: 0.5rem 0.6rem;
        margin-bottom: 0.6rem;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        background: rgba(0, 0, 0, 0.2);
    }
    .tool-group { display: inline-flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
    .tool-label {
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--color-text-faint);
        margin-right: 0.1rem;
    }

    .chip {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-bright);
        font-family: inherit;
        font-size: 0.72rem;
        font-weight: 600;
        padding: 0.2rem 0.5rem;
        cursor: pointer;
    }
    .chip:hover { border-color: var(--color-accent); }
    .chip.subtle { color: var(--color-text-muted); }

    .mini-select, .mini-input {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-bright);
        font-family: inherit;
        font-size: 0.72rem;
        padding: 0.18rem 0.35rem;
    }

    .live-key { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.72rem; color: var(--color-text-muted); }
    .key { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
    .key.busy { background: #b4562e; }
    .key.held { background: #8a6d3b; }
    .key.free { background: #3f5d43; }

    .canvas-wrap {
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        background: #0d0f13;
        overflow: hidden;
        margin-bottom: 0.7rem;
    }
    .canvas { display: block; width: 100%; height: auto; touch-action: none; }

    .floor { fill: #14171d; }
    .walls { fill: none; stroke: #5a5f6b; stroke-width: 0.22; }
    .grid { stroke: #ffffff10; stroke-width: 0.04; }
    .grid.major { stroke: #ffffff22; stroke-width: 0.06; }

    .feature { cursor: grab; }
    .feature rect { stroke: #00000060; stroke-width: 0.08; }
    .feature.sel rect { stroke: var(--color-accent); stroke-width: 0.16; }
    .feature-label {
        fill: #cfcfd6;
        text-anchor: middle;
        dominant-baseline: middle;
        pointer-events: none;
        font-family: inherit;
    }

    /* Dragging focuses the group (they carry tabindex so keyboard nudging
       works), and Chrome then paints a default focus ring — which on an SVG
       <g> is an enormous white rounded rectangle over the plan. Selection is
       already shown by the accent stroke, so this suppresses the ring for the
       pointer and restores a real one for keyboard users. */
    .table:focus, .feature:focus { outline: none; }
    .table:focus-visible .top, .feature:focus-visible rect {
        stroke: var(--color-accent);
        stroke-width: 0.26;
    }

    .table { cursor: grab; }
    .table.editing:active { cursor: grabbing; }
    .table .top {
        fill: #2a4a63;
        stroke: #7fa8c4;
        stroke-width: 0.1;
        transition: fill 0.15s;
    }
    .table.off .top { fill: #23252b; stroke: #4a4c55; }
    .table.busy .top { fill: #6b3320; stroke: #d4835c; }
    .table.event .top { fill: #5a3570; stroke: #b98fd0; }
    .table.held .top { fill: #5a4520; stroke: #d0ae63; }
    .table.free .top { fill: #24402a; stroke: #79b184; }
    .table.sel .top { stroke: var(--color-accent); stroke-width: 0.22; }
    /* Dashed rather than a colour swap: the table's real state (bookable, off)
       is still worth seeing while you untangle it. */
    .table.clash .top {
        stroke: var(--color-loss);
        stroke-width: 0.2;
        stroke-dasharray: 0.5 0.35;
    }

    /* Labels sit above everything and never take the pointer — clicks and
       drags belong to the shape underneath. */
    .labels { pointer-events: none; }

    .tname {
        fill: #f2f2f5;
        text-anchor: middle;
        dominant-baseline: middle;
        font-weight: 700;
        pointer-events: none;
        font-family: inherit;
    }
    .tsub {
        fill: #c8c8d0;
        text-anchor: middle;
        dominant-baseline: middle;
        pointer-events: none;
        font-family: inherit;
    }

    .scale { stroke: #6a6f7b; stroke-width: 0.08; }
    .scale-label { fill: #6a6f7b; text-anchor: middle; font-family: inherit; }

    .below { display: flex; gap: 0.7rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
    .inspector, .room-box {
        flex: 1 1 20rem;
        min-width: 0;
        padding: 0.55rem 0.65rem;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        background: rgba(0, 0, 0, 0.2);
    }
    .insp-row { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
    .insp-row:last-child { margin-bottom: 0; }
    .insp-name { flex: 1 1 8rem; min-width: 0; }
    .insp-num { display: flex; flex-direction: column; gap: 0.1rem; width: 4.6rem; }
    .insp-del { margin-left: auto; }
    .insp-hint { margin: 0; }
    .rot-read { font-size: 0.75rem; color: var(--color-text-bright); width: 2.6rem; text-align: center; }
    .room-stats { margin: 0; }

    kbd {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid var(--color-steel-border);
        border-radius: 3px;
        padding: 0 0.25rem;
        font-size: 0.72rem;
    }

    .tray { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.6rem; }

    .save-row { display: flex; align-items: center; gap: 0.7rem; }
    .unsaved { margin: 0; color: var(--color-accent); }
</style>
