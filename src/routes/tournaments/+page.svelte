<script lang="ts">
    import { getAdminMe, getMySystemRows } from '$lib/session';
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
            const s = await getAdminMe();
            if (s) isAdmin = s.is_super_admin || s.is_platform_admin || (s.scopes ?? []).length > 0;
            // /systems/mine, not /venue/info: the latter only lists systems
            // when the club has table bookings switched on, so the picker was
            // empty for every club without a venue. This one is club-scoped to
            // the systems actually enabled here, which is also exactly the set
            // the create endpoint will accept.
            systems = ((await getMySystemRows()) ?? []) as any;
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
    /* Past is by date as well as status: an event whose day has gone by is
       past even if nobody marked it finished (Clash of Generals sat under
       Coming up for that reason). Today in the UK, as YYYY-MM-DD. */
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    const isPast = (t: T) => t.status === 'finished' || (t.end_date ?? t.date) < today;
    const upcoming = $derived(list.filter((t) => !isPast(t)));
    const past = $derived(list.filter(isPast).sort((a, b) => b.date.localeCompare(a.date)));

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

<h1 class="page-title">Events</h1>

{#if creating}
    <section class="panel new-event">
        <h2 class="section-title">New event</h2>
        <div class="form-grid">
            <label class="field">
                <span class="field-label">Name <span class="req">*</span></span>
                <input class="field-input" type="text" bind:value={nName} placeholder="Autumn Open" />
            </label>
            <label class="field">
                <span class="field-label">Game system <span class="req">*</span></span>
                <select class="field-select" bind:value={nSystem} disabled={!systems.length}>
                    <option value="">{systems.length ? 'Choose' : 'No game systems enabled'}</option>
                    {#each systems as s}<option value={s.id}>{s.name}</option>{/each}
                </select>
                {#if !systems.length}
                    <span class="field-hint">No systems enabled yet. Add one under Admin → Systems.</span>
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
        <div class="new-actions">
            <button class="primary-button" type="button" disabled={!canCreate} onclick={create}>Create event</button>
            <button class="secondary-button" type="button" onclick={() => (creating = false)}>Cancel</button>
        </div>
    </section>
{/if}

{#if error}<p class="field-error">{error}</p>{/if}

<div class="list-head">
    <h2 class="section-title">Coming up</h2>
    {#if isAdmin && !creating}
        <button class="new-btn" type="button" onclick={() => (creating = true)}>+ New event</button>
    {/if}
</div>

{#if loading}
    <div class="skeleton"></div>
{:else if upcoming.length === 0}
    <p class="empty">No events coming up</p>
{:else}
    <div class="diary">
        {#each upcoming as t (t.id)}
            <a class="ev" href={`/tournaments/${t.id}`}>
                <div class="ev-img">
                    <!-- A club's own poster if they've set one, else the game
                         system's logo, so every event has a picture without a
                         TO having to find one. -->
                    <img src={t.image_url ?? `/logos/${t.system_slug ?? 'kt'}.png`} alt="" loading="lazy" />
                    <span class="ev-when">
                        <span class="ev-day">{dayNum(t.date)}</span>
                        <span class="ev-mon">{monthShort(t.date)}</span>
                    </span>
                </div>
                <div class="ev-body">
                    <span class={`status status-${t.status}`}>{STATUS_LABEL[t.status] ?? t.status}</span>
                    <h3 class="ev-name">{t.name}</h3>
                    <p class="ev-meta">
                        <b>{dateRangeOf(t)}</b>{#if t.start_time} · {t.start_time}{/if}
                    </p>
                    <p class="ev-meta">
                        {t.system ?? ''}{#if t.points_limit} · <b class="pts">{t.points_limit.toLocaleString('en-GB')} pts</b>{/if}
                        · {t.rounds} round{t.rounds === 1 ? '' : 's'}
                    </p>
                    {#if t.blurb}<p class="ev-blurb">{t.blurb}</p>{/if}
                    <div class="ev-foot">
                        <div class="entries">
                            <span><b>{t.entries}</b>{t.capacity ? ` of ${t.capacity}` : ''} entered{#if t.waitlisted} · <span class="wait">{t.waitlisted} waiting</span>{/if}</span>
                            {#if t.capacity}
                                <span class="track"><span class="fill" style={`width: ${Math.min(100, Math.round((t.entries / t.capacity) * 100))}%`}></span></span>
                            {/if}
                        </div>
                        {#if t.ticket_price_pence}
                            <span class="price">£{(t.ticket_price_pence / 100).toFixed(2)}</span>
                        {/if}
                    </div>
                </div>
            </a>
        {/each}
    </div>
{/if}

{#if past.length}
    <h2 class="section-title past-title">Past events</h2>
    <div class="diary past-diary">
        {#each past as t (t.id)}
            <a class="ev past" href={`/tournaments/${t.id}`}>
                <div class="ev-img">
                    <img src={t.image_url ?? `/logos/${t.system_slug ?? 'kt'}.png`} alt="" loading="lazy" />
                </div>
                <div class="ev-body">
                    <h3 class="ev-name">{t.name}</h3>
                    <p class="ev-meta">{dateRangeOf(t)} · {t.entries} played</p>
                </div>
            </a>
        {/each}
    </div>
{/if}

<style>
    .page-title {
        font-size: 2.4rem;
        font-weight: 700;
        line-height: 1;
        text-transform: uppercase;
        margin: 0 0 1rem;
    }

    .panel {
        padding: 18px 20px;
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 6px;
    }

    .new-event { margin-bottom: 1.2rem; }
    .new-event .section-title { margin: 0 0 0.8rem; }
    .new-actions { display: flex; gap: 8px; }

    .req { color: var(--color-accent); font-weight: 700; }
    .field-hint { font-size: 0.76rem; color: var(--color-text-dim); margin-top: 0.25rem; }
    .req-legend { margin: 0 0 0.8rem; font-size: 0.72rem; color: var(--color-text-dim); }

    .list-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 0.7rem;
    }

    .list-head .section-title { margin: 0; }

    .new-btn {
        min-height: 40px;
        padding: 0 14px;
        background: none;
        border: 1px solid var(--color-accent-border);
        border-radius: 5px;
        color: var(--color-accent);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
    }

    .new-btn:hover { background: rgba(201, 161, 74, 0.08); }

    .skeleton { height: 260px; border-radius: 6px; border: 1px solid #232733; background: #13161e; }
    /* A placeholder in the panel's place, so Coming up never looks missing. */
    .empty {
        margin: 0 0 0.5rem;
        padding: 1.2rem 1.25rem;
        background: #13161e;
        border: 1px dashed #343a47;
        border-radius: 6px;
        font-family: var(--font-heading);
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--color-text-faint);
    }

    .diary {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
        gap: 14px;
    }

    .past-diary { grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); }
    .past-title { margin-top: 1.6rem; }

    .ev {
        display: flex;
        flex-direction: column;
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 6px;
        overflow: hidden;
        text-decoration: none;
        color: inherit;
        transition: border-color 0.12s ease;
    }

    .ev:hover { border-color: var(--color-accent-border); }
    .ev.past { opacity: 0.72; }

    .ev-img {
        position: relative;
        aspect-ratio: 16 / 9;
        background: #0f1218;
        display: grid;
        place-items: center;
        border-bottom: 1px solid #232733;
    }

    .ev-img img { max-width: 72%; max-height: 72%; object-fit: contain; }
    .ev.past .ev-img { aspect-ratio: 21 / 9; }

    /* The date as a diary entry rather than another line of text. */
    .ev-when {
        position: absolute;
        top: 10px;
        left: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 4px 10px;
        border-radius: 5px;
        background: rgba(10, 11, 14, 0.85);
        border: 1px solid var(--color-accent-border);
        line-height: 1;
    }

    .ev-day { font-family: var(--font-heading); font-size: 1.5rem; font-weight: 700; color: var(--color-accent); }
    .ev-mon { margin-top: 2px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-text-dim); }

    .ev-body { flex: 1; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }

    /* Bold coloured words, not a pill: green when you can enter, gold while
       it's being played, dim while it's a draft only admins can see. */
    .status {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 0.85rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--color-text-dim);
    }

    .status-open { color: var(--color-win); }
    .status-running { color: var(--color-accent); }
    .status-closed { color: var(--color-text-muted); }
    .status-draft { color: var(--color-text-faint); font-style: italic; }

    .ev-name {
        font-family: var(--font-heading);
        font-size: 1.45rem;
        font-weight: 700;
        line-height: 1.05;
        text-transform: uppercase;
        color: var(--color-text-bright);
    }

    .ev-meta { margin: 0; font-size: 0.88rem; color: var(--color-text-dim); }
    .ev-meta b { color: var(--color-text-bright); font-weight: 600; }
    .ev-meta .pts { color: var(--color-accent); }

    .ev-blurb {
        margin: 4px 0 0;
        font-size: 0.85rem;
        color: var(--color-text-muted);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .ev-foot {
        margin-top: auto;
        padding-top: 10px;
        display: flex;
        align-items: flex-end;
        gap: 12px;
    }

    .entries { flex: 1; display: flex; flex-direction: column; gap: 5px; font-size: 0.85rem; color: var(--color-text-dim); }
    .entries b { color: var(--color-text-bright); font-family: var(--font-heading); font-size: 1.1rem; }
    .track { height: 6px; border-radius: 3px; background: #1c2029; }
    .fill { display: block; height: 6px; border-radius: 3px; background: var(--color-accent); }
    .wait { color: var(--color-accent); }

    .price { font-family: var(--font-heading); font-size: 1.3rem; font-weight: 700; color: var(--color-accent); }

    @media (max-width: 560px) {
        .page-title { font-size: 2.1rem; }
        .panel { padding: 14px 16px; }
    }
</style>
