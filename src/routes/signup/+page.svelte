<script lang="ts">
    import { onMount } from 'svelte';
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { goto, invalidateAll } from '$app/navigation';
    import { PUBLIC_API_URL } from '$env/static/public';
    import {
        SYSTEMS, NONE_FACTION, ETA_OPTIONS, etaOptionsFor, defaultEtaFor, formConfig
    } from '$lib/signupOptions';
    import {
        getSystemsConfig, vibeOptionsFor, usesPoints, defaultVibeFor, FALLBACK_SYSTEMS_CONFIG, type SystemConfig
    } from '$lib/systemsConfig';
    import { getClubSlugFromHostname } from '$lib/clubSlug';
    import { fetchMySystems, fetchSessionStart } from '$lib/mySystems';
    import FactionOptions from '$lib/FactionOptions.svelte';
    import SystemPicker from '$lib/SystemPicker.svelte';
    import DiscordGateNotice from '$lib/DiscordGateNotice.svelte';
    import ExperienceBadge, { type ExperienceSummary } from '$lib/ExperienceBadge.svelte';
    import { discordGateFrom, detailText, type DiscordGateBlock } from '$lib/discordGate';

    // Discord membership gate. Held per form area so the prompt appears next
    // to whatever the player was actually trying to do, and remembers that
    // action so "try again" re-runs it after they join.
    let signupGate = $state<DiscordGateBlock | null>(null);
    let preGate = $state<DiscordGateBlock | null>(null);
    let coGate = $state<DiscordGateBlock | null>(null);
    let gateRetry = $state<null | (() => void | Promise<void>)>(null);
    let gateRetrying = $state(false);

    async function retryGate() {
        if (!gateRetry) return;
        gateRetrying = true;
        try { await gateRetry(); } finally { gateRetrying = false; }
    }

    let { data } = $props();

    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);
    onMount(() => {
        // Pass the club slug so the signup form shows this club's own vibe
        // config (falls back to the platform default when the club hasn't set one).
        const club = getClubSlugFromHostname(window.location.hostname);
        getSystemsConfig(club).then((c) => (systemsConfig = c));
        fetchSessionStart(data.system).then((t) => (mySessionStart = t));
    });

    let system = $state(data.system);
    let week = $state(data.week);

    let stats = $state({ signed_up: 0, newcomers: 0, veterans: 0, cap_enabled: false, cap_max_players: null as number | null, cap_tables: null as number | null, is_full: false });

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
        loadCallOuts(data.system);
    });

    const cfg = $derived(formConfig(data.system, systemsConfig));
    /** Arrival times, and the one pre-selected: both follow this system's own
     *  session start. A club that hasn't set one keeps the original list and
     *  18:30, so nothing changes for them. */
    // Two sources, best first. The authenticated one knows the caller's real
    // club; the hostname-derived config only has a start time when they are on
    // that club's subdomain.
    let mySessionStart = $state<string | null>(null);
    const sessionStart = $derived(
        mySessionStart
        ?? systemsConfig.find((c) => c.legacy_system_name === data.system)?.session_start_time
        ?? null
    );
    const etaChoices = $derived(etaOptionsFor(sessionStart));
    const etaDefault = $derived(defaultEtaFor(sessionStart));

    function selectSystem(s: string) {
        if (s === system) return;
        system = s;
        // Drop the week param so the server recomputes the right default
        // (Wednesday vs Friday vs fortnightly Friday) for the new system.
        goto(`/signup?${new URLSearchParams({ system: s })}`, { invalidateAll: true });
    }

    function changeWeek() {
        goto(`/signup?${new URLSearchParams({ system, week })}`, { invalidateAll: true });
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
    // Scopes the caller can administer at this club. The backend lets a
    // system's admin arrange a game on two members' behalf; everyone else may
    // only arrange games they're playing in. Mirrored here so the form offers
    // exactly what the API will accept, rather than letting someone build a
    // submission that's guaranteed to 403.
    let adminScopes = $state<string[]>([]);

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

    // The session time arrives after first paint, so the placeholder default has
    // to be replaced once it is known. Deliberately does NOT read `eta`: an
    // effect that both reads and writes it loops, and "is the current value in
    // range" was the wrong test anyway, because the old 18:30 sits inside most
    // windows and so was never corrected.
    let etaTouched = $state(false);
    $effect(() => {
        const next = etaDefault;
        if (etaTouched || !next) return;
        eta = next;
        preEta = next;
    });

    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/me`, { credentials: 'include' });
            if (r.ok) auth = await r.json();
        } catch (_) {}
        try {
            // Always 200, even signed-out — no need to gate the call on auth.
            const r = await fetch(`${PUBLIC_API_URL}/admin/me`, { credentials: 'include' });
            if (r.ok) adminScopes = (await r.json()).scopes ?? [];
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

    // Multi-club network model: claimed-ness and "my player" are per active
    // club — use auth.player (active-club player from /auth/me), not the legacy
    // home-club auth.user.player_id.
    const isClaimed = $derived(auth.authenticated && auth.player != null);

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
    let eta = $state('18:30');   // replaced by etaDefault once the config loads
    // Experience is no longer asked for — it's counted from the games the club
    // has paired this player for in this system (see experience.py). The form
    // shows it; the API derives it again on submit, so the value posted here
    // is ignored and can't be tampered with.
    let myExperience = $state<ExperienceSummary | null>(null);
    let expSaving = $state(false);
    let expError = $state<string | null>(null);

    async function loadMyExperience(system: string) {
        myExperience = null;
        try {
            const r = await fetch(
                `${PUBLIC_API_URL}/signups/experience?system=${encodeURIComponent(system)}`,
                { credentials: 'include' }
            );
            if (r.ok) myExperience = await r.json();
        } catch (_) {}
    }

    async function saveExperienceExtra(extra: number) {
        expSaving = true;
        expError = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/signups/experience`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system: data.system, extra_games: extra })
            });
            const body = await r.json().catch(() => ({}));
            if (r.ok) myExperience = body;
            else expError = detailText(body, 'Could not save that.');
        } catch (_) {
            expError = 'Network error. Please try again.';
        }
        expSaving = false;
    }

    // Reload when the system changes, and once auth resolves — the count is per
    // system, and it needs a claimed player to count for. Both values are read
    // into locals so they're genuinely tracked as dependencies; a bare
    // `void x;` does not reliably register one.
    $effect(() => {
        const system = data.system;
        const claimed = isClaimed;
        if (!claimed) {
            myExperience = null;
            return;
        }
        loadMyExperience(system);
    });
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
        // A time they already chose is theirs, even if it sits outside the
        // window this system now offers.
        if (src?.eta) { eta = src.eta; etaTouched = true; }
        else eta = etaDefault;
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
        signupGate = null;
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
                    vibe: cfg.fixedVibe ?? vibe,
                    standby_ok: standby,
                    scenario: cfg.showScenario ? scenario : null,
                    can_demo: cfg.showCanDemo ? canDemo : false
                })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                const g = discordGateFrom(body);
                if (g) { signupGate = g; gateRetry = submit; }
                else errorMsg = detailText(body, 'Could not submit your signup.');
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
                errorMsg = detailText(body, 'Could not drop your signup.');
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
        const myPlayerId = auth.player?.id;
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
            ? (myPairing.player_a_id === auth.player?.id
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
                swapError = detailText(body, 'Could not arrange the game.');
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
    // Player B can be a guest who isn't on the system: type a name instead
    // of picking a roster player. The backend stores them with no profile.
    let preBIsGuest = $state(false);
    let preBGuestName = $state('');
    let prePoints = $state(2000);
    let preEta = $state('18:30');   // ditto
    let preVibe = $state('Casual');

    let preSubmitting = $state(false);
    let preSuccess = $state<string | null>(null);
    let preError = $state<string | null>(null);

    // The prearranged form reads the backend's vibe_options for the system,
    // sorted for display.
    const preVibeOptions = $derived(vibeOptionsFor(systemsConfig, data.system));
    const preShowPoints = $derived(usesPoints(systemsConfig, data.system));
    const prePlayerFactionLabel = $derived(cfg.factionLabel.replace('Your ', ''));

    // Reset the prearranged form's per-system fields when the system changes.
    // Use the backend's default_vibe rather than preVibeOptions[0] — option
    // order isn't guaranteed by the backend (observed alphabetical), so
    // indexing into it picked the wrong default for HH ("Intro" before
    // "Standard") when tested against live data.
    // Whether the caller may arrange a game they aren't playing in. Only this
    // system's admin can, matching signups.submit_prearranged's ownership
    // check — everyone else is Player A by definition.
    const preCanArrangeForOthers = $derived(adminScopes.includes(data.system));

    /** Who Player A starts as: the caller, unless they administer this system
     *  and may therefore arrange a game between two other people. Used by both
     *  reset paths — clearing it to '' after a successful submission would
     *  leave a non-admin with an empty, unfixable Player A, since the field is
     *  no longer a control they can set. */
    function defaultPlayerA(): number | '' {
        return preCanArrangeForOthers ? '' : (auth.player?.id ?? '');
    }

    $effect(() => {
        preVibe = defaultVibeFor(systemsConfig, data.system);
        preAFaction = NONE_FACTION;
        preBFaction = NONE_FACTION;
        // Reset per system because the admin scope is per system too —
        // switching tabs can change who Player A is allowed to be.
        preA = defaultPlayerA();
        preB = '';
        preBIsGuest = false;
        preBGuestName = '';
        prePoints = cfg.defaultPoints;
        preSuccess = null;
        preError = null;
    });

    async function submitPrearranged() {
        if (preSubmitting) return;
        preError = null;
        preSuccess = null;

        const guestName = preBGuestName.trim();
        if (preA === '') {
            preError = preBIsGuest ? 'Please select Player A.' : 'Please select both players.';
            return;
        }
        if (preBIsGuest) {
            if (!guestName) {
                preError = "Please enter the guest's name.";
                return;
            }
        } else {
            if (preB === '') {
                preError = 'Please select both players.';
                return;
            }
            if (preA === preB) {
                preError = 'Player A and Player B must be different.';
                return;
            }
        }
        if (preAFaction === NONE_FACTION || preBFaction === NONE_FACTION) {
            preError = 'Please pick a faction for both players.';
            return;
        }

        preSubmitting = true;
        preGate = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/signups/prearranged`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: data.system,
                    week: data.week,
                    player_a_id: preA,
                    player_b_id: preBIsGuest ? null : preB,
                    guest_b_name: preBIsGuest ? guestName : null,
                    faction_a: preAFaction,
                    faction_b: preBFaction,
                    eta: preEta,
                    vibe: preVibe,
                    points: preShowPoints ? prePoints : null
                })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                const g = discordGateFrom(body);
                if (g) { preGate = g; gateRetry = submitPrearranged; }
                else preError = detailText(body, 'Could not submit the pre-arranged game.');
            } else {
                const aName = players.find((p) => p.id === preA)?.name ?? 'Player A';
                const bName = preBIsGuest
                    ? `${guestName} (guest)`
                    : (players.find((p) => p.id === preB)?.name ?? 'Player B');
                preSuccess = `Pre-arranged game submitted: ${aName} vs ${bName}.`;
                preA = defaultPlayerA();
                preB = '';
                preBIsGuest = false;
                preBGuestName = '';
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

    /* ---------- call outs (ad-hoc, can't-make-club-night games) ---------- */
    type CallOut = {
        id: number; creator_name: string;
        game_at: string; game_date: string; game_time: string; when_label: string;
        vibe: string | null; faction: string | null; points: number | null;
        notes: string | null; status: string; is_mine: boolean;
    };
    // Whether this club sells table space, so the call-out form can point at
    // the booking page. Same source as the club page's Book a table button.
    let venueEnabled = $state(false);
    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/venue/info`, { credentials: 'include' });
            if (r.ok) venueEnabled = (await r.json()).enabled === true;
        } catch (_) {
            venueEnabled = false;
        }
    });

    let callOuts = $state<CallOut[]>([]);

    // Which call-out the URL fragment is pointing at, so one followed from
    // Discord is visibly the one you came for. The browser can't scroll to it
    // on its own: the list arrives after the page does, and by then the
    // fragment has already been resolved against a page that didn't have it.
    let targetedCallOut = $state<number | null>(null);

    async function focusTargetedCallOut() {
        const m = /^#call-out-(\d+)$/.exec(window.location.hash);
        if (!m) return;
        const id = Number(m[1]);
        if (!callOuts.some((c) => c.id === id)) return;
        targetedCallOut = id;

        // Wait for the element rather than guessing when it appears. The card
        // is several conditionals deep, so neither a frame callback nor tick()
        // was enough on its own — both ran while getElementById still returned
        // null, and the optional chain swallowed it into a silent no-op.
        // Bounded, so a call-out that never renders costs half a second and
        // then stops.
        for (let i = 0; i < 40; i++) {
            const el = document.getElementById(`call-out-${id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            await new Promise(requestAnimationFrame);
        }
    }

    async function loadCallOuts(sys: string) {
        try {
            const params = new URLSearchParams({ system: sys });
            const r = await fetch(`${PUBLIC_API_URL}/call-outs?${params}`, { credentials: 'include' });
            callOuts = r.ok ? ((await r.json()).call_outs ?? []) : [];
        } catch (_) {
            callOuts = [];
        }
        focusTargetedCallOut();
    }

    let coDate = $state('');
    let coTime = $state('18:30');
    let coVibe = $state('Casual');
    let coFaction = $state(NONE_FACTION);
    let coPoints = $state(2000);
    let coNotes = $state('');
    let coSubmitting = $state(false);
    let coSuccess = $state<string | null>(null);
    let coError = $state<string | null>(null);

    // Reset the per-system fields when the system changes (mirrors the
    // pre-arranged form's reset). Location/date/notes are left alone so a
    // config reload can't wipe what the user is mid-way through typing.
    $effect(() => {
        coVibe = defaultVibeFor(systemsConfig, data.system);
        coFaction = NONE_FACTION;
        coPoints = cfg.defaultPoints;
        coSuccess = null;
        coError = null;
    });

    async function submitCallOut() {
        if (coSubmitting) return;
        coError = null;
        coSuccess = null;
        if (!coDate) { coError = 'Please pick a date.'; return; }
        if (!coTime) { coError = 'Please pick a time.'; return; }
        if (coFaction === NONE_FACTION) { coError = `Please pick ${prePlayerFactionLabel.toLowerCase()}.`; return; }

        coSubmitting = true;
        coGate = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/call-outs`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: data.system,
                    game_date: coDate,
                    game_time: coTime,
                    vibe: coVibe,
                    faction: coFaction === NONE_FACTION ? null : coFaction,
                    points: preShowPoints ? coPoints : null,
                    notes: coNotes.trim() || null
                })
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                const g = discordGateFrom(body);
                if (g) { coGate = g; gateRetry = postCallOut; }
                else coError = detailText(body, 'Could not post the call-out.');
            } else {
                coSuccess = 'Call-out posted — it stays here and in Discord until someone takes it up or the time passes.';
                coDate = '';
                coNotes = '';
                await loadCallOuts(data.system);
            }
        } catch (_) {
            coError = 'Network error. Please try again.';
        }
        coSubmitting = false;
    }

    async function takeCallOut(id: number) {
        coError = null;
        coGate = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/call-outs/${id}/take`, { method: 'POST', credentials: 'include' });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) {
                const g = discordGateFrom(body);
                if (g) { coGate = g; gateRetry = () => takeCallOut(id); }
                else coError = detailText(body, 'Could not take up this call-out.');
            }
            else await loadCallOuts(data.system);
        } catch (_) {
            coError = 'Network error. Please try again.';
        }
    }

    async function cancelCallOut(id: number) {
        coError = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/call-outs/${id}/cancel`, { method: 'POST', credentials: 'include' });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) coError = detailText(body, 'Could not cancel this call-out.');
            else await loadCallOuts(data.system);
        } catch (_) {
            coError = 'Network error. Please try again.';
        }
    }
