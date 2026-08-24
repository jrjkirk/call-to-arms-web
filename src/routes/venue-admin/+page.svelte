<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from '$lib/HelpTip.svelte';
    import VenueDay from '$lib/VenueDay.svelte';
    import VenueTables from '$lib/VenueTables.svelte';
    import VenueClubNights from '$lib/VenueClubNights.svelte';
    import VenueSettings from '$lib/VenueSettings.svelte';
    import VenueStaff from '$lib/VenueStaff.svelte';

    type DayOverview = {
        date: string; weekday: string; tables_total: number; tables_booked: number;
        tables_club_night: number; tables_committed: number; load: number | null;
        over_capacity: boolean; bookings: number;
        club_nights: { system: string; signups: number; accent_color: string | null }[];
    };

    let access = $state<'checking' | 'ok' | 'denied'>('checking');
    let canManageStaff = $state(false);
    let tab = $state<'diary' | 'nights' | 'tables' | 'settings' | 'staff'>('diary');
    let upcoming = $state<DayOverview[]>([]);
    let pending = $state<any[]>([]);
    let selectedDate = $state('');
    let loadError = $state<string | null>(null);

    async function loadUpcoming() {
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/upcoming?days=21`, {
            credentials: 'include'
        });
        if (!r.ok) { loadError = 'Could not load the diary.'; return; }
        const body = await r.json();
        upcoming = body.days;
        pending = body.pending;
        if (!selectedDate && upcoming.length) selectedDate = upcoming[0].date;
    }

    onMount(async () => {
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/me`, { credentials: 'include' });
        const body = r.ok ? await r.json() : { can_admin_venue: false };
        access = body.can_admin_venue ? 'ok' : 'denied';
        canManageStaff = body.can_manage_staff === true;
        // A bar manager can run the diary but can't hand out venue access, so
        // don't show them a tab that would only 403.
        if (!canManageStaff && tab === 'staff') tab = 'diary';
        if (access === 'ok') await loadUpcoming();
    });

    // Busy-ness as a word, not just a bar. Colour alone can't carry this: a
    // manager scanning three weeks needs to read the outlier, not decode a hue.
    function loadLabel(d: DayOverview): string {
        if (!d.tables_total) return 'No tables';
        if (d.over_capacity) return 'Over capacity';
        const pct = Math.round((d.load ?? 0) * 100);
        if (pct === 0) return 'Free';
        if (pct < 50) return `${pct}% busy`;
        if (pct < 90) return `${pct}% busy`;
        return 'Nearly full';
    }

    const selected = $derived(upcoming.find((d) => d.date === selectedDate) ?? null);

    function shortDate(iso: string): string {
        const d = new Date(iso + 'T00:00:00');
        return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    }
</script>

<svelte:head><title>Venue Admin · Call to Arms</title></svelte:head>

