<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';

    type AdminMe = { is_super_admin: boolean; is_platform_admin: boolean; scopes: string[] };
    type PlatformClub = {
        id: number;
        name: string;
        slug: string;
        active: boolean;
        leagues_enabled: boolean;
        timezone: string;
        contact_email: string | null;
        enabled_system_count: number;
        has_super_admin: boolean;
    };
    type ClubSystemRow = {
        system_id: number;
        system_name: string;
        enabled: boolean;
        session_day: string;
        session_cadence: string;
        cadence_anchor: string | null;
    };
    type SystemCatalogueEntry = { id: number; name: string; legacy_system_name: string };
    type PlatformSystemFull = {
        id: number;
        name: string;
        slug: string;
        legacy_system_name: string;
        uses_points: boolean;
        default_points: number | null;
        max_points: number | null;
        vibe_options: string[];
        default_vibe: string | null;
        uses_scenarios: boolean;
        scenario_options: string[] | null;
        default_scenario: string | null;
        allows_demo: boolean;
        has_intro_prepass: boolean;
        recent_weeks: number;
        extended_weeks: number;
        escalation_priority: boolean;
        faction_list: string[] | null;
        icon_folder: string | null;
        active: boolean;
    };
    type SuperAdminEntry = { user_id: number; discord_name: string; player_name: string | null };
    type GrantableUser = { id: number; discord_name: string; player_name: string };

    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const CADENCES = ['weekly', 'fortnightly'];

    let adminMe = $state<AdminMe | null>(null);
    let pageLoading = $state(true);

    let clubs = $state<PlatformClub[]>([]);
    let clubsLoading = $state(false);
    let clubsError = $state<string | null>(null);

    let systemsCatalogue = $state<SystemCatalogueEntry[]>([]);

    // Game Systems catalogue management (full CRUD, including inactive systems
    // — distinct from systemsCatalogue above, which is the lightweight
    // active-only GET /systems used to populate the per-club systems picker)
    let gameSystems = $state<PlatformSystemFull[]>([]);
    let gameSystemsLoading = $state(false);
    let gameSystemsError = $state<string | null>(null);

    let gsSelectId = $state('');
    let gsName = $state('');
    let gsSlug = $state('');
    let gsLegacyName = $state('');
    let gsUsesPoints = $state(false);
    let gsDefaultPoints = $state<number | ''>('');
    let gsMaxPoints = $state<number | ''>('');
    let gsVibeOptionsStr = $state('');
    let gsDefaultVibe = $state('');
    let gsUsesScenarios = $state(false);
    let gsScenarioOptionsStr = $state('');
    let gsDefaultScenario = $state('');
    let gsAllowsDemo = $state(false);
    let gsHasIntroPrepass = $state(false);
    let gsRecentWeeks = $state(3);
    let gsExtendedWeeks = $state(6);
    let gsEscalationPriority = $state(false);
    let gsActive = $state(true);
    let gsSaving = $state(false);
    let gsError = $state<string | null>(null);
    let gsMessage = $state<string | null>(null);

    const gsIsEditing = $derived(gsSelectId !== '');
    const gsVibeOptionsArr = $derived(
        gsVibeOptionsStr.split(',').map((s) => s.trim()).filter(Boolean)
    );
    const gsScenarioOptionsArr = $derived(
        gsScenarioOptionsStr.split(',').map((s) => s.trim()).filter(Boolean)
    );

    $effect(() => {
        if (gsVibeOptionsArr.length === 0) {
            gsDefaultVibe = '';
        } else if (!gsVibeOptionsArr.includes(gsDefaultVibe)) {
            gsDefaultVibe = gsVibeOptionsArr[0];
        }
    });

    $effect(() => {
        if (!gsUsesScenarios || gsScenarioOptionsArr.length === 0) {
            gsDefaultScenario = '';
        } else if (!gsScenarioOptionsArr.includes(gsDefaultScenario)) {
            gsDefaultScenario = gsScenarioOptionsArr[0];
        }
    });

    // Create-club form
    let createName = $state('');
    let createSlug = $state('');
    let createContactEmail = $state('');
    let createLeaguesEnabled = $state(true);
    let createActive = $state(false);
    let creating = $state(false);
    let createError = $state<string | null>(null);
    let createMessage = $state<string | null>(null);

    // Selected club detail
    let selectedClubId = $state<number | null>(null);
    let clubSystems = $state<ClubSystemRow[]>([]);
    let clubSuperAdmins = $state<SuperAdminEntry[]>([]);
    let clubGrantableUsers = $state<GrantableUser[]>([]);
    let detailLoading = $state(false);
    let detailError = $state<string | null>(null);

    const selectedClub = $derived(clubs.find((c) => c.id === selectedClubId) ?? null);

    // Add/edit system form
    let systemSelectId = $state('');
    let systemSessionDay = $state('Wednesday');
    let systemSessionCadence = $state('weekly');
    let systemCadenceAnchor = $state('');
    let systemEnabled = $state(true);
    let systemSaving = $state(false);
    let systemError = $state<string | null>(null);
    let systemMessage = $state<string | null>(null);

    // Appoint super-admin form
    let appointUserIdStr = $state('');
    let appointing = $state(false);
    let appointError = $state<string | null>(null);

    let activeToggling = $state(false);
    let activeError = $state<string | null>(null);

    // Edit club details form (pre-filled from the selected club on select)
    let editName = $state('');
    let editSlug = $state('');
    let editEmail = $state('');
    let editLeagues = $state(true);
    let editSaving = $state(false);
    let editError = $state<string | null>(null);
    let editMessage = $state<string | null>(null);

    async function loadAdminMe() {
        const r = await fetch(`${PUBLIC_API_URL}/admin/me`, { credentials: 'include' });
        adminMe = r.ok ? await r.json() : null;
    }

    async function loadClubs() {
        clubsLoading = true;
        clubsError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/clubs`, { credentials: 'include' });
        if (r.ok) {
            clubs = await r.json();
        } else {
            const body = await r.json().catch(() => ({}));
            clubsError = body.detail || 'Failed to load clubs.';
        }
        clubsLoading = false;
    }

    async function loadSystemsCatalogue() {
        const r = await fetch(`${PUBLIC_API_URL}/systems`);
        if (r.ok) systemsCatalogue = await r.json();
    }

    async function loadGameSystems() {
        gameSystemsLoading = true;
        gameSystemsError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/systems`, { credentials: 'include' });
        if (r.ok) {
            gameSystems = await r.json();
        } else {
            const body = await r.json().catch(() => ({}));
            gameSystemsError = body.detail || 'Failed to load systems.';
        }
        gameSystemsLoading = false;
    }

    onMount(async () => {
        await loadAdminMe();
        if (adminMe?.is_platform_admin) {
            await Promise.all([loadClubs(), loadSystemsCatalogue(), loadGameSystems()]);
        }
        pageLoading = false;
    });

    async function createClub() {
        creating = true;
        createError = null;
        createMessage = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/clubs`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: createName.trim(),
                slug: createSlug.trim(),
                contact_email: createContactEmail.trim() || null,
                leagues_enabled: createLeaguesEnabled,
                active: createActive,
            }),
        });
        if (r.ok) {
            createMessage = `Created "${createName}".`;
            createName = '';
            createSlug = '';
            createContactEmail = '';
            createLeaguesEnabled = true;
            createActive = false;
            await loadClubs();
        } else {
            const body = await r.json().catch(() => ({}));
            createError = body.detail || 'Failed to create club.';
        }
        creating = false;
    }

    async function selectClub(clubId: number) {
        selectedClubId = clubId;
        detailLoading = true;
        detailError = null;
        systemError = null;
        systemMessage = null;
        appointError = null;
        activeError = null;
        resetSystemForm();

        // Pre-fill the edit-details form from the club being managed.
        const c = clubs.find((cl) => cl.id === clubId);
        if (c) {
            editName = c.name;
            editSlug = c.slug;
            editEmail = c.contact_email ?? '';
            editLeagues = c.leagues_enabled;
        }
        editError = null;
        editMessage = null;

        const [systemsResp, superAdminsResp, grantableResp] = await Promise.all([
            fetch(`${PUBLIC_API_URL}/admin/platform/clubs/${clubId}/systems`, { credentials: 'include' }),
            fetch(`${PUBLIC_API_URL}/admin/platform/clubs/${clubId}/super-admins`, { credentials: 'include' }),
            fetch(`${PUBLIC_API_URL}/admin/platform/clubs/${clubId}/grantable-users`, { credentials: 'include' }),
        ]);

        if (systemsResp.ok && superAdminsResp.ok && grantableResp.ok) {
            clubSystems = await systemsResp.json();
            clubSuperAdmins = await superAdminsResp.json();
            clubGrantableUsers = await grantableResp.json();
        } else {
            detailError = 'Failed to load club detail.';
        }
        detailLoading = false;
    }

    function resetSystemForm() {
        systemSelectId = '';
        systemSessionDay = 'Wednesday';
        systemSessionCadence = 'weekly';
        systemCadenceAnchor = '';
        systemEnabled = true;
    }

    function onSystemPick() {
        const existing = clubSystems.find((s) => String(s.system_id) === systemSelectId);
        if (existing) {
            systemSessionDay = existing.session_day;
            systemSessionCadence = existing.session_cadence;
            systemCadenceAnchor = existing.cadence_anchor ?? '';
            systemEnabled = existing.enabled;
        } else {
            systemSessionDay = 'Wednesday';
            systemSessionCadence = 'weekly';
            systemCadenceAnchor = '';
            systemEnabled = true;
        }
    }

    async function saveClubSystem() {
        if (!selectedClubId || !systemSelectId) return;
        systemSaving = true;
        systemError = null;
        systemMessage = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/clubs/${selectedClubId}/systems`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_id: Number(systemSelectId),
                enabled: systemEnabled,
                session_day: systemSessionDay,
                session_cadence: systemSessionCadence,
                cadence_anchor: systemSessionCadence === 'fortnightly' ? (systemCadenceAnchor || null) : null,
            }),
        });
        if (r.ok) {
            systemMessage = 'Saved.';
            await selectClub(selectedClubId);
            await loadClubs();
        } else {
            const body = await r.json().catch(() => ({}));
            systemError = body.detail || 'Failed to save system.';
        }
        systemSaving = false;
    }

    function resetGameSystemForm() {
        gsSelectId = '';
        gsName = '';
        gsSlug = '';
        gsLegacyName = '';
        gsUsesPoints = false;
        gsDefaultPoints = '';
        gsMaxPoints = '';
        gsVibeOptionsStr = '';
        gsUsesScenarios = false;
        gsScenarioOptionsStr = '';
        gsAllowsDemo = false;
        gsHasIntroPrepass = false;
        gsRecentWeeks = 3;
        gsExtendedWeeks = 6;
        gsEscalationPriority = false;
        gsActive = true;
        gsError = null;
        gsMessage = null;
    }

    function onGameSystemPick(e?: Event) {
        gsError = null;
        gsMessage = null;
        // Read the id straight off the event target rather than trusting
        // gsSelectId here: Svelte fires this onchange handler and its own
        // bind:value sync off the same native 'change' event, and the two
        // aren't guaranteed to run in a fixed order — reading gsSelectId
        // can observe its pre-change value. The manual call site (the
        // table's "Edit" button) has no event and assigns gsSelectId
        // synchronously just before calling this, so it's race-free.
        const id = e ? (e.target as HTMLSelectElement).value : gsSelectId;
        if (id === '') {
            resetGameSystemForm();
            return;
        }
        const existing = gameSystems.find((s) => String(s.id) === id);
        if (!existing) return;
        gsName = existing.name;
        gsSlug = existing.slug;
        gsLegacyName = existing.legacy_system_name;
        gsUsesPoints = existing.uses_points;
        gsDefaultPoints = existing.default_points ?? '';
        gsMaxPoints = existing.max_points ?? '';
        gsVibeOptionsStr = (existing.vibe_options ?? []).join(', ');
        gsUsesScenarios = existing.uses_scenarios;
        gsScenarioOptionsStr = (existing.scenario_options ?? []).join(', ');
        gsAllowsDemo = existing.allows_demo;
        gsHasIntroPrepass = existing.has_intro_prepass;
        gsRecentWeeks = existing.recent_weeks;
        gsExtendedWeeks = existing.extended_weeks;
        gsEscalationPriority = existing.escalation_priority;
        gsActive = existing.active;
    }

    async function saveGameSystem() {
        gsSaving = true;
        gsError = null;
        gsMessage = null;

        const body: Record<string, unknown> = {
            name: gsName.trim(),
            legacy_system_name: gsLegacyName.trim(),
            uses_points: gsUsesPoints,
            default_points: gsUsesPoints && gsDefaultPoints !== '' ? Number(gsDefaultPoints) : null,
            max_points: gsUsesPoints && gsMaxPoints !== '' ? Number(gsMaxPoints) : null,
            vibe_options: gsVibeOptionsArr,
            default_vibe: gsDefaultVibe || null,
            uses_scenarios: gsUsesScenarios,
            scenario_options: gsUsesScenarios ? gsScenarioOptionsArr : null,
            default_scenario: gsUsesScenarios ? gsDefaultScenario || null : null,
            allows_demo: gsAllowsDemo,
            has_intro_prepass: gsHasIntroPrepass,
            recent_weeks: gsRecentWeeks,
            extended_weeks: gsExtendedWeeks,
            escalation_priority: gsEscalationPriority,
            // faction_list / icon_folder are NOT sent: a system's factions and
            // icon directory are backend-owned rules (call-to-arms-api systems/
            // modules), not editable catalogue data. The backend ignores them
            // if sent.
            active: gsActive
        };

        let url = `${PUBLIC_API_URL}/admin/platform/systems`;
        if (gsIsEditing) {
            url = `${PUBLIC_API_URL}/admin/platform/systems/${gsSelectId}`;
        } else {
            body.slug = gsSlug.trim();
        }

        const wasEditing = gsIsEditing;
        const idAtSaveTime = gsSelectId;
        const r = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (r.ok) {
            gsMessage = wasEditing ? 'Updated.' : 'Created.';
            await loadGameSystems();
            await loadSystemsCatalogue();
            // Only clear the form if the admin hasn't since picked a
            // different system to edit while these reloads were in
            // flight — otherwise this would silently wipe out whatever
            // they'd started typing for their next edit.
            if (!wasEditing && gsSelectId === idAtSaveTime) resetGameSystemForm();
        } else {
            const errBody = await r.json().catch(() => ({}));
            gsError = errBody.detail || 'Failed to save system.';
        }
        gsSaving = false;
    }

    async function appointSuperAdmin() {
        if (!selectedClubId || !appointUserIdStr) return;
        appointing = true;
        appointError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/clubs/${selectedClubId}/super-admins`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: Number(appointUserIdStr) }),
        });
        if (r.ok) {
            appointUserIdStr = '';
            await selectClub(selectedClubId);
            await loadClubs();
        } else {
            const body = await r.json().catch(() => ({}));
            appointError = body.detail || 'Failed to appoint super-admin.';
        }
        appointing = false;
    }

    async function removeSuperAdmin(userId: number) {
        if (!selectedClubId) return;
        if (!confirm('Remove this super-admin? They will lose all admin access for this club.')) return;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/clubs/${selectedClubId}/super-admins/${userId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (r.ok) {
            await selectClub(selectedClubId);
            await loadClubs();
        }
    }

    async function toggleActive() {
        if (!selectedClub) return;
        const next = !selectedClub.active;
        const verb = next ? 'activate' : 'deactivate';
        if (!confirm(`Really ${verb} "${selectedClub.name}"? ${next ? 'It will immediately become visible on the public club picker and start receiving real traffic.' : 'It will immediately disappear from the public club picker.'}`)) {
            return;
        }
        activeToggling = true;
        activeError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/clubs/${selectedClub.id}/active`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: next }),
        });
        if (r.ok) {
            await loadClubs();
        } else {
            const body = await r.json().catch(() => ({}));
            activeError = body.detail || 'Failed to update active state.';
        }
        activeToggling = false;
    }

    async function saveClubDetails() {
        if (!selectedClub) return;
        editSaving = true;
        editError = null;
        editMessage = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/platform/clubs/${selectedClub.id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: editName,
                slug: editSlug,
                contact_email: editEmail,
                leagues_enabled: editLeagues,
            }),
        });
        if (r.ok) {
            const updated = await r.json();
            // Re-sync to the values the server actually stored (e.g. a
            // normalized/lowercased slug) so the form matches reality.
            editName = updated.name;
            editSlug = updated.slug;
            editEmail = updated.contact_email ?? '';
            editLeagues = updated.leagues_enabled;
            editMessage = 'Saved.';
            await loadClubs();
        } else {
            const body = await r.json().catch(() => ({}));
            editError = body.detail || 'Failed to save club details.';
        }
        editSaving = false;
    }
