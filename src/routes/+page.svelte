<script lang="ts">
    import { onMount } from 'svelte';
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { goto, invalidateAll } from '$app/navigation';
    import { PUBLIC_API_URL } from '$env/static/public';
    import {
        SYSTEMS, NONE_FACTION, EXPERIENCE_OPTIONS, ETA_OPTIONS, formConfig
    } from '$lib/signupOptions';
    import {
        getSystemsConfig, configFor, sortVibeOptions, FALLBACK_SYSTEMS_CONFIG, type SystemConfig
    } from '$lib/systemsConfig';
    import { getClubSlugFromHostname } from '$lib/clubSlug';
    import { fetchMySystems } from '$lib/mySystems';
    import SystemPicker from '$lib/SystemPicker.svelte';

    let { data } = $props();

    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);
    onMount(() => {
        // Pass the club slug so the signup form shows this club's own vibe
        // config (falls back to the platform default when the club hasn't set one).
        const club = getClubSlugFromHostname(window.location.hostname);
        getSystemsConfig(club).then((c) => (systemsConfig = c));
    });

    let system = $state(data.system);
    let week = $state(data.week);

    let stats = $state({ signed_up: 0, newcomers: 0, veterans: 0 });

    async function loadStats(sys: string, wk: string) {
        try {
            const params = new URLSearchParams({ system: sys, week: wk });
            const r = await fetch(`${PUBLIC_API_URL}/signups/stats?${params}`, { credentials: 'include' });
            if (r.ok) stats = await r.json();
        } catch (_) {}
    }

    $effect(() => {
        system = data.system;
        week = data.week;
        loadStats(data.system, data.week);
    });

    const cfg = $derived(formConfig(data.system, systemsConfig));

    function selectSystem(s: string) {
        if (s === system) return;
        system = s;
        // Drop the week param so the server recomputes the right default
        // (Wednesday vs Friday vs fortnightly Friday) for the new system.
        goto(`/?${new URLSearchParams({ system: s })}`, { invalidateAll: true });
    }

    function changeWeek() {
        goto(`/?${new URLSearchParams({ system, week })}`, { invalidateAll: true });
    }

    let showWeekField = $state(false);


    /* ---------- auth ---------- */
    type AuthState = {
        authenticated: boolean;
        user?: { discord_name: string; player_id: number | null };
        player?: { id: number; name: string } | null;
    };
    let auth = $state<AuthState>({ authenticated: false });
    let authLoaded = $state(false);

    // The caller's own club's actually-enabled systems (GET /systems/mine,
    // authenticated). null until resolved or if unauthenticated/failed —
    // callers fall back to the full SYSTEMS list so an anonymous visitor
    // still sees every tab, same as before this change.
    let mySystems = $state<string[] | null>(null);
    const tabSystems = $derived(mySystems ?? SYSTEMS);
    // Gates the system-selector row so it renders once, already filtered to the
    // club's systems — never flashing the full list before /systems/mine
    // resolves. True after resolution (or immediately for anonymous visitors,
    // who correctly see every system).
    let systemsResolved = $state(false);
    // Everything below reads auth/systemsConfig-dependent state (the system
    // tabs, the sign-up card's auth branch) — gating the whole page on both
    // being resolved means it appears once, fully formed, instead of the
    // tab row and sign-up card popping in separately as each fetch lands.
    const pageReady = $derived(authLoaded && systemsResolved);

    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/me`, { credentials: 'include' });
            if (r.ok) auth = await r.json();
        } catch (_) {}
        authLoaded = true;
        if (auth.authenticated) {
            mySystems = await fetchMySystems();
        }
        systemsResolved = true;
    });

    // Once the club's real system list resolves, if the currently-selected
    // system isn't actually enabled for this club (e.g. the server-side
    // default of "The Old World" isn't one this club runs), switch to the
    // first system that is — the homepage's purpose is signing up for a
    // real session, so it shouldn't strand the user on an unusable tab.
    $effect(() => {
        if (mySystems && mySystems.length > 0 && !mySystems.includes(system)) {
            selectSystem(mySystems[0]);
        }
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
        const c = formConfig(data.system, systemsConfig);
        faction = src?.faction && [NONE_FACTION, ...c.factions].includes(src.faction) ? src.faction : NONE_FACTION;
        points = src?.points != null && src.points > 0 ? src.points : c.defaultPoints;
        eta = src?.eta && ETA_OPTIONS.includes(src.eta) ? src.eta : '18:30';
        experience = src?.experience && EXPERIENCE_OPTIONS.includes(src.experience) ? src.experience : 'New';
        vibe = src?.vibe && c.vibeOptions?.includes(src.vibe) ? src.vibe : c.defaultVibe;
        standby = !!src?.standby_ok;
        scenario = src?.scenario && c.scenarioOptions.includes(src.scenario) ? src.scenario : c.defaultScenario;
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
                await loadPairings(data.system, data.week);
            } else {
                errorMsg = 'No signup found for you this week to drop.';
            }
        } catch (_) {
            errorMsg = 'Network error. Please try again.';
        }
        dropping = false;
    }

    /* ---------- pairings / swap ---------- */
    type MatchupWithIds = {
        player_a_name: string;
        player_a_id: number | null;
        player_b_name: string | null;
        player_b_id: number | null;
        is_bye: boolean;
    };

    let pairingsPublished = $state(false);
    let myPairing = $state<MatchupWithIds | null>(null);
    let otherPlayers = $state<{ player_id: number; player_name: string }[]>([]);

    let swapTarget = $state<number | ''>('');
    let swapSubmitting = $state(false);
    let swapSuccess = $state<string | null>(null);
    let swapError = $state<string | null>(null);

    async function loadPairings(sys: string, wk: string) {
        const myPlayerId = auth.user?.player_id;
        if (!myPlayerId) return;
        try {
            // No club param needed — the backend resolves the caller's own
            // club from the session cookie (authenticated, since we already
            // returned above otherwise) or, for anonymous callers, this
            // request's Origin header (subdomain-based resolution).
            const params = new URLSearchParams({ system: sys, week: wk });
            const r = await fetch(`${PUBLIC_API_URL}/pairings?${params}`, { credentials: 'include' });
            if (!r.ok) { pairingsPublished = false; myPairing = null; otherPlayers = []; return; }
            const d = await r.json();
            if (!d.published) { pairingsPublished = false; myPairing = null; otherPlayers = []; return; }
            pairingsPublished = true;
            myPairing = (d.matchups as MatchupWithIds[]).find(
                (m) => m.player_a_id === myPlayerId || m.player_b_id === myPlayerId
            ) ?? null;
            const seen = new Set<number>();
            const others: { player_id: number; player_name: string }[] = [];
            for (const m of d.matchups as MatchupWithIds[]) {
                if (m.player_a_id && m.player_a_id !== myPlayerId && !seen.has(m.player_a_id)) {
                    seen.add(m.player_a_id);
                    others.push({ player_id: m.player_a_id, player_name: m.player_a_name });
                }
                if (m.player_b_id && m.player_b_id !== myPlayerId && !seen.has(m.player_b_id)) {
                    seen.add(m.player_b_id);
                    others.push({ player_id: m.player_b_id, player_name: m.player_b_name! });
                }
            }
            otherPlayers = others;
        } catch (_) {
            pairingsPublished = false;
            myPairing = null;
            otherPlayers = [];
        }
    }

    $effect(() => {
        const _sys = data.system;
        const _wk = data.week;
        if (authLoaded && isClaimed) {
            swapSuccess = null;
            swapError = null;
            swapTarget = '';
            loadPairings(_sys, _wk);
        } else {
            pairingsPublished = false;
            myPairing = null;
            otherPlayers = [];
        }
    });

    const myOpponentName = $derived(
        myPairing && !myPairing.is_bye
            ? (myPairing.player_a_id === auth.user?.player_id
                ? myPairing.player_b_name
                : myPairing.player_a_name)
            : null
    );

    async function submitSwap() {
        if (swapSubmitting || swapTarget === '') return;
        swapSubmitting = true;
        swapSuccess = null;
        swapError = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/signups/swap`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: data.system,
                    week: data.week,
                    opponent_player_id: swapTarget,
                })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                swapError = body.detail || 'Could not arrange the game.';
            } else {
                swapSuccess = 'Done! Check Discord for the update.';
                swapTarget = '';
                await invalidateAll();
                await loadPairings(data.system, data.week);
            }
        } catch (_) {
            swapError = 'Network error. Please try again.';
        }
        swapSubmitting = false;
    }

    /* ---------- pre-arranged game ---------- */
    type PlayerOption = { id: number; name: string };
    let players = $state<PlayerOption[]>([]);

    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/players`, { credentials: 'include' });
            if (r.ok) players = await r.json();
        } catch (_) {}
    });

    let preA = $state<number | ''>('');
    let preAFaction = $state(NONE_FACTION);
    let preB = $state<number | ''>('');
    let preBFaction = $state(NONE_FACTION);
    let prePoints = $state(2000);
    let preEta = $state('18:30');
    let preVibe = $state('Casual');

    let preSubmitting = $state(false);
    let preSuccess = $state<string | null>(null);
    let preError = $state<string | null>(null);

    // The prearranged form reads the backend's vibe_options for the system,
    // sorted for display.
    const preVibeOptions = $derived(sortVibeOptions(configFor(systemsConfig, data.system).vibe_options));
    const preShowPoints = $derived(configFor(systemsConfig, data.system).uses_points);
    const prePlayerFactionLabel = $derived(cfg.factionLabel.replace('Your ', ''));

    // Reset the prearranged form's per-system fields when the system changes.
    // Use the backend's default_vibe rather than preVibeOptions[0] — option
    // order isn't guaranteed by the backend (observed alphabetical), so
    // indexing into it picked the wrong default for HH ("Intro" before
    // "Standard") when tested against live data.
    $effect(() => {
        preVibe = configFor(systemsConfig, data.system).default_vibe || preVibeOptions[0] || 'Casual';
        preAFaction = NONE_FACTION;
        preBFaction = NONE_FACTION;
        preA = '';
        preB = '';
        prePoints = cfg.defaultPoints;
        preSuccess = null;
        preError = null;
    });

    async function submitPrearranged() {
        if (preSubmitting) return;
        preError = null;
        preSuccess = null;

        if (preA === '' || preB === '') {
            preError = 'Please select both players.';
            return;
        }
        if (preA === preB) {
            preError = 'Player A and Player B must be different.';
            return;
        }
        if (preAFaction === NONE_FACTION || preBFaction === NONE_FACTION) {
            preError = 'Please pick a faction for both players.';
            return;
        }

        preSubmitting = true;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/signups/prearranged`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: data.system,
                    week: data.week,
                    player_a_id: preA,
                    player_b_id: preB,
                    faction_a: preAFaction,
                    faction_b: preBFaction,
                    eta: preEta,
                    vibe: preVibe,
                    points: preShowPoints ? prePoints : null
                })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                preError = body.detail || 'Could not submit the pre-arranged game.';
            } else {
                const aName = players.find((p) => p.id === preA)?.name ?? 'Player A';
                const bName = players.find((p) => p.id === preB)?.name ?? 'Player B';
                preSuccess = `Pre-arranged game submitted: ${aName} vs ${bName}.`;
                preA = '';
                preB = '';
                preAFaction = NONE_FACTION;
                preBFaction = NONE_FACTION;
                await invalidateAll();
                if (isClaimed) await loadMine();
            }
        } catch (_) {
            preError = 'Network error. Please try again.';
        }
        preSubmitting = false;
    }
