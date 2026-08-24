<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from './HelpTip.svelte';

    type Staff = { id: number; user_id: number; discord_name: string | null; player_name: string | null };

    let staff = $state<Staff[]>([]);
    let candidates = $state<{ id: number; discord_name: string; player_name: string }[]>([]);
    let chosen = $state('');
    let error = $state<string | null>(null);
    let message = $state<string | null>(null);

    async function load() {
        const [s, c] = await Promise.all([
            fetch(`${PUBLIC_API_URL}/venue/admin/staff`, { credentials: 'include' }),
            // Reuses the appoint-an-admin candidate list: every user at this
            // club with a linked player. Venue access is granted to the same
            // pool, just through a different door.
            fetch(`${PUBLIC_API_URL}/admin/grantable-users`, { credentials: 'include' })
        ]);
        if (s.ok) staff = await s.json();
        if (c.ok) candidates = await c.json();
    }
    onMount(load);

    async function add() {
        if (!chosen) return;
        error = null; message = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/staff`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: Number(chosen) })
        });
        if (r.ok) { chosen = ''; await load(); message = 'Added.'; }
        else error = (await r.json().catch(() => ({}))).detail || 'Could not add them.';
    }

    async function remove(row: Staff) {
        const who = row.player_name || row.discord_name || 'this person';
        if (!confirm(`Remove venue access for ${who}?`)) return;
        error = null; message = null;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/staff/${row.id}`, {
            method: 'DELETE', credentials: 'include'
        });
        if (r.ok) { await load(); message = 'Removed.'; }
        else error = 'Could not remove them.';
    }
</script>

<div class="a-card">
    <div class="a-head">
        <h2 class="a-title">Venue staff</h2>
        <HelpTip
            label="venue staff"
            text={"Who can open this tab. Venue access is on its own — it gives the diary, tables and settings, and nothing else. Someone running the bar doesn't need to be a game-system admin.\n\nClub super-admins and platform admins already have it and aren't listed here, because this screen can't take it away from them."}
        />
        <span class="a-head-end a-state" class:is-on={staff.length > 0}>{staff.length}</span>
    </div>

    {#if staff.length === 0}
        <p class="a-note">Nobody yet. Club super-admins can already get in.</p>
    {:else}
        <ul class="staff-list">
            {#each staff as row (row.id)}
                <li>
                    <span>{row.player_name || row.discord_name || `User ${row.user_id}`}</span>
                    <button class="danger-button" type="button" onclick={() => remove(row)}>Remove</button>
                </li>
            {/each}
        </ul>
    {/if}

    <h3 class="a-subtitle">Give someone access</h3>
    <div class="add-row">
        <select class="field-select" bind:value={chosen}>
            <option value="">— Choose a person —</option>
            {#each candidates as c}
                <option value={String(c.id)}>{c.player_name} ({c.discord_name})</option>
            {/each}
        </select>
        <button class="primary-button" type="button" disabled={!chosen} onclick={add}>Add</button>
    </div>

    {#if error}<p class="field-error">{error}</p>{/if}
    {#if message}<p class="pairing-message">{message}</p>{/if}
</div>

<style>
    .staff-list {
        list-style: none;
        margin: 0 0 0.5rem;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }
    .staff-list li {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.88rem;
        color: var(--color-text-bright);
    }
    .staff-list li button { margin-left: auto; }

    .add-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .add-row .field-select { flex: 1 1 14rem; min-width: 0; }
</style>
