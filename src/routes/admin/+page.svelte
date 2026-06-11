<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';

    const VALID_SCOPES = ['The Old World', 'The Horus Heresy', 'Kill Team', 'League'];

    type AdminMe = { is_super_admin: boolean; scopes: string[] };
    type RoleEntry = { user_id: number; discord_name: string; player_name: string | null; scope: string };
    type SuperAdminEntry = { user_id: number; discord_name: string; player_name: string | null };
    type RolesData = { roles: RoleEntry[]; super_admins: SuperAdminEntry[] };
    type GrantableUser = { id: number; discord_name: string; player_name: string };

    let adminMe = $state<AdminMe | null>(null);
    let rolesData = $state<RolesData | null>(null);
    let grantableUsers = $state<GrantableUser[]>([]);
    let pageLoading = $state(true);
    let rolesLoading = $state(false);

    // Appoint form state
    let grantUserIdStr = $state('');
    let grantScope = $state(VALID_SCOPES[0]);
    let granting = $state(false);
    let grantError = $state<string | null>(null);

    async function loadAdminMe() {
        const r = await fetch(`${PUBLIC_API_URL}/admin/me`, { credentials: 'include' });
        adminMe = r.ok ? await r.json() : null;
    }

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

    onMount(async () => {
        await loadAdminMe();
        if (adminMe?.is_super_admin) {
            await Promise.all([loadRoles(), loadGrantableUsers()]);
        }
        pageLoading = false;
    });

    // Group admin_roles by person for the roles table
    const rolesByUser = $derived.by(() => {
        if (!rolesData) return [];
        const map = new Map<number, { discord_name: string; player_name: string | null; scopes: string[] }>();
        for (const role of rolesData.roles) {
            if (!map.has(role.user_id)) {
                map.set(role.user_id, { discord_name: role.discord_name, player_name: role.player_name, scopes: [] });
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

    function displayName(entry: { discord_name: string; player_name: string | null }): string {
        return entry.player_name ? `${entry.player_name} (${entry.discord_name})` : entry.discord_name;
    }
</script>

<h2 class="page-heading">Admin</h2>

{#if pageLoading}
    <p class="muted">Loading…</p>
{:else if !adminMe || (!adminMe.is_super_admin && adminMe.scopes.length === 0)}
    <p class="muted">You don't have admin access.</p>
{:else}

    {#if adminMe.is_super_admin}
        <!-- ── Super-admin section ─────────────────────────────────────── -->
        <section class="admin-section">
            <h3 class="section-heading">Manage Admins</h3>

            <!-- Super-admins read-only -->
            <div class="sub-section">
                <h4 class="sub-heading">Super-admins <span class="badge">managed via SQL</span></h4>
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

            <!-- Current scope roles -->
            <div class="sub-section">
                <h4 class="sub-heading">Scope roles</h4>
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
                                                title="Remove {scope} from {person.discord_name}"
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

            <!-- Appoint form -->
            <div class="sub-section">
                <h4 class="sub-heading">Appoint admin</h4>
                <form class="appoint-form" onsubmit={(e) => { e.preventDefault(); grantRole(); }}>
                    <div class="field">
                        <label class="field-label" for="grant-user">User</label>
                        <select id="grant-user" class="field-select" bind:value={grantUserIdStr}>
                            <option value="">— Select user —</option>
                            {#each grantableUsers as u}
                                <option value={String(u.id)}>{u.player_name} ({u.discord_name})</option>
                            {/each}
                        </select>
                    </div>
                    <div class="field">
                        <label class="field-label" for="grant-scope">Scope</label>
                        <select id="grant-scope" class="field-select" bind:value={grantScope}>
                            {#each VALID_SCOPES as s}
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
                        disabled={!grantUserIdStr || granting}
                    >
                        {granting ? 'Appointing…' : 'Appoint'}
                    </button>
                </form>
            </div>
        </section>
    {/if}

    <!-- ── Per-scope cards ──────────────────────────────────────────────── -->
    {#if adminMe.scopes.length > 0}
        <section class="admin-section">
            <h3 class="section-heading">Your Scopes</h3>
            <div class="scope-cards">
                {#each adminMe.scopes as scope}
                    <div class="scope-card">
                        <div class="scope-card-title">{scope}</div>
                        <p class="scope-card-body">Pairings, blocks and history for {scope} will appear here.</p>
                    </div>
                {/each}
            </div>
        </section>
    {/if}

{/if}

<style>
    .page-heading {
        font-size: 1.5rem;
        margin: 0 0 1.5rem;
    }

    .muted {
        color: var(--color-text-muted);
        font-style: italic;
    }

    .admin-section {
        margin-bottom: 2rem;
    }

    .section-heading {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-accent);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 0 0 1rem;
        padding-bottom: 0.4rem;
        border-bottom: 1px solid var(--color-accent-border);
    }

    .sub-section {
        margin-bottom: 1.5rem;
    }

    .sub-heading {
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--color-text-muted);
        margin: 0 0 0.6rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .badge {
        font-size: 0.7rem;
        font-weight: 400;
        text-transform: none;
        letter-spacing: 0;
        background: rgba(148, 163, 184, 0.1);
        border: 1px solid rgba(148, 163, 184, 0.25);
        color: var(--color-text-faint);
        padding: 1px 6px;
        border-radius: 4px;
    }

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
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.15);
        border-radius: 6px;
        border: 1px solid var(--color-accent-border-soft);
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
        border-radius: 8px;
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

    .remove-btn {
        background: none;
        border: none;
        color: var(--color-text-muted);
        cursor: pointer;
        font-size: 1rem;
        line-height: 1;
        padding: 0;
        transition: color 0.15s;
    }

    .remove-btn:hover {
        color: #f87171;
    }

    .appoint-form {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 0.75rem;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        min-width: 180px;
    }

    .field-label {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--color-accent);
    }

    .field-select {
        background: var(--color-surface-dark);
        border: 1px solid var(--color-accent-border);
        border-radius: 6px;
        color: var(--color-text-base);
        padding: 7px 10px;
        font-size: 0.9rem;
        cursor: pointer;
    }

    .field-select:focus {
        outline: none;
        border-color: var(--color-accent);
    }

    .field-error {
        font-size: 0.8rem;
        color: #f87171;
        margin: 0;
        width: 100%;
    }

    .primary-button {
        background: var(--color-accent);
        color: #111;
        border: none;
        border-radius: 8px;
        padding: 8px 18px;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        transition: opacity 0.15s;
        white-space: nowrap;
    }

    .primary-button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }

    .primary-button:not(:disabled):hover {
        opacity: 0.85;
    }

    .scope-cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 1rem;
    }

    .scope-card {
        background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-dark) 100%);
        border: 1px solid var(--color-accent-border);
        border-radius: 12px;
        padding: 1rem 1.2rem;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    }

    .scope-card-title {
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--color-accent);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 0.5rem;
    }

    .scope-card-body {
        font-size: 0.85rem;
        color: var(--color-text-muted);
        font-style: italic;
        margin: 0;
    }
</style>
