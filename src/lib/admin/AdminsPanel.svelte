<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import HelpTip from '$lib/HelpTip.svelte';
    import { accountLabel } from '$lib/accountName';

    /**
     * The Admins tab of the club admin page: who holds which system's admin
     * role, granting and removing them, and the club's super-admins. Split out of
     * routes/admin/+page.svelte, which only shows it to a super-admin. Loads the
     * roles and the grantable users when opened; the page used to fetch both at
     * start-up for every visit. General admin styles come from club-admin.css.
     */
    let { scopes }: { scopes: string[] } = $props();

    type RoleEntry = { user_id: number; name: string; discord_name: string | null; player_name: string | null; scope: string };
    type SuperAdminEntry = { user_id: number; name: string; discord_name: string | null; player_name: string | null };
    type RolesData = { roles: RoleEntry[]; super_admins: SuperAdminEntry[] };
    type GrantableUser = { id: number; name: string; discord_name: string | null; player_name: string };

    let rolesData = $state<RolesData | null>(null);
    let grantableUsers = $state<GrantableUser[]>([]);

    let rolesLoading = $state(false);

    // Appoint form state
    let grantUserIdStr = $state('');
    let grantScope = $state('');
    let granting = $state(false);
    let grantError = $state<string | null>(null);

    async function loadRoles() {
        rolesLoading = true;
        const r = await fetch(`${PUBLIC_API_URL}/admin/roles`, { credentials: 'include' });
        if (r.ok) rolesData = await r.json();
        rolesLoading = false;
    }

    async function loadGrantableUsers() {
        const r = await fetch(`${PUBLIC_API_URL}/admin/grantable-users`, { credentials: 'include' });
        if (r.ok) grantableUsers = await r.json();
    }

    const rolesByUser = $derived.by(() => {
        if (!rolesData) return [];
        const map = new Map<number, { name: string; discord_name: string | null; player_name: string | null; scopes: string[] }>();
        for (const role of rolesData.roles) {
            if (!map.has(role.user_id)) {
                map.set(role.user_id, { name: role.name, discord_name: role.discord_name, player_name: role.player_name, scopes: [] });
            }
            map.get(role.user_id)!.scopes.push(role.scope);
        }
        return [...map.entries()].map(([user_id, v]) => ({ user_id, ...v }));
    });

    async function removeRole(userId: number, scope: string) {
        const params = new URLSearchParams({ user_id: String(userId), scope });
        const r = await fetch(`${PUBLIC_API_URL}/admin/roles?${params}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (r.ok) await loadRoles();
    }

    async function grantRole() {
        if (!grantUserIdStr) return;
        granting = true;
        grantError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/roles`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: Number(grantUserIdStr), scope: grantScope }),
        });
        if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            grantError = body.detail || 'Failed to grant role.';
        } else {
            grantUserIdStr = '';
            await loadRoles();
        }
        granting = false;
    }

    function displayName(entry: { name?: string | null; discord_name: string | null; player_name: string | null }): string {
        return accountLabel(entry);
    }

    onMount(() => {
        loadRoles();
        loadGrantableUsers();
    });
</script>

<!-- ══ Admins & Delegates ══ -->
<div class="dash-group">
    <div class="dash-group-header static">
        <span class="dash-group-title">Admins &amp; Delegates</span>
    </div>
    <div class="dash-group-body">
<section class="admin-section sub-section">

    <div class="sub-section">
        <div class="a-head">
            <h4 class="a-title">Super-admins</h4>
            <HelpTip label="super-admins" text="Full control of the club: every system, plus club-level settings like the Club page, admins and table booking. Set directly in the database. A club super-admin can't appoint another one from here." />
            <span class="a-head-end"><span class="a-state">managed via SQL</span></span>
        </div>
        {#if rolesData && rolesData.super_admins.length > 0}
            <ul class="name-list">
                {#each rolesData.super_admins as sa}
                    <li>{displayName(sa)}</li>
                {/each}
            </ul>
        {:else if rolesData}
            <p class="muted">None.</p>
        {:else}
            <p class="muted">…</p>
        {/if}
    </div>

    <div class="sub-section">
        <div class="a-head">
            <h4 class="a-title">Scope roles</h4>
            <HelpTip label="scope roles" text="A scope role makes someone the admin of one game night. They can run its pairings, league, missions, Discord and schedule, but not club-level settings and not any other system." />
        </div>
        {#if rolesLoading}
            <p class="muted">Loading…</p>
        {:else if rolesByUser.length === 0}
            <p class="muted">No scope admins yet.</p>
        {:else}
            <div class="roles-table">
                {#each rolesByUser as person}
                    <div class="roles-row">
                        <div class="roles-person">{displayName(person)}</div>
                        <div class="roles-scopes">
                            {#each person.scopes as scope}
                                <span class="scope-chip">
                                    {scope}
                                    <button
                                        class="remove-btn"
                                        type="button"
                                        title="Remove {scope} from {displayName(person)}"
                                        onclick={() => removeRole(person.user_id, scope)}
                                    >×</button>
                                </span>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <div class="sub-section">
        <h4 class="a-title">Appoint an admin</h4>
        <form class="appoint-form" onsubmit={(e) => { e.preventDefault(); grantRole(); }}>
            <div class="field">
                <label class="field-label" for="grant-user">User</label>
                <select id="grant-user" class="field-select" bind:value={grantUserIdStr}>
                    <option value="">Select user</option>
                    {#each grantableUsers as u}
                        <option value={String(u.id)}>{accountLabel(u)}</option>
                    {/each}
                </select>
            </div>
            <div class="field">
                <label class="field-label" for="grant-scope">Scope</label>
                <select id="grant-scope" class="field-select" bind:value={grantScope}>
                    <option value="">Select scope</option>
                    {#each scopes as s}
                        <option>{s}</option>
                    {/each}
                </select>
            </div>
            {#if grantError}
                <p class="field-error">{grantError}</p>
            {/if}
            <button
                type="submit"
                class="primary-button"
                disabled={!grantUserIdStr || !grantScope || granting}
            >
                {granting ? 'Appointing…' : 'Appoint'}
            </button>
        </form>
    </div>
</section>
    </div>
</div>

<style>
    .name-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }

    .name-list li {
        font-size: 0.9rem;
        color: var(--color-text-base);
        padding: 6px 0;
        background: none;
        border-radius: 0;
        border: none;
        border-bottom: 1px solid var(--color-steel-border);
        display: inline-block;
        width: fit-content;
    }

    .roles-table {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .roles-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 8px 10px;
        background: rgba(0, 0, 0, 0.15);
        border: 1px solid var(--color-accent-border-soft);
        border-radius: var(--radius);
        flex-wrap: wrap;
    }

    .roles-person {
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--color-text-bright);
        min-width: 160px;
    }

    .roles-scopes {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .scope-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        background: rgba(201, 161, 74, 0.12);
        border: 1px solid rgba(201, 161, 74, 0.35);
        color: var(--color-accent);
        font-size: 0.78rem;
        font-weight: 600;
        padding: 2px 8px 2px 10px;
        border-radius: 999px;
    }
    .name-list > *:last-child {
        border-bottom: none;
    }
</style>
