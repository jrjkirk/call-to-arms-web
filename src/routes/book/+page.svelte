<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';

    type Slot = { start: string; end: string; available: boolean; reason: string | null; tables_free: number };
    type DayLoad = { date: string; weekday: string; load: number | null; over_capacity: boolean;
                     club_nights: { system: string; signups: number }[] };

    let info = $state<any>(null);
    let loading = $state(true);
    let days = $state<DayLoad[]>([]);

    let chosenDate = $state('');
    let duration = $state(120);
    let partySize = $state(2);
    let systemChoice = $state('');      // '' = not chosen, 'other' = free text
    let gameNote = $state('');
    let contactName = $state('');
    let contactPhone = $state('');
    let notes = $state('');

    let slots = $state<Slot[]>([]);
    let chosenSlot = $state<string | null>(null);
    let slotsLoading = $state(false);
    let submitting = $state(false);
    let error = $state<string | null>(null);
    let confirmed = $state<any>(null);

    async function loadInfo() {
        const r = await fetch(`${PUBLIC_API_URL}/venue/info`, { credentials: 'include' });
        info = r.ok ? await r.json() : { enabled: false };
        if (info.enabled) {
            duration = info.min_duration_minutes;
            chosenDate = info.first_date;
            const b = await fetch(`${PUBLIC_API_URL}/venue/busy?start=${info.first_date}&days=21`, {
                credentials: 'include'
            });
            if (b.ok) days = (await b.json()).days;
        }
        loading = false;
    }
    onMount(loadInfo);

    async function loadSlots() {
        if (!chosenDate) return;
        slotsLoading = true;
        chosenSlot = null;
        const r = await fetch(
            `${PUBLIC_API_URL}/venue/availability?date=${chosenDate}&duration=${duration}&party_size=${partySize}`,
            { credentials: 'include' }
        );
        slots = r.ok ? ((await r.json()).slots ?? []) : [];
        slotsLoading = false;
    }

    $effect(() => {
        chosenDate; duration; partySize;
        loadSlots();
    });

    async function book() {
        if (!chosenSlot) return;
        submitting = true;
        error = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/bookings`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: chosenDate,
                start_time: chosenSlot,
                duration_minutes: duration,
                party_size: partySize,
                system_id: systemChoice && systemChoice !== 'other' ? Number(systemChoice) : null,
                game_note: systemChoice === 'other' ? gameNote : null,
                contact_name: contactName,
                contact_phone: contactPhone,
                notes
            })
        });
        if (r.ok) confirmed = await r.json();
        else error = (await r.json().catch(() => ({}))).detail || 'Could not book that.';
        submitting = false;
    }

    // Assembled here rather than as an inline {#if} chain: the chain ate the
    // space before the em dash, and a sentence with four optional clauses is
    // far easier to get right as a string than as nested markup.
    const pitchSentence = $derived.by(() => {
        const n = confirmed?.club_night;
        if (!n) return '';
        const at = n.start_time ? ` from ${n.start_time}` : '';
        if (n.same_evening) {
            const who = n.signups ? ` — ${n.signups} players are already coming` : '';
            return `runs the same night you've booked${at ? ',' + at : ''}${who}.`;
        }
        const every = n.session_cadence === 'fortnightly' ? 'every other' : 'every';
        return `runs here ${every} ${n.session_day}${at}.`;
    });

    function dayLabel(iso: string): string {
        return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short'
        });
    }
    const durations = $derived(
        info
            ? Array.from(
                  { length: Math.floor((info.max_duration_minutes - info.min_duration_minutes) / 30) + 1 },
                  (_, i) => info.min_duration_minutes + i * 30
              )
            : []
    );
    function durationLabel(m: number): string {
        const h = Math.floor(m / 60), r = m % 60;
        return r ? `${h}h ${r}m` : `${h} hour${h === 1 ? '' : 's'}`;
    }
</script>

