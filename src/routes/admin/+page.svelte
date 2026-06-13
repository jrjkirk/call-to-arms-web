<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import {
        NONE_FACTION,
        TOW_FACTIONS, HH_FACTIONS, KT_FACTIONS,
        ETA_OPTIONS,
    } from '$lib/signupOptions';

    const VALID_SCOPES = ['The Old World', 'The Horus Heresy', 'Kill Team', 'League'];
    const SYSTEM_SCOPES = ['The Old World', 'The Horus Heresy', 'Kill Team'];

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
    type DisplayRow = {
        id: number | null;
        a_signup_id: number;
        a_name: string;
        a_faction: string | null;
        a_vibe: string | null;
        b_signup_id: number | null;
        b_name: string | null;
        b_faction: string | null;
        b_vibe: string | null;
        type: string | null;
        eta: string | null;
        points: string | null;
        prearranged: boolean;
    };
    type SignupItem = { id: number; name: string; faction: string | null; vibe: string | null };
    type PairingsState = {
        week: string;
        rows: DisplayRow[];
        editRows: EditRow[];
        published: boolean;
        isPreview: boolean;
        signups: SignupItem[];
        loading: boolean;
        saving: boolean;
        posting: boolean;
        dirty: boolean;
        error: string | null;
        message: string | null;
    };
    type EditRow = {
        id: number | null;
        a_signup_id: number | null;
        b_signup_id: number | null;
        a_faction: string;
        b_faction: string;
        a_type: string;
        b_type: string;
        type: string;
        eta: string;
        points: string;
        prearranged: boolean;
    };

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

    // Per-scope pairings state
    let pairings = $state<Record<string, PairingsState>>({});

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

    function defaultWeekFor(system: string): string {
        const target = system === 'The Old World' ? 3 : 5;
        const d = new Date();
        const day = d.getDay();
        const daysAhead = (target - day + 7) % 7;
        d.setDate(d.getDate() + (daysAhead === 0 ? 7 : daysAhead));
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    function factionsFor(system: string): string[] {
        if (system === 'The Horus Heresy') return HH_FACTIONS;
        if (system === 'Kill Team') return KT_FACTIONS;
        return TOW_FACTIONS;
    }

    function vibeOptionsFor(system: string): string[] {
        if (system === 'Kill Team') return ['Standard'];
        if (system === 'The Horus Heresy') return ['Standard', 'Intro'];
        return ['Casual', 'Competitive', 'Intro', 'Either'];
    }

    function showPoints(system: string): boolean {
        return system !== 'Kill Team';
    }

    function displayRowToEdit(r: DisplayRow): EditRow {
        return {
            id: r.id,
            a_signup_id: r.a_signup_id,
            b_signup_id: r.b_signup_id,
            a_faction: r.a_faction ?? NONE_FACTION,
            b_faction: r.b_faction ?? NONE_FACTION,
            a_type: r.a_vibe ?? '',
            b_type: r.b_vibe ?? '',
            type: r.type ?? '',
            eta: r.eta ?? '',
            points: r.points ?? '',
            prearranged: r.prearranged,
        };
    }

    function initPairingsState(scope: string): PairingsState {
        return {
            week: defaultWeekFor(scope),
            rows: [],
            editRows: [],
            published: false,
            isPreview: false,
            signups: [],
            loading: false,
            saving: false,
            posting: false,
            dirty: false,
            error: null,
            message: null,
        };
    }

    async function loadPairings(scope: string) {
        const ps = pairings[scope];
        if (!ps) return;
        ps.loading = true;
        ps.error = null;
        ps.message = null;
        const params = new URLSearchParams({ system: scope, week: ps.week });
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairings?${params}`, { credentials: 'include' });
        if (r.ok) {
            const data = await r.json();
            ps.rows = data.rows ?? [];
            ps.editRows = ps.rows.map(displayRowToEdit);
            ps.published = data.published ?? false;
            ps.isPreview = false;
            ps.dirty = false;
        } else {
            ps.error = 'Failed to load pairings.';
        }
        await loadSignups(scope);
        ps.loading = false;
    }

    async function loadSignups(scope: string) {
        const ps = pairings[scope];
        if (!ps) return;
        const params = new URLSearchParams({ system: scope, week: ps.week });
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairings/signup-list?${params}`, { credentials: 'include' });
        if (r.ok) ps.signups = await r.json();
    }

    async function previewPairings(scope: string) {
        const ps = pairings[scope];
        if (!ps) return;
        ps.loading = true;
        ps.error = null;
        ps.message = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairings/preview`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system: scope, week: ps.week }),
        });
        if (r.ok) {
            const data = await r.json();
            ps.rows = data.rows ?? [];
            ps.editRows = ps.rows.map(displayRowToEdit);
            ps.isPreview = true;
            ps.dirty = false;
            ps.message = 'Preview only — no changes saved to the database.';
        } else {
            const body = await r.json().catch(() => ({}));
            ps.error = body.detail || 'Preview failed.';
        }
        ps.loading = false;
    }

    async function generatePairings(scope: string) {
        const ps = pairings[scope];
        if (!ps) return;
        ps.loading = true;
        ps.error = null;
        ps.message = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairings/generate`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system: scope, week: ps.week }),
        });
        if (r.ok) {
            const data = await r.json();
            ps.rows = data.rows ?? [];
            ps.editRows = ps.rows.map(displayRowToEdit);
            ps.isPreview = false;
            ps.dirty = false;
            ps.message = `Generated ${ps.rows.length} pairing(s).`;
        } else {
            const body = await r.json().catch(() => ({}));
            ps.error = body.detail || 'Generation failed.';
        }
        ps.loading = false;
    }

    async function savePairings(scope: string) {
        const ps = pairings[scope];
        if (!ps || ps.isPreview) return;
        ps.saving = true;
        ps.error = null;
        ps.message = null;
        const rows = ps.editRows.filter(r => r.id !== null);
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairings/save`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system: scope, week: ps.week, rows }),
        });
        if (r.ok) {
            const data = await r.json();
            ps.dirty = false;
            ps.message = `Saved ${data.changed} pairing(s).`;
            await loadPairings(scope);
        } else {
            const body = await r.json().catch(() => ({}));
            ps.error = body.detail || 'Save failed.';
        }
        ps.saving = false;
    }

    async function togglePublish(scope: string) {
        const ps = pairings[scope];
        if (!ps) return;
        const newPublished = !ps.published;
        ps.error = null;
        ps.message = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairings/publish`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system: scope, week: ps.week, published: newPublished }),
        });
        if (r.ok) {
            ps.published = newPublished;
            ps.message = newPublished ? 'Pairings published.' : 'Pairings unpublished.';
        } else {
            const body = await r.json().catch(() => ({}));
            ps.error = body.detail || 'Publish toggle failed.';
        }
    }

    async function postDiscord(scope: string) {
        const ps = pairings[scope];
        if (!ps) return;
        ps.posting = true;
        ps.error = null;
        ps.message = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairings/post-discord`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system: scope, week: ps.week }),
        });
        if (r.ok) {
            const data = await r.json();
            ps.message = data.posted ? 'Posted to Discord.' : `Not posted: ${data.reason}.`;
        } else {
            const body = await r.json().catch(() => ({}));
            ps.error = body.detail || 'Discord post failed.';
        }
        ps.posting = false;
    }

    async function deletePairing(scope: string, rowId: number) {
        const ps = pairings[scope];
        if (!ps) return;
        ps.error = null;
        ps.message = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairings`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system: scope, week: ps.week, ids: [rowId] }),
        });
        if (r.ok) {
            await loadPairings(scope);
        } else {
            const body = await r.json().catch(() => ({}));
            ps.error = body.detail || 'Delete failed.';
        }
    }

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
            if (SYSTEM_SCOPES.includes(scope)) {
                pairings[scope] = initPairingsState(scope);
                tasks.push(loadPairings(scope));
            }
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

    <!-- ── Per-scope cards ───────────────────────────────────────────── -->
    {#if adminMe.scopes.length > 0}
        <section class="admin-section">
            <h3 class="section-heading">Your Scopes</h3>
            <div class="scope-cards">
                {#each adminMe.scopes as scope}
                    <div class="scope-card">
                        <div class="scope-card-title">{scope}</div>

                        <!-- Recent Games -->
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

                        <!-- Weekly Pairings (system scopes only) -->
                        {#if SYSTEM_SCOPES.includes(scope) && pairings[scope]}
                            {@const ps = pairings[scope]}
                            <div class="sub-section pairings-section">
                                <h4 class="sub-heading">
                                    Weekly Pairings
                                    {#if ps.published}
                                        <span class="pub-badge pub-live">● Published</span>
                                    {:else}
                                        <span class="pub-badge pub-draft">○ Unpublished</span>
                                    {/if}
                                </h4>

                                <!-- Week input + action buttons -->
                                <div class="pairing-controls">
                                    <div class="field field-narrow">
                                        <label class="field-label" for="week-{scope}">Week</label>
                                        <input
                                            id="week-{scope}"
                                            class="field-input week-input"
                                            type="text"
                                            placeholder="DD/MM/YYYY"
                                            bind:value={ps.week}
                                            onblur={() => loadPairings(scope)}
                                        />
                                    </div>
                                    <div class="pairing-btn-row">
                                        <button
                                            class="secondary-button"
                                            type="button"
                                            disabled={ps.loading}
                                            onclick={() => previewPairings(scope)}
                                            title="Compute proposed pairings without saving"
                                        >Preview (dry run)</button>
                                        <button
                                            class="primary-button"
                                            type="button"
                                            disabled={ps.loading}
                                            onclick={() => generatePairings(scope)}
                                        >{ps.loading ? 'Working…' : 'Generate'}</button>
                                        <button
                                            class={`publish-btn ${ps.published ? 'pub-on' : 'pub-off'}`}
                                            type="button"
                                            onclick={() => togglePublish(scope)}
                                        >{ps.published ? 'Unpublish' : 'Publish'}</button>
                                        <button
                                            class="secondary-button"
                                            type="button"
                                            disabled={ps.posting}
                                            onclick={() => postDiscord(scope)}
                                        >{ps.posting ? 'Posting…' : 'Post to Discord'}</button>
                                    </div>
                                </div>

                                {#if ps.error}
                                    <p class="field-error">{ps.error}</p>
                                {/if}
                                {#if ps.message}
                                    <p class="pairing-message">{ps.message}</p>
                                {/if}

                                {#if ps.isPreview}
                                    <p class="preview-banner">DRY RUN — proposed board, not saved. Click Generate to commit.</p>
                                {/if}

                                {#if ps.editRows.length === 0 && !ps.loading}
                                    <p class="muted small">No pairings for this week. Generate to create them.</p>
                                {:else if ps.editRows.length > 0}
                                    <!-- Editable grid -->
                                    <div class="grid-wrap">
                                        <table class="pairing-grid">
                                            <thead>
                                                <tr>
                                                    <th>A</th>
                                                    <th>A Faction</th>
                                                    <th>A Type</th>
                                                    <th>B</th>
                                                    <th>B Faction</th>
                                                    <th>B Type</th>
                                                    <th>Type</th>
                                                    {#if showPoints(scope)}<th>ETA</th><th>Pts</th>{/if}
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {#each ps.editRows as er, idx}
                                                    <tr class:prearranged-row={er.prearranged} class:preview-row={er.id === null}>
                                                        <!-- A signup -->
                                                        <td>
                                                            {#if er.id === null}
                                                                <span class="cell-text">{ps.rows[idx]?.a_name ?? '—'}</span>
                                                            {:else}
                                                                <select
                                                                    class="cell-select"
                                                                    value={String(er.a_signup_id ?? '')}
                                                                    onchange={(e) => {
                                                                        const v = (e.target as HTMLSelectElement).value;
                                                                        er.a_signup_id = v ? Number(v) : null;
                                                                        ps.dirty = true;
                                                                    }}
                                                                >
                                                                    {#each ps.signups as su}
                                                                        <option value={String(su.id)}>{su.id} — {su.name}</option>
                                                                    {/each}
                                                                </select>
                                                            {/if}
                                                        </td>
                                                        <!-- A Faction -->
                                                        <td>
                                                            {#if er.id === null}
                                                                <span class="cell-text">{er.a_faction || '—'}</span>
                                                            {:else}
                                                                <select
                                                                    class="cell-select"
                                                                    bind:value={er.a_faction}
                                                                    onchange={() => (ps.dirty = true)}
                                                                >
                                                                    <option value={NONE_FACTION}>{NONE_FACTION}</option>
                                                                    {#each factionsFor(scope) as f}
                                                                        <option>{f}</option>
                                                                    {/each}
                                                                </select>
                                                            {/if}
                                                        </td>
                                                        <!-- A Type -->
                                                        <td>
                                                            {#if er.id === null}
                                                                <span class="cell-text">{er.a_type || '—'}</span>
                                                            {:else}
                                                                <select
                                                                    class="cell-select"
                                                                    bind:value={er.a_type}
                                                                    onchange={() => (ps.dirty = true)}
                                                                >
                                                                    <option value="">—</option>
                                                                    {#each vibeOptionsFor(scope) as v}
                                                                        <option>{v}</option>
                                                                    {/each}
                                                                </select>
                                                            {/if}
                                                        </td>
                                                        <!-- B signup -->
                                                        <td>
                                                            {#if er.id === null}
                                                                <span class="cell-text">{ps.rows[idx]?.b_name ?? 'BYE'}</span>
                                                            {:else}
                                                                <select
                                                                    class="cell-select"
                                                                    value={String(er.b_signup_id ?? '')}
                                                                    onchange={(e) => {
                                                                        const v = (e.target as HTMLSelectElement).value;
                                                                        er.b_signup_id = v ? Number(v) : null;
                                                                        ps.dirty = true;
                                                                    }}
                                                                >
                                                                    <option value="">BYE</option>
                                                                    {#each ps.signups as su}
                                                                        <option value={String(su.id)}>{su.id} — {su.name}</option>
                                                                    {/each}
                                                                </select>
                                                            {/if}
                                                        </td>
                                                        <!-- B Faction -->
                                                        <td>
                                                            {#if er.id === null}
                                                                <span class="cell-text">{er.b_faction || '—'}</span>
                                                            {:else}
                                                                <select
                                                                    class="cell-select"
                                                                    bind:value={er.b_faction}
                                                                    onchange={() => (ps.dirty = true)}
                                                                >
                                                                    <option value={NONE_FACTION}>{NONE_FACTION}</option>
                                                                    {#each factionsFor(scope) as f}
                                                                        <option>{f}</option>
                                                                    {/each}
                                                                </select>
                                                            {/if}
                                                        </td>
                                                        <!-- B Type -->
                                                        <td>
                                                            {#if er.id === null}
                                                                <span class="cell-text">{er.b_type || '—'}</span>
                                                            {:else}
                                                                <select
                                                                    class="cell-select"
                                                                    bind:value={er.b_type}
                                                                    onchange={() => (ps.dirty = true)}
                                                                >
                                                                    <option value="">—</option>
                                                                    {#each vibeOptionsFor(scope) as v}
                                                                        <option>{v}</option>
                                                                    {/each}
                                                                </select>
                                                            {/if}
                                                        </td>
                                                        <!-- Shared Type -->
                                                        <td>
                                                            {#if er.id === null}
                                                                <span class="cell-text">{er.type || '—'}</span>
                                                            {:else}
                                                                <select
                                                                    class="cell-select"
                                                                    bind:value={er.type}
                                                                    onchange={() => (ps.dirty = true)}
                                                                >
                                                                    <option value="">—</option>
                                                                    {#each vibeOptionsFor(scope) as v}
                                                                        <option>{v}</option>
                                                                    {/each}
                                                                </select>
                                                            {/if}
                                                        </td>
                                                        <!-- ETA + Points (points-bearing systems) -->
                                                        {#if showPoints(scope)}
                                                            <td>
                                                                {#if er.id === null}
                                                                    <span class="cell-text">{er.eta || '—'}</span>
                                                                {:else}
                                                                    <select
                                                                        class="cell-select"
                                                                        bind:value={er.eta}
                                                                        onchange={() => (ps.dirty = true)}
                                                                    >
                                                                        <option value="">—</option>
                                                                        {#each ETA_OPTIONS as t}
                                                                            <option>{t}</option>
                                                                        {/each}
                                                                    </select>
                                                                {/if}
                                                            </td>
                                                            <td>
                                                                {#if er.id === null}
                                                                    <span class="cell-text">{er.points || '—'}</span>
                                                                {:else}
                                                                    <input
                                                                        class="cell-input-num"
                                                                        type="number"
                                                                        min="0"
                                                                        step="250"
                                                                        bind:value={er.points}
                                                                        oninput={() => (ps.dirty = true)}
                                                                    />
                                                                {/if}
                                                            </td>
                                                        {/if}
                                                        <!-- Delete -->
                                                        <td class="cell-delete">
                                                            {#if er.id !== null}
                                                                <button
                                                                    class="remove-btn"
                                                                    type="button"
                                                                    title="Delete this pairing"
                                                                    onclick={() => deletePairing(scope, er.id!)}
                                                                >×</button>
                                                            {/if}
                                                        </td>
                                                    </tr>
                                                {/each}
                                            </tbody>
                                        </table>
                                    </div>

                                    {#if !ps.isPreview}
                                        <div class="save-row">
                                            {#if ps.dirty}
                                                <span class="dirty-indicator">Unsaved changes</span>
                                            {/if}
                                            <button
                                                class="primary-button"
                                                type="button"
                                                disabled={ps.saving || ps.isPreview || !ps.dirty}
                                                onclick={() => savePairings(scope)}
                                            >{ps.saving ? 'Saving…' : 'Save Pairing Changes'}</button>
                                        </div>
                                    {/if}
                                {/if}
                            </div>
                        {/if}

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

    .field-narrow {
        min-width: 130px;
        max-width: 160px;
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
        margin: 0.25rem 0 0;
        width: 100%;
    }

    .primary-button {
        background: var(--color-accent);
        color: #111;
        border: none;
        border-radius: 8px;
        padding: 7px 14px;
        font-size: 0.85rem;
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

    .secondary-button {
        background: transparent;
        color: var(--color-accent);
        border: 1px solid var(--color-accent-border);
        border-radius: 8px;
        padding: 7px 14px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
        white-space: nowrap;
    }

    .secondary-button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }

    .secondary-button:not(:disabled):hover {
        background: rgba(201, 161, 74, 0.1);
    }

    .publish-btn {
        border: none;
        border-radius: 8px;
        padding: 7px 14px;
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        transition: opacity 0.15s;
        white-space: nowrap;
    }

    .pub-on {
        background: #166534;
        color: #bbf7d0;
    }

    .pub-off {
        background: #7f1d1d;
        color: #fca5a5;
    }

    .publish-btn:hover {
        opacity: 0.85;
    }

    /* ── Scope cards ────────────────────────────────────────────────────── */

    .scope-cards {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .scope-card {
        background: var(--color-sidebar-bg);
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

    /* ── Pairings section ───────────────────────────────────────────────── */

    .pairings-section {
        border-top: 1px solid var(--color-accent-border-soft);
        padding-top: 1rem;
        margin-top: 1rem;
    }

    .pub-badge {
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: none;
        letter-spacing: 0;
        padding: 2px 8px;
        border-radius: 999px;
    }

    .pub-live {
        background: rgba(22, 101, 52, 0.4);
        color: #86efac;
        border: 1px solid #166534;
    }

    .pub-draft {
        background: rgba(127, 29, 29, 0.3);
        color: #fca5a5;
        border: 1px solid #7f1d1d;
    }

    .pairing-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
    }

    /* Match the action buttons' exact padding/font-size so the input and
       button row share the same height, making flex-end alignment exact. */
    .week-input {
        padding: 7px 14px;
        font-size: 0.85rem;
    }

    .pairing-btn-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
    }

    .preview-banner {
        font-size: 0.8rem;
        color: #fbbf24;
        background: rgba(251, 191, 36, 0.08);
        border: 1px solid rgba(251, 191, 36, 0.3);
        border-radius: 6px;
        padding: 6px 12px;
        margin: 0 0 0.75rem;
    }

    .pairing-message {
        font-size: 0.8rem;
        color: #86efac;
        margin: 0 0 0.5rem;
    }

    /* ── Pairing grid ───────────────────────────────────────────────────── */

    .grid-wrap {
        overflow-x: auto;
        margin-bottom: 0.75rem;
    }

    .pairing-grid {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.78rem;
        min-width: 700px;
    }

    .pairing-grid th {
        text-align: left;
        padding: 5px 6px;
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--color-text-muted);
        border-bottom: 1px solid var(--color-accent-border-soft);
        white-space: nowrap;
    }

    .pairing-grid td {
        padding: 4px 4px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        vertical-align: middle;
    }

    .pairing-grid tr:hover td {
        background: rgba(255, 255, 255, 0.02);
    }

    .prearranged-row td {
        background: rgba(201, 161, 74, 0.06);
    }

    .preview-row td {
        opacity: 0.75;
    }

    .cell-select {
        background: var(--color-surface-dark);
        border: 1px solid var(--color-accent-border-soft);
        border-radius: 4px;
        color: var(--color-text-base);
        padding: 3px 6px;
        font-size: 0.75rem;
        width: 100%;
        max-width: 160px;
        cursor: pointer;
    }

    .cell-select:focus {
        outline: none;
        border-color: var(--color-accent);
    }

    .cell-input-num {
        background: var(--color-surface-dark);
        border: 1px solid var(--color-accent-border-soft);
        border-radius: 4px;
        color: var(--color-text-base);
        padding: 3px 6px;
        font-size: 0.75rem;
        width: 72px;
        font-family: inherit;
    }

    .cell-input-num:focus {
        outline: none;
        border-color: var(--color-accent);
    }

    .cell-text {
        font-size: 0.78rem;
        color: var(--color-text-base);
    }

    .cell-delete {
        width: 28px;
        text-align: center;
    }

    .save-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-top: 0.5rem;
    }

    .dirty-indicator {
        font-size: 0.78rem;
        color: #fbbf24;
        font-style: italic;
    }
</style>
