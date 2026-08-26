<script lang="ts">
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from './HelpTip.svelte';

    /** One club night's table plan for one date.
     *
     *  The venue's side of the pairings, and only the venue's side: players
     *  are told who they're playing, never where to sit. A table number in a
     *  Discord post goes stale the moment staff move a game, and there is
     *  nobody standing in the room to correct it. */
    let { date, night, onchange }:
        { date: string; night: any; onchange?: () => void } = $props();

    let plan = $state<any>(null);
    let busy = $state(false);
    let error = $state<string | null>(null);
    // Open by default once a plan exists: staff opening the diary on the night
    // want to see where people are sitting, not a button that reveals it.
    let open = $state(true);

    async function load() {
        const r = await fetch(
            `${PUBLIC_API_URL}/venue/admin/seating?night_id=${night.night_id}&date=${date}`,
            { credentials: 'include' }
        );
        plan = r.ok ? await r.json() : null;
        if (!r.ok) error = 'Could not load tonight’s table plan.';
    }
    // Reloads when the day changes, and when the night's own seating summary
    // does — regenerating from anywhere should be visible here.
    $effect(() => { date; night.night_id; night.seating?.tables_seated; load(); });

    async function post(path: string, body: any) {
        busy = true; error = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/seating/${path}`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ night_id: night.night_id, date, ...body })
        });
        if (r.ok) { plan = await r.json(); open = true; onchange?.(); }
        else error = (await r.json().catch(() => ({}))).detail ?? 'That didn’t work.';
        busy = false;
    }

    const short = $derived((plan?.unseated ?? []).length);
    const spare = $derived((plan?.spare_tables ?? []).length);
</script>

{#if plan?.measurable}
    <div class="seating">
        <div class="s-head">
            <h3 class="a-subtitle">
                Tonight’s tables
                <HelpTip
                    label="tonight's tables"
                    text={'What this night actually needs, from its own pairings: one table per game, none for a bye.\n\nEach game is put on a real table so staff know where to send people. Players are never told — the pairings post says who you\'re playing, not where to sit.'}
                />
            </h3>
            {#if plan.generated_at}
                <button class="chip" type="button" onclick={() => (open = !open)}>
                    {open ? 'Hide' : 'Show'} the {plan.games.length} game{plan.games.length === 1 ? '' : 's'}
                </button>
            {/if}
        </div>

        {#if !plan.has_pairings}
            <p class="a-note">
                No pairings for {plan.week} yet. Once they’re generated, this works out
                how many of the {plan.tables_held} held tables the night actually needs.
            </p>
        {:else}
            <p class="a-note s-summary">
                <strong>{plan.tables_needed}</strong>
                table{plan.tables_needed === 1 ? '' : 's'} needed
                {#if plan.byes.length}
                    <span class="s-quiet">
                        ({plan.byes.length} bye{plan.byes.length === 1 ? '' : 's'} — no table)
                    </span>
                {/if}
                {#if plan.tables_held}
                    · <strong>{plan.released ? plan.tables_held - spare : plan.tables_held}</strong>
                    held{#if plan.released}<span class="s-quiet">, {spare} back on sale</span>{/if}
                {/if}
                {#if !plan.published}
                    <span class="s-quiet">· pairings aren’t published yet</span>
                {/if}
            </p>

            {#if !plan.generated_at}
                <button class="primary-button" type="button" disabled={busy}
                        onclick={() => post('generate', {})}>
                    {busy ? 'Laying out…' : 'Lay out the tables'}
                </button>
            {:else}
                <div class="s-actions">
                    <button class="secondary-button" type="button" disabled={busy}
                            onclick={() => post('generate', {})}>
                        {busy ? 'Working…' : 'Update for the latest pairings'}
                    </button>
                </div>
            {/if}

            {#if short}
                <p class="field-error">
                    {short} game{short === 1 ? '' : 's'} with nowhere to sit — every table is
                    held for something else or already booked. Free one up, or they’re playing
                    on the floor.
                </p>
            {/if}

            {#if plan.generated_at && spare}
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

            {#if open && plan.games.length}
                <div class="games">
                    {#each plan.games as g, i}
                        <div class="game" class:unseated={!g.table_id}>
                            <span class="g-n">{i + 1}</span>
                            <span class="g-who">
                                <strong>{g.a}</strong> v <strong>{g.b}</strong>
                                {#if g.prearranged}<span class="s-quiet">· pre-arranged</span>{/if}
                            </span>
                            <span class="g-table">
                                <select class="field-select" disabled={busy}
                                        value={g.table_id ?? ''}
                                        onchange={(e) => post('move', {
                                            pairing_id: g.pairing_id,
                                            table_id: e.currentTarget.value
                                                ? Number(e.currentTarget.value) : null
                                        })}>
                                    <option value="">No table</option>
                                    {#each plan.table_options as t}
                                        <option value={t.id}>{t.name}{t.size ? ` · ${t.size}` : ''}</option>
                                    {/each}
                                    <!-- A locked seat can sit on a table that has since
                                         been booked or unheld, so its own option may not
                                         be in the candidate list. Without this the picker
                                         would show the game as having no table at all. -->
                                    {#if g.table_id && !plan.table_options.some((t: any) => t.id === g.table_id)}
                                        <option value={g.table_id}>{g.table} (kept)</option>
                                    {/if}
                                </select>
                                {#if g.locked}
                                    <span class="lock" title="You put this one here. Updating leaves it alone.">📌</span>
                                {/if}
                            </span>
                        </div>
                    {/each}
                    {#each plan.byes as b}
                        <div class="game bye">
                            <span class="g-n">—</span>
                            <span class="g-who"><strong>{b.a}</strong> has a bye</span>
                            <span class="g-table s-quiet">No table needed</span>
                        </div>
                    {/each}
                </div>
            {/if}
        {/if}

        {#if error}<p class="field-error">{error}</p>{/if}
    </div>
{/if}

<style>
    .seating {
        margin: 0.9rem 0 0.2rem;
        padding: 0.8rem 0.9rem;
        border: 1px solid var(--color-steel-border);
        border-radius: 8px;
        background: color-mix(in srgb, var(--color-panel) 60%, transparent);
    }
    .s-head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.6rem; }
    .s-summary { margin: 0.2rem 0 0.6rem; }
    .s-quiet { color: var(--color-text-faint); }
    .s-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    .spare {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
        flex-wrap: wrap;
        margin-top: 0.7rem;
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

    .games { margin-top: 0.7rem; display: flex; flex-direction: column; gap: 0.3rem; }
    .game {
        display: grid;
        grid-template-columns: 1.4rem 1fr auto;
        align-items: center;
        gap: 0.6rem;
        padding: 0.35rem 0.5rem;
        border-radius: 5px;
        background: color-mix(in srgb, var(--color-panel) 70%, transparent);
    }
    .game.unseated { border: 1px solid var(--color-loss); }
    .game.bye { opacity: 0.65; }
    .g-n { color: var(--color-text-faint); font-size: 0.78rem; text-align: right; }
    .g-who { font-size: 0.86rem; }
    .g-table { display: flex; align-items: center; gap: 0.35rem; }
    .g-table .field-select { min-width: 9rem; font-size: 0.8rem; padding: 0.25rem 0.4rem; }
    .lock { font-size: 0.75rem; }
</style>