<svelte:head><title>Book a table · Call to Arms</title></svelte:head>

<div class="container">
{#if loading}
    <p class="a-note">Loading…</p>
{:else if !info.enabled}
    <div class="a-card">
        <div class="a-head"><h1 class="a-title">Book a table</h1></div>
        <p class="a-note">This club doesn't take table bookings.</p>
    </div>
{:else if confirmed}
    <div class="a-card booked">
        <div class="a-head">
            <h1 class="a-title">
                {confirmed.booking.status === 'requested' ? 'Request sent' : 'Table booked'}
            </h1>
        </div>
        <p class="booked-line">
            <strong>{confirmed.booking.date}</strong>, {confirmed.booking.time}
        </p>
        <p class="booked-line">
            {confirmed.booking.table}{confirmed.booking.table_size ? ` · ${confirmed.booking.table_size}` : ''}
            · {confirmed.booking.party_size} player{confirmed.booking.party_size === 1 ? '' : 's'}
            · {confirmed.booking.game}
        </p>
        {#if confirmed.booking.status === 'requested'}
            <p class="a-note">The venue will confirm this shortly. Your table is held until they do.</p>
        {/if}
        {#if info.confirmation_note}<p class="a-note">{info.confirmation_note}</p>{/if}

        {#if confirmed.club_night}
            <div class="pitch">
                <p class="pitch-head">
                    {#if confirmed.club_night.same_evening}
                        There's a club night on that evening
                    {:else}
                        While you're here
                    {/if}
                </p>
                <p class="pitch-body">
                    <strong>{confirmed.club_night.system}</strong> {pitchSentence}
                </p>
                <a class="secondary-button" href="/signup?system={encodeURIComponent(confirmed.club_night.legacy_system_name ?? confirmed.club_night.system)}">
                    Sign up for it
                </a>
            </div>
        {/if}

        <button class="secondary-button" type="button" onclick={() => { confirmed = null; loadInfo(); }}>
            Book another
        </button>
    </div>
{:else}
    <div class="a-card">
        <div class="a-head"><h1 class="a-title">Book a table at {info.club_name}</h1></div>
        {#if info.booking_blurb}<p class="a-note">{info.booking_blurb}</p>{/if}

        <h2 class="a-subtitle">Pick a day</h2>
        <div class="day-strip">
            {#each days as d}
                <button class="day-chip" class:selected={d.date === chosenDate}
                        onclick={() => (chosenDate = d.date)}>
                    <span class="day-chip-date">{dayLabel(d.date)}</span>
                    <span class="day-chip-bar">
                        <span class="day-chip-fill" style="width: {Math.min(100, Math.round((d.load ?? 0) * 100))}%"></span>
                    </span>
                    {#if d.club_nights.length}
                        <span class="day-chip-night">{d.club_nights[0].system} night</span>
                    {:else}
                        <span class="day-chip-night quiet">
                            {(d.load ?? 0) >= 0.9 ? 'Nearly full' : (d.load ?? 0) >= 0.5 ? 'Getting busy' : 'Quiet'}
                        </span>
                    {/if}
                </button>
            {/each}
        </div>

        <div class="form-grid">
            <label class="field">
                <span class="field-label">How long</span>
                <select class="field-select" bind:value={duration}>
                    {#each durations as m}<option value={m}>{durationLabel(m)}</option>{/each}
                </select>
            </label>
            <label class="field">
                <span class="field-label">Players</span>
                <input class="field-input" type="number" min="1" max={info.max_party_size} bind:value={partySize} />
            </label>
            <label class="field">
                <span class="field-label">What are you playing</span>
                <select class="field-select" bind:value={systemChoice}>
                    <option value="">— Choose —</option>
                    {#each info.systems as s}<option value={String(s.id)}>{s.name}</option>{/each}
                    <option value="other">Something else</option>
                </select>
            </label>
            {#if systemChoice === 'other'}
                <label class="field">
                    <span class="field-label">What is it</span>
                    <input class="field-input" type="text" bind:value={gameNote} placeholder="Blood Bowl" />
                </label>
            {/if}
        </div>

        <h2 class="a-subtitle">Pick a time</h2>
        {#if slotsLoading}
            <p class="a-note">Checking…</p>
        {:else if slots.length === 0}
            <p class="a-note">No bookings that day.</p>
        {:else}
            <div class="slots">
                {#each slots as s}
                    <button class="slot" class:selected={chosenSlot === s.start}
                            disabled={!s.available}
                            title={s.reason === 'full' ? 'All tables taken' : s.reason === 'too_soon' ? 'Too close to now' : ''}
                            onclick={() => (chosenSlot = s.start)}>
                        {s.start}
                    </button>
                {/each}
            </div>
        {/if}

        {#if chosenSlot}
            <h2 class="a-subtitle">Your details</h2>
            <div class="form-grid">
                <label class="field">
                    <span class="field-label">Name</span>
                    <input class="field-input" type="text" bind:value={contactName} placeholder="Your name" />
                </label>
                <label class="field">
                    <span class="field-label">Phone <span class="field-label-hint">(optional)</span></span>
                    <input class="field-input" type="tel" bind:value={contactPhone} />
                </label>
            </div>
            <label class="field">
                <span class="field-label">Anything the venue should know <span class="field-label-hint">(optional)</span></span>
                <textarea class="field-input field-textarea" rows="2" bind:value={notes}></textarea>
            </label>

            {#if error}<p class="field-error">{error}</p>{/if}
            <button class="primary-button" type="button" disabled={submitting} onclick={book}>
                {submitting ? 'Booking…' : info.confirm_mode === 'request' ? 'Request this table' : 'Book this table'}
            </button>
        {:else if error}
            <p class="field-error">{error}</p>
        {/if}
    </div>
{/if}
</div>

<style>
    .day-strip { display: flex; gap: 0.4rem; overflow-x: auto; padding-bottom: 0.4rem; margin-bottom: 1rem; }

    .day-chip {
        flex: 0 0 auto;
        width: 7rem;
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
    }
    .day-chip:hover { border-color: var(--color-accent-border); }
    .day-chip.selected { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 15%, transparent); }
    .day-chip-date { font-size: 0.78rem; font-weight: 700; color: var(--color-text-bright); }
    .day-chip-bar { width: 100%; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.08); overflow: hidden; }
    .day-chip-fill { display: block; height: 100%; background: var(--color-accent); }
    .day-chip-night {
        font-size: 0.66rem; color: var(--color-accent);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
    }
    .day-chip-night.quiet { color: var(--color-text-faint); }

    .slots { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem; }
    .slot {
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        background: rgba(0, 0, 0, 0.2);
        color: var(--color-text-bright);
        font-family: inherit;
        font-size: 0.85rem;
        padding: 0.4rem 0.7rem;
        cursor: pointer;
    }
    .slot:hover:not(:disabled) { border-color: var(--color-accent-border); }
    .slot.selected { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 15%, transparent); font-weight: 700; }
    .slot:disabled { opacity: 0.3; cursor: not-allowed; }

    .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
        gap: 0.7rem;
        margin-bottom: 1rem;
    }
    .field { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.6rem; }

    .booked-line { margin: 0 0 0.3rem; font-size: 0.95rem; color: var(--color-text-bright); }

    .pitch {
        margin: 1rem 0;
        padding: 0.8rem 0.9rem;
        border: 1px solid var(--color-accent);
        border-radius: var(--radius);
        /* A wash, not --color-accent-soft — that token is a solid gold, and
           both the heading and the CTA in here are accent-coloured. */
        background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    }
    .pitch-head {
        margin: 0 0 0.3rem;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-accent);
    }
    .pitch-body { margin: 0 0 0.7rem; font-size: 0.9rem; color: var(--color-text-bright); }
</style>