</script>

{#if pageReady}
<div class="page-reveal" in:fly={{ y: 24, duration: 550, easing: cubicOut }}>

<h2 class="page-heading">Select a System</h2>

<SystemPicker
    systems={tabSystems}
    {systemsConfig}
    isActive={(s) => system === s}
    onSelect={selectSystem}
/>

<div class="next-session-row">
    <span>Next session: <strong>{data.week}</strong></span>
    <button type="button" class="link-button" onclick={() => (showWeekField = !showWeekField)}>
        {showWeekField ? 'Cancel' : 'Change week'}
    </button>
</div>

{#if showWeekField}
    <div class="field week-field">
        <label class="field-label" for="week">Week (DD/MM/YYYY)</label>
        <input id="week" class="field-input" type="text" bind:value={week} onblur={changeWeek} />
    </div>
{/if}

<div class="stat-row">
    <div class="stat-card" in:fly={{ y: 16, duration: 400, delay: 0 }}>
        <div class="stat-label">Signed Up</div>
        <div class="stat-value">{stats.signed_up}</div>
    </div>
    <div class="stat-card" in:fly={{ y: 16, duration: 400, delay: 70 }}>
        <div class="stat-label">Newcomers</div>
        <div class="stat-value">{stats.newcomers}</div>
    </div>
    <div class="stat-card" in:fly={{ y: 16, duration: 400, delay: 140 }}>
        <div class="stat-label">Veterans</div>
        <div class="stat-value">{stats.veterans}</div>
    </div>
</div>

<div class="section-title">Sign Up</div>

{#if !auth.authenticated}
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
                    <input id="su-points" class="field-input" type="number" min="0" max={cfg.maxPoints} step="50" bind:value={points} />
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
                        {#each cfg.scenarioOptions as s}
                            <option value={s}>{s}</option>
                        {/each}
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

    {#if pairingsPublished && myPairing}
        <div class="section-title">Re-arrange your game</div>
        <div class="signup-card card">
            <p class="muted" style="margin: 0 0 0.75rem;">
                {#if myOpponentName}
                    Your current pairing: vs <strong>{myOpponentName}</strong>
                {:else}
                    You currently have no opponent.
                {/if}
            </p>
            {#if otherPlayers.length > 0}
                <div class="field">
                    <label class="field-label" for="swap-target">Re-arrange with</label>
                    <select id="swap-target" class="field-select" bind:value={swapTarget}>
                        <option value="">— Select player —</option>
                        {#each otherPlayers as p}
                            <option value={p.player_id}>{p.player_name}</option>
                        {/each}
                    </select>
                </div>
                {#if swapError}
                    <div class="error fade-in">{swapError}</div>
                {/if}
                {#if swapSuccess}
                    <div class="success fade-in">{swapSuccess}</div>
                {/if}
                <div class="actions">
                    <button
                        class="primary-button"
                        onclick={submitSwap}
                        disabled={swapSubmitting || swapTarget === ''}
                        type="button"
                    >
                        {#if swapSubmitting}
                            Arranging…
                        {:else if swapTarget !== ''}
                            Re-arrange with {otherPlayers.find((p) => p.player_id === swapTarget)?.player_name}
                        {:else}
                            Re-arrange your game
                        {/if}
                    </button>
                </div>
            {:else}
                <p class="muted">No other players in this week's pairings.</p>
            {/if}
        </div>
    {/if}

    <div class="section-title">Pre-Arranged Game</div>
    <details class="card prearranged-card">
        <summary>Set up a pre-arranged game</summary>
        <p class="prompt-body small">
            Use this if you've already arranged a game with someone outside the regular
            signup process. Both players need an existing profile, and neither can already
            be signed up for {data.week} — drop first using the form above if needed. If one
            player later drops out, the other remains in the weekly pairings pool.
        </p>

        {#if players.length < 2}
            <p class="muted">Pre-arranged games need at least two active players in the system.</p>
        {:else}
            <div class="form-grid">
                <div class="field">
                    <label class="field-label" for="pre-a">Player A</label>
                    <select id="pre-a" class="field-select" bind:value={preA}>
                        <option value="">— Select —</option>
                        {#each players as p}
                            <option value={p.id}>{p.name}</option>
                        {/each}
                    </select>
                </div>
                <div class="field">
                    <label class="field-label" for="pre-a-fac">Player A's {prePlayerFactionLabel}</label>
                    <select id="pre-a-fac" class="field-select" bind:value={preAFaction}>
                        <option value={NONE_FACTION}>{NONE_FACTION}</option>
                        {#each cfg.factions as f}
                            <option value={f}>{f}</option>
                        {/each}
                    </select>
                </div>

                <div class="field">
                    <label class="field-label" for="pre-b">Player B</label>
                    <select id="pre-b" class="field-select" bind:value={preB}>
                        <option value="">— Select —</option>
                        {#each players as p}
                            <option value={p.id}>{p.name}</option>
                        {/each}
                    </select>
                </div>
                <div class="field">
                    <label class="field-label" for="pre-b-fac">Player B's {prePlayerFactionLabel}</label>
                    <select id="pre-b-fac" class="field-select" bind:value={preBFaction}>
                        <option value={NONE_FACTION}>{NONE_FACTION}</option>
                        {#each cfg.factions as f}
                            <option value={f}>{f}</option>
                        {/each}
                    </select>
                </div>

                {#if preShowPoints}
                    <div class="field">
                        <label class="field-label" for="pre-pts">Army Points</label>
                        <input id="pre-pts" class="field-input" type="number" min="0" max={cfg.maxPoints} step="50" bind:value={prePoints} />
                    </div>
                {/if}

                <div class="field">
                    <label class="field-label" for="pre-eta">Estimated Time of Arrival</label>
                    <select id="pre-eta" class="field-select" bind:value={preEta}>
                        {#each ETA_OPTIONS as t}
                            <option value={t}>{t}</option>
                        {/each}
                    </select>
                </div>

                <div class="field">
                    <label class="field-label" for="pre-vibe">Type of Game</label>
                    <select id="pre-vibe" class="field-select" bind:value={preVibe}>
                        {#each preVibeOptions as v}
                            <option value={v}>{v}</option>
                        {/each}
                    </select>
                </div>
            </div>

            {#if preError}
                <div class="error fade-in">{preError}</div>
            {/if}
            {#if preSuccess}
                <div class="success fade-in">{preSuccess}</div>
            {/if}

            <div class="actions">
                <button class="primary-button" onclick={submitPrearranged} disabled={preSubmitting} type="button">
                    {preSubmitting ? 'Submitting…' : 'Submit'}
                </button>
            </div>
        {/if}
    </details>
{/if}

</div>
{/if}

<style>
    .page-heading { font-size: 1.5rem; margin: 0 0 1rem; }

    .next-session-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.9rem;
        color: var(--color-text-base);
        margin-bottom: 1rem;
    }

    .link-button {
        background: none;
        border: none;
        color: var(--color-accent);
        font-family: inherit;
        font-size: 0.85rem;
        text-decoration: underline;
        cursor: pointer;
        padding: 0;
    }

    .week-field {
        margin-bottom: 1rem;
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
        border-radius: var(--radius);
        margin-bottom: 1rem;
        font-size: 0.88rem;
    }

    .error {
        background: rgba(210, 80, 80, 0.12);
        border: 1px solid rgba(210, 80, 80, 0.5);
        color: var(--color-text-bright);
        padding: 0.7rem 1rem;
        border-radius: var(--radius);
        margin-top: 0.75rem;
        font-size: 0.9rem;
    }

    .success {
        background: rgba(110, 180, 110, 0.12);
        border: 1px solid rgba(110, 180, 110, 0.5);
        color: var(--color-text-bright);
        padding: 0.7rem 1rem;
        border-radius: var(--radius);
        margin-top: 0.75rem;
        font-size: 0.9rem;
    }

    .actions { margin-top: 1rem; }

   .primary-button {
        display: inline-block;
        background: var(--color-accent);
        border: 1px solid var(--color-accent);
        color: #1b1206;
        padding: 0.7rem 1.4rem;
        border-radius: var(--radius);
        font-size: 0.95rem;
        font-weight: 700;
        font-family: inherit;
        text-decoration: none;
        cursor: pointer;
        transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.08s ease, opacity 0.15s ease;
    }

    .primary-button:hover:not(:disabled) {
        background: var(--color-accent-soft);
        box-shadow: 0 4px 16px var(--color-accent-glow);
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
        border-radius: var(--radius);
        font-size: 0.95rem;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.15s ease, transform 0.08s ease;
    }

    .drop-button:hover:not(:disabled) { background: rgba(210, 80, 80, 0.25); }
    .drop-button:active:not(:disabled) { transform: scale(0.98); }
    .drop-button:disabled { opacity: 0.5; cursor: not-allowed; }

    .prearranged-card {
        padding: 1.25rem 1.5rem;
        margin-bottom: 0.5rem;
    }

    .prearranged-card summary {
        cursor: pointer;
        font-weight: 600;
        color: var(--color-text-bright);
        list-style: none;
    }

    .prearranged-card summary::-webkit-details-marker { display: none; }

    .prearranged-card summary::before {
        content: '▸ ';
        color: var(--color-accent);
    }

    .prearranged-card[open] summary::before {
        content: '▾ ';
    }

    .prompt-body.small {
        font-size: 0.85rem;
        margin-top: 0.75rem;
    }
</style>