<script lang="ts">
    import { onMount } from 'svelte';
    import { goto, invalidateAll } from '$app/navigation';
    import { PUBLIC_API_URL } from '$env/static/public';
    import {
        SYSTEMS, NONE_FACTION, EXPERIENCE_OPTIONS, ETA_OPTIONS, formConfig
    } from '$lib/signupOptions';

    let { data } = $props();

    let system = $state(data.system);
    let week = $state(data.week);

    $effect(() => {
        system = data.system;
        week = data.week;
    });

    const cfg = $derived(formConfig(data.system));

    function changeSystem() {
        // Drop the week param so the server recomputes the right default
        // (Wednesday vs Friday vs fortnightly Friday) for the new system.
        goto(`/?${new URLSearchParams({ system })}`, { invalidateAll: true });
    }

    function changeWeek() {
        goto(`/?${new URLSearchParams({ system, week })}`, { invalidateAll: true });
    }

    /* ---------- auth ---------- */
    type AuthState = {
        authenticated: boolean;
        user?: { discord_name: string; player_id: number | null };
        player?: { id: number; name: string } | null;
    };
    let auth = $state<AuthState>({ authenticated: false });
    let authLoaded = $state(false);

    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/me`, { credentials: 'include' });
            if (r.ok) auth = await r.json();
        } catch (_) {}
        authLoaded = true;
    });

    const isClaimed = $derived(auth.authenticated && auth.user?.player_id != null);

    /* ---------- my signup for this week ---------- */
    type SignupRow = {
        faction: string | null; points: number | null; eta: string | null;
        experience: string | null; vibe: string | null; standby_ok: boolean;
        scenario: string | null; can_demo: boolean;
    };
    let current = $state<SignupRow | null>(null);
    let mineLoaded = $state(false);

    /* ---------- form fields ---------- */
    let faction = $state(NONE_FACTION);
    let points = $state(2000);
    let eta = $state('18:30');
    let experience = $state('New');
    let vibe = $state('Casual');
    let standby = $state(false);
    let scenario = $state('Open Battle');
    let canDemo = $state(false);

    let submitting = $state(false);
    let successMsg = $state<string | null>(null);
    let errorMsg = $state<string | null>(null);

    let dropConfirm = $state(false);
    let dropping = $state(false);

    function applyPrefill(src: SignupRow | null) {
        const c = formConfig(data.system);
        faction = src?.faction && [NONE_FACTION, ...c.factions].includes(src.faction) ? src.faction : NONE_FACTION;
        points = src?.points != null && src.points > 0 ? src.points : c.defaultPoints;
        eta = src?.eta && ETA_OPTIONS.includes(src.eta) ? src.eta : '18:30';
        experience = src?.experience && EXPERIENCE_OPTIONS.includes(src.experience) ? src.experience : 'New';
        vibe = src?.vibe && c.vibeOptions?.includes(src.vibe) ? src.vibe : c.defaultVibe;
        standby = !!src?.standby_ok;
        scenario = src?.scenario && ['Open Battle', 'Weekly Scenario'].includes(src.scenario) ? src.scenario : 'Open Battle';
        canDemo = !!src?.can_demo;
    }

    async function loadMine() {
        mineLoaded = false;
        current = null;
        try {
            const params = new URLSearchParams({ system: data.system, week: data.week });
            const r = await fetch(`${PUBLIC_API_URL}/signups/mine?${params}`, { credentials: 'include' });
            if (r.ok) {
                const body = await r.json();
                current = body.current ?? null;
                applyPrefill(body.current ?? body.last ?? null);
            } else {
                applyPrefill(null);
            }
        } catch (_) {
            applyPrefill(null);
        }
        mineLoaded = true;
    }

    // Re-fetch my signup whenever auth resolves or the system/week changes
    $effect(() => {
        const _sys = data.system;
        const _wk = data.week;
        if (authLoaded && isClaimed) {
            successMsg = null;
            errorMsg = null;
            dropConfirm = false;
            loadMine();
        }
    });

    async function submit() {
        if (submitting) return;
        submitting = true;
        successMsg = null;
        errorMsg = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/signups`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: data.system,
                    week: data.week,
                    faction: faction === NONE_FACTION ? null : faction,
                    points: cfg.showPoints ? points : 0,
                    eta,
                    experience,
                    vibe: cfg.fixedVibe ?? vibe,
                    standby_ok: standby,
                    scenario: cfg.showScenario ? scenario : null,
                    can_demo: cfg.showCanDemo ? canDemo : false
                })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                errorMsg = body.detail || 'Could not submit your signup.';
            } else {
                successMsg = body.created
                    ? "Thanks! You're on the list."
                    : 'Your existing signup for this week has been updated.';
                await invalidateAll();
                await loadMine();
            }
        } catch (_) {
            errorMsg = 'Network error. Please try again.';
        }
        submitting = false;
    }

    async function drop() {
        if (dropping || !dropConfirm) return;
        dropping = true;
        successMsg = null;
        errorMsg = null;
        try {
            const params = new URLSearchParams({ system: data.system, week: data.week });
            const r = await fetch(`${PUBLIC_API_URL}/signups/mine?${params}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                errorMsg = body.detail || 'Could not drop your signup.';
            } else if (body.dropped) {
                successMsg = 'Your signup for this week has been dropped.';
                dropConfirm = false;
                await invalidateAll();
                await loadMine();
            } else {
                errorMsg = 'No signup found for you this week to drop.';
            }
        } catch (_) {
            errorMsg = 'Network error. Please try again.';
        }
        dropping = false;
    }
</script>

<h2 class="page-heading">Select a System</h2>

<div class="filter-row">
    <div class="field">
        <label class="field-label" for="system">System</label>
        <select id="system" class="field-select" bind:value={system} onchange={changeSystem}>
            {#each SYSTEMS as s}
                <option value={s}>{s}</option>
            {/each}
        </select>
    </div>

    <div class="field">
        <label class="field-label" for="week">Week (DD/MM/YYYY)</label>
        <input id="week" class="field-input" type="text" bind:value={week} onblur={changeWeek} />
    </div>
</div>

<div class="stat-row">
    <div class="stat-card">
        <div class="stat-label">Signed Up</div>
        <div class="stat-value">{data.stats.signed_up}</div>
    </div>
    <div class="stat-card">
        <div class="stat-label">Newcomers</div>
        <div class="stat-value">{data.stats.newcomers}</div>
    </div>
    <div class="stat-card">
        <div class="stat-label">Veterans</div>
        <div class="stat-value">{data.stats.veterans}</div>
    </div>
</div>

<div class="section-title">Sign Up</div>

{#if !authLoaded}
    <div class="signup-card card"><p class="muted">Loading…</p></div>
{:else if !auth.authenticated}
    <div class="signup-card card">
        <p class="prompt-body">Sign in with Discord to sign up for this week's session.</p>
        <a class="primary-button" href={`${PUBLIC_API_URL}/auth/discord/login`}>Sign in with Discord</a>
    </div>
{:else if !isClaimed}
    <div class="signup-card card">
        <p class="prompt-body">
            Almost there, <strong>{auth.user?.discord_name}</strong> — link your player profile
            first so your signups count toward your record.
        </p>
        <a class="primary-button" href="/claim">Link my player profile</a>
    </div>
{:else}
    <div class="signup-card card">
        {#if current}
            <div class="signed-up-note">
                ✓ You're signed up for {data.week}. Submitting again updates your entry.
            </div>
        {/if}

        <div class="form-grid">
            <div class="field">
                <label class="field-label" for="su-faction">{cfg.factionLabel}</label>
                <select id="su-faction" class="field-select" bind:value={faction}>
                    <option value={NONE_FACTION}>{NONE_FACTION}</option>
                    {#each cfg.factions as f}
                        <option value={f}>{f}</option>
                    {/each}
                </select>
            </div>

            {#if cfg.showPoints}
                <div class="field">
                    <label class="field-label" for="su-points">Army Points</label>
                    <input id="su-points" class="field-input" type="number" min="0" max="10000" step="50" bind:value={points} />
                    {#if cfg.pointsCaption}
                        <p class="field-caption">{cfg.pointsCaption}</p>
                    {/if}
                </div>
            {/if}

            <div class="field">
                <label class="field-label" for="su-eta">Estimated Time of Arrival</label>
                <select id="su-eta" class="field-select" bind:value={eta}>
                    {#each ETA_OPTIONS as t}
                        <option value={t}>{t}</option>
                    {/each}
                </select>
            </div>

            <div class="field">
                <label class="field-label" for="su-exp">Experience</label>
                <select id="su-exp" class="field-select" bind:value={experience}>
                    {#each EXPERIENCE_OPTIONS as e}
                        <option value={e}>{e}</option>
                    {/each}
                </select>
            </div>

            {#if cfg.vibeOptions}
                <div class="field">
                    <label class="field-label" for="su-vibe">Type of Game</label>
                    <select id="su-vibe" class="field-select" bind:value={vibe}>
                        {#each cfg.vibeOptions as v}
                            <option value={v}>{v}</option>
                        {/each}
                    </select>
                </div>
            {/if}

            {#if cfg.showScenario}
                <div class="field">
                    <label class="field-label" for="su-scen">Scenario Preference</label>
                    <select id="su-scen" class="field-select" bind:value={scenario}>
                        <option value="Open Battle">Open Battle</option>
                        <option value="Weekly Scenario">Weekly Scenario</option>
                    </select>
                </div>
            {/if}
        </div>

        <label class="check-row">
            <input type="checkbox" bind:checked={standby} />
            <span>I Can Be on Standby</span>
        </label>

        {#if cfg.showCanDemo}
            <label class="check-row">
                <input type="checkbox" bind:checked={canDemo} />
                <span>I Can Lead an Intro Game</span>
            </label>
        {/if}

        {#if errorMsg}
            <div class="error fade-in">{errorMsg}</div>
        {/if}
        {#if successMsg}
            <div class="success fade-in">{successMsg}</div>
        {/if}

        <div class="actions">
            <button class="primary-button" onclick={submit} disabled={submitting || !mineLoaded} type="button">
                {submitting ? 'Submitting…' : 'Submit'}
            </button>
        </div>
    </div>

    {#if current}
        <div class="section-title">Need to Drop Out?</div>
        <div class="signup-card card">
            <label class="check-row">
                <input type="checkbox" bind:checked={dropConfirm} />
                <span>I confirm I want to drop my signup for this week</span>
            </label>
            <div class="actions">
                <button class="drop-button" onclick={drop} disabled={!dropConfirm || dropping} type="button">
                    {dropping ? 'Dropping…' : 'Drop My Signup'}
                </button>
            </div>
        </div>
    {/if}
{/if}

<style>
    .page-heading { font-size: 1.5rem; margin: 0 0 1rem; }

    .filter-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    @media (max-width: 600px) {
        .filter-row { grid-template-columns: 1fr; }
    }

    .signup-card { padding: 1.25rem 1.5rem; margin-bottom: 0.5rem; }

    .muted { margin: 0; color: var(--color-text-dim); font-style: italic; }

    .prompt-body { margin: 0 0 0.9rem; color: var(--color-text-base); line-height: 1.5; }

    .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0 1rem;
    }

    @media (max-width: 600px) {
        .form-grid { grid-template-columns: 1fr; }
    }

    .field-caption {
        margin: 0.3rem 0 0;
        font-size: 0.78rem;
        color: var(--color-text-dim);
        font-style: italic;
    }

    .check-row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin: 0.35rem 0;
        color: var(--color-text-base);
        font-size: 0.95rem;
        cursor: pointer;
    }

    .check-row input {
        width: 17px;
        height: 17px;
        accent-color: var(--color-accent);
        cursor: pointer;
    }

    .signed-up-note {
        background: rgba(110, 180, 110, 0.10);
        border: 1px solid rgba(110, 180, 110, 0.40);
        color: var(--color-text-bright);
        padding: 0.55rem 0.9rem;
        border-radius: 10px;
        margin-bottom: 1rem;
        font-size: 0.88rem;
    }

    .error {
        background: rgba(210, 80, 80, 0.12);
        border: 1px solid rgba(210, 80, 80, 0.5);
        color: var(--color-text-bright);
        padding: 0.7rem 1rem;
        border-radius: 10px;
        margin-top: 0.75rem;
        font-size: 0.9rem;
    }

    .success {
        background: rgba(110, 180, 110, 0.12);
        border: 1px solid rgba(110, 180, 110, 0.5);
        color: var(--color-text-bright);
        padding: 0.7rem 1rem;
        border-radius: 10px;
        margin-top: 0.75rem;
        font-size: 0.9rem;
    }

    .actions { margin-top: 1rem; }

   .primary-button {
        display: inline-block;
        background: rgba(201, 161, 74, 0.18);
        border: 1px solid rgba(201, 161, 74, 0.55);
        color: var(--color-text-bright);
        padding: 0.7rem 1.25rem;
        border-radius: 10px;
        font-size: 0.95rem;
        font-weight: 600;
        font-family: inherit;
        text-decoration: none;
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease, transform 0.08s ease, opacity 0.15s ease;
    }

    .primary-button:hover:not(:disabled) {
        background: rgba(201, 161, 74, 0.30);
        border-color: var(--color-accent);
    }

    .primary-button:active:not(:disabled) {
        transform: scale(0.98);
    }

    .primary-button:disabled { opacity: 0.5; cursor: not-allowed; }

    .drop-button {
        background: rgba(210, 80, 80, 0.12);
        border: 1px solid rgba(210, 80, 80, 0.5);
        color: var(--color-text-bright);
        padding: 0.7rem 1.25rem;
        border-radius: 10px;
        font-size: 0.95rem;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.15s ease, transform 0.08s ease;
    }

    .drop-button:hover:not(:disabled) { background: rgba(210, 80, 80, 0.25); }
    .drop-button:active:not(:disabled) { transform: scale(0.98); }
    .drop-button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>