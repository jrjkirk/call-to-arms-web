<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import BookingPlanPicker from '$lib/plan/BookingPlanPicker.svelte';

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
    let slotTables = $state<{ id: number; name: string; size_label: string | null;
                              seats: number; recommended: boolean }[]>([]);
    let chosenTable = $state<number | null>(null);
    // Why each table you CAN'T have is unavailable, so the plan can grey it
    // honestly instead of making everything look booked.
    let slotUnavailable = $state<{ id: number; reason: string }[]>([]);
    let slotsLoading = $state(false);
    let submitting = $state(false);

    /** Some venue-named nights already end in "night" — "Magic Night night". */
    const nightLabel = (name: string) =>
        /night$/i.test(name) ? name : `${name} night`;
    let error = $state<string | null>(null);
    let confirmed = $state<any>(null);

    // The availability side of this page is public, but placing the booking
    // still needs an account. Rather than let a visitor fill the form in and
    // meet a bare "Authentication required" on submit, the last step asks them
    // to sign in. null = not checked yet, so nothing flashes on first paint.
    let signedIn = $state<boolean | null>(null);
    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/me`, { credentials: 'include' });
            signedIn = r.ok ? (await r.json()).authenticated === true : false;
        } catch (_) {
            signedIn = false;
        }
    });

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

    let dayInfo = $state<any>(null);

    async function loadSlots() {
        if (!chosenDate) return;
        slotsLoading = true;
        chosenSlot = null;
        slotTables = [];
        chosenTable = null;
        const sys = systemChoice && systemChoice !== 'other' ? `&system_id=${systemChoice}` : '';
        const r = await fetch(
            `${PUBLIC_API_URL}/venue/availability?date=${chosenDate}&duration=${duration}&party_size=${partySize}${sys}`,
            { credentials: 'include' }
        );
        const body = r.ok ? await r.json() : null;
        slots = body?.slots ?? [];
        dayInfo = body;
        slotsLoading = false;
    }

    // The game matters to the grid too, not just to the booking: a system with
    // tables held for its club night changes what's on offer that evening.
    $effect(() => {
        chosenDate; duration; partySize; systemChoice;
        loadSlots();
    });

    async function pickSlot(start: string) {
        chosenSlot = start;
        chosenTable = null;
        slotTables = [];
        slotUnavailable = [];
        const sys = systemChoice && systemChoice !== 'other' ? `&system_id=${systemChoice}` : '';
        const r = await fetch(
            `${PUBLIC_API_URL}/venue/tables-for-slot?date=${chosenDate}&start_time=${start}` +
            `&duration=${duration}&party_size=${partySize}${sys}`,
            { credentials: 'include' }
        );
        if (r.ok) {
            const body = await r.json();
            slotTables = body.tables ?? [];
            slotUnavailable = body.unavailable ?? [];
        }
    }

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
                table_id: chosenTable,
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
            const who = n.signups
                ? ` — ${n.signups} ${n.signups === 1 ? 'player is' : 'players are'} already signed up`
                : '';
            return `runs here the same night you've booked${at ? ',' + at : ''}${who}.` +
                ' Sign up and you\'ll be paired with someone.';
        }
        const every = n.session_cadence === 'fortnightly' ? 'every other' : 'every';
        return `runs here ${every} ${n.session_day}${at}.`;
    });

    // The club night holding tables IS the game they've chosen to play.
    const heldForYourGame = $derived(
        systemChoice && systemChoice !== 'other'
            ? (dayInfo?.club_nights ?? []).find(
                  (n: any) => String(n.system_id) === String(systemChoice)
              ) ?? null
            : null
    );

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
                        That's club night
                    {:else}
                        There's a club night for that
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
                        <!-- A venue-only night is named by its venue, and some of
                             them already end in "night" — "Magic Night night". -->
                        <span class="day-chip-night">{nightLabel(d.club_nights[0].system)}</span>
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
            <p class="a-note">No times free that day.</p>
        {:else}
            {#if dayInfo?.tables_held}
                {#if heldForYourGame}
                    <!-- Their own game's night is what's taking the tables. Telling
                         them "held for The Old World" while they book The Old World
                         invites the obvious question, so answer it: the night is
                         the better offer, and signing up gets them an opponent. -->
                    <p class="a-note">
                        {heldForYourGame.system} club night runs that evening and
                        {dayInfo.tables_held} tables are held for it. You can
                        <a href="/signup?system={encodeURIComponent(heldForYourGame.legacy_system_name ?? heldForYourGame.system)}">sign up for the night</a>
                        instead and be paired with someone — or book one of the tables below.
                    </p>
                {:else}
                    <p class="a-note">
                        {dayInfo.tables_held} of our tables are held for
                        {dayInfo.club_nights.map((n: any) => n.system).join(' and ')} that
                        evening, so there's less free than usual.
                    </p>
                {/if}
            {/if}
            <div class="slots">
                {#each slots as s}
                    <button class="slot" class:selected={chosenSlot === s.start}
                            disabled={!s.available}
                            title={s.reason === 'full' ? 'All tables taken' : s.reason === 'too_soon' ? 'Too close to now' : ''}
                            onclick={() => pickSlot(s.start)}>
                        {s.start}
                    </button>
                {/each}
            </div>
        {/if}

        {#if chosenSlot && slotTables.length}
            <h2 class="a-subtitle">Pick a table</h2>

            <!-- The room itself. A list of cards tells you a 6x4 is free; it
                 can't tell you it's the one by the window, which is the only
                 reason anyone asks for a particular table. The cards stay
                 below, sharing the selection — they're the keyboard and
                 screen-reader path, not a fallback. -->
            <BookingPlanPicker
                free={slotTables.map((t) => t.id)}
                unavailable={slotUnavailable}
                recommended={slotTables.filter((t) => t.recommended).map((t) => t.id)}
                selected={chosenTable}
                onpick={(id) => (chosenTable = id)} />

            <div class="tables">
                {#each slotTables as t (t.id)}
                    <button class="tcard" class:selected={chosenTable === t.id}
                            class:recommended={t.recommended}
                            onclick={() => (chosenTable = chosenTable === t.id ? null : t.id)}>
                        <span class="tcard-name">{t.name}</span>
                        <span class="tcard-size">{t.size_label ?? ''} · seats {t.seats}</span>
                        {#if t.recommended}<span class="tcard-flag">Recommended</span>{/if}
                    </button>
                {/each}
            </div>
            <p class="a-note">
                {chosenTable ? 'We\'ll hold that one for you.' : 'Leave it to us and we\'ll pick the best free table.'}
            </p>
        {/if}

        {#if chosenSlot && signedIn === false}
            <h2 class="a-subtitle">Almost there</h2>
            <p class="a-note">
                Sign in to hold {slotTables.find((t) => t.id === chosenTable)?.name ?? 'this table'}
                on {dayLabel(chosenDate)} at {chosenSlot}.
            </p>
            <a class="primary-button" href={`${PUBLIC_API_URL}/auth/discord/login`}>Sign in to book</a>
        {:else if chosenSlot}
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

    .tables { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem; }

    .tcard {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.1rem;
        min-width: 8rem;
        padding: 0.5rem 0.7rem;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        background: rgba(0, 0, 0, 0.2);
        font-family: inherit;
        cursor: pointer;
        text-align: left;
    }
    .tcard:hover { border-color: var(--color-accent-border); }
    .tcard.recommended { border-color: var(--color-accent-border); }
    .tcard.selected {
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    }
    .tcard-name { font-size: 0.85rem; font-weight: 700; color: var(--color-text-bright); }
    .tcard-size { font-size: 0.7rem; color: var(--color-text-muted); }
    .tcard-flag { font-size: 0.66rem; font-weight: 700; color: var(--color-accent); }

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
