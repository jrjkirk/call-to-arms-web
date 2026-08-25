<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from './HelpTip.svelte';
    import PlanObject from './plan/PlanObject.svelte';
    import SelectionFrame from './plan/SelectionFrame.svelte';
    import { angleTo, feet, norm, overlaps, resize, type Box, type Handle } from './plan/geometry';

    /**
     * The venue's floor plan: an editor, and a live view of the room.
     *
     * Everything is in FEET, and every position is the CENTRE of a thing.
     * The SVG's viewBox IS the room, so nothing here converts to pixels —
     * pointer positions come back through the SVG's own inverse transform,
     * which keeps dragging exact at any zoom on any screen.
     */

    type Room = { id: number; name: string; width_ft: number; depth_ft: number; notes: string | null };

    let rooms = $state<any[]>([]);
    let tables = $state<any[]>([]);
    let features = $state<any[]>([]);
    let deletedTables = $state<number[]>([]);
    let deletedFeatures = $state<number[]>([]);

    let roomId = $state<number | null>(null);
    let sel = $state<{ kind: 'table' | 'feature'; idx: number } | null>(null);
    let dirty = $state(false);
    let saving = $state(false);
    let error = $state<string | null>(null);
    let message = $state<string | null>(null);
    let loading = $state(true);

    let snap = $state(0.5);
    let showGrid = $state(true);
    // Tonight, not Edit. A venue lays its room out once and then looks at it
    // every shift — opening on the editor would put the rarer job in front of
    // the daily one, and risk someone nudging a table they only came to look at.
    let mode = $state<'edit' | 'live'>('live');
    let zoom = $state(1);

    let liveDate = $state(new Date().toISOString().slice(0, 10));
    let liveAt = $state('');
    let occupancy = $state<any>(null);

    let svgEl: SVGSVGElement | null = $state(null);
    let wrapEl: HTMLDivElement | null = $state(null);
    let rootEl: HTMLDivElement | null = $state(null);
    let pxPerFt = $state(20);

    /**
     * The app is a 1100px reading column, which is the wrong shape for a
     * spatial tool — a floor plan wants the whole desk.
     *
     * Measured from documentElement.clientWidth rather than done in CSS with
     * 100vw, because 100vw INCLUDES the scrollbar: the usual full-bleed trick
     * overshoots by its width and adds a horizontal scrollbar to every page it
     * appears on. clientWidth is the visible width, so this lands exactly.
     */
    let bleed = $state(0);
    function measureBleed() {
        if (!rootEl) return;
        const avail = document.documentElement.clientWidth - 32;
        bleed = Math.max(0, avail - rootEl.parentElement!.clientWidth);
    }

    // ---- undo -----------------------------------------------------------
    // A direct-manipulation editor without undo is one people are afraid of, so
    // every committed gesture snapshots the plan. Positions only — rooms are
    // saved server-side the moment they change, and rolling those back here
    // would leave the two out of step.
    let past = $state<string[]>([]);
    let future = $state<string[]>([]);
    const snapshot = () => JSON.stringify({ tables, features, deletedTables, deletedFeatures });

    function commit() {
        past = [...past.slice(-49), snapshot()];
        future = [];
        dirty = true;
    }
    function restore(json: string) {
        const s = JSON.parse(json);
        tables = s.tables; features = s.features;
        deletedTables = s.deletedTables; deletedFeatures = s.deletedFeatures;
        sel = null;
    }
    function undo() {
        if (!past.length) return;
        future = [snapshot(), ...future];
        const prev = past[past.length - 1];
        past = past.slice(0, -1);
        restore(prev);
        dirty = true;
    }
    function redo() {
        if (!future.length) return;
        past = [...past, snapshot()];
        restore(future[0]);
        future = future.slice(1);
        dirty = true;
    }

    /** The colour-coding palette, as [token, fill, edge]. Mirrors venue.py's
     *  TABLE_COLORS — named options rather than a free picker, so nothing can
     *  be chosen that's illegible on the dark plan, and nothing can be painted
     *  the green the Tonight view uses for "free". */
    const COLORS: [string, string, string][] = [
        ['slate', '#2a4a63', '#7fa8c4'],
        ['blue', '#243c6b', '#7f96d4'],
        ['green', '#24402a', '#79b184'],
        ['amber', '#5a4520', '#d0ae63'],
        ['red', '#5c2a24', '#cf7d72'],
        ['purple', '#452a5e', '#a684c9'],
        ['teal', '#1f4444', '#6fb3ad'],
        ['grey', '#33363d', '#8b8f99']
    ];

    const TABLE_PRESETS = [
        { label: '6×4', w: 6, d: 4, seats: 2, shape: 'rect' },
        { label: '4×4', w: 4, d: 4, seats: 2, shape: 'rect' },
        { label: '8×4', w: 8, d: 4, seats: 4, shape: 'rect' },
        { label: '6×3', w: 6, d: 3, seats: 2, shape: 'rect' },
        { label: 'Round', w: 4, d: 4, seats: 4, shape: 'round' },
        { label: 'Oval', w: 6, d: 3.5, seats: 4, shape: 'oval' }
    ];
    const FIXTURES = [
        { kind: 'bar', label: 'Bar', w: 10, d: 2 },
        { kind: 'door', label: 'Door', w: 3, d: 0.6 },
        { kind: 'pillar', label: 'Pillar', w: 1.5, d: 1.5, shape: 'round' },
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
    const selected = $derived(
        sel === null ? null : (sel.kind === 'table' ? tables[sel.idx] : features[sel.idx])
    );

    const overlapping = $derived.by(() => {
        const bad = new Set<number>();
        const list = roomTables;
        for (let i = 0; i < list.length; i++)
            for (let j = i + 1; j < list.length; j++) {
                if (list[i].pos_x == null || list[j].pos_x == null) continue;
                if (overlaps(list[i] as Box, list[j] as Box)) {
                    bad.add(tables.indexOf(list[i]));
                    bad.add(tables.indexOf(list[j]));
                }
            }
        return bad;
    });

    // ---- data -----------------------------------------------------------
    async function load() {
        loading = true;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/layout`, { credentials: 'include' });
        if (r.ok) { apply(await r.json()); roomId = rooms[0]?.id ?? null; }
        else error = 'Could not load the plan.';
        loading = false;
    }
    function apply(body: any) {
        rooms = body.rooms; tables = body.tables; features = body.features;
        deletedTables = []; deletedFeatures = [];
        past = []; future = []; dirty = false; sel = null;
    }
    onMount(load);

    async function save() {
        saving = true; error = null; message = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/layout`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tables, features,
                                   deleted_table_ids: deletedTables,
                                   deleted_feature_ids: deletedFeatures })
        });
        if (r.ok) { apply(await r.json()); message = 'Plan saved.'; }
        else error = (await r.json().catch(() => ({}))).detail || 'Save failed.';
        saving = false;
    }

    // ---- pointer --------------------------------------------------------
    const snapTo = (v: number) => (snap > 0 ? Math.round(v / snap) * snap : v);

    function atPointer(e: PointerEvent) {
        if (!svgEl) return null;
        const pt = svgEl.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const ctm = svgEl.getScreenCTM();
        if (!ctm) return null;
        const p = pt.matrixTransform(ctm.inverse());
        return { x: p.x, y: p.y };
    }

    type Gesture =
        | { type: 'move'; dx: number; dy: number }
        | { type: 'resize'; handle: Handle }
        | { type: 'rotate'; grab: number; from: number };
    let gesture: Gesture | null = null;
    let gestureStarted = false;

    function beginMove(e: PointerEvent, kind: 'table' | 'feature', idx: number) {
        if (mode === 'live') return;
        e.stopPropagation();
        const p = atPointer(e);
        if (!p) return;
        sel = { kind, idx };
        const o: any = kind === 'table' ? tables[idx] : features[idx];
        gesture = { type: 'move', dx: p.x - o.pos_x, dy: p.y - o.pos_y };
        gestureStarted = false;
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }

    function beginHandle(what: Handle | 'rotate', e: PointerEvent) {
        if (!selected) return;
        e.stopPropagation();
        const p = atPointer(e);
        if (!p) return;
        gesture = what === 'rotate'
            ? { type: 'rotate', grab: angleTo(selected as Box, p.x, p.y), from: selected.rotation }
            : { type: 'resize', handle: what };
        gestureStarted = false;
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }

    function onMove(e: PointerEvent) {
        if (!gesture || !selected || !room) return;
        const p = atPointer(e);
        if (!p) return;
        // The snapshot goes in on the FIRST movement, not on pointerdown, so a
        // click that selects without moving doesn't fill the undo stack.
        if (!gestureStarted) { commit(); gestureStarted = true; }

        const o: any = selected;
        if (gesture.type === 'move') {
            o.pos_x = Math.max(0, Math.min(room.width_ft, snapTo(p.x - gesture.dx)));
            o.pos_y = Math.max(0, Math.min(room.depth_ft, snapTo(p.y - gesture.dy)));
        } else if (gesture.type === 'resize') {
            const next = resize(o as Box, gesture.handle, p.x, p.y,
                                { min: 1, snap, keepAspect: e.shiftKey });
            o.pos_x = next.pos_x; o.pos_y = next.pos_y;
            o.width_ft = Math.round(next.width_ft * 100) / 100;
            o.depth_ft = Math.round(next.depth_ft * 100) / 100;
        } else {
            const now = angleTo(o as Box, p.x, p.y);
            let deg = gesture.from + (now - gesture.grab);
            // Snapped to 15° unless shift is held — a table at 3.7° is a
            // mistake, not a decision, and every plan wants square by default.
            if (!e.shiftKey) deg = Math.round(deg / 15) * 15;
            o.rotation = norm(deg);
        }
        tables = tables; features = features;
    }

    function endGesture(e: PointerEvent) {
        (e.currentTarget as Element)?.releasePointerCapture?.(e.pointerId);
        gesture = null;
    }

    // ---- object actions -------------------------------------------------
    function addTable(p: (typeof TABLE_PRESETS)[number]) {
        if (!room) return;
        commit();
        tables = [...tables, {
            id: null, name: `Table ${tables.length + 1}`, room_id: room.id,
            shape: p.shape, color: 'slate',
            pos_x: snapTo(room.width_ft / 2), pos_y: snapTo(room.depth_ft / 2),
            width_ft: p.w, depth_ft: p.d, rotation: 0, seats: p.seats, active: true, notes: null
        }];
        sel = { kind: 'table', idx: tables.length - 1 };
    }
    function addFixture(f: (typeof FIXTURES)[number]) {
        if (!room) return;
        commit();
        features = [...features, {
            id: null, room_id: room.id, kind: f.kind, label: f.label,
            shape: (f as any).shape ?? 'rect',
            pos_x: snapTo(room.width_ft / 2), pos_y: snapTo(room.depth_ft / 2),
            width_ft: f.w, depth_ft: f.d, rotation: 0
        }];
        sel = { kind: 'feature', idx: features.length - 1 };
    }
    function removeSelected() {
        if (!sel) return;
        commit();
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
    }
    function duplicateSelected() {
        if (!sel) return;
        commit();
        if (sel.kind === 'table') {
            const t = tables[sel.idx];
            tables = [...tables, { ...t, id: null, name: `${t.name} copy`,
                                   pos_x: t.pos_x + 2, pos_y: t.pos_y + 2 }];
            sel = { kind: 'table', idx: tables.length - 1 };
        } else {
            const f = features[sel.idx];
            features = [...features, { ...f, id: null, pos_x: f.pos_x + 2, pos_y: f.pos_y + 2 }];
            sel = { kind: 'feature', idx: features.length - 1 };
        }
    }
    function nudge(dx: number, dy: number) {
        if (!selected || !room) return;
        commit();
        const step = snap || 0.5;
        (selected as any).pos_x = Math.max(0, Math.min(room.width_ft, selected.pos_x + dx * step));
        (selected as any).pos_y = Math.max(0, Math.min(room.depth_ft, selected.pos_y + dy * step));
        tables = tables; features = features;
    }
    function turn(by: number) {
        if (!selected) return;
        commit();
        (selected as any).rotation = norm(selected.rotation + by);
        tables = tables; features = features;
    }
    function setColor(color: string) {
        if (!sel || sel.kind !== 'table') return;
        commit();
        tables[sel.idx].color = color;
        tables = tables;
    }
    function setShape(shape: string) {
        if (!selected) return;
        commit();
        (selected as any).shape = shape;
        tables = tables; features = features;
    }
    function align(where: string) {
        if (!selected || !room) return;
        commit();
        const o: any = selected;
        const hw = o.width_ft / 2, hd = o.depth_ft / 2;
        if (where === 'left') o.pos_x = hw;
        if (where === 'hcentre') o.pos_x = room.width_ft / 2;
        if (where === 'right') o.pos_x = room.width_ft - hw;
        if (where === 'top') o.pos_y = hd;
        if (where === 'vcentre') o.pos_y = room.depth_ft / 2;
        if (where === 'bottom') o.pos_y = room.depth_ft - hd;
        tables = tables; features = features;
    }
    function placeUnplaced(t: any) {
        if (!room) return;
        commit();
        t.room_id = room.id;
        t.pos_x = snapTo(room.width_ft / 2);
        t.pos_y = snapTo(room.depth_ft / 2);
        tables = tables;
        sel = { kind: 'table', idx: tables.indexOf(t) };
    }

    function onKey(e: KeyboardEvent) {
        const el = e.target as HTMLElement;
        if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
        const meta = e.metaKey || e.ctrlKey;
        if (meta && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            e.shiftKey ? redo() : undo();
            return;
        }
        if (mode === 'live' || !sel) return;
        const move: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
        };
        if (move[e.key]) { e.preventDefault(); nudge(...move[e.key]); }
        else if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); }
        else if (e.key === 'r' || e.key === 'R') turn(e.shiftKey ? -15 : 15);
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
        else if (e.key === 'Escape') sel = null;
    }

    // ---- rooms ----------------------------------------------------------
    async function saveRoom(r: any, patch: any) {
        error = null;
        const res = await fetch(`${PUBLIC_API_URL}/venue/admin/layout/rooms`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: r?.id ?? null, name: patch.name ?? r?.name ?? 'Room',
                width_ft: patch.width_ft ?? r?.width_ft ?? 30,
                depth_ft: patch.depth_ft ?? r?.depth_ft ?? 20
            })
        });
        if (res.ok) {
            const body = await res.json();
            rooms = body.rooms;
            if (!dirty) { tables = body.tables; features = body.features; }
            if (!rooms.find((x) => x.id === roomId)) roomId = rooms[0]?.id ?? null;
        } else error = (await res.json().catch(() => ({}))).detail || 'Could not save the room.';
    }
    async function deleteRoom() {
        if (!room || !confirm(`Delete ${room.name}? Its tables come off the plan but aren't deleted.`)) return;
        const res = await fetch(`${PUBLIC_API_URL}/venue/admin/layout/rooms/${room.id}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (res.ok) {
            const body = await res.json();
            apply(body);
            roomId = rooms[0]?.id ?? null;
            if (body.unplaced) message = `${body.unplaced} table(s) came off the plan.`;
        } else error = (await res.json().catch(() => ({}))).detail || 'Could not delete the room.';
    }

    // ---- live -----------------------------------------------------------
    async function loadOccupancy() {
        const at = liveAt ? `&at=${liveAt}` : '';
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/layout/occupancy?date=${liveDate}${at}`,
                              { credentials: 'include' });
        occupancy = r.ok ? await r.json() : null;
    }
    $effect(() => { if (mode === 'live') { liveDate; liveAt; loadOccupancy(); } });

    // Gated on mode, not just on having occupancy: it stays loaded after a
    // switch back to Edit, and tonight's times bleeding onto the editor made
    // tables look booked while someone was rearranging the room.
    const bookingsFor = (t: any) =>
        mode !== 'live' || !occupancy || t.id === null
            ? []
            : (occupancy.tables[String(t.id)] ?? []);
    function stateOf(t: any): string {
        if (mode !== 'live') return t.active ? 'idle' : 'off';
        if (!t.active) return 'off';
        const b = bookingsFor(t);
        if (b.some((x: any) => x.is_event)) return 'event';
        if (b.length) return 'busy';
        if (occupancy?.held_table_ids?.includes(t.id)) return 'held';
        return 'free';
    }
    const liveCount = $derived(
        mode === 'live' && occupancy
            ? { busy: roomTables.filter((t) => ['busy', 'event'].includes(stateOf(t))).length,
                held: roomTables.filter((t) => stateOf(t) === 'held').length,
                free: roomTables.filter((t) => stateOf(t) === 'free').length }
            : null
    );

    // ---- viewport -------------------------------------------------------
    const pad = 2;
    const view = $derived(room
        ? { x: -pad, y: -pad, w: room.width_ft + pad * 2, h: room.depth_ft + pad * 2 }
        : { x: 0, y: 0, w: 10, h: 10 });

    /** Feet per screen pixel — handles and dimension text are sized from this
     *  so they stay a constant size however far the plan is zoomed. */
    const ftPerPx = $derived(pxPerFt > 0 ? 1 / pxPerFt : 0.05);

    // Fit the room to the box in BOTH axes, then apply zoom. Deriving height
    // from width letterboxed a wide room and overflowed a tall one.
    let boxW = $state(800);
    let boxH = $state(500);
    const fit = $derived.by(() => {
        const k = Math.min(boxW / view.w, boxH / view.h) * zoom;
        return { w: Math.max(1, view.w * k), h: Math.max(1, view.h * k), k };
    });

    function measure() {
        if (!wrapEl || !room) return;
        boxW = Math.max(1, wrapEl.clientWidth - 20);
        boxH = Math.max(1, wrapEl.clientHeight - 20);
        pxPerFt = fit.k;
    }
    $effect(() => { zoom; roomId; rooms.length; boxW; boxH; measure(); });
    // The editor lives behind the `loading` branch, so on mount rootEl and
    // wrapEl are both still null — measuring there sized the plan to nothing
    // and left the full-bleed width at zero. Wait for the elements instead.
    $effect(() => {
        if (!rootEl || !wrapEl) return;
        const ro = new ResizeObserver(() => { measureBleed(); measure(); });
        ro.observe(wrapEl);
        if (rootEl.parentElement) ro.observe(rootEl.parentElement);
        measureBleed();
        measure();
        return () => ro.disconnect();
    });

    function gridLines(r: Room) {
        const out: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
        for (let x = 1; x < r.width_ft; x++)
            out.push({ x1: x, y1: 0, x2: x, y2: r.depth_ft, major: x % 5 === 0 });
        for (let y = 1; y < r.depth_ft; y++)
            out.push({ x1: 0, y1: y, x2: r.width_ft, y2: y, major: y % 5 === 0 });
        return out;
    }

    async function exportPng() {
        if (!svgEl || !room) return;
        // Clone so the export never carries the selection frame or the grid —
        // a plan pinned to the staff-room wall shouldn't have editor furniture
        // on it.
        const clone = svgEl.cloneNode(true) as SVGSVGElement;
        clone.querySelectorAll('.frame, .grid').forEach((n) => n.remove());
        const px = 100;
        clone.setAttribute('width', String(view.w * px / 4));
        clone.setAttribute('height', String(view.h * px / 4));
        const blob = new Blob(
            [`<?xml version="1.0"?>` + new XMLSerializer().serializeToString(clone)],
            { type: 'image/svg+xml' }
        );
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
        const canvas = document.createElement('canvas');
        canvas.width = view.w * px / 4;
        canvas.height = view.h * px / 4;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#0d0f13';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const a = document.createElement('a');
        a.download = `${room.name.replace(/\W+/g, '-').toLowerCase()}-plan.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
    }
</script>

<svelte:window on:keydown={onKey} />

{#if loading}
    <p class="a-note">Loading the plan…</p>
{:else}
<div class="editor" class:live={mode === 'live'} bind:this={rootEl}
     style="--bleed: {bleed}px">
    <!-- top bar -->
    <div class="bar top">
        <span class="bar-left">
            <span class="a-title">Floor plan</span>
            <HelpTip
                label="floor plan"
                text={"Your venue drawn to scale. Click something to pick it up: drag to move, corner handles to resize, the arm above it to turn.\n\nTurning snaps to 15°, and resizing to your snap setting — hold Shift to override either.\n\nSwitch to Tonight to see the same room with its bookings on it."}
            />
        </span>
        <span class="bar-mid">
            <button class="icon-btn" disabled={!past.length} onclick={undo} title="Undo (Ctrl+Z)">↶</button>
            <button class="icon-btn" disabled={!future.length} onclick={redo} title="Redo (Ctrl+Shift+Z)">↷</button>
        </span>
        <span class="bar-right">
            {#if dirty}<span class="unsaved">● Unsaved</span>{/if}
            <span class="mode-toggle">
                <button class="view-btn" class:active={mode === 'edit'} onclick={() => (mode = 'edit')}>Edit</button>
                <button class="view-btn" class:active={mode === 'live'} onclick={() => (mode = 'live')}>Tonight</button>
            </span>
            {#if mode === 'edit'}
                <button class="primary-button" disabled={saving || !dirty} onclick={save}>
                    {saving ? 'Saving…' : 'Save'}
                </button>
            {/if}
            <button class="secondary-button" onclick={exportPng}>Export PNG</button>
        </span>
    </div>

    <div class="body">
        <!-- left rail -->
        {#if mode === 'edit'}
            <div class="rail">
                <span class="rail-head">Tables</span>
                {#each TABLE_PRESETS as p}
                    <button class="rail-btn" onclick={() => addTable(p)}>
                        <span class="rail-ico {p.shape}"></span>{p.label}
                    </button>
                {/each}
                <span class="rail-head">Fixtures</span>
                {#each FIXTURES as f}
                    <button class="rail-btn subtle" onclick={() => addFixture(f)}>{f.label}</button>
                {/each}
                <span class="rail-head">Grid</span>
                <select class="rail-select" bind:value={snap} aria-label="Snap">
                    <option value={0}>No snap</option>
                    <option value={0.25}>Snap 3″</option>
                    <option value={0.5}>Snap 6″</option>
                    <option value={1}>Snap 1 ft</option>
                </select>
                <label class="check-row rail-check">
                    <input type="checkbox" bind:checked={showGrid} />
                    <span>Show grid</span>
                </label>
            </div>
        {/if}

        <!-- canvas -->
        <div class="stage">
            <div class="room-tabs">
                {#each rooms as r (r.id)}
                    <button class="room-tab" class:active={r.id === roomId}
                            onclick={() => { roomId = r.id; sel = null; }}>{r.name}</button>
                {/each}
                {#if mode === 'edit'}
                    <button class="room-tab add"
                            onclick={() => saveRoom(null, { name: `Room ${rooms.length + 1}` })}>+ Room</button>
                {/if}
            </div>

            {#if mode === 'live'}
                <div class="live-bar">
                    <input class="mini-input" type="date" bind:value={liveDate} aria-label="Date" />
                    <input class="mini-input" type="time" bind:value={liveAt} aria-label="At" />
                    {#if liveAt}<button class="chip" onclick={() => (liveAt = '')}>Whole day</button>{/if}
                    {#if liveCount}
                        <span class="live-key">
                            <span class="key busy"></span>{liveCount.busy} busy
                            <span class="key held"></span>{liveCount.held} held
                            <span class="key free"></span>{liveCount.free} free
                        </span>
                    {/if}
                    {#if occupancy?.club_nights?.length}
                        <span class="live-note">
                            {occupancy.club_nights.map((n: any) => n.system).join(' · ')}
                        </span>
                    {/if}
                </div>
            {/if}

            <div class="canvas-wrap" bind:this={wrapEl}>
                {#if room}
                    <svg bind:this={svgEl} class="canvas"
                         style="width: {fit.w}px; height: {fit.h}px"
                         viewBox="{view.x} {view.y} {view.w} {view.h}"
                         role="application" aria-label="{room.name} floor plan"
                         onpointerdown={() => (sel = null)}
                         onpointermove={onMove}
                         onpointerup={endGesture}
                         onpointercancel={endGesture}>
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
                            <PlanObject o={f} kind="feature" state={f.kind}
                                        selected={sel?.kind === 'feature' && sel.idx === i}
                                        editing={mode === 'edit'}
                                        onpick={(e) => beginMove(e, 'feature', i)} />
                        {/each}

                        {#each roomTables as t (t.id ?? `n${tables.indexOf(t)}`)}
                            {@const i = tables.indexOf(t)}
                            <PlanObject o={t} kind="table" state={stateOf(t)}
                                        selected={sel?.kind === 'table' && sel.idx === i}
                                        clash={mode === 'edit' && overlapping.has(i)}
                                        editing={mode === 'edit'}
                                        bookings={bookingsFor(t)}
                                        onpick={(e) => beginMove(e, 'table', i)} />
                        {/each}

                        {#if selected && mode === 'edit'}
                            <SelectionFrame box={selected as Box} scale={ftPerPx} onstart={beginHandle} />
                        {/if}
                    </svg>
                {/if}
            </div>

            <!-- status bar -->
            <div class="bar status">
                <span>{room?.name ?? '—'} · {room ? `${feet(room.width_ft)} × ${feet(room.depth_ft)}` : ''}</span>
                <span>
                    {roomTables.length} table{roomTables.length === 1 ? '' : 's'} ·
                    {seatsHere} seats
                    {#if overlapping.size}
                        <span class="warn"> · {overlapping.size} overlapping</span>
                    {/if}
                </span>
                <span class="zoomer">
                    <button class="icon-btn" onclick={() => (zoom = Math.max(0.4, zoom - 0.15))}>−</button>
                    <span class="zoom-read">{Math.round(zoom * 100)}%</span>
                    <button class="icon-btn" onclick={() => (zoom = Math.min(3, zoom + 0.15))}>+</button>
                    <button class="icon-btn wide" onclick={() => (zoom = 1)}>FIT</button>
                </span>
            </div>
        </div>

        <!-- right panel -->
        {#if mode === 'edit'}
            <div class="panel">
                {#if selected}
                    {@const isTable = sel?.kind === 'table'}
                    <span class="panel-head">{isTable ? 'Table' : 'Fixture'}</span>

                    <label class="p-field">
                        <span class="field-label">{isTable ? 'Name' : 'Label'}</span>
                        {#if isTable}
                            <input class="field-input" bind:value={tables[sel!.idx].name}
                                   oninput={() => (dirty = true)} />
                        {:else}
                            <input class="field-input" bind:value={features[sel!.idx].label}
                                   oninput={() => (dirty = true)} />
                        {/if}
                    </label>

                    <span class="field-label">Shape</span>
                    <div class="seg">
                        {#each [['rect', '▭'], ['round', '◯'], ['oval', '⬭']] as [k, glyph]}
                            <button class="seg-btn" class:active={selected.shape === k}
                                    onclick={() => setShape(k)} aria-label={k}>{glyph}</button>
                        {/each}
                    </div>

                    {#if isTable}
                        <span class="field-label">Colour</span>
                        <div class="swatches">
                            {#each COLORS as [name, fill, edge]}
                                <button class="swatch" class:active={tables[sel!.idx].color === name}
                                        style="--fill: {fill}; --edge: {edge}"
                                        title={name} aria-label={name}
                                        onclick={() => setColor(name)}></button>
                            {/each}
                        </div>
                    {/if}


                    <div class="p-grid">
                        <label class="p-field">
                            <span class="field-label">Width ft</span>
                            <input class="field-input" type="number" step="0.5" min="1" max="100"
                                   bind:value={selected.width_ft} oninput={() => (dirty = true)} />
                        </label>
                        <label class="p-field">
                            <span class="field-label">Depth ft</span>
                            <input class="field-input" type="number" step="0.5" min="1" max="100"
                                   bind:value={selected.depth_ft} oninput={() => (dirty = true)} />
                        </label>
                        <label class="p-field">
                            <span class="field-label">Turn °</span>
                            <input class="field-input" type="number" step="15" min="0" max="359"
                                   bind:value={selected.rotation} oninput={() => (dirty = true)} />
                        </label>
                        {#if isTable}
                            <label class="p-field">
                                <span class="field-label">Seats</span>
                                <input class="field-input" type="number" min="1" max="20"
                                       bind:value={tables[sel!.idx].seats} oninput={() => (dirty = true)} />
                            </label>
                        {/if}
                    </div>

                    {#if isTable}
                        <label class="check-row">
                            <input type="checkbox" bind:checked={tables[sel!.idx].active}
                                   onchange={() => (dirty = true)} />
                            <span>Bookable</span>
                        </label>
                    {/if}

                    <span class="panel-head">Align to room</span>
                    <div class="align-grid">
                        <button class="seg-btn" onclick={() => align('left')} title="Left">⇤</button>
                        <button class="seg-btn" onclick={() => align('hcentre')} title="Centre">⇔</button>
                        <button class="seg-btn" onclick={() => align('right')} title="Right">⇥</button>
                        <button class="seg-btn" onclick={() => align('top')} title="Top">⤒</button>
                        <button class="seg-btn" onclick={() => align('vcentre')} title="Middle">⇕</button>
                        <button class="seg-btn" onclick={() => align('bottom')} title="Bottom">⤓</button>
                    </div>

                    <div class="p-actions">
                        <button class="secondary-button" onclick={duplicateSelected}>Duplicate</button>
                        <button class="danger-button" onclick={removeSelected}>Delete</button>
                    </div>
                {:else}
                    <span class="panel-head">Room</span>
                    <label class="p-field">
                        <span class="field-label">Name</span>
                        <input class="field-input" value={room?.name ?? ''}
                               onchange={(e) => saveRoom(room, { name: (e.currentTarget as HTMLInputElement).value })} />
                    </label>
                    <div class="p-grid">
                        <label class="p-field">
                            <span class="field-label">Width ft</span>
                            <input class="field-input" type="number" step="1" min="4" max="400"
                                   value={room?.width_ft}
                                   onchange={(e) => saveRoom(room, { width_ft: Number((e.currentTarget as HTMLInputElement).value) })} />
                        </label>
                        <label class="p-field">
                            <span class="field-label">Depth ft</span>
                            <input class="field-input" type="number" step="1" min="4" max="400"
                                   value={room?.depth_ft}
                                   onchange={(e) => saveRoom(room, { depth_ft: Number((e.currentTarget as HTMLInputElement).value) })} />
                        </label>
                    </div>
                    {#if rooms.length > 1}
                        <button class="danger-button" onclick={deleteRoom}>Delete room</button>
                    {/if}
                    <p class="a-note panel-hint">
                        Click a table to edit it. Drag to move · handles to resize ·
                        the arm above to turn · <kbd>R</kbd> · arrows · <kbd>Del</kbd>
                    </p>
                {/if}

                {#if unplaced.length}
                    <span class="panel-head">Not on the plan</span>
                    <div class="tray">
                        {#each unplaced as t}
                            <button class="chip" onclick={() => placeUnplaced(t)}>{t.name} ↗</button>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    {#if error}<p class="field-error">{error}</p>{/if}
    {#if message}<p class="pairing-message">{message}</p>{/if}
</div>
{/if}

<style>
    .editor {
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        background: var(--color-surface-dark);
        overflow: hidden;
        /* Widened symmetrically past the app's column. --bleed is measured in
           JS from the visible viewport width, so this never overshoots into a
           horizontal scrollbar the way a 100vw full-bleed does. */
        width: calc(100% + var(--bleed, 0px));
        margin-left: calc(var(--bleed, 0px) / -2);
    }

    .bar {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.45rem 0.7rem;
        background: rgba(0, 0, 0, 0.3);
    }
    .bar.top { border-bottom: 1px solid var(--color-steel-border); }
    .bar-left { display: inline-flex; align-items: center; gap: 0.4rem; }
    .bar-mid { display: inline-flex; gap: 0.2rem; }
    .bar-right { display: inline-flex; align-items: center; gap: 0.5rem; margin-left: auto; }
    .unsaved { font-size: 0.72rem; color: var(--color-accent); }

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
    .icon-btn:hover:not(:disabled) { color: var(--color-text-bright); border-color: var(--color-accent); }
    .icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .icon-btn.wide { font-size: 0.66rem; font-weight: 700; }

    .mode-toggle { display: inline-flex; gap: 0.2rem; }
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

    /* Tall enough to actually work in: the room, not a letterbox of it.
       Capped so it still fits on a laptop without the save row falling off. */
    .body {
        display: flex;
        align-items: stretch;
        height: clamp(28rem, 76vh, 60rem);
    }

    .rail {
        flex: 0 0 8.2rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.6rem 0.5rem;
        /* The body is a fixed height now, and .editor clips — without this the
           bottom of a long rail or panel is simply unreachable. */
        overflow-y: auto;
        min-height: 0;
        border-right: 1px solid var(--color-steel-border);
        background: rgba(0, 0, 0, 0.18);
    }
    .rail-head {
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-text-faint);
        margin-top: 0.5rem;
    }
    .rail-head:first-child { margin-top: 0; }
    .rail-btn {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-bright);
        font-family: inherit;
        font-size: 0.72rem;
        font-weight: 600;
        padding: 0.25rem 0.45rem;
        cursor: pointer;
        text-align: left;
    }
    .rail-btn:hover { border-color: var(--color-accent); }
    .rail-btn.subtle { color: var(--color-text-muted); font-weight: 500; }
    .rail-ico {
        width: 12px; height: 9px;
        border: 1px solid currentColor;
        opacity: 0.8;
        flex: 0 0 auto;
    }
    .rail-ico.round { border-radius: 50%; width: 10px; height: 10px; }
    .rail-ico.oval { border-radius: 50%; }
    .rail-select {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-bright);
        font-family: inherit;
        font-size: 0.72rem;
        padding: 0.2rem 0.3rem;
    }
    .rail-check { font-size: 0.72rem; }

    .stage { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }

    .room-tabs {
        display: flex;
        gap: 0.3rem;
        flex-wrap: wrap;
        padding: 0.5rem 0.6rem 0;
    }
    .room-tab {
        background: transparent;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 0.74rem;
        font-weight: 600;
        padding: 0.22rem 0.6rem;
        cursor: pointer;
    }
    .room-tab.active {
        color: var(--color-text-bright);
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 12%, transparent);
    }
    .room-tab.add { color: var(--color-text-faint); }

    .live-bar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
        padding: 0.5rem 0.6rem 0;
    }
    .mini-input {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-bright);
        font-family: inherit;
        font-size: 0.72rem;
        padding: 0.18rem 0.35rem;
    }
    .live-key { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.72rem; color: var(--color-text-muted); }
    .key { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
    .key.busy { background: #b4562e; }
    .key.held { background: #8a6d3b; }
    .key.free { background: #3f5d43; }
    .live-note { font-size: 0.72rem; color: var(--color-accent); }

    .canvas-wrap {
        flex: 1 1 auto;
        min-height: 0;
        padding: 0.6rem;
        background: #0d0f13;
        overflow: auto;
        display: flex;
    }
    .canvas {
        display: block;
        margin: auto;
        flex: 0 0 auto;
        touch-action: none;
        /* Without this, dragging across the plan makes the browser text-select
           the table labels, and the selection highlight paints a solid pale
           rectangle over the room. */
        user-select: none;
        -webkit-user-select: none;
    }

    /* Svelte scopes styles per component, so a rule written inside PlanObject
       or SelectionFrame can't be relied on to cover every focusable node in
       the tree. :global from the canvas down is the one place that reaches all
       of them — SVG groups take focus on pointerdown and Chrome rings their
       whole bounding box, which on a rotated table is a large rectangle
       nowhere near the table itself. */
    .canvas :global(*:focus),
    .canvas :global(*:focus-visible) { outline: none; }

    .floor { fill: #14171d; }
    .walls { fill: none; stroke: #5a5f6b; stroke-width: 0.22; }
    .grid { stroke: #ffffff10; stroke-width: 0.04; }
    .grid.major { stroke: #ffffff22; stroke-width: 0.06; }

    .bar.status {
        border-top: 1px solid var(--color-steel-border);
        font-size: 0.72rem;
        color: var(--color-text-muted);
    }
    .bar.status .warn { color: var(--color-loss); font-weight: 700; }
    .zoomer { display: inline-flex; align-items: center; gap: 0.25rem; margin-left: auto; }
    .zoom-read { width: 3rem; text-align: center; }

    .panel {
        flex: 0 0 14rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.6rem 0.6rem 0.8rem;
        overflow-y: auto;
        min-height: 0;
        border-left: 1px solid var(--color-steel-border);
        background: rgba(0, 0, 0, 0.18);
    }
    .panel-head {
        font-size: 0.62rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-accent);
        margin-top: 0.4rem;
    }
    .panel-head:first-child { margin-top: 0; }
    .p-field { display: flex; flex-direction: column; gap: 0.12rem; }
    .p-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.35rem; }
    .p-actions { display: flex; gap: 0.35rem; margin-top: 0.3rem; }
    .panel-hint { margin: 0.4rem 0 0; font-size: 0.7rem; }

    .seg { display: flex; gap: 0.2rem; }

    .swatches { display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.2rem; }
    .swatch {
        aspect-ratio: 1;
        min-height: 1.1rem;
        border-radius: 3px;
        background: var(--fill);
        border: 1px solid var(--edge);
        cursor: pointer;
        padding: 0;
    }
    .swatch.active {
        outline: 2px solid var(--color-accent);
        outline-offset: 1px;
    }
    .align-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.2rem; }
    .seg-btn {
        flex: 1 1 auto;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 0.8rem;
        padding: 0.18rem 0.3rem;
        cursor: pointer;
    }
    .seg-btn:hover { color: var(--color-text-bright); border-color: var(--color-accent); }
    .seg-btn.active {
        color: var(--color-text-bright);
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    }

    .chip {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-bright);
        font-family: inherit;
        font-size: 0.7rem;
        padding: 0.18rem 0.45rem;
        cursor: pointer;
    }
    .tray { display: flex; flex-wrap: wrap; gap: 0.25rem; }

    kbd {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid var(--color-steel-border);
        border-radius: 3px;
        padding: 0 0.22rem;
        font-size: 0.7rem;
    }

    @media (max-width: 900px) {
        .body { flex-direction: column; }
        .rail, .panel { flex: 1 1 auto; border: none; border-top: 1px solid var(--color-steel-border); }
        .rail { flex-direction: row; flex-wrap: wrap; align-items: center; }
    }
</style>
