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
        system_id: number; system: string; session_day: string; session_cadence: string;
        start_time: string | null; expected_tables: number | null; notes: string | null;
        preferred_table_ids: number[]; reserved_table_ids: number[]; review: Review;
    };

    let nights = $state<Night[]>([]);
    let tables = $state<Table[]>([]);
    let savingId = $state<number | null>(null);
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
        savingId = n.system_id; error = null; message = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/club-nights`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_id: n.system_id,
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
        const every = n.session_cadence === 'fortnightly' ? 'Every other' : 'Every';
        return `${every} ${n.session_day}${n.start_time ? ` · ${n.start_time}` : ''}`;
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

{#each nights as n (n.system_id)}
    <div class="a-card">
        <div class="a-head">
            <h2 class="a-title">{n.system}</h2>
            <HelpTip
                label="club night tables"
                text={"Set aside how many tables this night needs, and which ones are its own.\n\nTap a table once for \"suits this game\" — it'll be offered first to anyone booking it. Tap again for \"held\", and the public can't book it at all on this night. Staff still can.\n\nThe review underneath checks your number against real published pairings, one pairing to a table."}
            />
            <span class="a-head-end a-state" class:is-on={n.reserved_table_ids.length > 0}>
                {cadence(n)}
            </span>
        </div>

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
        {#if n.review.samples.length === 0}
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

        <button class="primary-button" type="button" disabled={savingId === n.system_id}
                onclick={() => save(n)}>
            {savingId === n.system_id ? 'Saving…' : 'Save'}
        </button>
    </div>
{/each}

{#if error}<p class="field-error">{error}</p>{/if}
{#if message}<p class="pairing-message">{message}</p>{/if}

<style>
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
