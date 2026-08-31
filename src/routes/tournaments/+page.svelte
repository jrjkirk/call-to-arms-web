<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';

    type T = {
        id: number; name: string; date: string; system: string | null;
        status: string; rounds: number; entries: number; checked_in: number;
        waitlisted: number; capacity: number | null; points_limit: number | null;
        start_time: string | null; blurb: string | null;
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
                <div class="event-list">
                    {#each upcoming as t (t.id)}
                        <a class="event" href={`/tournaments/${t.id}`}>
                            <div class="event-main">
                                <span class="event-name">{t.name}</span>
                                <span class="event-meta">
                                    {dayLabel(t.date)}{t.system ? ` · ${t.system}` : ''}
                                    {t.points_limit ? ` · ${t.points_limit} pts` : ''}
                                    · {t.rounds} round{t.rounds === 1 ? '' : 's'}
                                </span>
                            </div>
                            <div class="event-side">
                                <span class="pill" class:live={t.status === 'running'}
                                      class:draft={t.status === 'draft'}>
                                    {STATUS_LABEL[t.status] ?? t.status}
                                </span>
                                <span class="event-count">
                                    {t.entries}{t.capacity ? ` / ${t.capacity}` : ''} entered
                                    {#if t.waitlisted}<span class="wait">+{t.waitlisted} waiting</span>{/if}
                                </span>
                            </div>
                        </a>
                    {/each}
                </div>
            {/if}

            {#if past.length}
                <h2 class="a-subtitle">Finished</h2>
                <div class="event-list">
                    {#each past as t (t.id)}
                        <a class="event past" href={`/tournaments/${t.id}`}>
                            <div class="event-main">
                                <span class="event-name">{t.name}</span>
                                <span class="event-meta">{dayLabel(t.date)}{t.system ? ` · ${t.system}` : ''}</span>
                            </div>
                            <span class="event-count">{t.entries} played</span>
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