{#if access === 'checking'}
    <p class="a-note">Loading…</p>
{:else if access === 'denied'}
    <div class="a-card">
        <div class="a-head"><h2 class="a-title">Venue Admin</h2></div>
        <p class="a-note">You don't have venue access at this club.</p>
    </div>
{:else}
    <div class="venue-tabs">
        <button class="venue-tab" class:active={tab === 'diary'} onclick={() => (tab = 'diary')}>Diary</button>
        <button class="venue-tab" class:active={tab === 'nights'} onclick={() => (tab = 'nights')}>Club nights</button>
        <button class="venue-tab" class:active={tab === 'tables'} onclick={() => (tab = 'tables')}>Tables</button>
        <button class="venue-tab" class:active={tab === 'settings'} onclick={() => (tab = 'settings')}>Settings</button>
        {#if canManageStaff}
            <button class="venue-tab" class:active={tab === 'staff'} onclick={() => (tab = 'staff')}>Staff</button>
        {/if}
    </div>

    {#if loadError}<p class="field-error">{loadError}</p>{/if}

    {#if tab === 'diary'}
        {#if pending.length}
            <div class="a-card pending-card">
                <div class="a-head">
                    <h2 class="a-title">Waiting for you</h2>
                    <HelpTip
                        label="pending bookings"
                        text={"These came in while the venue was set to ask before confirming.\n\nThey're holding their table in the meantime, so an unanswered request still blocks the slot."}
                    />
                    <span class="a-head-end a-state is-on">{pending.length}</span>
                </div>
                <ul class="pending-list">
                    {#each pending as p}
                        <li>{shortDate(p.date_iso)} · {p.time} · {p.table} · {p.name} ({p.game})</li>
                    {/each}
                </ul>
                <p class="a-note">Open the day below to confirm or turn them down.</p>
            </div>
        {/if}

        <div class="a-card">
            <div class="a-head">
                <h2 class="a-title">Next three weeks</h2>
                <HelpTip
                    label="how busy"
                    text={"Busy-ness counts BOTH kinds of demand: tables already booked, and the tables your club nights are expected to need.\n\nClub-night demand is worked out from that night's signups, two players to a table. That's why a Wednesday with no bookings can still show as nearly full."}
                />
            </div>
            <div class="day-strip">
                {#each upcoming as d}
                    <button
                        class="day-chip"
                        class:selected={d.date === selectedDate}
                        class:over={d.over_capacity}
                        onclick={() => (selectedDate = d.date)}
                    >
                        <span class="day-chip-date">{shortDate(d.date)}</span>
                        <span class="day-chip-bar">
                            <span class="day-chip-fill" style="width: {Math.min(100, Math.round((d.load ?? 0) * 100))}%"></span>
                        </span>
                        <span class="day-chip-label">{loadLabel(d)}</span>
                        {#if d.club_nights.length}
                            <span class="day-chip-night">{d.club_nights.map((n) => n.system).join(', ')}</span>
                        {/if}
                    </button>
                {/each}
            </div>
        </div>

        {#if selected}
            <VenueDay date={selected.date} onchange={loadUpcoming} />
        {/if}
    {:else if tab === 'nights'}
        <VenueClubNights />
    {:else if tab === 'tables'}
        <VenueTables />
    {:else if tab === 'settings'}
        <VenueSettings />
    {:else}
        <VenueStaff />
    {/if}
{/if}

<style>
    .venue-tabs {
        display: flex;
        gap: 0.4rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
    }

    .venue-tab {
        background: transparent;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-muted);
        font-family: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        padding: 0.4rem 0.9rem;
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s, background 0.15s;
    }
    .venue-tab:hover { color: var(--color-text-bright); }
    .venue-tab.active {
        color: var(--color-text-bright);
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    }

    .pending-card { --panel-accent: var(--color-loss); }

    .pending-list {
        list-style: none;
        margin: 0 0 0.5rem;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        font-size: 0.85rem;
        color: var(--color-text-bright);
    }

    /* Horizontal because a venue reads its diary along time, not down a list —
       three weeks side by side makes the busy Wednesday obvious at a glance. */
    .day-strip {
        display: flex;
        gap: 0.4rem;
        overflow-x: auto;
        padding-bottom: 0.4rem;
    }

    .day-chip {
        flex: 0 0 auto;
        width: 7.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        align-items: flex-start;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        padding: 0.5rem 0.6rem;
        cursor: pointer;
        font-family: inherit;
        text-align: left;
        transition: border-color 0.15s, background 0.15s;
    }
    .day-chip:hover { border-color: var(--color-accent-border); }
    /* A wash, not --color-accent-soft: that token is a solid gold, and this
       chip carries muted, accent and loss-coloured children that all have to
       stay readable on top of it. */
    .day-chip.selected {
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    }
    .day-chip.over { border-color: var(--color-loss); }

    .day-chip-date {
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--color-text-bright);
    }

    .day-chip-bar {
        width: 100%;
        height: 4px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.08);
        overflow: hidden;
    }
    .day-chip-fill {
        display: block;
        height: 100%;
        background: var(--color-accent);
    }
    .day-chip.over .day-chip-fill { background: var(--color-loss); }

    .day-chip-label {
        font-size: 0.7rem;
        color: var(--color-text-muted);
    }
    .day-chip.over .day-chip-label {
        color: var(--color-loss);
        font-weight: 700;
    }

    .day-chip-night {
        font-size: 0.66rem;
        color: var(--color-text-faint);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
    }
</style>
