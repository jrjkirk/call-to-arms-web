<script lang="ts">
    import { getAdminMe, getMe } from '$lib/session';
    import PageSkeleton from '$lib/PageSkeleton.svelte';
    import { page } from '$app/state';
    import { loginHref } from '$lib/loginUrl';
    import GoogleSignIn from '$lib/GoogleSignIn.svelte';
    import { signInProviders } from '$lib/signInProviders';
    import { onMount } from 'svelte';
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
    import NightPicker from '$lib/NightPicker.svelte';
    import ModeSwitch from '$lib/ModeSwitch.svelte';
    import { fetchHome, fetchPairings, peekHome, peekPairings, weekday, type HomeNight, type PairingsData } from '$lib/home/api';
    import { peek, revalidate } from '$lib/swr';
    import DiscordGateNotice from '$lib/DiscordGateNotice.svelte';
    import ExperienceBadge, { type ExperienceSummary } from '$lib/ExperienceBadge.svelte';
    import HelpTip from '$lib/HelpTip.svelte';
    import { discordGateFrom, detailText, type DiscordGateBlock } from '$lib/discordGate';

    // Discord membership gate. Held per form area so the prompt appears next
    // to whatever the player was actually trying to do, and remembers that
    // action so "try again" re-runs it after they join.
    let signupGate = $state<DiscordGateBlock | null>(null);
    let preGate = $state<DiscordGateBlock | null>(null);
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

    let stats = $state({
        signed_up: 0, newcomers: 0, veterans: 0, cap_enabled: false,
        cap_max_players: null as number | null, cap_tables: null as number | null, is_full: false,
        /** Set only when this system's admin has auto-pairings on. */
        pairings_post: null as { day: string; time: string } | null
    });

    /** Which system/week `stats` describes, so the count can show what this
     *  visit already knows (from Your week) until the fresh one arrives,
     *  rather than flashing 0. */
    let statsFor = $state('');

    // Everything this page reads comes through $lib/swr: what this visit last
    // saw shows at once, and the fresh answer replaces it only if it changed.
    async function loadStats(sys: string, wk: string) {
        const k = `/signups/stats?${new URLSearchParams({ system: sys, week: wk })}`;
        const seen = peek<typeof stats>(k);
        if (seen) { stats = seen; statsFor = `${sys}|${wk}`; }
        await revalidate<typeof stats>(k, (v) => { stats = v; statsFor = `${sys}|${wk}`; });
    }

    $effect(() => {
        system = data.system;
        loadStats(data.system, data.week);
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


    /* The club's nights, for the tile grid. Null for a visitor (GET /home
       needs an account) or if it fails, and the page falls back to the plain
       system tiles. */
    let nights = $state<HomeNight[] | null>(null);
    // From earlier in this visit straight away, refreshed behind.
    onMount(async () => {
        nights = peekHome()?.nights ?? null;
        nights = (await fetchHome())?.nights ?? nights;
    });
    const night = $derived(nights?.find((n) => n.system === data.system) ?? null);
    /** "Wednesday", for the button: the night, not the system, is what a
     *  player is saying yes to. Falls back to the system's name. */
    const nightName = $derived(night && night.week === data.week ? weekday(night.date) : data.system);

    /* Home's "Can't make it" and "Re-arrange" link here with #drop and
       #rearrange. Both sections appear only once the signup and pairings have
       loaded, after the browser has already looked for the fragment, so this
       finds them itself (bounded, like the call-out focus below). */
    let scrolledToHash = false;
    async function scrollToHash() {
        if (scrolledToHash) return;
        const id = window.location.hash.slice(1);
        if (id !== 'drop' && id !== 'rearrange') return;
        for (let i = 0; i < 60; i++) {
            const el = document.getElementById(id);
            if (el) {
                scrolledToHash = true;
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }
            await new Promise(requestAnimationFrame);
        }
    }


    /* ---------- auth ---------- */
    type AuthState = {
        authenticated: boolean;
        user?: { name: string; discord_name: string | null; player_id: number | null };
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
        // Shared answers for the visit ($lib/session): instant after the first page.
        const [me, adminMe] = await Promise.all([getMe(), getAdminMe()]);
        if (me) auth = me;
        adminScopes = adminMe?.scopes ?? [];
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
        const k = `/signups/experience?system=${encodeURIComponent(system)}`;
        myExperience = peek<ExperienceSummary>(k) ?? null;
        await revalidate<ExperienceSummary>(k, (v) => (myExperience = v));
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

    type MineBody = { current: SignupRow | null; last: SignupRow | null };
    function applyMine(body: MineBody) {
        current = body.current ?? null;
        applyPrefill(body.current ?? body.last ?? null);
    }

    async function loadMine() {
        const k = `/signups/mine?${new URLSearchParams({ system: data.system, week: data.week })}`;
        const seen = peek<MineBody>(k);
        if (seen) {
            applyMine(seen);
            mineLoaded = true;
        } else {
            mineLoaded = false;
            current = null;
        }
        // Applied again only if it changed, so a form someone has started
        // filling in isn't reset by the same answer arriving twice.
        const changed = await revalidate<MineBody>(k, applyMine);
        if (!seen && !changed) applyPrefill(null);
        mineLoaded = true;
        scrollToHash();
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

    /* The week's pairings, shared with Home and Pairings ($lib/home/api): if
       either has already shown this week, the re-arrange card is drawn from
       that at once and refreshed behind. */
    async function loadPairings(sys: string, wk: string) {
        const seenPairings = peekPairings(sys, wk);
        if (seenPairings) showPairings(seenPairings);
        showPairings(await fetchPairings(sys, wk));
    }

    function showPairings(d: PairingsData) {
        const myPlayerId = auth.player?.id;
        if (!myPlayerId) return;
        try {
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
            scrollToHash();
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
    let players = $state<PlayerOption[]>(peek<PlayerOption[]>('/players') ?? []);

    onMount(() => {
        revalidate<PlayerOption[]>('/players', (v) => (players = v));
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
</script>


{#if pageReady}
<div class="page-reveal">

<h1 class="page-title">Sign up</h1>

<ModeSwitch mode="club" system={data.system} />

{#if nights && nights.length}
    <NightPicker {nights} {systemsConfig} active={system} onSelect={selectSystem} />
{:else}
    <SystemPicker
        systems={tabSystems}
        {systemsConfig}
        isActive={(s) => system === s}
        onSelect={selectSystem}
    />
{/if}

<!-- The night in numbers: who's coming, and how many are new or veterans. -->
<div class="night-stats">
    <span class="ns">
        <b style={night ? `color: ${night.accent_color}` : ''}>{statsFor === `${data.system}|${data.week}` || !night || night.week !== data.week ? stats.signed_up : night.signed_up}{#if stats.cap_enabled && stats.cap_max_players}<small>/{stats.cap_max_players}</small>{/if}</b>
        <span>Signed up</span>
    </span>
    <!-- Always all three, so on a phone they sit in the night tiles' columns. -->
    <span class="ns"><b class="ns-new">{stats.newcomers}</b><span>{stats.newcomers === 1 ? 'Newcomer' : 'Newcomers'}</span></span>
    <span class="ns"><b class="ns-vet">{stats.veterans}</b><span>{stats.veterans === 1 ? 'Veteran' : 'Veterans'}</span></span>
</div>

<div class="section-title">Your signup</div>

{#if !auth.authenticated}
    <div class="signup-card card">
        <p class="prompt-body">Sign in to sign up for this week's session.</p>
        <div class="signin-row">
            <a class="primary-button" href={loginHref(page.url)}>Sign in with Discord</a>
            <GoogleSignIn url={page.url} class="secondary-button" />
            {#if $signInProviders.includes('email')}
                <a class="secondary-button" href={`/signin?next=${encodeURIComponent(page.url.pathname + page.url.search)}`}>Sign in with email</a>
            {/if}
        </div>
    </div>
{:else if !isClaimed}
    <div class="signup-card card">
        <p class="prompt-body">
            Almost there, <strong>{auth.user?.name}</strong>. Link your player profile
            first so your signups count toward your record.
        </p>
        <a class="primary-button" href="/claim">Link my player profile</a>
    </div>
{:else}
    <div class="signup-card card">
        {#if current}
            <p class="state-word in">You're in</p>
        {:else if stats.is_full}
            <p class="state-word full">Full</p>
        {/if}

        <div class="form-grid">
            <div class="field">
                <label class="field-label" for="su-faction">{cfg.factionLabel.replace(/^Your /i, '')}</label>
                <select id="su-faction" class="field-select" bind:value={faction}>
                    <option value={NONE_FACTION}>None</option>
                    <FactionOptions {systemsConfig} system={data.system} />
                </select>
            </div>

            {#if cfg.showPoints}
                <div class="field">
                    <label class="field-label" for="su-points">Points</label>
                    <input id="su-points" class="field-input" type="number" min="0" max={cfg.maxPoints} step="50" bind:value={points} />
                </div>
            {/if}

            <div class="field" class:field-full={etaChoices.length <= 6}>
                <span class="field-label" id="su-eta-label">Arrives</span>
                <!-- Taps for a short list; a club with no start time set
                     still gets the long default list, which is a dropdown. -->
                {#if etaChoices.length <= 6}
                    <div class="chips chips-time" role="radiogroup" aria-labelledby="su-eta-label">
                        {#each etaChoices as t}
                            <button type="button" class="chip" role="radio" aria-checked={eta === t}
                                    onclick={() => { eta = t; etaTouched = true; }}>{t}</button>
                        {/each}
                    </div>
                {:else}
                    <select class="field-select" aria-labelledby="su-eta-label" bind:value={eta}
                            onchange={() => (etaTouched = true)}>
                        {#each etaChoices as t}
                            <option value={t}>{t}</option>
                        {/each}
                    </select>
                {/if}
            </div>

            {#if cfg.vibeOptions}
                <div class="field field-full">
                    <span class="field-label" id="su-vibe-label">Kind of game</span>
                    <div class="chips" role="radiogroup" aria-labelledby="su-vibe-label">
                        {#each cfg.vibeOptions as v}
                            <button type="button" class="chip" role="radio" aria-checked={vibe === v} onclick={() => (vibe = v)}>{v}</button>
                        {/each}
                    </div>
                </div>
            {/if}

            {#if cfg.showScenario}
                <div class="field">
                    <label class="field-label" for="su-scen">Scenario</label>
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
                    <p class="muted small">…</p>
                {/if}
            </div>
        </div>

        <!-- Gated at last. The API has always zeroed standby_ok unless the
             system allowed it, so on the five systems that don't, this box
             was there and did nothing. -->
        {#if cfg.showStandby}
            <label class="check-row">
                <input type="checkbox" bind:checked={standby} />
                <span>Happy to sit out if numbers are odd</span>
            </label>
        {/if}

        {#if cfg.showCanDemo}
            <label class="check-row">
                <input type="checkbox" bind:checked={canDemo} />
                <span>I can teach someone new</span>
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
            <button class="primary-button signup-cta" onclick={submit} disabled={submitting || !mineLoaded || (stats.is_full && !current)} type="button">
                {submitting ? 'Saving…' : (stats.is_full && !current) ? 'Session full' : current ? 'Update my signup' : `Sign up for ${nightName}`}
            </button>
            {#if stats.pairings_post}
                <p class="cta-note">Pairings go up {stats.pairings_post.day} at {stats.pairings_post.time}</p>
            {/if}
        </div>
    </div>

{#if current}
        <div class="section-title" id="drop">Can't make it?</div>
        <div class="signup-card card">
            <label class="check-row">
                <input type="checkbox" bind:checked={dropConfirm} />
                <span>I can't make it</span>
            </label>
            <div class="actions">
                <button class="danger-button drop-button" onclick={drop} disabled={!dropConfirm || dropping} type="button">
                    {dropping ? 'Dropping…' : 'Drop out'}
                </button>
            </div>
        </div>
    {/if}

    {#if pairingsPublished && myPairing}
        <div class="section-title" id="rearrange">Re-arrange your game</div>
        <div class="signup-card card">
            <p class="current-opp">
                <span class="field-label">Playing</span>
                <b>{myOpponentName ?? 'Nobody yet'}</b>
            </p>
            {#if otherPlayers.length > 0}
                <div class="field">
                    <label class="field-label" for="swap-target">Swap to</label>
                    <select id="swap-target" class="field-select" bind:value={swapTarget}>
                        <option value="">Select</option>
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
                <p class="muted">Nobody to swap with</p>
            {/if}
        </div>
    {/if}

    <div class="section-title">Pre-arranged game
        <HelpTip label="pre-arranged games" text={"For a game you've already agreed with someone.\n\n\u2022 Neither of you can already be signed up: drop out first if you are\n\u2022 Playing someone who isn't on the app? Tick Guest and type their name\n\u2022 If one of you drops out later, the other goes back into the pairings"} />
    </div>
    <details class="card prearranged-card">
        <summary>Arrange a game</summary>

        {#if players.length < 1}
            <p class="muted">No players yet</p>
        {:else}
            <div class="form-grid">
                <div class="field">
                    {#if preCanArrangeForOthers}
                        <label class="field-label" for="pre-a">Player A</label>
                        <select id="pre-a" class="field-select" bind:value={preA}>
                            <option value="">Select</option>
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
                    <label class="field-label" for="pre-a-fac">{prePlayerFactionLabel}</label>
                    <select id="pre-a-fac" class="field-select" bind:value={preAFaction}>
                        <option value={NONE_FACTION}>None</option>
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
                            <option value="">Select</option>
                            {#each players.filter((p) => p.id !== preA) as p}
                                <option value={p.id}>{p.name}</option>
                            {/each}
                        </select>
                    {/if}
                    <label class="guest-toggle">
                        <input type="checkbox" bind:checked={preBIsGuest} />
                        Guest
                    </label>
                </div>
                <div class="field">
                    <label class="field-label" for="pre-b-fac">{prePlayerFactionLabel}</label>
                    <select id="pre-b-fac" class="field-select" bind:value={preBFaction}>
                        <option value={NONE_FACTION}>None</option>
                        <FactionOptions {systemsConfig} system={data.system} />
                    </select>
                </div>

                {#if preShowPoints}
                    <div class="field">
                        <label class="field-label" for="pre-pts">Points</label>
                        <input id="pre-pts" class="field-input" type="number" min="0" max={cfg.maxPoints} step="50" bind:value={prePoints} />
                    </div>
                {/if}

                <div class="field">
                    <label class="field-label" for="pre-eta">Arrives</label>
                    <select id="pre-eta" class="field-select" bind:value={preEta}
                            onchange={() => (etaTouched = true)}>
                        {#each etaChoices as t}
                            <option value={t}>{t}</option>
                        {/each}
                    </select>
                </div>

                <div class="field">
                    <label class="field-label" for="pre-vibe">Kind of game</label>
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
                    {preSubmitting ? 'Arranging…' : 'Arrange game'}
                </button>
            </div>
        {/if}
    </details>

{/if}

</div>
{:else}
    <PageSkeleton title="Sign up" />
{/if}

<style>
    .page-title {
        font-size: 2.4rem;
        font-weight: 700;
        line-height: 1;
        text-transform: uppercase;
        margin: 0 0 1rem;
    }

    /* The night in numbers (design rule 5): big condensed figures, each with
       a capitals label; newcomers and veterans in the colours their
       experience tier uses everywhere else. */
    .night-stats {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 1.6rem;
        margin: 0.2rem 0 1.4rem;
    }
    .ns { display: flex; flex-direction: column; gap: 0.2rem; }
    .ns b {
        font-family: var(--font-heading);
        font-size: 2rem;
        font-weight: 700;
        line-height: 1;
        color: var(--color-text-bright);
        font-variant-numeric: tabular-nums;
    }
    .ns b small { font-size: 1.1rem; color: var(--color-text-faint); }
    .ns > span {
        font-family: var(--font-heading);
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        white-space: nowrap;
        text-transform: uppercase;
        color: var(--color-text-dim);
    }
    .ns-new { color: #6eb46e !important; }
    .ns-vet { color: #d08a50 !important; }

    /* Where the signup stands, as a coloured word (design rule 4). */
    .state-word {
        margin: 0 0 1rem;
        font-family: var(--font-heading);
        font-size: 1.1rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
    }
    .state-word.in { color: var(--color-win); }
    .state-word.full { color: #d4786c; }

    .current-opp { display: flex; align-items: baseline; gap: 0.6rem; margin: 0 0 0.9rem; }
    .current-opp .field-label { margin: 0; }
    .current-opp b { color: var(--color-text-bright); font-size: 1.05rem; }

    .chips {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 6px;
    }

    .chips-time { grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); }

    .chip {
        min-height: 44px;
        padding: 0 10px;
        border-radius: var(--radius);
        border: 1px solid #343a47;
        background: none;
        color: var(--color-text-muted);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
    }

    .chip:hover { border-color: var(--color-accent-border); }

    .chip[aria-checked='true'] {
        border-color: var(--color-accent);
        background: rgba(201, 161, 74, 0.16);
        color: var(--color-text-bright);
    }

    .chip:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

    .signup-cta { min-height: 50px; padding: 0 28px; font-size: 1.05rem; }
    .cta-note {
        margin: 0.6rem 0 0;
        font-family: var(--font-heading);
        font-size: 0.92rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--color-text-dim);
    }

    @media (max-width: 560px) {
        .page-title { font-size: 2.1rem; }
        .signup-cta { width: 100%; }
        .cta-note { text-align: center; }
        /* The same three columns as the night tiles above (NightPicker),
           each number centred under a tile. */
        .night-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
        .ns { align-items: center; text-align: center; }
        .ns > span { letter-spacing: 0.05em; }
    }

    .signup-card { padding: 1.25rem 1.5rem; margin-bottom: 0.5rem; }

    .muted { margin: 0; color: var(--color-text-dim); }

    .prompt-body { margin: 0 0 0.9rem; color: var(--color-text-base); line-height: 1.5; }

    .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0 1rem;
    }

    @media (max-width: 600px) {
        .form-grid { grid-template-columns: 1fr; }
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

    /* The shared .primary-button (app.css), larger, with a glow on hover: the
       one action this page exists for. */
    .primary-button {
        border: 1px solid var(--color-accent);
        color: #1b1206;
        padding: 0.7rem 1.4rem;
        font-size: 0.95rem;
        transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.08s ease, opacity 0.15s ease;
    }

    .primary-button:hover:not(:disabled) {
        background: var(--color-accent-soft);
        box-shadow: 0 4px 16px var(--color-accent-glow);
    }

    .primary-button:active:not(:disabled) {
        transform: scale(0.98);
    }

    .drop-button { min-height: 2.8rem; padding: 0 1.25rem; }

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
        font-family: var(--font-heading);
        font-size: 1.05rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-bright);
        list-style: none;
    }
    .prearranged-card[open] summary { margin-bottom: 1rem; }

    .prearranged-card summary::-webkit-details-marker { display: none; }

    .prearranged-card summary::before {
        content: '▸ ';
        color: var(--color-accent);
    }

    .prearranged-card[open] summary::before {
        content: '▾ ';
    }


    .field-full { grid-column: 1 / -1; }








    .signin-row { display: flex; gap: 0.6rem; flex-wrap: wrap; }


</style>