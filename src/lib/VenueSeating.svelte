<script lang="ts">
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from './HelpTip.svelte';

    /** One club night's table plan for one date — the part of it the floor plan
     *  can't say.
     *
     *  The plan itself shows which tables are in use and who is on them, so
     *  there's no list of games here: it would be the same information, longer
     *  and in a worse order. What's left is the arithmetic and the one decision
     *  attached to it — how many held tables the night turns out not to need,
     *  and whether to put them back on sale.
     *
     *  Laying out happens automatically when the pairings are published; the
     *  button is for the case where the pairings changed afterwards. */
    let { date, night, onchange }:
        { date: string; night: any; onchange?: () => void } = $props();

    let plan = $state<any>(null);
    let busy = $state(false);
    let error = $state<string | null>(null);

    async function load() {
        const r = await fetch(
            `${PUBLIC_API_URL}/venue/admin/seating?night_id=${night.night_id}&date=${date}`,
            { credentials: 'include' }
        );
        plan = r.ok ? await r.json() : null;
    }
    $effect(() => { date; night.night_id; night.seating?.tables_seated; load(); });

    async function post(path: string, body: any) {
        busy = true; error = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/seating/${path}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ night_id: night.night_id, date, ...body })
        });
        if (r.ok) { plan = await r.json(); onchange?.(); }
        else error = (await r.json().catch(() => ({}))).detail ?? 'That didn’t work.';
        busy = false;
    }

    const spare = $derived((plan?.spare_tables ?? []).length);
    /** Worth showing at all? A night with no pairings and nothing spare has
     *  nothing to say that the plan above hasn't already said. */
    const useful = $derived(!!plan?.measurable && (plan.has_pairings || spare > 0));
</script>

