<script lang="ts">
    import { onMount, tick } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from './HelpTip.svelte';
    import PlanObject from './plan/PlanObject.svelte';
    import SelectionFrame from './plan/SelectionFrame.svelte';
    import { angleTo, confine, extents, feet, insideInterior, interiorOf, norm, overlaps,
             resize, WALL_FT, type Box, type Handle } from './plan/geometry';

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
    /**
     * Selection is a SET of stable keys, not an index.
     *
     * Indexes shift the moment anything is added, removed or duplicated, and a
     * multi-selection held as indexes silently starts pointing at the wrong
     * tables. Every object gets a client-side `_uid` on load, and selection is
     * keyed on that.
     */
    let uidSeq = 0;
    const withUids = (list: any[]) => list.map((o) => ({ ...o, _uid: ++uidSeq }));
    const keyOf = (kind: 'table' | 'feature', o: any) => `${kind}:${o._uid}`;

    let selection = $state<Set<string>>(new Set());
    const isSel = (kind: 'table' | 'feature', o: any) => selection.has(keyOf(kind, o));

    /** Every selected object, paired with which list it lives in. */
    const picked = $derived([
        ...tables.filter((t) => isSel('table', t)).map((o) => ({ kind: 'table' as const, o })),
        ...features.filter((f) => isSel('feature', f)).map((o) => ({ kind: 'feature' as const, o }))
    ]);
    const sole = $derived(picked.length === 1 ? picked[0] : null);

    /** Bounding box of everything selected, for the group outline. */
    const groupBox = $derived.by(() => {
        if (picked.length < 2) return null;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const s of picked) {
            const e = extents(s.o as Box);
            x0 = Math.min(x0, s.o.pos_x - e.hx);
            y0 = Math.min(y0, s.o.pos_y - e.hy);
            x1 = Math.max(x1, s.o.pos_x + e.hx);
            y1 = Math.max(y1, s.o.pos_y + e.hy);
        }
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    });
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
        selection = new Set();
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
        // Enclosure first: a venue describes itself in rooms, and drawing one
        // box beats lining up four wall segments by hand.
        { kind: 'enclosure', label: 'Room', w: 14, d: 10, color: 'grey' },
        // A wall's depth is ONE WALL THICKNESS by default, so it meets a room's
        // wall flush instead of sitting proud of it.
        { kind: 'wall', label: 'Wall', w: 8, d: WALL_FT, color: 'grey' },
        { kind: 'door', label: 'Door', w: 3, d: WALL_FT, color: 'grey' },
        { kind: 'bar', label: 'Bar', w: 10, d: 2, color: 'amber' },
        { kind: 'pillar', label: 'Pillar', w: 1.5, d: 1.5, shape: 'round', color: 'grey' },
        { kind: 'shelves', label: 'Terrain', w: 6, d: 1.5, color: 'amber' },
        { kind: 'stairs', label: 'Stairs', w: 4, d: 3, color: 'grey' },
        { kind: 'toilets', label: 'Toilets', w: 6, d: 5, color: 'teal' },
        // Last: it's annotation rather than a thing on the floor, so it sits
        // below the fixtures you'd actually place.
        { kind: 'note', label: 'Text', w: 8, d: 2, color: 'slate' }
    ];

    // Walls, rooms and doors are structure — the palette doesn't apply, because
    // a plan whose walls are teal stops reading as a building.
    const STRUCTURAL = ['enclosure', 'wall', 'door'];
    const colourable = $derived(
        picked.filter((s) => s.kind === 'table' || !STRUCTURAL.includes(s.o.kind))
    );

    const room = $derived(rooms.find((r) => r.id === roomId) ?? null);
    const roomTables = $derived(tables.filter((t) => t.room_id === roomId));
    const roomFeatures = $derived(features.filter((f) => f.room_id === roomId));
    // Annotations are labels ABOUT the room, so they draw last. Underneath the
    // tables, a note dropped in the middle of the floor simply vanished.
    const roomStructure = $derived(roomFeatures.filter((f) => f.kind !== 'note'));
    const roomNotes = $derived(roomFeatures.filter((f) => f.kind === 'note'));
    const unplaced = $derived(tables.filter((t) => t.room_id === null));
    const seatsHere = $derived(roomTables.filter((t) => t.active).reduce((n, t) => n + t.seats, 0));
    const selected = $derived(sole ? sole.o : null);

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
        rooms = body.rooms;
        tables = withUids(body.tables);
        features = withUids(body.features);
        deletedTables = []; deletedFeatures = [];
        past = []; future = []; dirty = false; selection = new Set();
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
        | { type: 'move'; dx: number; dy: number;
            from: { o: any; x: number; y: number }[]; anchor: { x: number; y: number } }
        | { type: 'resize'; handle: Handle }
        | { type: 'rotate'; grab: number; from: number }
        | { type: 'band'; x0: number; y0: number; add: boolean };
    let gesture: Gesture | null = null;
    let gestureStarted = false;
    /**
     * The enclosure an object is standing in, if any.
     *
     * Chosen by the SMALLEST interior that contains the centre, so a room
     * inside a room confines to the inner one rather than to whichever
     * happened to be added first.
     */
    function roomAround(o: any) {
        let best: any = null;
        for (const f of roomFeatures) {
            if (f.kind !== 'enclosure' || f === o) continue;
            if (!insideInterior(f as Box, o.pos_x, o.pos_y)) continue;
            if (!best || f.width_ft * f.depth_ft < best.width_ft * best.depth_ft) best = f;
        }
        return best;
    }

    /**
     * Push an object back inside whatever bounds it.
     *
     * Furniture is held to the floor of the room it stands in, or to the plan's
     * inner wall face. STRUCTURE IS NOT: a door belongs IN a wall and a wall
     * segment belongs against one, so confining them to the interior — which
     * is what this did — made it impossible to put a door in a room's wall or
     * on the edge of the plan at all. They're only kept from leaving the plan.
     */
    function keepInside(o: any) {
        if (!room || o.kind === 'enclosure') return;
        const structural = o.kind === 'wall' || o.kind === 'door';
        const host = structural ? null : roomAround(o);
        const area = host
            ? interiorOf(host as Box)
            : structural
              ? { x0: 0, y0: 0, x1: room.width_ft, y1: room.depth_ft }
              : { x0: WALL_FT, y0: WALL_FT,
                  x1: room.width_ft - WALL_FT, y1: room.depth_ft - WALL_FT };
        const c = confine(o as Box, area);
        o.pos_x = c.x;
        o.pos_y = c.y;
    }

    /** The rubber band, in feet, while a marquee drag is in progress. */
    let band = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

    function beginBand(e: PointerEvent) {
        if (mode === 'live') return;
        const p = atPointer(e);
        if (!p) return;
        // Shift keeps what's already picked, so a marquee can add to a
        // selection rather than always replacing it.
        if (!e.shiftKey) selection = new Set();
        gesture = { type: 'band', x0: p.x, y0: p.y, add: e.shiftKey };
        gestureStarted = true;
        band = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }

    function finishBand() {
        if (!band) return;
        const lo = { x: Math.min(band.x0, band.x1), y: Math.min(band.y0, band.y1) };
        const hi = { x: Math.max(band.x0, band.x1), y: Math.max(band.y0, band.y1) };
        const next = new Set(selection);
        // TOUCHES, not contains. Requiring a table to be fully enclosed means
        // dragging across a row of them catches nothing, which reads as broken.
        const hit = (kind: 'table' | 'feature', o: any) => {
            const e = extents(o as Box);
            if (Math.abs(o.pos_x - (lo.x + hi.x) / 2) > e.hx + (hi.x - lo.x) / 2) return;
            if (Math.abs(o.pos_y - (lo.y + hi.y) / 2) > e.hy + (hi.y - lo.y) / 2) return;

            // A room is a hollow box, so its solid bounding box is the wrong
            // test: a marquee drawn round the tables INSIDE a room sits fully
            // within that box and was dragging the room along with them. It's
            // only caught if the band actually reaches its walls.
            if (kind === 'feature' && o.kind === 'enclosure') {
                const inset = 0.6;
                const inside =
                    lo.x > o.pos_x - e.hx + inset && hi.x < o.pos_x + e.hx - inset &&
                    lo.y > o.pos_y - e.hy + inset && hi.y < o.pos_y + e.hy - inset;
                if (inside) return;
            }
            next.add(keyOf(kind, o));
        };
        for (const t of roomTables) hit('table', t);
        for (const f of roomFeatures) hit('feature', f);
        selection = next;
        band = null;
    }

    function beginMove(e: PointerEvent, kind: 'table' | 'feature', o: any) {
        if (mode === 'live') return;
        e.stopPropagation();
        const p = atPointer(e);
        if (!p) return;
        const key = keyOf(kind, o);

        if (e.shiftKey) {
            const next = new Set(selection);
            next.has(key) ? next.delete(key) : next.add(key);
            selection = next;
            if (!next.has(key)) return;        // just deselected — nothing to drag
        } else if (!selection.has(key)) {
            // Clicking an unselected object selects only it. Clicking one that
            // is already selected keeps the group, so dragging any member moves
            // the whole thing — which is what every editor does and what makes
            // a multi-selection worth having.
            selection = new Set([key]);
        }

        gesture = {
            type: 'move',
            dx: p.x - o.pos_x, dy: p.y - o.pos_y,
            from: picked.map((s) => ({ o: s.o, x: s.o.pos_x, y: s.o.pos_y })),
            anchor: { x: o.pos_x, y: o.pos_y }
        };
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
        if (!gesture || !room) return;
        if (gesture.type !== 'band' && gesture.type !== 'move' && !selected) return;
        const p = atPointer(e);
        if (!p) return;
        // The snapshot goes in on the FIRST movement, not on pointerdown, so a
        // click that selects without moving doesn't fill the undo stack.
        if (!gestureStarted) { commit(); gestureStarted = true; }

        const o: any = selected;
        if (gesture.type === 'move') {
            // Snap the DELTA, not each object: snapping every member
            // independently would quietly close up the gaps between them.
            let dx = snapTo(p.x - gesture.dx) - gesture.anchor.x;
            let dy = snapTo(p.y - gesture.dy) - gesture.anchor.y;
            // Clamp so the group's bounding box stays in the room, rather than
            // clamping each object and shearing the arrangement.
            const xs = gesture.from.map((f) => f.x);
            const ys = gesture.from.map((f) => f.y);
            dx = Math.max(-Math.min(...xs), Math.min(room.width_ft - Math.max(...xs), dx));
            dy = Math.max(-Math.min(...ys), Math.min(room.depth_ft - Math.max(...ys), dy));
            for (const f of gesture.from) {
                f.o.pos_x = f.x + dx;
                f.o.pos_y = f.y + dy;
                keepInside(f.o);
            }
        } else if (gesture.type === 'band') {
            band = { x0: gesture.x0, y0: gesture.y0, x1: p.x, y1: p.y };
        } else if (gesture.type === 'resize') {
            const next = resize(o as Box, gesture.handle, p.x, p.y,
                                { min: 1, snap, keepAspect: e.shiftKey });
            o.pos_x = next.pos_x; o.pos_y = next.pos_y;
            o.width_ft = Math.round(next.width_ft * 100) / 100;
            o.depth_ft = Math.round(next.depth_ft * 100) / 100;
            keepInside(o);
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
        if (gesture?.type === 'band') finishBand();
        gesture = null;
    }

    // ---- object actions -------------------------------------------------
    function addTable(p: (typeof TABLE_PRESETS)[number]) {
        if (!room) return;
        commit();
        tables = [...tables, {
            id: null, name: `Table ${tables.length + 1}`, room_id: room.id,
            shape: p.shape, color: 'slate', _uid: ++uidSeq,
            pos_x: snapTo(room.width_ft / 2), pos_y: snapTo(room.depth_ft / 2),
            width_ft: p.w, depth_ft: p.d, rotation: 0, seats: p.seats, active: true, notes: null
        }];
        selection = new Set([keyOf('table', tables[tables.length - 1])]);
    }
    function addFixture(f: (typeof FIXTURES)[number]) {
        if (!room) return;
        commit();
        features = [...features, {
            id: null, room_id: room.id, kind: f.kind, label: f.label,
            shape: (f as any).shape ?? 'rect', _uid: ++uidSeq,
            pos_x: snapTo(room.width_ft / 2), pos_y: snapTo(room.depth_ft / 2),
            width_ft: f.w, depth_ft: f.d, rotation: 0, color: (f as any).color ?? 'grey'
        }];
        if (f.kind === 'enclosure' || f.kind === 'door') {
            features[features.length - 1].label = null;
        }
        selection = new Set([keyOf('feature', features[features.length - 1])]);
    }
    function removeSelected() {
        if (!picked.length) return;
        commit();
        const goneT = new Set(picked.filter((s) => s.kind === 'table').map((s) => s.o._uid));
        const goneF = new Set(picked.filter((s) => s.kind === 'feature').map((s) => s.o._uid));
        for (const t of tables) if (goneT.has(t._uid) && t.id !== null) deletedTables = [...deletedTables, t.id];
        for (const f of features) if (goneF.has(f._uid) && f.id !== null) deletedFeatures = [...deletedFeatures, f.id];
        tables = tables.filter((t) => !goneT.has(t._uid));
        features = features.filter((f) => !goneF.has(f._uid));
        selection = new Set();
    }
    function duplicateSelected() {
        if (!picked.length) return;
        commit();
        const next = new Set<string>();
        const newT = [], newF = [];
        for (const s of picked) {
            const copy = { ...s.o, id: null, _uid: ++uidSeq,
                           pos_x: s.o.pos_x + 2, pos_y: s.o.pos_y + 2 };
            if (s.kind === 'table') { copy.name = `${s.o.name} copy`; newT.push(copy); }
            else newF.push(copy);
            next.add(keyOf(s.kind, copy));
        }
        tables = [...tables, ...newT];
        features = [...features, ...newF];
        // The COPIES become the selection, so a duplicate can be dragged
        // straight into place without re-picking it.
        selection = next;
    }
    function nudge(dx: number, dy: number) {
        if (!picked.length || !room) return;
        commit();
        const step = snap || 0.5;
        for (const s of picked) {
            s.o.pos_x += dx * step;
            s.o.pos_y += dy * step;
            keepInside(s.o);
        }
        tables = tables; features = features;
    }
    function turn(by: number) {
        if (!picked.length) return;
        commit();
        // Each about its OWN centre. Spinning a group around a shared centre is
        // occasionally what you want and usually not — a row of tables turned
        // that way ends up somewhere else entirely.
        for (const s of picked) s.o.rotation = norm(s.o.rotation + by);
        tables = tables; features = features;
    }
    function selectAll() {
        const next = new Set<string>();
        for (const t of roomTables) next.add(keyOf('table', t));
        for (const f of roomFeatures) next.add(keyOf('feature', f));
        selection = next;
    }
    function setColor(color: string) {
        if (!colourable.length) return;
        commit();
        for (const s of colourable) s.o.color = color;
        tables = tables; features = features;
    }
    function setShape(shape: string) {
        if (!picked.length) return;
        commit();
        for (const s of picked) s.o.shape = shape;
        tables = tables; features = features;
    }
    function align(where: string) {
        if (!picked.length || !room) return;
        commit();
        for (const s of picked) {
            const o: any = s.o;
            const e = extents(o as Box);
            // Aligned against the INNER face of the wall, matching where
            // dragging stops. Using the outer bounds put things half inside
            // the wall they were supposedly aligned to.
            // Structure aligns to the wall itself; furniture to its inner face.
            const inset = (o.kind === 'wall' || o.kind === 'door') ? 0 : WALL_FT;
            if (where === 'left') o.pos_x = inset + e.hx;
            if (where === 'hcentre') o.pos_x = room.width_ft / 2;
            if (where === 'right') o.pos_x = room.width_ft - inset - e.hx;
            if (where === 'top') o.pos_y = inset + e.hy;
            if (where === 'vcentre') o.pos_y = room.depth_ft / 2;
            if (where === 'bottom') o.pos_y = room.depth_ft - inset - e.hy;
            // ...and if it's standing in a room, that room's wall wins.
            keepInside(o);
        }
        tables = tables; features = features;
    }

    /** Spread the selection evenly between its outermost members. */
    function distribute(axis: 'x' | 'y') {
        if (picked.length < 3 || !room) return;
        commit();
        const key = axis === 'x' ? 'pos_x' : 'pos_y';
        const sorted = [...picked].sort((a, b) => a.o[key] - b.o[key]);
        const first = sorted[0].o[key];
        const last = sorted[sorted.length - 1].o[key];
        const step = (last - first) / (sorted.length - 1);
        sorted.forEach((s, i) => { s.o[key] = first + step * i; });
        tables = tables; features = features;
    }
    function placeUnplaced(t: any) {
        if (!room) return;
        commit();
        t.room_id = room.id;
        t.pos_x = snapTo(room.width_ft / 2);
        t.pos_y = snapTo(room.depth_ft / 2);
        tables = tables;
        selection = new Set([keyOf('table', t)]);
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
        if (mode === 'live') return;
        if (meta && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAll(); return; }
        if (!picked.length) return;
        const move: Record<string, [number, number]> = {
            ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]
        };
        if (move[e.key]) { e.preventDefault(); nudge(...move[e.key]); }
        else if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); }
        else if (e.key === 'r' || e.key === 'R') turn(e.shiftKey ? -15 : 15);
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
        else if (e.key === 'Escape') selection = new Set();
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

    /**
     * Wheel to zoom, keeping whatever is under the cursor under the cursor.
     *
     * Zooming about the centre is the lazy version and it's maddening in
     * practice: you point at the far corner, zoom, and the corner leaves the
     * screen. So the scroll offset is corrected afterwards to pin the point.
     */
    async function onWheel(e: WheelEvent) {
        if (mode !== 'edit' || !wrapEl) return;
        // Plain wheel scrolls, as it does everywhere else; ctrl/cmd zooms. A
        // canvas that zooms on a bare wheel fights every trackpad on the way
        // past it.
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const rect = wrapEl.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        // Where the cursor is, as a fraction of the whole plan.
        const fx = (wrapEl.scrollLeft + cx) / Math.max(1, fit.w);
        const fy = (wrapEl.scrollTop + cy) / Math.max(1, fit.h);

        const step = e.deltaY > 0 ? 0.9 : 1.1;
        const next = Math.min(6, Math.max(0.3, zoom * step));
        if (next === zoom) return;
        zoom = next;

        await tick();
        wrapEl.scrollLeft = fx * fit.w - cx;
        wrapEl.scrollTop = fy * fit.h - cy;
    }

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
                            onclick={() => { roomId = r.id; selection = new Set(); }}>{r.name}</button>
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

            <div class="canvas-wrap" bind:this={wrapEl} onwheel={onWheel}>
                {#if room}
                    <svg bind:this={svgEl} class="canvas"
                         style="width: {fit.w}px; height: {fit.h}px"
                         viewBox="{view.x} {view.y} {view.w} {view.h}"
                         role="application" aria-label="{room.name} floor plan"
                         onpointerdown={beginBand}
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
                        <!-- Inset by half a wall so the OUTER face lands exactly on the
                             room bounds, matching how an enclosure is drawn. Same
                             thickness, same colour: they're the same material. -->
                        <rect class="walls"
                              x={WALL_FT / 2} y={WALL_FT / 2}
                              width={Math.max(0.1, room.width_ft - WALL_FT)}
                              height={Math.max(0.1, room.depth_ft - WALL_FT)}
                              stroke-width={WALL_FT} />

                        {#each roomStructure as f (f.id ?? `n${features.indexOf(f)}`)}
                            {@const i = features.indexOf(f)}
                            <PlanObject o={f} kind="feature" state={f.kind}
                                        selected={isSel('feature', f)}
                                        editing={mode === 'edit'}
                                        onpick={(e) => beginMove(e, 'feature', f)} />
                        {/each}

                        {#each roomTables as t (t.id ?? `n${tables.indexOf(t)}`)}
                            {@const i = tables.indexOf(t)}
                            <PlanObject o={t} kind="table" state={stateOf(t)}
                                        selected={isSel('table', t)}
                                        clash={mode === 'edit' && overlapping.has(i)}
                                        editing={mode === 'edit'}
                                        bookings={bookingsFor(t)}
                                        onpick={(e) => beginMove(e, 'table', t)} />
                        {/each}

                        {#each roomNotes as f (f.id ?? `n${features.indexOf(f)}`)}
                            {@const i = features.indexOf(f)}
                            <PlanObject o={f} kind="feature" state={f.kind}
                                        selected={isSel('feature', f)}
                                        editing={mode === 'edit'}
                                        onpick={(e) => beginMove(e, 'feature', f)} />
                        {/each}

                        {#if sole && mode === 'edit'}
                            <SelectionFrame box={sole.o as Box} scale={ftPerPx} onstart={beginHandle} />
                        {:else if picked.length > 1 && mode === 'edit' && groupBox}
                            <!-- A group gets a bounding box but no resize handles.
                                 Scaling a whole arrangement is a different job
                                 from resizing one table, and a handle that
                                 looked the same but did something else would be
                                 worse than not offering it. -->
                            <rect class="group-box"
                                  x={groupBox.x} y={groupBox.y}
                                  width={groupBox.w} height={groupBox.h}
                                  stroke-width={Math.max(0.03, 1.2 * ftPerPx)} />
                        {/if}

                        {#if band}
                            <rect class="band"
                                  x={Math.min(band.x0, band.x1)} y={Math.min(band.y0, band.y1)}
                                  width={Math.abs(band.x1 - band.x0)}
                                  height={Math.abs(band.y1 - band.y0)}
                                  stroke-width={Math.max(0.03, 1.2 * ftPerPx)} />
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
                    <button class="icon-btn" onclick={() => (zoom = Math.max(0.3, zoom - 0.15))}>−</button>
                    <span class="zoom-read">{Math.round(zoom * 100)}%</span>
                    <button class="icon-btn" onclick={() => (zoom = Math.min(6, zoom + 0.15))}>+</button>
                    <button class="icon-btn wide" onclick={() => (zoom = 1)}>FIT</button>
                </span>
            </div>
        </div>

        <!-- right panel -->
        {#if mode === 'edit'}
            <div class="panel">
                {#if picked.length > 1}
                    <span class="panel-head">{picked.length} selected</span>
                    <p class="a-note panel-hint">
                        Drag any of them to move the group. Everything below applies to all
                        {picked.length}.
                    </p>

                    <span class="field-label">Colour</span>
                    <div class="swatches">
                        {#each COLORS as [name, fill, edge]}
                            <button class="swatch" style="--fill: {fill}; --edge: {edge}"
                                    title={name} aria-label={name}
                                    onclick={() => setColor(name)}></button>
                        {/each}
                    </div>

                    <span class="field-label">Turn</span>
                    <div class="seg">
                        <button class="seg-btn" onclick={() => turn(-90)}>⟲ 90°</button>
                        <button class="seg-btn" onclick={() => turn(-15)}>−15°</button>
                        <button class="seg-btn" onclick={() => turn(15)}>+15°</button>
                        <button class="seg-btn" onclick={() => turn(90)}>⟳ 90°</button>
                    </div>

                    <span class="panel-head">Align to room</span>
                    <div class="align-grid">
                        <button class="seg-btn" onclick={() => align('left')} title="Left">⇤</button>
                        <button class="seg-btn" onclick={() => align('hcentre')} title="Centre">⇔</button>
                        <button class="seg-btn" onclick={() => align('right')} title="Right">⇥</button>
                        <button class="seg-btn" onclick={() => align('top')} title="Top">⤒</button>
                        <button class="seg-btn" onclick={() => align('vcentre')} title="Middle">⇕</button>
                        <button class="seg-btn" onclick={() => align('bottom')} title="Bottom">⤓</button>
                    </div>

                    {#if picked.length > 2}
                        <span class="panel-head">Space evenly</span>
                        <div class="seg">
                            <button class="seg-btn" onclick={() => distribute('x')}>Across</button>
                            <button class="seg-btn" onclick={() => distribute('y')}>Down</button>
                        </div>
                    {/if}

                    <div class="p-actions">
                        <button class="secondary-button" onclick={duplicateSelected}>Duplicate</button>
                        <button class="danger-button" onclick={removeSelected}>Delete</button>
                    </div>
                {:else if sole}
                    {@const isTable = sole?.kind === 'table'}
                    <span class="panel-head">{isTable ? 'Table' : 'Fixture'}</span>

                    <label class="p-field">
                        <span class="field-label">{isTable ? 'Name' : 'Label'}</span>
                        {#if isTable}
                            <input class="field-input" bind:value={sole!.o.name}
                                   oninput={() => (dirty = true)} />
                        {:else}
                            <input class="field-input" bind:value={sole!.o.label}
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

                    {#if colourable.length}
                        <span class="field-label">Colour</span>
                        <div class="swatches">
                            {#each COLORS as [name, fill, edge]}
                                <button class="swatch" class:active={sole?.o.color === name}
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
                                       bind:value={sole!.o.seats} oninput={() => (dirty = true)} />
                            </label>
                        {/if}
                    </div>

                    {#if isTable}
                        <label class="check-row">
                            <input type="checkbox" bind:checked={sole!.o.active}
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

    .group-box {
        fill: none;
        stroke: var(--color-accent);
        stroke-dasharray: 0.4 0.3;
        pointer-events: none;
    }
    .band {
        fill: color-mix(in srgb, var(--color-accent) 12%, transparent);
        stroke: var(--color-accent);
        pointer-events: none;
    }

    .floor { fill: #14171d; }
    .walls { fill: none; stroke: #6d7280; }
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