</script>

<h2 class="page-heading">Platform Admin</h2>

{#if pageLoading}
    <p class="muted">Loading…</p>
{:else if !adminMe?.is_platform_admin}
    <p class="muted">You don't have platform admin access.</p>
{:else}
    <p class="section-intro platform-banner">
        Cross-club management — creating clubs, configuring their systems, appointing their
        delegates, and toggling which clubs are live. Separate from, and more powerful than, a
        club's own <a href="/admin">Admin</a> tools.
    </p>

    <!-- ══ Club Management ══ -->
    <details class="dash-group" open>
            <summary class="dash-group-header">
                <span class="dash-chevron" aria-hidden="true">▶</span>
                <span class="dash-group-title">Club Management</span>
            </summary>
        <div class="dash-group-body">
    <section class="admin-section">
        <h3 class="section-heading">Clubs</h3>
        {#if clubsLoading}
            <p class="muted">Loading…</p>
        {:else if clubsError}
            <p class="field-error">{clubsError}</p>
        {:else}
            <div class="table-wrap">
                <table class="clubs-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Slug</th>
                            <th>Status</th>
                            <th>Systems</th>
                            <th>Super-admin</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each clubs as club (club.id)}
                            <tr class:selected-row={club.id === selectedClubId}>
                                <td>{club.name}</td>
                                <td class="muted">{club.slug}</td>
                                <td>
                                    <span class="status-badge" class:status-active={club.active} class:status-inactive={!club.active}>
                                        {club.active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td>{club.enabled_system_count}</td>
                                <td>
                                    <span class="status-badge" class:status-active={club.has_super_admin} class:status-inactive={!club.has_super_admin}>
                                        {club.has_super_admin ? 'Yes' : 'No'}
                                    </span>
                                </td>
                                <td>
                                    <button class="primary-button" type="button" onclick={() => selectClub(club.id)}>
                                        Manage
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </section>
    <section class="admin-section">
        <h3 class="section-heading">Create Club</h3>
        <form class="appoint-form" onsubmit={(e) => { e.preventDefault(); createClub(); }}>
            <div class="field">
                <label class="field-label" for="cc-name">Name</label>
                <input id="cc-name" class="field-input" type="text" bind:value={createName} required />
            </div>
            <div class="field">
                <label class="field-label" for="cc-slug">Slug</label>
                <input id="cc-slug" class="field-input" type="text" bind:value={createSlug} required />
            </div>
            <div class="field">
                <label class="field-label" for="cc-email">Contact Email</label>
                <input id="cc-email" class="field-input" type="email" bind:value={createContactEmail} />
            </div>
            <div class="field-row-break"></div>
            <label class="check-row">
                <input type="checkbox" bind:checked={createLeaguesEnabled} />
                <span>Leagues enabled</span>
            </label>
            <label class="check-row">
                <input type="checkbox" bind:checked={createActive} />
                <span>Active immediately</span>
            </label>
            {#if createError}
                <p class="field-error">{createError}</p>
            {/if}
            {#if createMessage}
                <p class="pairing-message">{createMessage}</p>
            {/if}
            <button type="submit" class="primary-button" disabled={!createName.trim() || !createSlug.trim() || creating}>
                {creating ? 'Creating…' : 'Create Club'}
            </button>
        </form>
    </section>
        </div>
    </details>

    <!-- ══ Game Systems ══ -->
    <details class="dash-group">
            <summary class="dash-group-header">
                <span class="dash-chevron" aria-hidden="true">▶</span>
                <span class="dash-group-title">Game Systems</span>
            </summary>
        <div class="dash-group-body">
    <section class="admin-section">
        <p class="section-intro">
            The global catalogue of systems any club can enable for itself. Deactivating a
            system here is a platform-wide kill switch — no club can self-service-enable it
            while inactive.
        </p>
        {#if gameSystemsLoading}
            <p class="muted">Loading…</p>
        {:else if gameSystemsError}
            <p class="field-error">{gameSystemsError}</p>
        {:else}
            <div class="table-wrap">
                <table class="clubs-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Slug</th>
                            <th>Status</th>
                            <th>Points</th>
                            <th>Scenarios</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each gameSystems as s (s.id)}
                            <tr class:selected-row={String(s.id) === gsSelectId}>
                                <td>{s.name}</td>
                                <td class="muted">{s.slug}</td>
                                <td>
                                    <span class="status-badge" class:status-active={s.active} class:status-inactive={!s.active}>
                                        {s.active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td>{s.uses_points ? 'Yes' : 'No'}</td>
                                <td>{s.uses_scenarios ? 'Yes' : 'No'}</td>
                                <td>
                                    <button
                                        class="primary-button"
                                        type="button"
                                        onclick={() => { gsSelectId = String(s.id); onGameSystemPick(); }}
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        {/each}
                        {#if gameSystems.length === 0}
                            <tr><td colspan="6" class="muted">No systems yet.</td></tr>
                        {/if}
                    </tbody>
                </table>
            </div>
        {/if}

        <form class="appoint-form system-form" onsubmit={(e) => { e.preventDefault(); saveGameSystem(); }}>
            <div class="field">
                <label class="field-label" for="gs-select">System</label>
                <select id="gs-select" class="field-select" bind:value={gsSelectId} onchange={onGameSystemPick}>
                    <option value="">— New system —</option>
                    {#each gameSystems as s}
                        <option value={String(s.id)}>{s.name}</option>
                    {/each}
                </select>
            </div>
            <div class="field">
                <label class="field-label" for="gs-name">Name</label>
                <input id="gs-name" class="field-input" type="text" bind:value={gsName} required />
            </div>
            <div class="field">
                <label class="field-label" for="gs-slug">Slug</label>
                <input
                    id="gs-slug"
                    class="field-input"
                    type="text"
                    bind:value={gsSlug}
                    required
                    disabled={gsIsEditing}
                    title={gsIsEditing ? 'Slug is immutable after creation.' : ''}
                />
            </div>
            <div class="field">
                <label class="field-label" for="gs-legacy">Legacy system name</label>
                <input id="gs-legacy" class="field-input" type="text" bind:value={gsLegacyName} required />
            </div>
            <div class="field-row-break"></div>

            <label class="check-row">
                <input type="checkbox" bind:checked={gsUsesPoints} />
                <span>Uses points</span>
            </label>
            {#if gsUsesPoints}
                <div class="field field-narrow">
                    <label class="field-label" for="gs-default-points">Default points</label>
                    <input id="gs-default-points" class="field-input" type="number" min="0" bind:value={gsDefaultPoints} />
                </div>
                <div class="field field-narrow">
                    <label class="field-label" for="gs-max-points">Max points</label>
                    <input id="gs-max-points" class="field-input" type="number" min="0" bind:value={gsMaxPoints} />
                </div>
            {/if}
            <div class="field-row-break"></div>

            <div class="field">
                <label class="field-label" for="gs-vibes">Vibe options (comma-separated)</label>
                <input id="gs-vibes" class="field-input" type="text" bind:value={gsVibeOptionsStr} placeholder="Casual, Competitive, Intro" />
            </div>
            <div class="field field-narrow">
                <label class="field-label" for="gs-default-vibe">Default vibe</label>
                <select id="gs-default-vibe" class="field-select" bind:value={gsDefaultVibe}>
                    {#each gsVibeOptionsArr as v}
                        <option value={v}>{v}</option>
                    {/each}
                </select>
            </div>
            <div class="field-row-break"></div>

            <label class="check-row">
                <input type="checkbox" bind:checked={gsUsesScenarios} />
                <span>Uses scenarios</span>
            </label>
            {#if gsUsesScenarios}
                <div class="field">
                    <label class="field-label" for="gs-scenarios">Scenario options (comma-separated)</label>
                    <input id="gs-scenarios" class="field-input" type="text" bind:value={gsScenarioOptionsStr} placeholder="Open Battle, Weekly Scenario" />
                </div>
                <div class="field field-narrow">
                    <label class="field-label" for="gs-default-scenario">Default scenario</label>
                    <select id="gs-default-scenario" class="field-select" bind:value={gsDefaultScenario}>
                        {#each gsScenarioOptionsArr as sc}
                            <option value={sc}>{sc}</option>
                        {/each}
                    </select>
                </div>
            {/if}
            <div class="field-row-break"></div>

            <label class="check-row">
                <input type="checkbox" bind:checked={gsAllowsDemo} />
                <span>Allows demo</span>
            </label>
            <label class="check-row">
                <input type="checkbox" bind:checked={gsHasIntroPrepass} />
                <span>Has intro pre-pass</span>
            </label>
            <label class="check-row">
                <input type="checkbox" bind:checked={gsEscalationPriority} />
                <span>Escalation priority</span>
            </label>
            <div class="field-row-break"></div>

            <div class="field field-narrow">
                <label class="field-label" for="gs-recent-weeks">Recent weeks</label>
                <input id="gs-recent-weeks" class="field-input" type="number" min="1" bind:value={gsRecentWeeks} />
            </div>
            <div class="field field-narrow">
                <label class="field-label" for="gs-extended-weeks">Extended weeks</label>
                <input id="gs-extended-weeks" class="field-input" type="number" min="1" bind:value={gsExtendedWeeks} />
            </div>
            <div class="field-row-break"></div>

            <label class="check-row">
                <input type="checkbox" bind:checked={gsActive} />
                <span>Active</span>
            </label>

            {#if gsError}
                <p class="field-error">{gsError}</p>
            {/if}
            {#if gsMessage}
                <p class="pairing-message">{gsMessage}</p>
            {/if}
            <button
                type="submit"
                class="primary-button"
                disabled={!gsName.trim() || !gsSlug.trim() || !gsLegacyName.trim() || gsSaving}
            >
                {gsSaving ? 'Saving…' : gsIsEditing ? 'Update System' : 'Create System'}
            </button>
        </form>
    </section>
        </div>
    </details>

    {#if selectedClub}
        <!-- ══ Managing (per-club) ══ -->
        <details class="dash-group" open>
            <summary class="dash-group-header">
                <span class="dash-chevron" aria-hidden="true">▶</span>
                <span class="dash-group-title">Managing: {selectedClub.name}</span>
            </summary>
            <div class="dash-group-body">
        <section class="admin-section">

            <div class="sub-section">
                <h4 class="sub-heading">Active status</h4>
                <p class="section-intro">
                    Currently
                    <span class="status-badge" class:status-active={selectedClub.active} class:status-inactive={!selectedClub.active}>
                        {selectedClub.active ? 'Active' : 'Inactive'}
                    </span>
                    {selectedClub.active ? '— visible on the public club picker.' : '— hidden from the public club picker.'}
                </p>
                {#if activeError}
                    <p class="field-error">{activeError}</p>
                {/if}
                <button class="primary-button" type="button" disabled={activeToggling} onclick={toggleActive}>
                    {activeToggling ? 'Saving…' : selectedClub.active ? 'Deactivate' : 'Activate'}
                </button>
            </div>

            <div class="sub-section">
                <h4 class="sub-heading">Edit details</h4>
                <form class="appoint-form" onsubmit={(e) => { e.preventDefault(); saveClubDetails(); }}>
                    <div class="field">
                        <label class="field-label" for="edit-name">Name</label>
                        <input id="edit-name" class="field-input" type="text" bind:value={editName} required />
                    </div>
                    <div class="field">
                        <label class="field-label" for="edit-slug">Slug</label>
                        <input id="edit-slug" class="field-input" type="text" bind:value={editSlug} required />
                    </div>
                    {#if editSlug.trim().toLowerCase() !== selectedClub.slug}
                        <p class="section-intro slug-warning">
                            ⚠ Changing the slug renames this club's URL to
                            <strong>{(editSlug.trim().toLowerCase() || '…')}.calltoarms.app</strong> —
                            existing links, bookmarks, and subdomain logins using the old slug
                            (<strong>{selectedClub.slug}</strong>) will stop working.
                        </p>
                    {/if}
                    <div class="field">
                        <label class="field-label" for="edit-email">Contact Email</label>
                        <input id="edit-email" class="field-input" type="email" bind:value={editEmail} />
                    </div>
                    <div class="field-row-break"></div>
                    <label class="check-row">
                        <input type="checkbox" bind:checked={editLeagues} />
                        <span>Leagues enabled</span>
                    </label>
                    {#if editError}
                        <p class="field-error">{editError}</p>
                    {/if}
                    {#if editMessage}
                        <p class="pairing-message">{editMessage}</p>
                    {/if}
                    <button type="submit" class="primary-button" disabled={!editName.trim() || !editSlug.trim() || editSaving}>
                        {editSaving ? 'Saving…' : 'Save details'}
                    </button>
                </form>
            </div>

            {#if detailLoading}
                <p class="muted">Loading…</p>
            {:else if detailError}
                <p class="field-error">{detailError}</p>
            {:else}
                <div class="sub-section">
                    <h4 class="sub-heading">Systems</h4>
                    <ul class="block-list">
                        {#each clubSystems as row (row.system_id)}
                            <li class="block-row">
                                <span class="block-names"><strong>{row.system_name}</strong></span>
                                <span class="block-note">
                                    {row.enabled ? 'Enabled' : 'Disabled'} — {row.session_cadence} {row.session_day}
                                    {#if row.cadence_anchor}(anchor {row.cadence_anchor}){/if}
                                </span>
                            </li>
                        {/each}
                        {#if clubSystems.length === 0}
                            <p class="muted">No systems configured yet.</p>
                        {/if}
                    </ul>

                    <form class="appoint-form system-form" onsubmit={(e) => { e.preventDefault(); saveClubSystem(); }}>
                        <div class="field">
                            <label class="field-label" for="sys-select">System</label>
                            <select id="sys-select" class="field-select" bind:value={systemSelectId} onchange={onSystemPick}>
                                <option value="">— Select system —</option>
                                {#each systemsCatalogue as s}
                                    <option value={String(s.id)}>
                                        {s.legacy_system_name}
                                        {clubSystems.some((cs) => cs.system_id === s.id) ? ' (edit)' : ' (add)'}
                                    </option>
                                {/each}
                            </select>
                        </div>
                        <div class="field field-narrow">
                            <label class="field-label" for="sys-day">Day</label>
                            <select id="sys-day" class="field-select" bind:value={systemSessionDay}>
                                {#each DAYS as d}
                                    <option>{d}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="field field-narrow">
                            <label class="field-label" for="sys-cadence">Cadence</label>
                            <select id="sys-cadence" class="field-select" bind:value={systemSessionCadence}>
                                {#each CADENCES as c}
                                    <option>{c}</option>
                                {/each}
                            </select>
                        </div>
                        {#if systemSessionCadence === 'fortnightly'}
                            <div class="field field-narrow">
                                <label class="field-label" for="sys-anchor">Anchor date</label>
                                <input id="sys-anchor" class="field-input" type="date" bind:value={systemCadenceAnchor} />
                            </div>
                        {/if}
                        <div class="field-row-break"></div>
                        <label class="check-row">
                            <input type="checkbox" bind:checked={systemEnabled} />
                            <span>Enabled</span>
                        </label>
                        {#if systemError}
                            <p class="field-error">{systemError}</p>
                        {/if}
                        {#if systemMessage}
                            <p class="pairing-message">{systemMessage}</p>
                        {/if}
                        <button type="submit" class="primary-button" disabled={!systemSelectId || systemSaving}>
                            {systemSaving ? 'Saving…' : 'Save System'}
                        </button>
                    </form>
                </div>

                <div class="sub-section">
                    <h4 class="sub-heading">Super-admins</h4>
                    <ul class="block-list">
                        {#each clubSuperAdmins as sa (sa.user_id)}
                            <li class="block-row">
                                <span class="block-names">
                                    <strong>{sa.player_name ?? sa.discord_name}</strong>
                                    {#if sa.player_name}<span class="block-note">({sa.discord_name})</span>{/if}
                                </span>
                                <button class="remove-btn" type="button" title="Remove super-admin" onclick={() => removeSuperAdmin(sa.user_id)}>×</button>
                            </li>
                        {/each}
                        {#if clubSuperAdmins.length === 0}
                            <p class="muted">No super-admin appointed yet.</p>
                        {/if}
                    </ul>

                    <form class="appoint-form" onsubmit={(e) => { e.preventDefault(); appointSuperAdmin(); }}>
                        <div class="field">
                            <label class="field-label" for="appoint-user">User</label>
                            <select id="appoint-user" class="field-select" bind:value={appointUserIdStr}>
                                <option value="">— Select user —</option>
                                {#each clubGrantableUsers as u}
                                    <option value={String(u.id)}>{u.player_name} ({u.discord_name})</option>
                                {/each}
                            </select>
                        </div>
                        {#if appointError}
                            <p class="field-error">{appointError}</p>
                        {/if}
                        <button type="submit" class="primary-button" disabled={!appointUserIdStr || appointing}>
                            {appointing ? 'Appointing…' : 'Appoint Super-admin'}
                        </button>
                    </form>
                </div>
            {/if}
        </section>
            </div>
        </details>
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

    .platform-banner {
        padding: 10px 14px;
        background: rgba(180, 90, 60, 0.08);
        border: 1px solid rgba(180, 90, 60, 0.3);
        border-radius: 8px;
    }

    .platform-banner a {
        color: var(--color-accent);
    }

    .admin-section {
        margin-bottom: 2rem;
    }

    /* ── Dashboard groups (collapsible) ──────────────────────────────────── */

    .dash-group {
        margin-bottom: 1.25rem;
        background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-surface-dark) 100%);
        border: 1px solid var(--color-accent-border);
        border-radius: 12px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        overflow: hidden;
    }

    .dash-group-header {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 14px 18px;
        cursor: pointer;
        font-size: 0.95rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--color-accent);
        background: rgba(0, 0, 0, 0.25);
        border-bottom: 1px solid transparent;
        user-select: none;
        list-style: none;
    }

    .dash-group-header::-webkit-details-marker { display: none; }

    .dash-group[open] .dash-group-header {
        border-bottom-color: var(--color-accent-border);
    }

    .dash-chevron {
        font-size: 0.7rem;
        line-height: 1;
        transition: transform 0.15s;
        display: inline-block;
    }

    .dash-group[open] .dash-chevron {
        transform: rotate(90deg);
    }

    .dash-group-title {
        flex: 1;
    }

    .dash-group-body {
        padding: 1.25rem 1.5rem;
    }

    .dash-group-body .admin-section {
        margin-bottom: 1.75rem;
    }

    .dash-group-body .admin-section:last-child {
        margin-bottom: 0;
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

    .slug-warning {
        color: var(--color-accent);
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
    }

    .table-wrap {
        overflow-x: auto;
    }

    .clubs-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        color: var(--color-text-base);
    }

    .clubs-table thead th {
        background: rgba(0, 0, 0, 0.25);
        color: var(--color-accent);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        font-weight: 700;
        padding: 8px 10px;
        text-align: left;
    }

    .clubs-table td {
        padding: 8px 10px;
        font-size: 0.9rem;
        border-top: 1px solid var(--color-accent-border-soft);
    }

    .selected-row {
        background: var(--color-surface-hover);
    }

    .status-badge {
        display: inline-block;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 999px;
    }

    .status-active {
        background: rgba(110, 180, 110, 0.15);
        color: var(--color-win);
        border: 1px solid rgba(110, 180, 110, 0.4);
    }

    .status-inactive {
        background: rgba(148, 163, 184, 0.1);
        color: var(--color-text-faint);
        border: 1px solid rgba(148, 163, 184, 0.25);
    }

    .block-list {
        list-style: none;
        padding: 0;
        margin: 0 0 0.75rem;
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

    .block-note {
        font-size: 0.78rem;
        color: var(--color-text-dim);
        font-style: italic;
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

    .system-form {
        margin-top: 0.5rem;
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

    .field-row-break {
        flex-basis: 100%;
        height: 0;
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

    .field-input:focus {
        outline: none;
        border-color: var(--color-accent);
    }

    .check-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.85rem;
        color: var(--color-text-base);
    }

    .field-error {
        font-size: 0.8rem;
        color: #f87171;
        margin: 0.25rem 0 0;
        width: 100%;
    }

    .pairing-message {
        font-size: 0.8rem;
        color: var(--color-win);
        margin: 0.25rem 0 0;
        width: 100%;
    }

    .primary-button {
        background: var(--color-accent);
        color: #111;
        border: none;
        border-radius: 8px;
        padding: 0 14px;
        height: 2.2rem;
        box-sizing: border-box;
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
</style>
