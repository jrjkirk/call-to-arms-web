<script lang="ts">
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from './HelpTip.svelte';

    let { date, onchange }: { date: string; onchange?: () => void } = $props();

    let day = $state<any>(null);
    let error = $state<string | null>(null);
    let busy = $state(false);

    async function load() {
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/day?date=${date}`, {
            credentials: 'include'
        });
        if (r.ok) day = await r.json();
        else error = 'Could not load that day.';
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

        {#if day.booking_rows.length === 0}
            <p class="a-note">No bookings.</p>
        {:else}
            <div class="bookings">
                {#each day.booking_rows as b (b.id)}
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
</style>
