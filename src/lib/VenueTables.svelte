<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from './HelpTip.svelte';

    type Table = {
        id: number; name: string; size_label: string | null; seats: number;
        active: boolean; sort_order: number; notes: string | null;
    };

    let tables = $state<Table[]>([]);
    let error = $state<string | null>(null);
    let message = $state<string | null>(null);
    let newName = $state('');
    let newSize = $state('6x4');
    let newSeats = $state(2);
    let saving = $state(false);

    async function load() {
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/tables`, { credentials: 'include' });
        if (r.ok) tables = await r.json();
    }
    onMount(load);

    async function add() {
        if (!newName.trim()) return;
        saving = true; error = null; message = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/tables`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: newName, size_label: newSize, seats: newSeats,
                active: true, sort_order: tables.length + 1
            })
        });
        if (r.ok) { newName = ''; await load(); message = 'Table added.'; }
        else error = (await r.json().catch(() => ({}))).detail || 'Could not add that table.';
        saving = false;
    }

    async function save(t: Table) {
        error = null; message = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/tables/${t.id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(t)
        });
        if (r.ok) message = 'Saved.';
        else error = (await r.json().catch(() => ({}))).detail || 'Save failed.';
    }

    async function remove(t: Table) {
        if (!confirm(`Delete ${t.name}?`)) return;
        error = null; message = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/tables/${t.id}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (r.ok) { await load(); message = `${t.name} deleted.`; }
        // The API refuses to delete a table that has bookings and explains why.
        // That explanation is the useful part, so it's shown as written.
        else error = (await r.json().catch(() => ({}))).detail || 'Delete failed.';
    }
</script>

<div class="a-card">
    <div class="a-head">
        <h2 class="a-title">Tables</h2>
        <HelpTip
            label="tables"
            text={"What the public can book. Bookings are put on the smallest table that fits the party, so a pair doesn't take your only big board.\n\nTurn a table off to stop new bookings without losing the old ones — that's what to do for a table that's out of service, or one you want to keep back for club nights."}
        />
        <span class="a-head-end a-state" class:is-on={tables.some((t) => t.active)}>
            {tables.filter((t) => t.active).length} bookable
        </span>
    </div>

    {#if tables.length === 0}
        <p class="a-note">No tables yet. Add one below — bookings can't open until there's at least one.</p>
    {/if}

    <div class="table-list">
        {#each tables as t (t.id)}
            <div class="table-row" class:off={!t.active}>
                <input class="field-input t-name" bind:value={t.name} onblur={() => save(t)} />
                <input class="field-input t-size" bind:value={t.size_label} onblur={() => save(t)} placeholder="6x4" />
                <label class="t-seats">
                    <span class="field-label-hint">Seats</span>
                    <input class="field-input" type="number" min="1" max="20" bind:value={t.seats} onblur={() => save(t)} />
                </label>
                <label class="check-row t-active">
                    <input type="checkbox" bind:checked={t.active} onchange={() => save(t)} />
                    <span>Bookable</span>
                </label>
                <button class="danger-button" type="button" onclick={() => remove(t)}>Delete</button>
            </div>
        {/each}
    </div>

    <h3 class="a-subtitle">Add a table</h3>
    <div class="table-row">
        <input class="field-input t-name" bind:value={newName} placeholder="Table 3" />
        <input class="field-input t-size" bind:value={newSize} placeholder="6x4" />
        <label class="t-seats">
            <span class="field-label-hint">Seats</span>
            <input class="field-input" type="number" min="1" max="20" bind:value={newSeats} />
        </label>
        <button class="primary-button" type="button" disabled={saving || !newName.trim()} onclick={add}>Add</button>
    </div>

    {#if error}<p class="field-error">{error}</p>{/if}
    {#if message}<p class="pairing-message">{message}</p>{/if}
</div>

<style>
    .table-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .table-row {
        display: flex;
        gap: 0.5rem;
        align-items: flex-end;
        flex-wrap: wrap;
    }
    .table-row.off { opacity: 0.55; }

    .t-name { flex: 1 1 9rem; min-width: 0; }
    .t-size { flex: 0 0 5rem; }
    .t-seats { flex: 0 0 5rem; display: flex; flex-direction: column; gap: 0.15rem; }
    .t-active { flex: 0 0 auto; }
</style>
