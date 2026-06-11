<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';

    const VALID_SCOPES = ['The Old World', 'The Horus Heresy', 'Kill Team', 'League'];

    type AdminMe = { is_super_admin: boolean; scopes: string[] };
    type RoleEntry = { user_id: number; discord_name: string; player_name: string | null; scope: string };
    type SuperAdminEntry = { user_id: number; discord_name: string; player_name: string | null };
    type RolesData = { roles: RoleEntry[]; super_admins: SuperAdminEntry[] };
    type GrantableUser = { id: number; discord_name: string; player_name: string };
    type BlockEntry = {
        block_id: number;
        player_a_id: number;
        player_a_name: string;
        player_b_id: number;
        player_b_name: string;
        note: string | null;
    };
    type BlockPlayer = { id: number; name: string };

    let adminMe = $state<AdminMe | null>(null);
    let rolesData = $state<RolesData | null>(null);
    let grantableUsers = $state<GrantableUser[]>([]);
    let pageLoading = $state(true);
    let rolesLoading = $state(false);

    let blocks = $state<BlockEntry[]>([]);
    let blocksLoading = $state(false);
    let blockPlayers = $state<BlockPlayer[]>([]);
    let historyByScope = $state<Record<string, any[]>>({});
    let historyLoading = $state<Record<string, boolean>>({});

    // Appoint form state
    let grantUserIdStr = $state('');
    let grantScope = $state(VALID_SCOPES[0]);
    let granting = $state(false);
    let grantError = $state<string | null>(null);

    // Add block form state
    let addBlockP1Str = $state('');
    let addBlockP2Str = $state('');
    let addBlockNote = $state('');
    let addingBlock = $state(false);
    let addBlockError = $state<string | null>(null);

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

    async function loadBlocks() {
        blocksLoading = true;
        const r = await fetch(`${PUBLIC_API_URL}/admin/blocks`, { credentials: 'include' });
        if (r.ok) blocks = await r.json();
        blocksLoading = false;
    }

    async function loadBlockPlayers() {
        const r = await fetch(`${PUBLIC_API_URL}/admin/blocks/players`, { credentials: 'include' });
        if (r.ok) blockPlayers = await r.json();
    }

    async function loadHistory(scope: string) {
        historyLoading[scope] = true;
        const r = await fetch(
            `${PUBLIC_API_URL}/admin/history?scope=${encodeURIComponent(scope)}`,
            { credentials: 'include' }
        );
        if (r.ok) historyByScope[scope] = await r.json();
        historyLoading[scope] = false;
    }

    onMount(async () => {
        await loadAdminMe();
        if (!adminMe || (!adminMe.is_super_admin && adminMe.scopes.length === 0)) {
            pageLoading = false;
            return;
        }
        const tasks: Promise<void>[] = [loadBlocks()];
        if (adminMe.is_super_admin) {
            tasks.push(loadRoles(), loadGrantableUsers(), loadBlockPlayers());
        }
        for (const scope of adminMe.scopes) {
            tasks.push(loadHistory(scope));
        }
        await Promise.all(tasks);
        pageLoading = false;
    });

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

    async function addBlock() {
        if (!addBlockP1Str || !addBlockP2Str || addBlockP1Str === addBlockP2Str) return;
        addingBlock = true;
        addBlockError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/blocks`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                player_a_id: Number(addBlockP1Str),
                player_b_id: Number(addBlockP2Str),
                note: addBlockNote.trim() || null,
            }),
        });
        if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            addBlockError = body.detail || 'Failed to add block.';
        } else {
            addBlockP1Str = '';
            addBlockP2Str = '';
            addBlockNote = '';
            await loadBlocks();
        }
        addingBlock = false;
    }

    async function removeBlock(playerAId: number, playerBId: number) {
        const params = new URLSearchParams({
            player_a_id: String(playerAId),
            player_b_id: String(playerBId),
        });
        const r = await fetch(`${PUBLIC_API_URL}/admin/blocks?${params}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (r.ok) await loadBlocks();
    }

    function displayName(entry: { discord_name: string; player_name: string | null }): string {
        return entry.player_name ? `${entry.player_name} (${entry.discord_name})` : entry.discord_name;
    }

    function fmt(f: string | null | undefined): string {
        return f || '—';
    }