{#if useful}
    <div class="seating">
        <div class="s-line">
            <span class="s-what">
                <strong>{plan.system_name ?? night.system}</strong>
                <HelpTip
                    label="tonight's tables"
                    text={'Worked out from this night\'s own pairings: one table per game, none for a bye. It runs by itself when the pairings are published.\n\nWho is on which table is drawn on the plan above — click a table to see the game.'}
                />
                <!-- Games and held tables, both counted rather than derived. An
                     "X of Y in use" phrasing kept coming out subtly wrong,
                     because held-minus-spare also picks up tables that are
                     booked or belong to another night — and the spare box
                     below says the useful half of it exactly. -->
                <span class="s-quiet">
                    {plan.tables_needed} game{plan.tables_needed === 1 ? '' : 's'}{#if plan.byes.length}, {plan.byes.length} bye{plan.byes.length === 1 ? '' : 's'}{/if}
                    {#if plan.tables_held}· {plan.tables_held} tables held{/if}
                    {#if !plan.published}· pairings aren’t published yet{/if}
                </span>
            </span>

            {#if plan.has_pairings}
                <button class="s-refresh" type="button" disabled={busy}
                        title="Only needed if the pairings changed after they were published"
                        onclick={() => post('generate', {})}>
                    {busy ? 'Working…' : plan.generated_at ? 'Re-check' : 'Lay out'}
                </button>
            {/if}
        </div>

        {#if plan.needs_table.length}
            <!-- The ONLY games anyone has to do anything about. Everything that
                 fitted inside the night's own tables is on the plan above and
                 needs no decision; these are over the allocation, so somebody
                 has to choose a table that belongs to somebody else. -->
            <div class="overflow">
                <p class="o-head">
                    <strong>{plan.needs_table.length} game{plan.needs_table.length === 1 ? '' : 's'}
                    with no table.</strong>
                    <span class="s-quiet">
                        {plan.tables_needed} games, {plan.tables_held} tables held for this night —
                        pick a table for {plan.needs_table.length === 1 ? 'it' : 'each'}, or
                        {plan.needs_table.length === 1 ? "it's" : "they're"} playing on the floor.
                    </span>
                </p>
                {#each plan.needs_table as g (g.pairing_id)}
                    <div class="o-row">
                        <span class="o-who">
                            <strong>{g.a}</strong> v <strong>{g.b}</strong>
                            <span class="s-quiet">{[g.a_eta && `${g.a} here ${g.a_eta}`,
                                                    g.b_eta && `${g.b} here ${g.b_eta}`]
                                                    .filter(Boolean).join(' · ')}</span>
                        </span>
                        <select class="field-select" disabled={busy} value=""
                                onchange={(e) => post('move', {
                                    pairing_id: g.pairing_id,
                                    table_id: Number(e.currentTarget.value)
                                })}>
                            <option value="" disabled>Put them on…</option>
                            {#each plan.table_options as t}
                                <option value={t.id}>
                                    {t.name}{t.size ? ` · ${t.size}` : ''}{t.taken_by
                                        ? ` — ${t.taken_by} would move off`
                                        : t.allocated ? '' : ' — not held for this night'}
                                </option>
                            {/each}
                        </select>
                    </div>
                {/each}
            </div>
        {/if}

        {#if spare}
            <div class="spare" class:released={plan.released}>
                <div>
                    <strong>{spare} table{spare === 1 ? '' : 's'} going spare:</strong>
                    {plan.spare_tables.join(', ')}
                    <p class="s-quiet">
                        {#if plan.released}
                            Back on sale — the public can book {spare === 1 ? 'it' : 'them'} tonight.
                        {:else}
                            Held for this night, but tonight’s games don’t need
                            {spare === 1 ? 'it' : 'them'}.
                        {/if}
                    </p>
                </div>
                <button class={plan.released ? 'secondary-button' : 'primary-button'}
                        type="button" disabled={busy}
                        onclick={() => post('release', { released: !plan.released })}>
                    {plan.released ? 'Hold them again' : 'Put them back on sale'}
                </button>
            </div>
        {/if}

        {#if error}<p class="field-error">{error}</p>{/if}
    </div>
{/if}

<style>
    .seating { margin: 0.6rem 0 0.2rem; }

    .s-line {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.8rem;
        flex-wrap: wrap;
    }
    .s-what { font-size: 0.86rem; }
    .s-quiet { color: var(--color-text-faint); }

    .s-refresh {
        background: transparent;
        border: none;
        color: var(--color-text-faint);
        font-family: inherit;
        font-size: 0.74rem;
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
    }
    .s-refresh:hover:not(:disabled) { color: var(--color-accent); }
    .s-refresh:disabled { cursor: default; }

    .overflow {
        margin-top: 0.5rem;
        padding: 0.6rem 0.7rem;
        border-radius: 6px;
        border: 1px solid color-mix(in srgb, var(--color-loss) 45%, transparent);
        background: color-mix(in srgb, var(--color-loss) 8%, transparent);
    }
    .o-head { margin: 0 0 0.45rem; font-size: 0.86rem; }
    .o-head .s-quiet { display: block; font-size: 0.78rem; margin-top: 0.1rem; }
    .o-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.7rem;
        flex-wrap: wrap;
        padding: 0.3rem 0;
    }
    .o-who { font-size: 0.86rem; }
    .o-who .s-quiet { margin-left: 0.4rem; font-size: 0.76rem; }
    .o-row .field-select {
        font-size: 0.78rem;
        padding: 0.22rem 0.4rem;
        /* Doesn't stretch: wrapped onto its own line it went full-bleed, which
           made a one-line decision look like a form. */
        flex: 0 1 24rem;
        min-width: 12rem;
    }

    .spare {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
        flex-wrap: wrap;
        margin-top: 0.5rem;
        padding: 0.6rem 0.7rem;
        border-radius: 6px;
        border: 1px solid var(--color-accent-border);
        background: color-mix(in srgb, var(--color-accent) 8%, transparent);
    }
    .spare.released {
        border-color: var(--color-win);
        background: color-mix(in srgb, var(--color-win) 10%, transparent);
    }
    .spare p { margin: 0.15rem 0 0; font-size: 0.8rem; }
</style>
