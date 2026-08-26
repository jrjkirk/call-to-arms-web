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

    const short = $derived((plan?.unseated ?? []).length);
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

        {#if short}
            <p class="field-error">
                {short} game{short === 1 ? '' : 's'} with nowhere to sit — every table is held
                for something else or already booked.
            </p>
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
