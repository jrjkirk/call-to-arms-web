<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';

    type T = {
        id: number; name: string; date: string; system: string | null;
        status: string; rounds: number; entries: number; checked_in: number;
        waitlisted: number; capacity: number | null; points_limit: number | null;
        start_time: string | null; blurb: string | null;
        end_date: string | null; system_slug: string | null;
        image_url: string | null; ticket_price_pence: number | null;
    };

    let list = $state<T[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let creating = $state(false);
    let systems = $state<{ id: number; name: string }[]>([]);
    let isAdmin = $state(false);

    // New-event form
    let nName = $state('');
    let nSystem = $state<number | ''>('');
    let nDate = $state('');
    let nRounds = $state(3);
    let nPoints = $state<number | ''>('');
    let nCapacity = $state<number | ''>('');

    const STATUS_LABEL: Record<string, string> = {
        draft: 'Draft', open: 'Entries open', closed: 'Entries closed',
        running: 'Under way', finished: 'Finished'
    };

    async function load() {
        loading = true;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/tournaments?include_drafts=true`, {
                credentials: 'include'
            });
            list = r.ok ? ((await r.json()).tournaments ?? []) : [];
            const a = await fetch(`${PUBLIC_API_URL}/admin/me`, { credentials: 'include' });
            if (a.ok) {
                const s = await a.json();
                isAdmin = s.is_super_admin || s.is_platform_admin || (s.scopes ?? []).length > 0;
            }
            // /systems/mine, not /venue/info: the latter only lists systems
            // when the club has table bookings switched on, so the picker was
            // empty for every club without a venue. This one is club-scoped to
            // the systems actually enabled here, which is also exactly the set
            // the create endpoint will accept.
            const sy = await fetch(`${PUBLIC_API_URL}/systems/mine`, { credentials: 'include' });
            systems = sy.ok ? await sy.json() : [];
        } catch (_) {
            error = 'Could not load events right now.';
        } finally {
            loading = false;
        }
    }
    onMount(load);

    async function create() {
        error = null;
        const r = await fetch(`${PUBLIC_API_URL}/tournaments`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nName, system_id: Number(nSystem), event_date: nDate,
                rounds: nRounds,
                points_limit: nPoints === '' ? null : Number(nPoints),
                capacity: nCapacity === '' ? null : Number(nCapacity)
            })
        });
        if (r.ok) {
            creating = false;
            nName = ''; nDate = ''; nPoints = ''; nCapacity = '';
            await load();
        } else {
            error = (await r.json().catch(() => ({}))).detail || 'Could not create that event.';
        }
    }

    const canCreate = $derived(nName.trim() !== '' && nSystem !== '' && nDate !== '');
    const upcoming = $derived(list.filter((t) => t.status !== 'finished'));
    const past = $derived(list.filter((t) => t.status === 'finished'));

    const dayNum = (iso: string) => new Date(iso + 'T00:00:00').getDate();
    const monthShort = (iso: string) =>
        new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' });

    /** "Sat 14 – Sun 15 Nov 2026" for a multi-day event, one date otherwise. */
    function dateRangeOf(t: T): string {
        if (!t.end_date || t.end_date === t.date) return dayLabel(t.date);
        return `${dayLabel(t.date)} – ${dayLabel(t.end_date)}`;
    }

    function dayLabel(iso: string): string {
        return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
        });
    }
</script>

<svelte:head><title>Events · Call to Arms</title></svelte:head>

<div class="container">
    <div class="a-card">
        <div class="a-head">
            <h1 class="a-title">Events</h1>
            {#if isAdmin}
                <button class="secondary-button a-head-end" type="button"
                        onclick={() => (creating = !creating)}>
                    {creating ? 'Cancel' : 'New event'}
                </button>
            {/if}
        </div>

        {#if creating}
            <div class="new-event">
                <div class="form-grid">
                    <label class="field">
                        <span class="field-label">Name <span class="req">*</span></span>
                        <input class="field-input" type="text" bind:value={nName}
                               placeholder="Autumn Open" />
                    </label>
                    <label class="field">
                        <span class="field-label">Game system <span class="req">*</span></span>
                        <select class="field-select" bind:value={nSystem} disabled={!systems.length}>
                            <option value="">{systems.length ? '— Choose —' : 'No game systems enabled'}</option>
                            {#each systems as s}<option value={s.id}>{s.name}</option>{/each}
                        </select>
                        {#if !systems.length}
                            <span class="field-hint">
                                This club has no game systems enabled yet. Add one under
                                Admin → Systems, then come back.
                            </span>
                        {/if}
                    </label>
                    <label class="field">
                        <span class="field-label">Date <span class="req">*</span></span>
                        <input class="field-input" type="date" bind:value={nDate} />
                    </label>
                    <label class="field">
                        <span class="field-label">Rounds</span>
                        <input class="field-input" type="number" min="1" max="12" bind:value={nRounds} />
                    </label>
                    <label class="field">
                        <span class="field-label">Points limit</span>
                        <input class="field-input" type="number" bind:value={nPoints} placeholder="2000" />
                    </label>
                    <label class="field">
                        <span class="field-label">Capacity</span>
                        <input class="field-input" type="number" bind:value={nCapacity} placeholder="No limit" />
                    </label>
                </div>
                <p class="req-legend"><span class="req">*</span> Required</p>
                <button class="primary-button" type="button" disabled={!canCreate} onclick={create}>
                    Create event
                </button>
            </div>
        {/if}

        {#if error}<p class="field-error">{error}</p>{/if}

        {#if loading}
            <p class="a-note">Loading…</p>
        {:else if list.length === 0}
            <p class="a-note">
                No events yet.{#if isAdmin} Create one above — you can set it up as a draft
                and open entries when you're ready.{/if}
            </p>
        {:else}
            {#if upcoming.length}
                <div class="diary">
                    {#each upcoming as t (t.id)}
                        <a class="ev" href={`/tournaments/${t.id}`}>
                            <div class="ev-img">
                                <!-- A club's own poster if they've set one, else the game
                                     system's logo — so every event has a picture without a
                                     TO having to find one. -->
                                <img src={t.image_url ?? `/logos/${t.system_slug ?? 'kt'}.png`}
                                     alt="" loading="lazy" />
                                <span class="ev-when">
                                    <span class="ev-day">{dayNum(t.date)}</span>
                                    <span class="ev-mon">{monthShort(t.date)}</span>
                                </span>
                            </div>
                            <div class="ev-body">
                                <span class="pill" class:live={t.status === 'running'}
                                      class:draft={t.status === 'draft'}>
                                    {STATUS_LABEL[t.status] ?? t.status}
                                </span>
                                <h3 class="ev-name">{t.name}</h3>
                                <p class="ev-meta">{dateRangeOf(t)}</p>
                                <p class="ev-meta">
                                    {t.system ?? ''}{t.points_limit ? ` · ${t.points_limit} pts` : ''}
                                    · {t.rounds} round{t.rounds === 1 ? '' : 's'}
                                </p>
                                {#if t.blurb}<p class="ev-blurb">{t.blurb}</p>{/if}
                                <p class="ev-foot">
                                    {t.entries}{t.capacity ? ` / ${t.capacity}` : ''} entered
                                    {#if t.waitlisted}<span class="wait">· {t.waitlisted} waiting</span>{/if}
                                    {#if t.ticket_price_pence}
                                        <span class="price">£{(t.ticket_price_pence / 100).toFixed(2)}</span>
                                    {/if}
                                </p>
                            </div>
                        </a>
                    {/each}
                </div>
            {/if}

            {#if past.length}
                <h2 class="a-subtitle">Finished</h2>
                <div class="diary past-diary">
                    {#each past as t (t.id)}
                        <a class="ev past" href={`/tournaments/${t.id}`}>
                            <div class="ev-img">
                                <img src={t.image_url ?? `/logos/${t.system_slug ?? 'kt'}.png`}
                                     alt="" loading="lazy" />
                            </div>
                            <div class="ev-body">
                                <h3 class="ev-name">{t.name}</h3>
                                <p class="ev-meta">{dateRangeOf(t)} · {t.entries} played</p>
                            </div>
                        </a>
                    {/each}
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
    .new-event {
        border: 1px solid var(--color-accent-border-soft);
        border-radius: var(--radius);
        padding: 1rem;
        margin-bottom: 1.2rem;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }

    .req { color: var(--color-accent); font-weight: 700; }
    .field-hint { font-size: 0.76rem; color: var(--color-text-dim); margin-top: 0.25rem; }
    .req-legend { margin: 0 0 0.8rem; font-size: 0.72rem; color: var(--color-text-dim); }

    .diary {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
        gap: 1rem;
    }
    .past-diary { grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); }

    .ev {
        display: flex; flex-direction: column;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        overflow: hidden;
        background: rgba(0, 0, 0, 0.2);
        text-decoration: none; color: inherit;
        transition: border-color 0.12s ease, transform 0.12s ease;
    }
    .ev:hover { border-color: var(--color-accent-border); transform: translateY(-2px); }
    .ev.past { opacity: 0.72; }

    .ev-img {
        position: relative;
        aspect-ratio: 16 / 9;
        background: rgba(0, 0, 0, 0.35);
        display: grid; place-items: center;
        border-bottom: 1px solid var(--color-steel-border);
    }
    .ev-img img { max-width: 72%; max-height: 72%; object-fit: contain; }
    .ev.past .ev-img { aspect-ratio: 21 / 9; }

    /* The date block reads as a diary entry rather than another line of text. */
    .ev-when {
        position: absolute; top: 0.5rem; left: 0.5rem;
        display: flex; flex-direction: column; align-items: center;
        padding: 0.25rem 0.5rem; border-radius: 6px;
        background: rgba(0, 0, 0, 0.72);
        border: 1px solid var(--color-accent-border);
        line-height: 1.05;
    }
    .ev-day { font-size: 1.15rem; font-weight: 700; color: var(--color-accent); }
    .ev-mon {
        font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.08em;
        color: var(--color-text-dim);
    }

    .ev-body { padding: 0.8rem 0.9rem; display: flex; flex-direction: column; gap: 0.3rem; }
    .ev-name { margin: 0; font-size: 1rem; color: var(--color-text-bright); }
    .ev-meta { margin: 0; font-size: 0.78rem; color: var(--color-text-dim); }
    .ev-blurb {
        margin: 0.2rem 0 0; font-size: 0.8rem; color: var(--color-text-dim);
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .ev-foot {
        margin: 0.4rem 0 0; font-size: 0.78rem; color: var(--color-text-dim);
        display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: baseline;
    }
    .price { margin-left: auto; color: var(--color-accent); font-weight: 700; }

    .event-list { display: flex; flex-direction: column; gap: 0.5rem; }

    .event {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 0.8rem 1rem;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        background: rgba(0, 0, 0, 0.18);
        text-decoration: none;
        color: inherit;
        transition: border-color 0.12s ease, background 0.12s ease;
    }
    .event:hover { border-color: var(--color-accent-border); background: rgba(201, 161, 74, 0.06); }
    .event.past { opacity: 0.72; }

    .event-main { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
    .event-name { font-weight: 700; color: var(--color-text-bright); }
    .event-meta { font-size: 0.8rem; color: var(--color-text-dim); }

    .event-side { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; }
    .event-count { font-size: 0.8rem; color: var(--color-text-dim); white-space: nowrap; }
    .wait { color: var(--color-accent); margin-left: 0.35rem; }

    .pill {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 700;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        border: 1px solid var(--color-steel-border);
        color: var(--color-text-dim);
        white-space: nowrap;
    }
    .pill.live { color: var(--color-accent); border-color: var(--color-accent-border); }
    .pill.draft { opacity: 0.7; font-style: italic; }
</style>
