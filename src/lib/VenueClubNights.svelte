<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from './HelpTip.svelte';

    type Table = { id: number; name: string; size_label: string | null; seats: number; active: boolean };
    type Review = {
        expected_tables: number | null;
        samples: { date: string; tables_used: number }[];
        average_tables: number | null;
        busiest_tables: number | null;
        advice: string | null;
    };
    type Night = {
        night_id: number; system_id: number | null; app_managed: boolean;
        editable_schedule: boolean;
        system: string; session_day: string | null; session_cadence: string;
        cadence_anchor?: string | null;
        start_time: string | null; expected_tables: number | null; notes: string | null;
        preferred_table_ids: number[]; reserved_table_ids: number[]; review: Review;
    };

    let nights = $state<Night[]>([]);
    let tables = $state<Table[]>([]);
    let savingId = $state<number | null>(null);
    let adding = $state(false);
    let newNight = $state({ name: '', session_day: 'Thursday', session_cadence: 'weekly',
                            cadence_anchor: '', start_time: '18:30', expected_tables: null as number | null });
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let error = $state<string | null>(null);
    let message = $state<string | null>(null);

    async function load() {
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/club-nights`, { credentials: 'include' });
        if (!r.ok) { error = 'Could not load your club nights.'; return; }
        const body = await r.json();
        nights = body.club_nights;
        tables = body.tables;
    }
    onMount(load);

    // Three states per table, because a table can be unrelated to a game, good
    // for it, or held for it — and "held" has to imply "good for it".
    function stateOf(n: Night, id: number): 'none' | 'preferred' | 'reserved' {
        if (n.reserved_table_ids.includes(id)) return 'reserved';
        if (n.preferred_table_ids.includes(id)) return 'preferred';
        return 'none';
    }

    function cycle(n: Night, id: number) {
        const s = stateOf(n, id);
        n.preferred_table_ids = n.preferred_table_ids.filter((t) => t !== id);
        n.reserved_table_ids = n.reserved_table_ids.filter((t) => t !== id);
        if (s === 'none') n.preferred_table_ids = [...n.preferred_table_ids, id];
        else if (s === 'preferred') {
            n.preferred_table_ids = [...n.preferred_table_ids, id];
            n.reserved_table_ids = [...n.reserved_table_ids, id];
        }
        nights = nights;
    }

    async function save(n: Night) {
        savingId = n.night_id; error = null; message = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/club-nights`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                night_id: n.night_id,
                // Only a venue-only night owns its own schedule; a Call to Arms
                // night reads its day and cadence from the game system, and
                // sending them back would let the two fork.
                ...(n.editable_schedule
                    ? { name: n.system, session_day: n.session_day,
                        session_cadence: n.session_cadence,
                        cadence_anchor: n.cadence_anchor || null,
                        start_time: n.start_time }
                    : {}),
                expected_tables: n.expected_tables === null || n.expected_tables === ('' as any)
                    ? null : Number(n.expected_tables),
                notes: n.notes,
                preferred_table_ids: n.preferred_table_ids,
                reserved_table_ids: n.reserved_table_ids
            })
        });
        if (r.ok) {
            const body = await r.json();
            nights = body.club_nights;
            tables = body.tables;
            message = 'Saved.';
        } else {
            error = (await r.json().catch(() => ({}))).detail || 'Save failed.';
        }
        savingId = null;
    }

    function cadence(n: Night): string {
        if (!n.session_day) return 'No day set';
        const every = n.session_cadence === 'fortnightly' ? 'Every other' : 'Every';
        return `${every} ${n.session_day}${n.start_time ? ` · ${n.start_time}` : ''}`;
    }

    async function addNight() {
        adding = true; error = null; message = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/club-nights`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: newNight.name,
                session_day: newNight.session_day,
                session_cadence: newNight.session_cadence,
                cadence_anchor: newNight.cadence_anchor || null,
                start_time: newNight.start_time,
                expected_tables: newNight.expected_tables
            })
        });
        if (r.ok) {
            const body = await r.json();
            nights = body.club_nights;
            tables = body.tables;
            newNight = { name: '', session_day: 'Thursday', session_cadence: 'weekly',
                         cadence_anchor: '', start_time: '18:30', expected_tables: null };
            message = 'Club night added.';
        } else {
            error = (await r.json().catch(() => ({}))).detail || 'Could not add that night.';
        }
        adding = false;
    }

    async function removeNight(n: Night) {
        if (!confirm(`Remove ${n.system} from your diary?`)) return;
        error = null; message = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/club-nights/${n.night_id}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (r.ok) { await load(); message = `${n.system} removed.`; }
        else error = (await r.json().catch(() => ({}))).detail || 'Could not remove it.';
    }
    function adviceTone(r: Review): string {
        if (!r.advice) return 'none';
        if (r.expected_tables === null) return 'info';
        if (r.busiest_tables !== null && r.busiest_tables > r.expected_tables) return 'short';
        if (r.busiest_tables !== null && r.busiest_tables <= r.expected_tables - 2) return 'spare';
        return 'good';
    }
</script>

{#if nights.length === 0}
    <div class="a-card">
        <div class="a-head"><h2 class="a-title">Club nights</h2></div>
        <p class="a-note">This club doesn't run any game nights yet.</p>
    </div>
{/if}

{#each nights as n (n.night_id)}
    <div class="a-card">
        <div class="a-head">
            {#if n.editable_schedule}
                <input class="night-name" bind:value={n.system} aria-label="Club night name" />
            {:else}
                <h2 class="a-title">{n.system}</h2>
            {/if}
            <HelpTip
                label="club night tables"
                text={"Set aside how many tables this night needs, and which ones are its own.\n\nTap a table once for \"suits this game\" — it'll be offered first to anyone booking it. Tap again for \"held\", and the public can't book it at all on this night. Staff still can.\n\nThe review underneath checks your number against real published pairings, one pairing to a table."}
            />
            <span class="a-head-end a-state" class:is-on={n.reserved_table_ids.length > 0}>
                {cadence(n)}
            </span>
        </div>

        {#if n.editable_schedule}
            <!-- A venue-only night has no game system behind it, so this screen
                 is the only record of when it runs. -->
            <div class="sched-row">
                <label class="field sched-day">
                    <span class="field-label">Day</span>
                    <select class="field-select" bind:value={n.session_day}>
                        {#each DAYS as d}<option value={d}>{d}</option>{/each}
                    </select>
                </label>
                <label class="field sched-cad">
                    <span class="field-label">How often</span>
                    <select class="field-select" bind:value={n.session_cadence}>
                        <option value="weekly">Weekly</option>
                        <option value="fortnightly">Fortnightly</option>
                    </select>
                </label>
                {#if n.session_cadence === 'fortnightly'}
                    <label class="field sched-anchor">
                        <span class="field-label">
                            A date it ran
                            <HelpTip label="fortnightly anchor" text={"Any date this night actually ran. We count fortnights from there to work out which weeks it falls on."} />
                        </span>
                        <input class="field-input" type="date" bind:value={n.cadence_anchor} />
                    </label>
                {/if}
                <label class="field sched-time">
                    <span class="field-label">Starts</span>
                    <input class="field-input" type="time" bind:value={n.start_time} />
                </label>
            </div>
        {/if}

        <div class="plan-row">
            <label class="field plan-count">
                <span class="field-label">Tables needed</span>
                <input class="field-input" type="number" min="0" max="200"
                       bind:value={n.expected_tables} placeholder="—" />
            </label>
            <label class="field plan-notes">
                <span class="field-label">Notes <span class="field-label-hint">(staff only)</span></span>
                <input class="field-input" type="text" bind:value={n.notes}
                       placeholder="Terrain goes out at 6" />
            </label>
        </div>

        <h3 class="a-subtitle">Its tables</h3>
        <div class="table-grid">
            {#each tables as t (t.id)}
                {@const st = stateOf(n, t.id)}
                <button class="tchip" class:preferred={st === 'preferred'} class:reserved={st === 'reserved'}
                        class:inactive={!t.active} type="button" onclick={() => cycle(n, t.id)}>
                    <span class="tchip-name">{t.name}</span>
                    <span class="tchip-size">{t.size_label ?? `${t.seats}p`}</span>
                    <span class="tchip-state">
                        {st === 'reserved' ? 'Held' : st === 'preferred' ? 'Suits' : '—'}
                    </span>
                </button>
            {/each}
        </div>
        <p class="a-note">
            {n.reserved_table_ids.length} held from the public on this night ·
            {n.preferred_table_ids.length} offered first to anyone booking {n.system}
        </p>

        <h3 class="a-subtitle">How the plan is holding up</h3>
        {#if !n.review.measurable}
            <p class="a-note">
                This night doesn't run through Call to Arms, so there are no pairings to
                check your plan against. Set the number you need and hold its tables below.
            </p>
        {:else if n.review.samples.length === 0}
            <p class="a-note">No published pairings yet, so there's nothing to compare against.</p>
        {:else}
            <div class="review">
                <div class="bars">
                    {#each n.review.samples as s}
                        {@const peak = Math.max(n.review.busiest_tables ?? 1, n.expected_tables ?? 1)}
                        <span class="bar" title="{s.date}: {s.tables_used} tables">
                            <span class="bar-fill" style="height: {(s.tables_used / peak) * 100}%"></span>
                        </span>
                    {/each}
                    {#if n.expected_tables}
                        {@const peak = Math.max(n.review.busiest_tables ?? 1, n.expected_tables)}
                        <span class="bar-plan" style="bottom: {(n.expected_tables / peak) * 100}%"></span>
                    {/if}
                </div>
                <div class="review-nums">
                    <span><strong>{n.review.average_tables}</strong> average</span>
                    <span><strong>{n.review.busiest_tables}</strong> busiest</span>
                    <span>over {n.review.samples.length} session{n.review.samples.length === 1 ? '' : 's'}</span>
                </div>
            </div>
            {#if n.review.advice}
                <p class="advice" class:short={adviceTone(n.review) === 'short'}
                   class:good={adviceTone(n.review) === 'good'}>{n.review.advice}</p>
            {/if}
        {/if}

        <div class="night-actions">
            <button class="primary-button" type="button" disabled={savingId === n.night_id}
                    onclick={() => save(n)}>
                {savingId === n.night_id ? 'Saving…' : 'Save'}
            </button>
            {#if !n.app_managed}
                <button class="danger-button" type="button" onclick={() => removeNight(n)}>Remove</button>
            {/if}
        </div>
    </div>
{/each}

<div class="a-card">
    <div class="a-head">
        <h2 class="a-title">Add a club night</h2>
        <HelpTip
            label="other club nights"
            text={"For a night this app doesn't run — Magic, Bolt Action, Warmachine.\n\nNobody signs up to it here and no pairings are generated, so there's nothing to check a plan against. It still holds its tables and still shows in your diary, which is what stops the public booking over it."}
        />
    </div>
    <p class="a-note">
        Your Call to Arms game nights are already listed above. Add anything else that
        takes up your tables.
    </p>
    <div class="add-grid">
        <label class="field add-name">
            <span class="field-label">Name</span>
            <input class="field-input" type="text" bind:value={newNight.name}
                   placeholder="Magic the Gathering" />
        </label>
        <label class="field">
            <span class="field-label">Day</span>
            <select class="field-select" bind:value={newNight.session_day}>
                {#each DAYS as d}<option value={d}>{d}</option>{/each}
            </select>
        </label>
        <label class="field">
            <span class="field-label">How often</span>
            <select class="field-select" bind:value={newNight.session_cadence}>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
            </select>
        </label>
        {#if newNight.session_cadence === 'fortnightly'}
            <label class="field">
                <span class="field-label">A date it ran</span>
                <input class="field-input" type="date" bind:value={newNight.cadence_anchor} />
            </label>
        {/if}
        <label class="field">
            <span class="field-label">Starts</span>
            <input class="field-input" type="time" bind:value={newNight.start_time} />
        </label>
        <label class="field">
            <span class="field-label">Tables needed</span>
            <input class="field-input" type="number" min="0" max="200"
                   bind:value={newNight.expected_tables} placeholder="—" />
        </label>
    </div>
    <button class="primary-button" type="button"
            disabled={adding || !newNight.name.trim()} onclick={addNight}>
        {adding ? 'Adding…' : 'Add club night'}
    </button>
</div>

{#if error}<p class="field-error">{error}</p>{/if}
{#if message}<p class="pairing-message">{message}</p>{/if}

<style>
    .night-name {
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--radius);
        padding: 0.1rem 0.3rem;
        margin: -0.1rem -0.3rem;
        font-family: var(--font-display);
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--panel-accent);
        min-width: 0;
        width: 14rem;
        max-width: 100%;
    }
    .night-name:hover { border-color: var(--color-steel-border); }
    .night-name:focus { outline: none; border-color: var(--color-accent); }

    .sched-row { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
    .sched-day, .sched-cad { flex: 0 0 9rem; }
    .sched-anchor { flex: 0 0 10rem; }
    .sched-time { flex: 0 0 8rem; }

    .night-actions { display: flex; gap: 0.6rem; align-items: center; }
    .night-actions .danger-button { margin-left: auto; }

    .add-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
        gap: 0.6rem;
        margin-bottom: 0.7rem;
    }
    .add-name { grid-column: span 2; }

    .plan-row { display: flex; gap: 0.7rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
    .plan-count { flex: 0 0 8rem; }
    .plan-notes { flex: 1 1 14rem; min-width: 0; }
    .field { display: flex; flex-direction: column; gap: 0.2rem; }

    .table-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.4rem; }

    .tchip {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.1rem;
        min-width: 5.5rem;
        padding: 0.4rem 0.6rem;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        background: rgba(0, 0, 0, 0.2);
        font-family: inherit;
        cursor: pointer;
        text-align: left;
        transition: border-color 0.15s, background 0.15s;
    }
    .tchip:hover { border-color: var(--color-accent-border); }
    .tchip.inactive { opacity: 0.45; }
    .tchip.preferred {
        border-color: var(--color-accent-border);
        background: color-mix(in srgb, var(--color-accent) 10%, transparent);
    }
    .tchip.reserved {
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 20%, transparent);
    }

    .tchip-name { font-size: 0.78rem; font-weight: 700; color: var(--color-text-bright); }
    .tchip-size { font-size: 0.66rem; color: var(--color-text-faint); }
    .tchip-state { font-size: 0.66rem; font-weight: 700; color: var(--color-text-muted); }
    .tchip.preferred .tchip-state, .tchip.reserved .tchip-state { color: var(--color-accent); }

    .review { display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.5rem; }

    /* Sparkline of recent sessions with the plan drawn across it, so "we keep
       needing more than we lay out" is visible before the sentence is read. */
    .bars {
        position: relative;
        display: flex;
        align-items: flex-end;
        gap: 3px;
        height: 3rem;
        padding: 0 2px;
    }
    .bar {
        display: flex;
        align-items: flex-end;
        width: 12px;
        height: 100%;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 2px;
    }
    .bar-fill { width: 100%; background: var(--color-accent); border-radius: 2px; }
    /* The plan drawn across the actuals — the whole point of the chart, so it
       has to read at a glance rather than hide behind the bars. */
    .bar-plan {
        position: absolute;
        left: -3px;
        right: -3px;
        height: 0;
        border-top: 2px dashed var(--color-text-bright);
        opacity: 0.75;
    }

    .review-nums {
        display: flex;
        gap: 0.9rem;
        font-size: 0.78rem;
        color: var(--color-text-muted);
        flex-wrap: wrap;
    }
    .review-nums strong { color: var(--color-text-bright); font-size: 0.95rem; }

    .advice {
        margin: 0 0 0.7rem;
        font-size: 0.84rem;
        color: var(--color-text-muted);
    }
    .advice.short { color: var(--color-loss); font-weight: 600; }
    .advice.good { color: var(--color-win); }
</style>