</script>

<h2 class="page-heading">Admin</h2>

{#if pageLoading}
    <p class="muted">Loading…</p>
{:else if !adminMe || (!adminMe.is_super_admin && adminMe.scopes.length === 0)}
    <p class="muted">You don't have admin access.</p>
{:else}

    {#if adminMe.is_super_admin}
        <!-- ── Manage Admins ───────────────────────────────────────────────── -->
        <section class="admin-section">
            <h3 class="section-heading">Manage Admins</h3>

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

    <!-- ── Pairing Blocks ─────────────────────────────────────────────── -->
    <section class="admin-section">
        <h3 class="section-heading">Pairing Blocks</h3>
        <p class="section-intro">Blocks prevent two players from being paired. They apply across all systems.</p>

        {#if adminMe.is_super_admin}
            <div class="sub-section">
                <h4 class="sub-heading">Add block</h4>
                <form class="appoint-form" onsubmit={(e) => { e.preventDefault(); addBlock(); }}>
                    <div class="field">
                        <label class="field-label" for="block-p1">Player A</label>
                        <select id="block-p1" class="field-select" bind:value={addBlockP1Str}>
                            <option value="">— Select —</option>
                            {#each blockPlayers as p}
                                <option value={String(p.id)}>{p.name}</option>
                            {/each}
                        </select>
                    </div>
                    <div class="field">
                        <label class="field-label" for="block-p2">Player B</label>
                        <select id="block-p2" class="field-select" bind:value={addBlockP2Str}>
                            <option value="">— Select —</option>
                            {#each blockPlayers as p}
                                <option value={String(p.id)}>{p.name}</option>
                            {/each}
                        </select>
                    </div>
                    <div class="field">
                        <label class="field-label" for="block-note">Note</label>
                        <input
                            id="block-note"
                            class="field-input"
                            type="text"
                            bind:value={addBlockNote}
                            placeholder="optional reason…"
                        />
                    </div>
                    {#if addBlockP1Str && addBlockP2Str && addBlockP1Str === addBlockP2Str}
                        <p class="field-error">Players must be different.</p>
                    {/if}
                    {#if addBlockError}
                        <p class="field-error">{addBlockError}</p>
                    {/if}
                    <button
                        type="submit"
                        class="primary-button"
                        disabled={!addBlockP1Str || !addBlockP2Str || addBlockP1Str === addBlockP2Str || addingBlock}
                    >
                        {addingBlock ? 'Adding…' : 'Add Block'}
                    </button>
                </form>
            </div>
        {/if}

        <div class="sub-section">
            {#if blocksLoading}
                <p class="muted">Loading…</p>
            {:else if blocks.length === 0}
                <p class="muted">No blocks configured.</p>
            {:else}
                <ul class="block-list">
                    {#each blocks as block}
                        <li class="block-row">
                            <span class="block-names">
                                <strong>{block.player_a_name}</strong>
                                <span class="block-x">✕</span>
                                <strong>{block.player_b_name}</strong>
                            </span>
                            {#if block.note}
                                <span class="block-note">{block.note}</span>
                            {/if}
                            {#if adminMe.is_super_admin}
                                <button
                                    class="remove-btn block-remove"
                                    type="button"
                                    title="Remove block"
                                    onclick={() => removeBlock(block.player_a_id, block.player_b_id)}
                                >×</button>
                            {/if}
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>

        {#if !adminMe.is_super_admin}
            <p class="muted small">Block list is managed by the lead admin.</p>
        {/if}
    </section>

    <!-- ── Per-scope history cards ────────────────────────────────────── -->
    {#if adminMe.scopes.length > 0}
        <section class="admin-section">
            <h3 class="section-heading">Your Scopes</h3>
            <div class="scope-cards">
                {#each adminMe.scopes as scope}
                    <div class="scope-card">
                        <div class="scope-card-title">{scope}</div>

                        <div class="sub-section">
                            <h4 class="sub-heading">Recent Games</h4>
                            {#if historyLoading[scope]}
                                <p class="muted small">Loading…</p>
                            {:else if !(historyByScope[scope]?.length)}
                                <p class="muted small">No games recorded yet.</p>
                            {:else if scope === 'League'}
                                <ul class="history-list">
                                    {#each historyByScope[scope] as entry}
                                        <li class="history-row">
                                            <span class="history-date">{entry.date}</span>
                                            <span class="history-matchup">
                                                {entry.p1_name} ({fmt(entry.p1_faction)}) vs {entry.p2_name} ({fmt(entry.p2_faction)})
                                            </span>
                                            <span class="history-result">{entry.result}</span>
                                        </li>
                                    {/each}
                                </ul>
                            {:else}
                                <ul class="history-list">
                                    {#each historyByScope[scope] as entry}
                                        <li class="history-row">
                                            <span class="history-date">{entry.week}</span>
                                            {#if entry.player_b_name}
                                                <span class="history-matchup">
                                                    {entry.player_a_name} ({fmt(entry.player_a_faction)}) vs {entry.player_b_name} ({fmt(entry.player_b_faction)})
                                                </span>
                                            {:else}
                                                <span class="history-matchup">
                                                    {entry.player_a_name} ({fmt(entry.player_a_faction)}) — bye
                                                </span>
                                            {/if}
                                        </li>
                                    {/each}
                                </ul>
                            {/if}
                        </div>
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

    .small {
        font-size: 0.82rem;
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
        margin: 0 0 0.75rem;
        padding-bottom: 0.4rem;
        border-bottom: 1px solid var(--color-accent-border);
    }

    .section-intro {
        font-size: 0.85rem;
        color: var(--color-text-muted);
        margin: 0 0 1rem;
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

    /* ── Blocks ────────────────────────────────────────────────────────── */

    .block-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .block-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 5px 10px;
        background: rgba(0, 0, 0, 0.15);
        border: 1px solid var(--color-accent-border-soft);
        border-radius: 7px;
        font-size: 0.88rem;
        flex-wrap: wrap;
    }

    .block-names {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex: 1;
        min-width: 0;
    }

    .block-x {
        color: var(--color-text-muted);
        font-size: 0.78rem;
    }

    .block-note {
        font-size: 0.78rem;
        color: var(--color-text-dim);
        font-style: italic;
    }

    .block-remove {
        margin-left: auto;
        flex: 0 0 auto;
    }

    /* ── Forms ─────────────────────────────────────────────────────────── */

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
        min-width: 160px;
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

    .field-input {
        background: var(--color-surface-dark);
        border: 1px solid var(--color-accent-border);
        border-radius: 6px;
        color: var(--color-text-base);
        padding: 7px 10px;
        font-size: 0.9rem;
        font-family: inherit;
    }

    .field-input::placeholder {
        color: var(--color-text-faint);
    }

    .field-input:focus {
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

    /* ── Scope cards ────────────────────────────────────────────────────── */

    .scope-cards {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .scope-card {
        background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-dark) 100%);
        border: 1px solid var(--color-accent-border);
        border-radius: 12px;
        padding: 1.2rem 1.4rem;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    }

    .scope-card-title {
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--color-accent);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 1rem;
    }

    /* ── History list ───────────────────────────────────────────────────── */

    .history-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0;
        max-height: 320px;
        overflow-y: auto;
    }

    .history-row {
        display: flex;
        align-items: baseline;
        gap: 0.6rem;
        padding: 4px 6px;
        font-size: 0.82rem;
        color: var(--color-text-base);
        flex-wrap: wrap;
        border-radius: 4px;
    }

    .history-row:nth-child(odd) {
        background: rgba(0, 0, 0, 0.12);
    }

    .history-date {
        font-size: 0.74rem;
        color: var(--color-text-muted);
        white-space: nowrap;
        flex: 0 0 auto;
    }

    .history-matchup {
        flex: 1;
        min-width: 0;
    }

    .history-result {
        font-size: 0.76rem;
        color: var(--color-text-dim);
        white-space: nowrap;
        flex: 0 0 auto;
    }
</style>
