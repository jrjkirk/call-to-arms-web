<script lang="ts">
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from './HelpTip.svelte';

    let { date, onchange, canApprove = false }:
        { date: string; onchange?: () => void; canApprove?: boolean } = $props();

    let day = $state<any>(null);
    let error = $state<string | null>(null);
    let busy = $state(false);
    let events = $state<any[]>([]);
    let message = $state<string | null>(null);
    let showEventForm = $state(false);
    let newEvent = $state({ name: '', start_time: '18:00', end_time: '22:00',
                            tables_needed: 4, description: '', public: true });

    async function load() {
        const [d, e] = await Promise.all([
            fetch(`${PUBLIC_API_URL}/venue/admin/day?date=${date}`, { credentials: 'include' }),
            fetch(`${PUBLIC_API_URL}/venue/admin/events?date=${date}&days=0`, { credentials: 'include' })
        ]);
        if (d.ok) day = await d.json();
        else error = 'Could not load that day.';
        events = e.ok ? await e.json() : [];
    }

    async function addEvent() {
        busy = true; error = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/events`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newEvent, date })
        });
        if (r.ok) {
            const made = await r.json();
            showEventForm = false;
            newEvent = { name: '', start_time: '18:00', end_time: '22:00',
                         tables_needed: 4, description: '', public: true };
            await load();
            onchange?.();
            // A busy room can hand back fewer tables than asked for. Say so at
            // the moment it happens, not on the night.
            if (made.short_by > 0) {
                error = `Held ${made.tables_held} of the ${made.tables_needed} tables you asked ` +
                        `for — the rest were already taken. Free something up, or edit the event.`;
            }
            if (made.status === 'pending') {
                message = `${made.name} is holding its tables and waiting for a club ` +
                          `super-admin to approve it.`;
            }
        } else {
            error = (await r.json().catch(() => ({}))).detail || 'Could not create that event.';
        }
        busy = false;
    }

    async function decide(ev: any, verdict: 'approve' | 'reject') {
        let reason: string | null = null;
        if (verdict === 'reject') {
            reason = prompt(`Why is ${ev.name} being turned down? (optional)`) ?? '';
        }
        busy = true; error = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/events/${ev.id}/${verdict}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
        });
        if (r.ok) {
            const got = await r.json();
            await load();
            onchange?.();
            if (verdict === 'approve' && got.short_by > 0) {
                error = `Approved, but only ${got.tables_held} of the ${got.tables_needed} ` +
                        `tables were still free.`;
            }
        } else {
            error = (await r.json().catch(() => ({}))).detail || 'That didn\'t work.';
        }
        busy = false;
    }

    async function removeEvent(ev: any) {
        if (!confirm(`Cancel ${ev.name} and release its ${ev.tables_held} table(s)?`)) return;
        busy = true; error = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/events/${ev.id}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (r.ok) { await load(); onchange?.(); }
        else error = 'Could not cancel it.';
        busy = false;
    }

    // Reload whenever the parent selects a different date.
    $effect(() => {
        date;
        load();
    });

    async function act(id: number, patch: Record<string, unknown>) {
        busy = true; error = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/bookings/${id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch)
        });
        if (r.ok) { await load(); onchange?.(); }
        else error = (await r.json().catch(() => ({}))).detail || 'That didn\'t work.';
        busy = false;
    }

    function longDate(iso: string): string {
        return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long'
        });
    }
</script>

{#if day}
    <div class="a-card" class:over={day.over_capacity}>
        <div class="a-head">
            <h2 class="a-title">{longDate(day.date)}</h2>
            <HelpTip
                label="this day"
                text={"Tables committed counts bookings AND the tables your club nights are expected to need, so you can see a clash before you take another booking.\n\nClub-night demand is worked out from that night's signups at two players a table."}
            />
            <span class="a-head-end a-state" class:is-on={!day.over_capacity}>
                {day.tables_committed} / {day.tables_total} tables
            </span>
        </div>

        {#if day.club_nights.length}
            <div class="nights">
                {#each day.club_nights as n}
                    <span class="night-pill" style="--pill: {n.accent_color ?? 'var(--color-accent)'}">
                        {n.system}{n.start_time ? ` · ${n.start_time}` : ''} · {n.signups} signed up
                        · ~{n.tables_expected} tables
                    </span>
                {/each}
            </div>
        {/if}

        {#if day.over_capacity}
            <p class="field-error">
                More tables are spoken for than you have. Bookings and the club night together
                need {day.tables_committed}; you have {day.tables_total}.
            </p>
        {/if}

        <div class="a-head events-head">
            <h3 class="a-subtitle">Events</h3>
            <HelpTip
                label="events"
                text={"Something the venue is running that takes tables out of circulation — a tournament, a launch night, a party.\n\nIt holds its tables exactly like a booking, so the public can't book over it. Cancel it and they come straight back."}
            />
            <span class="a-head-end">
                <button class="secondary-button" type="button"
                        onclick={() => (showEventForm = !showEventForm)}>
                    {showEventForm ? 'Cancel' : 'Add event'}
                </button>
            </span>
        </div>

        {#if showEventForm}
            <div class="event-form">
                <label class="field ev-name">
                    <span class="field-label">Name</span>
                    <input class="field-input" type="text" bind:value={newEvent.name}
                           placeholder="Grand Tournament" />
                </label>
                <label class="field">
                    <span class="field-label">From</span>
                    <input class="field-input" type="time" bind:value={newEvent.start_time} />
                </label>
                <label class="field">
                    <span class="field-label">To</span>
                    <input class="field-input" type="time" bind:value={newEvent.end_time} />
                </label>
                <label class="field">
                    <span class="field-label">Tables</span>
                    <input class="field-input" type="number" min="1" max="200"
                           bind:value={newEvent.tables_needed} />
                </label>
                <label class="field ev-desc">
                    <span class="field-label">Details <span class="field-label-hint">(optional)</span></span>
                    <input class="field-input" type="text" bind:value={newEvent.description} />
                </label>
                <label class="check-row ev-public">
                    <input type="checkbox" bind:checked={newEvent.public} />
                    <span>Show it to the public</span>
                </label>
                <button class="primary-button ev-go" type="button"
                        disabled={busy || !newEvent.name.trim()} onclick={addEvent}>
                    {busy ? 'Holding…' : 'Hold the tables'}
                </button>
            </div>
        {/if}

        {#if events.length === 0}
            <p class="a-note">No events.</p>
        {:else}
            <div class="events">
                {#each events as ev (ev.id)}
                    <div class="event" class:short={ev.short_by > 0}
                         class:pending={ev.status === 'pending'}
                         class:rejected={ev.status === 'rejected'}>
                        <div class="ev-when">
                            <strong>{ev.start_time}–{ev.end_time}</strong>
                            <span class="b-meta">{ev.tables_held} table{ev.tables_held === 1 ? '' : 's'}</span>
                        </div>
                        <div class="ev-who">
                            <strong>{ev.name}</strong>
                            {#if ev.status !== 'approved'}
                                <span class="ev-status">
                                    {ev.status === 'pending' ? 'Waiting for approval' : 'Turned down'}
                                    {#if ev.rejection_reason} — {ev.rejection_reason}{/if}
                                </span>
                            {/if}
                            {#if ev.table_names.length}
                                <span class="b-meta">{ev.table_names.join(', ')}</span>
                            {/if}
                            {#if ev.description}<span class="b-notes">{ev.description}</span>{/if}
                            {#if ev.short_by > 0}
                                <span class="ev-short">
                                    {ev.short_by} short of the {ev.tables_needed} asked for
                                </span>
                            {/if}
                            {#if !ev.public}<span class="b-meta">Not shown publicly</span>{/if}
                        </div>
                        <div class="b-actions">
                            {#if canApprove && ev.status !== 'approved'}
                                <button class="primary-button" disabled={busy}
                                        onclick={() => decide(ev, 'approve')}>Approve</button>
                            {/if}
                            {#if canApprove && ev.status === 'pending'}
                                <button class="secondary-button" disabled={busy}
                                        onclick={() => decide(ev, 'reject')}>Turn down</button>
                            {/if}
                            <button class="danger-button" disabled={busy}
                                    onclick={() => removeEvent(ev)}>Cancel</button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}

        <h3 class="a-subtitle">Bookings</h3>
        {#if day.booking_rows.filter((b) => !b.event_id).length === 0}
            <p class="a-note">No bookings.</p>
        {:else}
            <div class="bookings">
                <!-- An event's tables are bookings too, but showing six
                     identical rows for one tournament would bury the real
                     bookings. They're listed above as the one thing they are. -->
                {#each day.booking_rows.filter((b) => !b.event_id) as b (b.id)}
                    <div class="booking" class:cancelled={b.status === 'cancelled'}
                         class:pending={b.status === 'requested'}>
                        <div class="b-when">
                            <strong>{b.time}</strong>
                            <span class="b-table">{b.table}{b.table_size ? ` · ${b.table_size}` : ''}</span>
                        </div>
                        <div class="b-who">
                            <strong>{b.name}</strong>
                            <span class="b-meta">{b.game} · {b.party_size} player{b.party_size === 1 ? '' : 's'}</span>
                            {#if b.notes}<span class="b-notes">{b.notes}</span>{/if}
                            {#if b.phone || b.email}
                                <span class="b-meta">{[b.phone, b.email].filter(Boolean).join(' · ')}</span>
                            {/if}
                        </div>
                        <div class="b-actions">
                            {#if b.status === 'requested'}
                                <button class="primary-button" disabled={busy}
                                        onclick={() => act(b.id, { status: 'confirmed' })}>Confirm</button>
                            {/if}
                            {#if b.status !== 'cancelled'}
                                <button class="danger-button" disabled={busy}
                                        onclick={() => act(b.id, { status: 'cancelled' })}>Cancel</button>
                            {/if}
                            {#if b.status === 'cancelled'}
                                <span class="a-state">Cancelled</span>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}

        {#if error}<p class="field-error">{error}</p>{/if}
        {#if message}<p class="pairing-message">{message}</p>{/if}
    </div>
{/if}

<style>
    .a-card.over { --panel-accent: var(--color-loss); }

    .nights { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.7rem; }
    .night-pill {
        border: 1px solid var(--pill);
        border-radius: 999px;
        padding: 0.15rem 0.6rem;
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--color-text-bright);
    }

    .bookings { display: flex; flex-direction: column; gap: 0.5rem; }

    .booking {
        display: flex;
        gap: 0.9rem;
        align-items: flex-start;
        flex-wrap: wrap;
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        background: rgba(0, 0, 0, 0.2);
    }
    .booking.pending { border-color: var(--color-accent-border); }
    .booking.cancelled { opacity: 0.5; }

    .b-when { display: flex; flex-direction: column; min-width: 7rem; }
    .b-table { font-size: 0.72rem; color: var(--color-text-muted); }

    .b-who { display: flex; flex-direction: column; flex: 1 1 12rem; min-width: 0; }
    .b-meta { font-size: 0.75rem; color: var(--color-text-muted); }
    .b-notes { font-size: 0.75rem; color: var(--color-text-bright); font-style: italic; }

    .b-actions { display: flex; gap: 0.4rem; align-items: center; margin-left: auto; }

    .events-head { margin-top: 1rem; }

    .event-form {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
        gap: 0.6rem;
        align-items: end;
        padding: 0.7rem;
        margin-bottom: 0.7rem;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        background: rgba(0, 0, 0, 0.2);
    }
    .ev-name, .ev-desc { grid-column: span 2; }
    .ev-public, .ev-go { grid-column: span 2; }
    .field { display: flex; flex-direction: column; gap: 0.2rem; }

    .events { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.5rem; }

    .event {
        display: flex;
        gap: 0.9rem;
        align-items: flex-start;
        flex-wrap: wrap;
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--color-accent-border);
        border-radius: var(--radius);
        background: color-mix(in srgb, var(--color-accent) 8%, transparent);
    }
    .event.short { border-color: var(--color-loss); }
    /* Pending reads as unfinished business, not as a problem — it's holding
       its tables perfectly happily, it just needs a yes. */
    .event.pending {
        border-style: dashed;
        background: rgba(0, 0, 0, 0.2);
    }
    .event.rejected { opacity: 0.55; border-style: dashed; }

    .ev-status { font-size: 0.75rem; font-weight: 700; color: var(--color-accent); }
    .event.rejected .ev-status { color: var(--color-text-muted); }

    .ev-when { display: flex; flex-direction: column; min-width: 7rem; }
    .ev-who { display: flex; flex-direction: column; flex: 1 1 12rem; min-width: 0; }
    .ev-short { font-size: 0.75rem; color: var(--color-loss); font-weight: 700; }
</style>
