<script lang="ts">
    import { PUBLIC_API_URL } from '$env/static/public';
    import { onMount } from 'svelte';
    import PlanObject from './PlanObject.svelte';
    import { WALL_FT } from './geometry';

    /**
     * The room, drawn to scale, as a way to choose a table.
     *
     * A list of table cards tells you a 6x4 is free. It doesn't tell you it's
     * the one by the window, or that it's the far corner next to the toilets —
     * which is the whole reason someone asks for a particular table. The plan
     * answers that and the list can't.
     *
     * The list stays underneath, sharing the same selection. It isn't a
     * fallback for a venue that hasn't drawn a plan (though it is that too):
     * it's the keyboard-and-screen-reader path, and a picture with no text
     * equivalent would make the booking form unusable for anyone not using a
     * mouse.
     */
    let { free = [], unavailable = [], recommended = [], selected = null, onpick }: {
        /** Table ids bookable in the chosen slot. */
        free?: number[];
        /** Everything else, with why: booked | club_night | too_small | unavailable. */
        unavailable?: { id: number; reason: string }[];
        recommended?: number[];
        selected?: number | null;
        onpick?: (id: number | null) => void;
    } = $props();

    let rooms = $state<any[]>([]);
    let tables = $state<any[]>([]);
    let features = $state<any[]>([]);
    let roomId = $state<number | null>(null);
    let loading = $state(true);
    let failed = $state(false);

    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/venue/plan`, { credentials: 'include' });
            if (!r.ok) throw new Error('no plan');
            const body = await r.json();
            rooms = body.rooms ?? [];
            tables = body.tables ?? [];
            features = body.features ?? [];
            roomId = rooms[0]?.id ?? null;
        } catch (_) {
            failed = true;
        }
        loading = false;
    });

    const room = $derived(rooms.find((r) => r.id === roomId) ?? null);
    const roomTables = $derived(tables.filter((t) => t.room_id === roomId));
    const roomStructure = $derived(
        features.filter((f) => f.room_id === roomId && f.kind !== 'note')
    );
    const roomNotes = $derived(features.filter((f) => f.room_id === roomId && f.kind === 'note'));

    const freeSet = $derived(new Set(free));
    const recSet = $derived(new Set(recommended));
    const reasonOf = $derived.by(() => {
        const m = new Map<number, string>();
        for (const u of unavailable) m.set(u.id, u.reason);
        return m;
    });

    /** Four states, and each one is a different answer to "can I have that?" */
    function stateOf(t: any): string {
        if (freeSet.has(t.id)) return recSet.has(t.id) ? 'suits' : 'idle';
        return reasonOf.get(t.id) === 'club_night' ? 'held' : 'off';
    }

    const WHY: Record<string, string> = {
        booked: 'Already booked',
        club_night: 'Held for a club night',
        too_small: 'Too small for your party',
        unavailable: 'Not available'
    };

    function labelFor(t: any): string {
        if (freeSet.has(t.id)) {
            return `${t.name}, ${t.size_label ?? `seats ${t.seats}`}` +
                   (recSet.has(t.id) ? ', recommended for your game' : '') +
                   (selected === t.id ? ', selected' : '');
        }
        return `${t.name} — ${WHY[reasonOf.get(t.id) ?? 'unavailable']}`;
    }

    function pick(t: any) {
        if (!freeSet.has(t.id)) return;
        onpick?.(selected === t.id ? null : t.id);
    }

    const pad = 1.5;
    const view = $derived(room
        ? { x: -pad, y: -pad, w: room.width_ft + pad * 2, h: room.depth_ft + pad * 2 }
        : { x: 0, y: 0, w: 10, h: 10 });

    const chosen = $derived(roomTables.find((t) => t.id === selected) ?? null);
    const freeHere = $derived(roomTables.filter((t) => freeSet.has(t.id)).length);
</script>

{#if !loading && !failed && room}
    <div class="picker">
        {#if rooms.length > 1}
            <div class="rooms">
                {#each rooms as r (r.id)}
                    <button class="room-tab" class:active={r.id === roomId} type="button"
                            onclick={() => (roomId = r.id)}>{r.name}</button>
                {/each}
            </div>
        {/if}

        <svg class="canvas" viewBox="{view.x} {view.y} {view.w} {view.h}"
             role="group" aria-label="{room.name} — tap a free table to choose it">
            <rect class="floor" x="0" y="0" width={room.width_ft} height={room.depth_ft} />
            <rect class="walls"
                  x={WALL_FT / 2} y={WALL_FT / 2}
                  width={Math.max(0.1, room.width_ft - WALL_FT)}
                  height={Math.max(0.1, room.depth_ft - WALL_FT)}
                  stroke-width={WALL_FT} />

            {#each roomStructure as f (f.id)}
                <PlanObject o={f} kind="feature" state={f.kind} editing={false} />
            {/each}

            {#each roomTables as t (t.id)}
                <g class="table-slot" class:free={freeSet.has(t.id)}
                   role={freeSet.has(t.id) ? 'button' : 'img'}
                   tabindex={freeSet.has(t.id) ? 0 : -1}
                   aria-label={labelFor(t)}
                   aria-pressed={freeSet.has(t.id) ? selected === t.id : undefined}
                   onkeydown={(e) => {
                       if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(t); }
                   }}>
                    <PlanObject o={t} kind="table" state={stateOf(t)}
                                selected={selected === t.id}
                                editing={false}
                                note={freeSet.has(t.id) ? '' : WHY[reasonOf.get(t.id) ?? 'unavailable']}
                                onpick={() => pick(t)} />
                </g>
            {/each}

            {#each roomNotes as f (f.id)}
                <PlanObject o={f} kind="feature" state={f.kind} editing={false} />
            {/each}
        </svg>

        <p class="key">
            <span class="sw suits"></span> Suits your game
            <span class="sw idle"></span> Free
            <span class="sw held"></span> Club night
            <span class="sw off"></span> Taken
        </p>

        <p class="chosen" aria-live="polite">
            {#if chosen}
                <strong>{chosen.name}</strong> — {chosen.size_label ?? `seats ${chosen.seats}`}.
                We’ll hold that one for you.
            {:else}
                {freeHere} table{freeHere === 1 ? '' : 's'} free at that time. Tap one, or leave
                it to us and we’ll pick the best.
            {/if}
        </p>
    </div>
{/if}

<style>
    .picker { margin-bottom: 0.9rem; }

    .rooms { display: flex; gap: 0.3rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .room-tab {
        background: transparent;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 0.75rem;
        padding: 0.2rem 0.55rem;
        cursor: pointer;
    }
    .room-tab.active { color: var(--color-accent); border-color: var(--color-accent); }

    .canvas {
        display: block;
        width: 100%;
        height: auto;
        max-height: 26rem;
        background: #0d0f13;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
    }
    .floor { fill: #14171d; }
    .walls { fill: none; stroke: #6d7482; }

    /* Only a free table looks like something you can press. Named table-slot,
       not slot: the booking page already calls its time buttons that. */
    .table-slot { pointer-events: none; }
    .table-slot.free { pointer-events: all; cursor: pointer; }
    .table-slot.free:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

    .key {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex-wrap: wrap;
        margin: 0.5rem 0 0.2rem;
        font-size: 0.74rem;
        color: var(--color-text-faint);
    }
    .sw {
        width: 0.7rem;
        height: 0.7rem;
        border-radius: 2px;
        display: inline-block;
        margin-left: 0.55rem;
    }
    .sw:first-child { margin-left: 0; }
    .sw.suits { background: #24402a; border: 1px solid #79b184; }
    .sw.idle  { background: #2a4a63; border: 1px solid #7fa8c4; }
    .sw.held  { background: #5a4520; border: 1px solid #d0ae63; }
    .sw.off   { background: #23252b; border: 1px solid #4a4c55; }

    .chosen { margin: 0.35rem 0 0; font-size: 0.85rem; color: var(--color-text-muted); }
</style>