</script>

<svelte:head>
    <title>Signup — Call to Arms</title>
</svelte:head>

{#if pageReady}
<div class="page-reveal" in:fly={{ y: 24, duration: 550, easing: cubicOut }}>

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
        <div class="stat-value">{stats.signed_up}{#if stats.cap_enabled && stats.cap_max_players}<span class="stat-cap">/{stats.cap_max_players}</span>{/if}</div>
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
        {:else if stats.is_full}
            <div class="session-full-note">
                🚫 This session is full ({stats.cap_tables} table{stats.cap_tables === 1 ? '' : 's'} · {stats.cap_max_players} players). Sign-ups are closed for {data.week}.
            </div>
        {/if}

        <div class="form-grid">
            <div class="field">
                <label class="field-label" for="su-faction">{cfg.factionLabel}</label>
                <select id="su-faction" class="field-select" bind:value={faction}>
                    <option value={NONE_FACTION}>{NONE_FACTION}</option>
                    <FactionOptions {systemsConfig} system={data.system} />
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
                <select id="su-eta" class="field-select" bind:value={eta}
                        onchange={() => (etaTouched = true)}>
                    {#each etaChoices as t}
                        <option value={t}>{t}</option>
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

            <div class="field">
                <span class="field-label">Experience</span>
                {#if myExperience}
                    <ExperienceBadge
                        exp={myExperience}
                        saving={expSaving}
                        error={expError}
                        onSaveExtra={saveExperienceExtra}
                    />
                {:else}
                    <p class="muted small">Counting your games…</p>
                {/if}
            </div>
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

        {#if signupGate}
            <DiscordGateNotice gate={signupGate} onRetry={retryGate} retrying={gateRetrying} />
        {/if}
        {#if errorMsg}
            <div class="error fade-in">{errorMsg}</div>
        {/if}
        {#if successMsg}
            <div class="success fade-in">{successMsg}</div>
        {/if}

        <div class="actions">
            <button class="primary-button" onclick={submit} disabled={submitting || !mineLoaded || (stats.is_full && !current)} type="button">
                {submitting ? 'Submitting…' : (stats.is_full && !current) ? 'Session full' : 'Submit'}
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
            signup process. Bringing someone who isn't on the system? Tick
            <em>“Player B is a guest”</em> and just type their name — no profile needed.
            Neither player can already be signed up for {data.week} — drop first using the
            form above if needed. If one player later drops out, the other remains in the
            weekly pairings pool.
        </p>

        {#if players.length < 1}
            <p class="muted">Pre-arranged games need at least one active player in the system.</p>
        {:else}
            <div class="form-grid">
                <div class="field">
                    {#if preCanArrangeForOthers}
                        <label class="field-label" for="pre-a">Player A</label>
                        <select id="pre-a" class="field-select" bind:value={preA}>
                            <option value="">— Select —</option>
                            {#each players as p}
                                <option value={p.id}>{p.name}</option>
                            {/each}
                        </select>
                    {:else}
                        <!-- Fixed, not a disabled <select>: you can only arrange
                             games you're playing in, so offering a list you can't
                             choose from would just invite the question of why it's
                             greyed out. Plain text rather than a labelled control,
                             so no `for` pointing at a non-form element. -->
                        <span class="field-label">Player A</span>
                        <div class="field-fixed">{auth.player?.name ?? 'You'}</div>
                    {/if}
                </div>
                <div class="field">
                    <label class="field-label" for="pre-a-fac">Player A's {prePlayerFactionLabel}</label>
                    <select id="pre-a-fac" class="field-select" bind:value={preAFaction}>
                        <option value={NONE_FACTION}>{NONE_FACTION}</option>
                        <FactionOptions {systemsConfig} system={data.system} />
                    </select>
                </div>

                <div class="field">
                    <label class="field-label" for="pre-b">Player B</label>
                    {#if preBIsGuest}
                        <input
                            id="pre-b"
                            class="field-input"
                            type="text"
                            maxlength="80"
                            placeholder="Guest's name"
                            bind:value={preBGuestName}
                        />
                    {:else}
                        <!-- Player A is excluded: the API rejects a game against
                             yourself, so offering it is a guaranteed error. Filters
                             on preA rather than the logged-in player, so it stays
                             correct for an admin who has picked someone else. -->
                        <select id="pre-b" class="field-select" bind:value={preB}>
                            <option value="">— Select —</option>
                            {#each players.filter((p) => p.id !== preA) as p}
                                <option value={p.id}>{p.name}</option>
                            {/each}
                        </select>
                    {/if}
                    <label class="guest-toggle">
                        <input type="checkbox" bind:checked={preBIsGuest} />
                        Player B is a guest (not on the system)
                    </label>
                </div>
                <div class="field">
                    <label class="field-label" for="pre-b-fac">Player B's {prePlayerFactionLabel}</label>
                    <select id="pre-b-fac" class="field-select" bind:value={preBFaction}>
                        <option value={NONE_FACTION}>{NONE_FACTION}</option>
                        <FactionOptions {systemsConfig} system={data.system} />
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
                    <select id="pre-eta" class="field-select" bind:value={preEta}
                            onchange={() => (etaTouched = true)}>
                        {#each etaChoices as t}
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

            {#if preGate}
                <DiscordGateNotice gate={preGate} onRetry={retryGate} retrying={gateRetrying} />
            {/if}
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

    <div class="section-title">Call Outs</div>

    {#if callOuts.length > 0}
        <div class="callout-list">
            {#each callOuts as co (co.id)}
                <!-- id is the anchor the Discord link points at, so someone
                     following "Take it up in the app" lands on the call-out
                     itself rather than the top of the page. -->
                <div class="card callout-item" id={`call-out-${co.id}`}
                     class:callout-targeted={targetedCallOut === co.id}>
                    <div class="callout-head">
                        <strong>{co.creator_name}</strong> is looking for a game
                        <span class="callout-when">🗓️ {co.when_label}</span>
                    </div>
                    <div class="callout-meta">
                        {#if co.faction}⚔️ {co.faction}{/if}{#if co.vibe} • 🎭 {co.vibe}{/if}{#if co.points != null} • 🛡️ {co.points} pts{/if}
                    </div>
                    {#if co.notes}
                        <div class="callout-notes">📝 {co.notes}</div>
                    {/if}
                    <div class="actions callout-actions">
                        {#if co.is_mine}
                            <span class="muted callout-own">This is your call-out</span>
                            <button class="drop-button" onclick={() => cancelCallOut(co.id)} type="button">Cancel</button>
                        {:else if isClaimed}
                            <button class="primary-button" onclick={() => takeCallOut(co.id)} type="button">I'll take this game</button>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <p class="muted">No open call-outs for this system right now. Post one below if you're after an ad-hoc game.</p>
    {/if}

    <details class="card prearranged-card callout-card">
        <summary>Post a call-out</summary>
        <p class="prompt-body small">
            Want a game but not on a session day? Use this form to sign up and publicise
            your availability.
        </p>

        {#if venueEnabled}
            <!-- A nudge, not a link between the two: posting a call-out doesn't
                 book anything, and a table you haven't asked for isn't waiting
                 for you. Deliberately kept as a reminder rather than an
                 automatic booking — the game might not get taken up, and
                 holding a table on the chance it does costs the venue money. -->
            <p class="prompt-body small callout-book">
                Playing at the club? A call-out doesn’t reserve anything —
                <a href="/book" target="_blank" rel="noopener">book a table</a>
                once someone takes you up on it.
            </p>
        {/if}

        <div class="form-grid">
            <div class="field">
                <label class="field-label" for="co-date">Date</label>
                <input id="co-date" class="field-input" type="date" bind:value={coDate} />
            </div>
            <div class="field">
                <label class="field-label" for="co-time">Time</label>
                <input id="co-time" class="field-input" type="time" bind:value={coTime} />
            </div>

            <div class="field">
                <label class="field-label" for="co-fac">Your {prePlayerFactionLabel}</label>
                <select id="co-fac" class="field-select" bind:value={coFaction}>
                    <option value={NONE_FACTION}>{NONE_FACTION}</option>
                    <FactionOptions {systemsConfig} system={data.system} />
                </select>
            </div>

            <div class="field">
                <label class="field-label" for="co-vibe">Type of Game</label>
                <select id="co-vibe" class="field-select" bind:value={coVibe}>
                    {#each preVibeOptions as v}
                        <option value={v}>{v}</option>
                    {/each}
                </select>
            </div>

            {#if preShowPoints}
                <div class="field">
                    <label class="field-label" for="co-pts">Army Points</label>
                    <input id="co-pts" class="field-input" type="number" min="0" max={cfg.maxPoints} step="50" bind:value={coPoints} />
                </div>
            {/if}

            <div class="field field-full">
                <label class="field-label" for="co-notes">Notes (optional)</label>
                <textarea id="co-notes" class="field-input callout-notes-input" maxlength="500" rows="2" placeholder="Recommended: SBC. Plus anything else — parking, what you're after…" bind:value={coNotes}></textarea>
            </div>
        </div>

        {#if coGate}
            <DiscordGateNotice gate={coGate} onRetry={retryGate} retrying={gateRetrying} />
        {/if}
        {#if coError}
            <div class="error fade-in">{coError}</div>
        {/if}
        {#if coSuccess}
            <div class="success fade-in">{coSuccess}</div>
        {/if}

        <div class="actions">
            <button class="primary-button" onclick={submitCallOut} disabled={coSubmitting} type="button">
                {coSubmitting ? 'Posting…' : 'Post call-out'}
            </button>
        </div>
    </details>
{/if}

</div>
{/if}

<style>
    .callout-book {
        border-left: 2px solid var(--color-accent-border);
        padding-left: 0.6rem;
        color: var(--color-text-faint);
    }
    .callout-book a { color: var(--color-accent); }

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

    .session-full-note {
        background: rgba(207, 90, 84, 0.12);
        border: 1px solid rgba(207, 90, 84, 0.45);
        color: var(--color-text-bright);
        padding: 0.55rem 0.9rem;
        border-radius: var(--radius);
        margin-bottom: 1rem;
        font-size: 0.88rem;
    }

    .stat-cap {
        color: var(--color-text-dim);
        font-weight: 700;
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

    .guest-toggle {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin-top: 0.4rem;
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--color-text-muted);
        cursor: pointer;
    }

    .guest-toggle input[type='checkbox'] {
        width: auto;
        margin: 0;
        cursor: pointer;
        accent-color: var(--color-gold, #c9a14a);
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

    .field-full { grid-column: 1 / -1; }

    .callout-notes-input {
        resize: vertical;
        min-height: 2.4rem;
        font-family: inherit;
    }

    .callout-card { margin-top: 0.75rem; }

    .callout-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
    }

    /* Marks the call-out a Discord link pointed at. Fades rather than latches,
       so it says "this one" on arrival without staying shouty afterwards. */
    .callout-targeted {
        border-color: var(--color-accent);
        animation: callout-target-fade 2.6s ease-out forwards;
    }

    @keyframes callout-target-fade {
        0%   { box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 55%, transparent); }
        100% { box-shadow: 0 0 0 2px transparent; }
    }

    @media (prefers-reduced-motion: reduce) {
        .callout-targeted { animation: none; }
    }

    .callout-item { padding: 1rem 1.25rem; }

    .callout-head {
        color: var(--color-text-bright);
        margin-bottom: 0.35rem;
    }

    .callout-when {
        display: inline-block;
        margin-left: 0.5rem;
        color: var(--color-accent);
        font-weight: 600;
        white-space: nowrap;
    }

    .callout-meta {
        color: var(--color-text-base);
        font-size: 0.9rem;
    }

    .callout-notes {
        margin-top: 0.4rem;
        color: var(--color-text-dim);
        font-size: 0.88rem;
    }

    .callout-actions {
        margin-top: 0.85rem;
        display: flex;
        align-items: center;
        gap: 0.85rem;
    }

    .callout-own { font-size: 0.85rem; }
</style>