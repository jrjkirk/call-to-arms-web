<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import { fetchWeekId } from '$lib/weekId';
    import {
        NONE_FACTION,
        ETA_OPTIONS,
        EXPERIENCE_OPTIONS,
    } from '$lib/signupOptions';
    import {
        getSystemsConfig, configFor, sortVibeOptions, FALLBACK_SYSTEMS_CONFIG, CANONICAL_VIBES, systemLogoUrl, type SystemConfig
    } from '$lib/systemsConfig';
    import LineChart from '$lib/charts/LineChart.svelte';
    import BarChart from '$lib/charts/BarChart.svelte';
    import HBarChart from '$lib/charts/HBarChart.svelte';
    import PieChart from '$lib/charts/PieChart.svelte';

    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);

    // Every scope name is a real game system now — the old standalone
    // "League" pseudo-scope was retired from the backend (see valid_scopes());
    // league admin lives inside each system's own scope instead, gated by
    // that system's own league_enabled toggle. This always evaluates true
    // today; kept as an explicit boundary in case a non-system scope is ever
    // reintroduced, so call sites don't need to change either way.
    const isSystemScope = (scope: string) => scope !== 'League';
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // 00:00 -> 23:30 in 30-minute steps, for every time picker in this admin
    // panel (opening hours, session start time, event start/end) — dropdown
    // selects instead of the native browser time-picker, consistent with the
    // rest of the app's select-based inputs (ETA/Experience on the signup form).
    const HALF_HOUR_OPTIONS: string[] = (() => {
        const out: string[] = [];
        for (let h = 0; h < 24; h++) {
            for (const m of [0, 30]) {
                out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            }
        }
        return out;
    })();

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
    type AdminSignupRow = {
        id: number;
        player_id: number;
        player_name: string;
        faction: string | null;
        points: number | null | undefined;
        eta: string | null;
        experience: string | null;
        vibe: string | null;
        standby_ok: boolean;
        scenario: string | null;
        can_demo: boolean;
    };
    type SignupConfig = {
        show_points: boolean;
        default_points: number | null;
        show_scenario: boolean;
        show_standby: boolean;
        show_can_demo: boolean;
        vibe_options: string[];
        vibe_fixed: string | null;
    };
    type AddSignupForm = {
        open: boolean;
        playerId: string;
        faction: string;
        points: number | null | undefined;
        eta: string;
        experience: string;
        vibe: string;
        standbyOk: boolean;
        scenario: string;
        canDemo: boolean;
        submitting: boolean;
        error: string | null;
    };
    type LeagueResultRow = {
        id: number;
        result_date: string;
        player_1_id: number;
        player_1_name: string;
        player_1_faction: string | null;
        player_1_painting_bonus: string | null;
        player_1_rating_before: number;
        player_1_rating_after: number;
        player_2_id: number;
        player_2_name: string;
        player_2_faction: string | null;
        player_2_painting_bonus: string | null;
        player_2_rating_before: number;
        player_2_rating_after: number;
        game_type: string;
        result: string;
        k_factor_used: number;
    };

    // Per-system league state — modular per (club, system): each system's
    // admin section gets its own enable toggle, scoring config, seasons, and
    // results table. Mirrors the missions/call-to-arms per-scope pattern.
    type LeagueConfigData = {
        league_enabled: boolean;
        scoring_method: string; // 'elo' | 'winloss'
        starting_rating: number;
        k_casual: number;
        k_competitive: number;
        painting_fully_bonus: number;
        painting_partial_bonus: number;
        points_win: number;
        points_draw: number;
        points_loss: number;
        winloss_use_painting: boolean;
    };
    type PairingWeightConfigData = {
        uses_scenarios: boolean;
        uses_points: boolean;
        default_recent_weeks: number;
        default_extended_weeks: number;
        weight_mirror: number;
        weight_rematch: number;
        weight_vibe: number;
        weight_experience: number;
        weight_eta: number;
        weight_scenario: number;
        weight_points: number;
        recent_weeks: number | null;
        extended_weeks: number | null;
    };
    type PairingWeightState = {
        config: PairingWeightConfigData | null;
        loading: boolean;
        saving: boolean;
        error: string | null;
        message: string | null;
    };
    type LeagueChampion = { player_id: number; name: string; rating: number };
    type LeagueSeasonRow = {
        id: number;
        name: string;
        start_date: string;
        end_date: string | null;
        current: boolean;
        champion: LeagueChampion | null;
    };
    type LeagueState = {
        config: LeagueConfigData | null;
        configLoading: boolean;
        configSaving: boolean;
        configError: string | null;
        configMessage: string | null;

        seasons: LeagueSeasonRow[];
        seasonsLoading: boolean;
        seasonCreating: boolean;
        seasonError: string | null;
        newSeasonName: string;
        newSeasonStart: string;
        newSeasonEnd: string;

        // null = current season; otherwise the id of an archived season
        // being browsed read-only-ish in the results grid below.
        viewingSeasonId: number | null;

        results: LeagueResultRow[];
        resultsLoading: boolean;
        resultsError: string | null;

        // "Log results from pairings" — pulls a week's published pairings and
        // lets the admin record just the outcome per game.
        logWeek: string;
        logRows: LogResultRow[];
        logLoading: boolean;
        logSaving: boolean;
        logError: string | null;
        logMessage: string | null;
    };
    type LogResultRow = {
        pairing_id: number;
        a_name: string;
        a_faction: string | null;
        b_name: string;
        b_faction: string | null;
        result: string;       // '' until picked
        game_type: string;    // 'Competitive' | 'Casual'
        a_painting: string;   // '' | 'Partially Painted' | 'Fully Painted'
        b_painting: string;
    };
    type RearrangeForm = {
        player1Id: string;
        player2Id: string;
        submitting: boolean;
        error: string | null;
        message: string | null;
    };
    type PairingSummary = {
        games: number;
        byes: number;
        rematches: number;
        mirrors: number;
        widest_eta_gap_mins: number;
        vibe_mismatches: number;
    };
    type PairingsState = {
        week: string;
        rows: DisplayRow[];
        editRows: EditRow[];
        published: boolean;
        summary: PairingSummary | null;
        signups: SignupItem[];
        loading: boolean;
        saving: boolean;
        posting: boolean;
        dirty: boolean;
        error: string | null;
        message: string | null;
        signupRows: AdminSignupRow[];
        signupConfig: SignupConfig | null;
        signupsLoading: boolean;
        signupsError: string | null;
        addSignup: AddSignupForm;
        rearrange: RearrangeForm;
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
    type AutoPairingsSettings = {
        enabled: boolean;
        day: string;
        time: string;
        last_week: string | null;
        saving: boolean;
        error: string | null;
        message: string | null;
    };
    type CallToArmsSettings = {
        enabled: boolean;
        days_before: number;
        time: string;
        last_week: string | null;
        template: string;
        default_template: string;
        tokens: string[];
        image_mode: string;
        image_url: string;
        supports_mission_image: boolean;
        saving: boolean;
        error: string | null;
        message: string | null;
    };

    type MissionRow = {
        id: number;
        name: string | null;
        secondary_objectives: string | null;
        image_url: string | null;
        active: boolean;
    };
    type MissionGuidelines = { formats: string[]; max_size_mb: number; recommended: string };
    type MissionsState = {
        missions_enabled: boolean;
        missions_use_secondary: boolean;
        guidelines: MissionGuidelines | null;
        missions: MissionRow[];
        loading: boolean;
        error: string | null;
        settingsSaving: boolean;
        // upload form
        uploadName: string;
        uploadSecondary: string;
        uploadFile: File | null;
        uploadFileKey: number; // bump to reset the <input type=file>
        uploading: boolean;
        uploadError: string | null;
        uploadMessage: string | null;
    };

    // ── Command Table (dashboard overview) ──────────────────────────────
    type OverviewSystem = {
        system: string; slug: string; name: string;
        next_session: string; session_day: string;
        signups: number; cap_max_players: number | null; pairing_count: number;
        status: 'live' | 'drafted' | 'none';
    };
    type ChartPoint = { label: string; value: number };
    type AnalyticsState = {
        loading: boolean;
        overview: OverviewSystem[];
        // trends are per-system, lazily loaded when a system is focused
        trendSystem: string | null;
        signups: ChartPoint[];
        games: ChartPoint[];
        factions: ChartPoint[];
        ratings: ChartPoint[];
        trendsLoading: boolean;
    };
    let analytics = $state<AnalyticsState>({
        loading: true, overview: [], trendSystem: null,
        signups: [], games: [], factions: [], ratings: [], trendsLoading: false,
    });

    const STATUS_META: Record<string, { glyph: string; label: string; cls: string }> = {
        live: { glyph: '●', label: 'Pairings live', cls: 'live' },
        drafted: { glyph: '◐', label: 'Drafted — unpublished', cls: 'drafted' },
        none: { glyph: '○', label: 'No pairings yet', cls: 'none' },
    };
    // "DD/MM/YYYY" → "DD/MM" for compact chart ticks.
    const shortWeek = (w: string) => (w && w.length >= 5 ? w.slice(0, 5) : w);

    // NOTE: this runs inside onMount's Promise.all(tasks), so it must NEVER
    // reject — a thrown fetch would reject the whole batch and leave
    // pageLoading stuck true, hanging the entire admin page (this bit us once
    // when a backend endpoint 500'd). Analytics is non-essential chrome, so
    // any failure degrades to an empty Command Table, never a broken page.
    async function loadAnalytics() {
        analytics.loading = true;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/admin/analytics/overview`, { credentials: 'include' });
            if (r.ok) {
                const body = await r.json();
                analytics.overview = body.systems ?? [];
                // Auto-focus the first system's trends so the charts aren't empty on load.
                const first = analytics.overview.find((s) => isSystemScope(s.system));
                if (first) await loadTrends(first.system);
            }
        } catch {
            analytics.overview = [];
        } finally {
            analytics.loading = false;
        }
    }

    async function loadTrends(system: string) {
        analytics.trendSystem = system;
        analytics.trendsLoading = true;
        try {
            const q = `system=${encodeURIComponent(system)}`;
            const [su, ga, fa, ra] = await Promise.all([
                fetch(`${PUBLIC_API_URL}/admin/analytics/signups-over-time?${q}`, { credentials: 'include' }),
                fetch(`${PUBLIC_API_URL}/admin/analytics/games-over-time?${q}`, { credentials: 'include' }),
                fetch(`${PUBLIC_API_URL}/admin/analytics/faction-popularity?${q}`, { credentials: 'include' }),
                fetch(`${PUBLIC_API_URL}/admin/analytics/rating-distribution?${q}`, { credentials: 'include' }),
            ]);
            analytics.signups = su.ok ? (await su.json()).map((d: any) => ({ label: shortWeek(d.week), value: d.count })) : [];
            analytics.games = ga.ok ? (await ga.json()).map((d: any) => ({ label: shortWeek(d.week), value: d.count })) : [];
            analytics.factions = fa.ok ? (await fa.json()).map((d: any) => ({ label: d.faction, value: d.count })) : [];
            analytics.ratings = ra.ok
                ? ((await ra.json()).buckets ?? []).map((b: any) => ({ label: String(b.min), value: b.count }))
                : [];
        } catch {
            analytics.signups = analytics.games = analytics.factions = analytics.ratings = [];
        } finally {
            analytics.trendsLoading = false;
        }
    }

    // ── Sidebar navigation (function-first console) ─────────────────────
    // activeNav = which panel is shown; activeSystem = the focused system for
    // system-scoped panels (a single var replacing the old per-scope loop).
    let activeNav = $state('overview');
    let activeSystem = $state<string | null>(null);

    const SYSTEM_NAV = [
        { id: 'pairings', label: 'Pairings' },
        { id: 'league', label: 'League' },
        { id: 'weighting', label: 'Weighting' },
        { id: 'missions', label: 'Missions' },
        { id: 'autopairings', label: 'Auto-pairings' },
        { id: 'announcements', label: 'Announcements' },
        { id: 'clubcard', label: 'Club card' },
    ];
    // super: true = super-admin only. Blocks are club-wide and matter to
    // system admins too, so they stay visible to any admin.
    const CLUB_NAV = [
        { id: 'clubpage', label: 'Club page', super: true },
        { id: 'blocks', label: 'Players & blocks', super: false },
        { id: 'systems', label: 'Systems', super: true },
        { id: 'discord', label: 'Discord', super: true },
        { id: 'admins', label: 'Admins', super: true },
        { id: 'booking', label: 'Table booking', super: true },
    ];

    let adminMe = $state<AdminMe | null>(null);
    let adminClubSlug = $state<string | undefined>(undefined);
    let rolesData = $state<RolesData | null>(null);
    let grantableUsers = $state<GrantableUser[]>([]);
    let pageLoading = $state(true);
    let rolesLoading = $state(false);

    let blocks = $state<BlockEntry[]>([]);
    let blocksLoading = $state(false);
    let blockPlayers = $state<BlockPlayer[]>([]);
    let historyByScope = $state<Record<string, any[]>>({});
    let leagueState = $state<Record<string, LeagueState>>({});
    let pairingWeightState = $state<Record<string, PairingWeightState>>({});

    type SignupCapState = {
        enabled: boolean;
        tables: number;
        players_per_table: number;
        max_players: number;
        loading: boolean;
        saving: boolean;
        error: string | null;
        message: string | null;
    };
    let signupCapState = $state<Record<string, SignupCapState>>({});

    async function loadSignupCap(scope: string) {
        signupCapState[scope] = { enabled: false, tables: 0, players_per_table: 2, max_players: 0, loading: true, saving: false, error: null, message: null };
        const r = await fetch(`${PUBLIC_API_URL}/admin/signup-cap-settings?system=${encodeURIComponent(scope)}`, { credentials: 'include' });
        if (r.ok) {
            const d = await r.json();
            signupCapState[scope] = { ...signupCapState[scope], ...d, loading: false };
        } else {
            signupCapState[scope].loading = false;
            signupCapState[scope].error = 'Failed to load signup cap.';
        }
    }

    async function saveSignupCap(scope: string) {
        const cap = signupCapState[scope];
        cap.saving = true; cap.error = null; cap.message = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/signup-cap-settings`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system: scope, enabled: cap.enabled, tables: Number(cap.tables) || 0 }),
        });
        const body = await r.json().catch(() => ({}));
        if (r.ok) {
            signupCapState[scope] = { ...cap, ...body, saving: false, message: cap.enabled ? `Capped at ${body.tables} table(s) · ${body.max_players} players.` : 'Signup cap disabled.' };
        } else {
            cap.error = body.detail || 'Failed to save.';
            cap.saving = false;
        }
    }

    const PAINTING_OPTIONS = ['Partially Painted', 'Fully Painted'];
    const GAME_TYPE_OPTIONS = ['Casual', 'Competitive'];
    let historyLoading = $state<Record<string, boolean>>({});

    // Per-scope pairings state
    let pairings = $state<Record<string, PairingsState>>({});

    // Per-scope auto-pairings settings
    let autoPairingsSettings = $state<Record<string, AutoPairingsSettings>>({});
    let callToArmsSettings = $state<Record<string, CallToArmsSettings>>({});
    // Per-scope missions pool state
    let missionsState = $state<Record<string, MissionsState>>({});

    // Club landing page: club-wide profile (super-admin) + per-system
    // carousel card and events (each system's own admin). Mirrors the
    // Missions ownership split above.
    type ClubEventRow = {
        id: number;
        system_id: number | null;
        title: string;
        description: string | null;
        event_date: string;
        start_time: string | null;
        end_time: string | null;
        all_day: boolean;
    };
    type EventsFormState = {
        events: ClubEventRow[];
        loading: boolean;
        error: string | null;
        addTitle: string;
        addDate: string;
        addAllDay: boolean;
        addStart: string;
        addEnd: string;
        adding: boolean;
        addError: string | null;
    };
    function initEventsFormState(): EventsFormState {
        return {
            events: [], loading: false, error: null,
            addTitle: '', addDate: '', addAllDay: true, addStart: '', addEnd: '',
            adding: false, addError: null,
        };
    }

    type ClubProfileState = {
        blurb: string;
        website_url: string;
        discord_url: string;
        logo_url: string | null;
        address: string;
        latitude: number | null;
        longitude: number | null;
    };

    function googleMapsSearchUrl(address: string): string {
        const q = address.trim() || 'Manchester, UK';
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    }
    type OpeningHoursRow = { day: string; enabled: boolean; open: string; close: string; note: string };
    let clubProfile = $state<ClubProfileState | null>(null);
    let clubHours = $state<OpeningHoursRow[]>(
        DAYS.map((d) => ({ day: d, enabled: false, open: '18:00', close: '22:00', note: '' }))
    );
    let clubProfileSaving = $state(false);
    let clubProfileError = $state<string | null>(null);
    let clubProfileMessage = $state<string | null>(null);
    let clubLogoFile = $state<File | null>(null);
    let clubLogoFileKey = $state(0);
    let clubLogoUploading = $state(false);
    let clubLogoError = $state<string | null>(null);
    let clubWideEvents = $state<EventsFormState>(initEventsFormState());

    type CarouselState = {
        blurb: string;
        photo_url: string | null;
        accent_color: string;
        saving: boolean;
        error: string | null;
        message: string | null;
        uploadFile: File | null;
        uploadFileKey: number;
        uploading: boolean;
        uploadError: string | null;
    };
    let carouselState = $state<Record<string, CarouselState>>({});
    let systemEventsState = $state<Record<string, EventsFormState>>({});

    // Appoint form state
    let grantUserIdStr = $state('');
    let grantScope = $state('');
    let granting = $state(false);
    let grantError = $state<string | null>(null);

    // Add block form state
    let addBlockP1Str = $state('');
    let addBlockP2Str = $state('');
    let addBlockNote = $state('');
    let addingBlock = $state(false);
    let addBlockError = $state<string | null>(null);


    // Edit Player Profile state
    type PlayerListItem = { id: number; name: string; titles: string[]; active: boolean; admin_notes: string | null };
    let editPlayerList = $state<PlayerListItem[]>([]);
    let editPlayerIdStr = $state('');
    let editPlayerName = $state('');
    let editPlayerTitlesText = $state('');
    let editPlayerActive = $state(true);
    let editPlayerAdminNotes = $state('');
    let editPlayerSaving = $state(false);
    let editPlayerMessage = $state<string | null>(null);
    let editPlayerError = $state<string | null>(null);

    // Discord Webhooks state
    type WebhookRow = {
        webhook_type: string;
        system_id: number | null;
        system_name: string | null;
        configured: boolean;
        last_four?: string;
    };
    const WEBHOOK_TYPE_LABELS: Record<string, string> = {
        signup: 'Signup notifications',
        pairings: 'Pairings post',
        call_to_arms: 'Call to Arms post',
        league_result: 'League result',
        league_rankings: 'League rankings post',
        achievement: 'Achievement announcements',
    };
    // All webhook types are per-system now (league_result/achievement/
    // league_rankings moved off the old club-level path when leagues went
    // modular — a club webhook can post to a different Discord channel per
    // system). Every row in webhookRows carries a real system_id/system_name.
    const PER_SYSTEM_WEBHOOK_TYPES = ['signup', 'pairings', 'call_to_arms', 'league_result', 'achievement', 'league_rankings'];
    function webhookKey(webhookType: string, systemId: number | null): string {
        return `${webhookType}:${systemId ?? 'null'}`;
    }
    let webhookRows = $state<WebhookRow[]>([]);
    let webhookListError = $state<string | null>(null);
    let webhookInputs = $state<Record<string, string>>({});
    let webhookSaving = $state<Record<string, boolean>>({});
    let webhookError = $state<Record<string, string | null>>({});
    let webhookMessage = $state<Record<string, string | null>>({});

    // Club self-service Systems state
    type ClubSystemMineRow = {
        system_id: number;
        system_name: string;
        enabled: boolean;
        session_day: string;
        session_cadence: string;
        cadence_anchor: string | null;
        session_start_time: string | null;
        vibe_options: string[] | null;
        default_vibe: string | null;
        default_vibe_options: string[] | null;
        default_default_vibe: string | null;
    };
    type CatalogueSystem = { id: number; name: string; legacy_system_name: string };
    const CADENCES = ['weekly', 'fortnightly'];

    let clubSystemsMine = $state<ClubSystemMineRow[]>([]);
    let clubSystemsMineError = $state<string | null>(null);
    let fullCatalogue = $state<CatalogueSystem[]>([]);

    let csSelectId = $state('');
    let csSessionDay = $state('Wednesday');
    let csSessionCadence = $state('weekly');
    let csCadenceAnchor = $state('');
    let csSessionStartTime = $state('');
    let csEnabled = $state(true);
    let csUseDefaultVibes = $state(true);
    let csVibeOptions = $state<string[]>([]);
    let csDefaultVibe = $state('');
    let csSaving = $state(false);
    let csError = $state<string | null>(null);
    let csMessage = $state<string | null>(null);
    // Name shown in the edit-system form header (existing row or catalogue add).
    const csEditingName = $derived(
        clubSystemsMine.find((s) => String(s.system_id) === csSelectId)?.system_name
        ?? fullCatalogue.find((s) => String(s.id) === csSelectId)?.legacy_system_name
        ?? ''
    );

    // Table booking — super-admin-only oversight, not a per-system-admin
    // self-service surface like Missions/League: venue emails are closer to
    // a billing/venue relationship than day-to-day system admin work.
    type TableBookingData = {
        table_booking_enabled: boolean;
        venue_name: string | null;
        venue_email: string;
        cc_emails: string[];
        players_per_table: number;
        include_player_names: boolean;
        send_mode: string; // 'on_publish' | 'cutoff'
        cutoff_day: string | null;
        cutoff_time: string | null;
        subject_template: string | null;
        notes: string | null;
    };
    const TABLE_BOOKING_CUTOFF_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    let tbSelectScope = $state('');
    let tbLoading = $state(false);
    let tbSaving = $state(false);
    let tbError = $state<string | null>(null);
    let tbMessage = $state<string | null>(null);
    let tbEnabled = $state(false);
    let tbVenueName = $state('');
    let tbVenueEmail = $state('');
    let tbCcEmailsText = $state('');
    let tbPlayersPerTable = $state(2);
    let tbIncludeNames = $state(true);
    let tbSendMode = $state('on_publish');
    let tbCutoffDay = $state('Wednesday');
    let tbCutoffTime = $state('17:00');
    let tbSubjectTemplate = $state('');
    let tbNotes = $state('');

    type TableBookingPreview = {
        tables: number;
        headcount: number;
        player_names: string[];
        subject: string;
        html: string;
        already_sent: boolean;
    };
    type TableBookingHistoryRow = {
        week: string;
        tables: number;
        headcount: number;
        status: string;
        error: string | null;
        sent_at: string;
    };
    let tbPreviewWeek = $state('');
    let tbPreview = $state<TableBookingPreview | null>(null);
    let tbPreviewLoading = $state(false);
    let tbPreviewError = $state<string | null>(null);
    let tbSendLoading = $state(false);
    let tbSendMessage = $state<string | null>(null);
    let tbHistory = $state<TableBookingHistoryRow[]>([]);
    let tbHistoryLoading = $state(false);

    function factionsFor(system: string): string[] {
        return configFor(systemsConfig, system).faction_list;
    }

    // Vibe options offered in the pairings-grid "Type" dropdowns — sourced
    // purely from the catalogue, same as the main signup form and the
    // pre-arranged sub-form. (Previously this grid hardcoded a KT-excludes-
    // "Intro" rule that diverged from the other two surfaces; removed so all
    // three agree on whatever the catalogue says for each system.)
    function vibeOptionsFor(system: string): string[] {
        return sortVibeOptions(configFor(systemsConfig, system).vibe_options);
    }

    function showPoints(system: string): boolean {
        return configFor(systemsConfig, system).uses_points;
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

    function defaultAddSignupForm(): AddSignupForm {
        return {
            open: false,
            playerId: '',
            faction: NONE_FACTION,
            points: null,
            eta: '',
            experience: 'New',
            vibe: '',
            standbyOk: false,
            scenario: '',
            canDemo: false,
            submitting: false,
            error: null,
        };
    }

    function initPairingsState(scope: string, week: string): PairingsState {
        return {
            week,
            rows: [],
            editRows: [],
            published: false,
            summary: null,
            signups: [],
            loading: false,
            saving: false,
            posting: false,
            dirty: false,
            error: null,
            message: null,
            signupRows: [],
            signupConfig: null,
            signupsLoading: false,
            signupsError: null,
            addSignup: defaultAddSignupForm(),
            rearrange: { player1Id: '', player2Id: '', submitting: false, error: null, message: null },
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
            ps.summary = data.summary ?? null;
            ps.dirty = false;
        } else {
            ps.error = 'Failed to load pairings.';
        }
        await loadSignups(scope);
        await loadAdminSignups(scope);
        ps.loading = false;
    }

    async function loadSignups(scope: string) {
        const ps = pairings[scope];
        if (!ps) return;
        const params = new URLSearchParams({ system: scope, week: ps.week });
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairings/signup-list?${params}`, { credentials: 'include' });
        if (r.ok) ps.signups = await r.json();
    }

    async function loadAdminSignups(scope: string) {
        const ps = pairings[scope];
        if (!ps) return;
        ps.signupsLoading = true;
        ps.signupsError = null;
        const params = new URLSearchParams({ system: scope, week: ps.week });
        const r = await fetch(`${PUBLIC_API_URL}/admin/signups?${params}`, { credentials: 'include' });
        if (r.ok) {
            const data = await r.json();
            const config: SignupConfig = data.config;
            ps.signupConfig = config;
            ps.signupRows = (data.signups ?? []).map((su: AdminSignupRow) => ({
                ...su,
                faction: su.faction ?? NONE_FACTION,
                eta: su.eta ?? '',
                vibe: su.vibe ?? config.vibe_fixed ?? config.vibe_options[0] ?? '',
                scenario: su.scenario ?? '',
            }));
            ps.addSignup.points = config.default_points;
            ps.addSignup.vibe = config.vibe_fixed ?? config.vibe_options[0] ?? '';
        } else {
            ps.signupsError = 'Failed to load signups.';
        }
        ps.signupsLoading = false;
    }

    async function patchSignup(scope: string, su: AdminSignupRow, field: keyof AdminSignupRow, value: any) {
        const ps = pairings[scope];
        if (!ps) return;
        let v = value;
        if (typeof v === 'number' && isNaN(v)) v = null;
        if (v === undefined) v = null;
        if (field === 'scenario' && v === '') v = null;
        if (field === 'eta' && v === '') v = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/signups/${su.id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: v }),
        });
        if (r.ok) {
            const updated = await r.json();
            su.faction = updated.faction ?? NONE_FACTION;
            su.points = updated.points;
            su.eta = updated.eta ?? '';
            su.experience = updated.experience;
            su.vibe = updated.vibe ?? '';
            su.standby_ok = updated.standby_ok;
            su.scenario = updated.scenario ?? '';
            su.can_demo = updated.can_demo;
        } else {
            const body = await r.json().catch(() => ({}));
            ps.signupsError = body.detail || 'Failed to update signup.';
        }
    }

    async function forceDropSignup(scope: string, signupId: number) {
        const ps = pairings[scope];
        if (!ps) return;
        if (!confirm('Force drop this signup? This cannot be undone.')) return;
        const r = await fetch(`${PUBLIC_API_URL}/admin/signups/${signupId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (r.ok) {
            ps.signupRows = ps.signupRows.filter((su) => su.id !== signupId);
        } else {
            const body = await r.json().catch(() => ({}));
            ps.signupsError = body.detail || 'Failed to drop signup.';
        }
    }

    async function submitAddSignup(scope: string) {
        const ps = pairings[scope];
        if (!ps) return;
        const form = ps.addSignup;
        if (!form.playerId) {
            form.error = 'Select a player.';
            return;
        }
        form.submitting = true;
        form.error = null;
        const body: Record<string, any> = {
            system: scope,
            week: ps.week,
            player_id: Number(form.playerId),
            faction: form.faction === NONE_FACTION ? null : form.faction,
            eta: form.eta || null,
            experience: form.experience,
            standby_ok: form.standbyOk,
            can_demo: form.canDemo,
        };
        if (ps.signupConfig?.show_points) body.points = form.points;
        if (!ps.signupConfig?.vibe_fixed) body.vibe = form.vibe;
        if (ps.signupConfig?.show_scenario) body.scenario = form.scenario || null;

        const r = await fetch(`${PUBLIC_API_URL}/admin/signups`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (r.ok) {
            const created: AdminSignupRow = await r.json();
            ps.signupRows = [
                ...ps.signupRows,
                {
                    ...created,
                    faction: created.faction ?? NONE_FACTION,
                    eta: created.eta ?? '',
                    vibe: created.vibe ?? '',
                    scenario: created.scenario ?? '',
                },
            ].sort((a, b) => a.player_name.localeCompare(b.player_name));
            ps.addSignup = defaultAddSignupForm();
            ps.addSignup.points = ps.signupConfig?.default_points ?? null;
            ps.addSignup.vibe = ps.signupConfig?.vibe_fixed ?? ps.signupConfig?.vibe_options[0] ?? '';
        } else {
            const body2 = await r.json().catch(() => ({}));
            form.error = body2.detail || 'Failed to add signup.';
        }
        form.submitting = false;
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
            ps.summary = data.summary ?? null;
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
        if (!ps) return;
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

    async function rearrangeGame(scope: string) {
        const ps = pairings[scope];
        if (!ps) return;
        const form = ps.rearrange;
        if (!form.player1Id || !form.player2Id) {
            form.error = 'Select both players.';
            return;
        }
        if (form.player1Id === form.player2Id) {
            form.error = 'Players must be different.';
            return;
        }
        form.submitting = true;
        form.error = null;
        form.message = null;
        const r = await fetch(`${PUBLIC_API_URL}/signups/swap`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system: scope,
                week: ps.week,
                player_1_id: Number(form.player1Id),
                opponent_player_id: Number(form.player2Id),
            }),
        });
        if (r.ok) {
            form.message = 'Re-arranged! Check Discord for the announcement.';
            form.player1Id = '';
            form.player2Id = '';
            await loadPairings(scope);
        } else {
            const body = await r.json().catch(() => ({}));
            form.error = body.detail || 'Re-arrange failed.';
        }
        form.submitting = false;
    }

    async function loadAutoPairingsSettings(scope: string) {
        const r = await fetch(
            `${PUBLIC_API_URL}/admin/auto-pairings-settings?system=${encodeURIComponent(scope)}`,
            { credentials: 'include' }
        );
        if (r.ok) {
            const data = await r.json();
            autoPairingsSettings[scope] = {
                enabled: data.enabled,
                day: data.day,
                time: data.time,
                last_week: data.last_week,
                saving: false,
                error: null,
                message: null,
            };
        }
    }

    async function saveAutoPairingsSettings(scope: string) {
        const s = autoPairingsSettings[scope];
        if (!s) return;
        s.saving = true;
        s.error = null;
        s.message = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/auto-pairings-settings`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system: scope, enabled: s.enabled, day: s.day, time: s.time }),
        });
        if (r.ok) {
            s.message = 'Saved.';
        } else {
            const body = await r.json().catch(() => ({}));
            s.error = body.detail || 'Save failed.';
        }
        s.saving = false;
    }

    async function loadCallToArmsSettings(scope: string) {
        const r = await fetch(
            `${PUBLIC_API_URL}/admin/call-to-arms-settings?system=${encodeURIComponent(scope)}`,
            { credentials: 'include' }
        );
        if (r.ok) {
            const data = await r.json();
            callToArmsSettings[scope] = {
                enabled: data.enabled,
                days_before: data.days_before,
                time: data.time,
                last_week: data.last_week,
                template: data.template ?? '',
                default_template: data.default_template ?? '',
                tokens: data.tokens ?? [],
                // Non-scenario systems have no mission image, so "default"
                // there just means no image — show it as "none" for clarity.
                image_mode: (data.supports_mission_image === false && (data.image_mode ?? 'default') === 'default')
                    ? 'none'
                    : (data.image_mode ?? 'default'),
                image_url: data.image_url ?? '',
                supports_mission_image: data.supports_mission_image ?? false,
                saving: false,
                error: null,
                message: null,
            };
        }
    }

    async function saveCallToArmsSettings(scope: string) {
        const s = callToArmsSettings[scope];
        if (!s) return;
        s.saving = true;
        s.error = null;
        s.message = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/call-to-arms-settings`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system: scope, enabled: s.enabled, days_before: s.days_before, time: s.time,
                template: s.template, image_mode: s.image_mode, image_url: s.image_url,
            }),
        });
        if (r.ok) {
            s.message = 'Saved.';
        } else {
            const body = await r.json().catch(() => ({}));
            s.error = body.detail || 'Save failed.';
        }
        s.saving = false;
    }

    async function loadMissions(scope: string) {
        const prev = missionsState[scope];
        const r = await fetch(
            `${PUBLIC_API_URL}/admin/missions?system=${encodeURIComponent(scope)}`,
            { credentials: 'include' }
        );
        if (r.ok) {
            const data = await r.json();
            missionsState[scope] = {
                missions_enabled: data.missions_enabled,
                missions_use_secondary: data.missions_use_secondary,
                guidelines: data.guidelines ?? null,
                missions: data.missions ?? [],
                loading: false,
                error: null,
                settingsSaving: false,
                uploadName: prev?.uploadName ?? '',
                uploadSecondary: prev?.uploadSecondary ?? '',
                uploadFile: null,
                uploadFileKey: prev?.uploadFileKey ?? 0,
                uploading: false,
                uploadError: null,
                uploadMessage: null,
            };
        }
    }

    async function saveMissionsSettings(scope: string) {
        const ms = missionsState[scope];
        if (!ms) return;
        ms.settingsSaving = true;
        ms.error = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/missions-settings`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system: scope,
                missions_enabled: ms.missions_enabled,
                missions_use_secondary: ms.missions_use_secondary,
            }),
        });
        if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            ms.error = body.detail || 'Save failed.';
        }
        ms.settingsSaving = false;
    }

    async function uploadMission(scope: string) {
        const ms = missionsState[scope];
        if (!ms) return;
        ms.uploadError = null;
        ms.uploadMessage = null;
        if (!ms.uploadFile) {
            ms.uploadError = 'Choose an image to upload.';
            return;
        }
        ms.uploading = true;
        const fd = new FormData();
        fd.append('system', scope);
        if (ms.uploadName.trim()) fd.append('name', ms.uploadName.trim());
        if (ms.missions_use_secondary && ms.uploadSecondary.trim())
            fd.append('secondary_objectives', ms.uploadSecondary.trim());
        fd.append('image', ms.uploadFile);
        const r = await fetch(`${PUBLIC_API_URL}/admin/missions`, {
            method: 'POST',
            credentials: 'include',
            body: fd, // no Content-Type — browser sets the multipart boundary
        });
        if (r.ok) {
            const created = await r.json();
            ms.missions = [...ms.missions, created];
            ms.uploadName = '';
            ms.uploadSecondary = '';
            ms.uploadFile = null;
            ms.uploadFileKey += 1;
            ms.uploadMessage = 'Mission added.';
        } else {
            const body = await r.json().catch(() => ({}));
            ms.uploadError = body.detail || 'Upload failed.';
        }
        ms.uploading = false;
    }

    async function patchMission(scope: string, m: MissionRow, patch: Partial<MissionRow>) {
        const ms = missionsState[scope];
        if (!ms) return;
        const r = await fetch(`${PUBLIC_API_URL}/admin/missions/${m.id}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        });
        if (r.ok) {
            const updated = await r.json();
            ms.missions = ms.missions.map((x) => (x.id === m.id ? updated : x));
        } else {
            const body = await r.json().catch(() => ({}));
            ms.error = body.detail || 'Update failed.';
        }
    }

    async function deleteMission(scope: string, m: MissionRow) {
        const ms = missionsState[scope];
        if (!ms) return;
        if (!confirm(`Delete this mission${m.name ? ` (“${m.name}”)` : ''}? This can't be undone.`)) return;
        const r = await fetch(`${PUBLIC_API_URL}/admin/missions/${m.id}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (r.ok) {
            ms.missions = ms.missions.filter((x) => x.id !== m.id);
        } else {
            const body = await r.json().catch(() => ({}));
            ms.error = body.detail || 'Delete failed.';
        }
    }

    // ── Club landing page: super-admin profile ────────────────────────────
    async function loadClubProfile() {
        const r = await fetch(`${PUBLIC_API_URL}/club`, { credentials: 'include' });
        if (!r.ok) return;
        const data = await r.json();
        clubProfile = {
            blurb: data.club.blurb ?? '',
            website_url: data.club.website_url ?? '',
            discord_url: data.club.discord_url ?? '',
            logo_url: data.club.logo_url,
            address: data.club.address ?? '',
            latitude: data.club.latitude ?? null,
            longitude: data.club.longitude ?? null,
        };
        const byDay = new Map((data.club.opening_hours ?? []).map((h: any) => [h.day, h]));
        clubHours = DAYS.map((d) => {
            const row: any = byDay.get(d);
            return row
                ? { day: d, enabled: true, open: row.open ?? '18:00', close: row.close ?? '22:00', note: row.note ?? '' }
                : { day: d, enabled: false, open: '18:00', close: '22:00', note: '' };
        });
    }

    async function saveClubProfile() {
        if (!clubProfile) return;
        clubProfileSaving = true;
        clubProfileError = null;
        clubProfileMessage = null;
        const opening_hours = clubHours
            .filter((h) => h.enabled)
            .map((h) => ({ day: h.day, open: h.open, close: h.close, note: h.note.trim() || null }));
        const r = await fetch(`${PUBLIC_API_URL}/admin/club`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                blurb: clubProfile.blurb,
                website_url: clubProfile.website_url,
                discord_url: clubProfile.discord_url,
                opening_hours,
                address: clubProfile.address,
                latitude: clubProfile.latitude,
                longitude: clubProfile.longitude,
            }),
        });
        if (r.ok) {
            clubProfileMessage = 'Saved.';
        } else {
            const body = await r.json().catch(() => ({}));
            clubProfileError = body.detail || 'Save failed.';
        }
        clubProfileSaving = false;
    }

    async function uploadClubLogo() {
        if (!clubLogoFile) {
            clubLogoError = 'Choose an image to upload.';
            return;
        }
        clubLogoUploading = true;
        clubLogoError = null;
        const fd = new FormData();
        fd.append('image', clubLogoFile);
        const r = await fetch(`${PUBLIC_API_URL}/admin/club/logo`, {
            method: 'POST',
            credentials: 'include',
            body: fd,
        });
        if (r.ok) {
            const data = await r.json();
            if (clubProfile) clubProfile.logo_url = data.logo_url;
            clubLogoFile = null;
            clubLogoFileKey += 1;
        } else {
            const body = await r.json().catch(() => ({}));
            clubLogoError = body.detail || 'Upload failed.';
        }
        clubLogoUploading = false;
    }

    async function deleteClubLogo() {
        if (!confirm('Remove the club logo?')) return;
        const r = await fetch(`${PUBLIC_API_URL}/admin/club/logo`, { method: 'DELETE', credentials: 'include' });
        if (r.ok && clubProfile) clubProfile.logo_url = null;
    }

    // ── Club landing page: events, shared by the club-wide (super-admin)
    // and per-system (that system's admin) call sites below. ────────────
    async function loadClubWideEvents() {
        clubWideEvents.loading = true;
        const r = await fetch(`${PUBLIC_API_URL}/admin/club/events`, { credentials: 'include' });
        if (r.ok) {
            const all: ClubEventRow[] = await r.json();
            clubWideEvents.events = all.filter((e) => e.system_id === null);
        }
        clubWideEvents.loading = false;
    }

    async function addClubWideEvent() {
        const s = clubWideEvents;
        s.addError = null;
        if (!s.addTitle.trim() || !s.addDate) {
            s.addError = 'Title and date are required.';
            return;
        }
        s.adding = true;
        const r = await fetch(`${PUBLIC_API_URL}/admin/club/events`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system: null,
                title: s.addTitle.trim(),
                event_date: s.addDate,
                all_day: s.addAllDay,
                start_time: s.addAllDay ? null : s.addStart || null,
                end_time: s.addAllDay ? null : s.addEnd || null,
            }),
        });
        if (r.ok) {
            const created = await r.json();
            s.events = [...s.events, created];
            s.addTitle = '';
            s.addDate = '';
            s.addAllDay = true;
            s.addStart = '';
            s.addEnd = '';
        } else {
            const body = await r.json().catch(() => ({}));
            s.addError = body.detail || 'Failed to add event.';
        }
        s.adding = false;
    }

    async function deleteClubWideEvent(id: number) {
        if (!confirm('Delete this event?')) return;
        const r = await fetch(`${PUBLIC_API_URL}/admin/club/events/${id}`, { method: 'DELETE', credentials: 'include' });
        if (r.ok) clubWideEvents.events = clubWideEvents.events.filter((e) => e.id !== id);
    }

    // ── Club landing page: per-system carousel card ────────────────────
    async function loadCarousel(scope: string) {
        const r = await fetch(`${PUBLIC_API_URL}/club`, { credentials: 'include' });
        if (!r.ok) return;
        const data = await r.json();
        const sys = (data.systems ?? []).find((s: any) => s.legacy_system_name === scope);
        carouselState[scope] = {
            blurb: sys?.blurb ?? '',
            photo_url: sys?.photo_url ?? null,
            accent_color: sys?.accent_color ?? '#c9a14a',
            saving: false, error: null, message: null,
            uploadFile: null, uploadFileKey: 0, uploading: false, uploadError: null,
        };
    }

    async function saveCarousel(scope: string) {
        const cs = carouselState[scope];
        if (!cs) return;
        cs.saving = true;
        cs.error = null;
        cs.message = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/club-systems/carousel`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system: scope,
                blurb: cs.blurb,
                accent_color: cs.accent_color,
            }),
        });
        if (r.ok) {
            cs.message = 'Saved.';
        } else {
            const body = await r.json().catch(() => ({}));
            cs.error = body.detail || 'Save failed.';
        }
        cs.saving = false;
    }

    async function uploadCarouselPhoto(scope: string) {
        const cs = carouselState[scope];
        if (!cs || !cs.uploadFile) {
            if (cs) cs.uploadError = 'Choose an image to upload.';
            return;
        }
        cs.uploading = true;
        cs.uploadError = null;
        const fd = new FormData();
        fd.append('system', scope);
        fd.append('image', cs.uploadFile);
        const r = await fetch(`${PUBLIC_API_URL}/admin/club-systems/carousel/photo`, {
            method: 'POST',
            credentials: 'include',
            body: fd,
        });
        if (r.ok) {
            const data = await r.json();
            cs.photo_url = data.photo_url;
            cs.uploadFile = null;
            cs.uploadFileKey += 1;
        } else {
            const body = await r.json().catch(() => ({}));
            cs.uploadError = body.detail || 'Upload failed.';
        }
        cs.uploading = false;
    }

    async function deleteCarouselPhoto(scope: string) {
        const cs = carouselState[scope];
        if (!cs) return;
        if (!confirm('Remove this system\'s carousel photo?')) return;
        const r = await fetch(
            `${PUBLIC_API_URL}/admin/club-systems/carousel/photo?system=${encodeURIComponent(scope)}`,
            { method: 'DELETE', credentials: 'include' }
        );
        if (r.ok) cs.photo_url = null;
    }

    async function loadSystemEvents(scope: string) {
        systemEventsState[scope] = systemEventsState[scope] ?? initEventsFormState();
        const s = systemEventsState[scope];
        s.loading = true;
        const r = await fetch(
            `${PUBLIC_API_URL}/admin/club/events?system=${encodeURIComponent(scope)}`,
            { credentials: 'include' }
        );
        if (r.ok) s.events = await r.json();
        s.loading = false;
    }

    async function addSystemEvent(scope: string) {
        const s = systemEventsState[scope];
        if (!s) return;
        s.addError = null;
        if (!s.addTitle.trim() || !s.addDate) {
            s.addError = 'Title and date are required.';
            return;
        }
        s.adding = true;
        const r = await fetch(`${PUBLIC_API_URL}/admin/club/events`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system: scope,
                title: s.addTitle.trim(),
                event_date: s.addDate,
                all_day: s.addAllDay,
                start_time: s.addAllDay ? null : s.addStart || null,
                end_time: s.addAllDay ? null : s.addEnd || null,
            }),
        });
        if (r.ok) {
            const created = await r.json();
            s.events = [...s.events, created];
            s.addTitle = '';
            s.addDate = '';
            s.addAllDay = true;
            s.addStart = '';
            s.addEnd = '';
        } else {
            const body = await r.json().catch(() => ({}));
            s.addError = body.detail || 'Failed to add event.';
        }
        s.adding = false;
    }

    async function deleteSystemEvent(scope: string, id: number) {
        const s = systemEventsState[scope];
        if (!s) return;
        if (!confirm('Delete this event?')) return;
        const r = await fetch(`${PUBLIC_API_URL}/admin/club/events/${id}`, { method: 'DELETE', credentials: 'include' });
        if (r.ok) s.events = s.events.filter((e) => e.id !== id);
    }

    async function loadEditPlayerList() {
        const r = await fetch(`${PUBLIC_API_URL}/admin/players`, { credentials: 'include' });
        if (r.ok) editPlayerList = await r.json();
    }

    function onEditPlayerChange() {
        editPlayerMessage = null;
        editPlayerError = null;
        const player = editPlayerList.find(p => String(p.id) === editPlayerIdStr);
        if (!player) return;
        editPlayerName = player.name;
        editPlayerTitlesText = (player.titles ?? []).join('\n');
        editPlayerActive = player.active ?? true;
        editPlayerAdminNotes = player.admin_notes ?? '';
    }

    async function saveEditPlayer() {
        if (!editPlayerIdStr) return;
        editPlayerSaving = true;
        editPlayerMessage = null;
        editPlayerError = null;
        const titles = editPlayerTitlesText.split('\n').map(t => t.trim()).filter(Boolean);
        const r = await fetch(`${PUBLIC_API_URL}/admin/players/${editPlayerIdStr}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: editPlayerName,
                titles,
                active: editPlayerActive,
                admin_notes: editPlayerAdminNotes.trim() || null,
            }),
        });
        if (r.ok) {
            const updated = await r.json();
            editPlayerMessage = 'Saved.';
            editPlayerList = editPlayerList.map(p =>
                p.id === updated.id
                    ? { ...p, name: updated.name, titles: updated.titles, active: updated.active, admin_notes: updated.admin_notes }
                    : p
            );
        } else {
            const body = await r.json().catch(() => ({}));
            editPlayerError = body.detail || 'Save failed.';
        }
        editPlayerSaving = false;
    }

    async function loadClubWebhooks() {
        webhookListError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/webhooks`, { credentials: 'include' });
        if (r.ok) {
            webhookRows = await r.json();
        } else {
            webhookListError = 'Failed to load webhooks.';
        }
    }

    async function saveClubWebhook(webhookType: string, systemId: number | null) {
        const key = webhookKey(webhookType, systemId);
        const url = (webhookInputs[key] ?? '').trim();
        if (!url) return;
        webhookSaving[key] = true;
        webhookError[key] = null;
        webhookMessage[key] = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/webhooks`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhook_type: webhookType, system_id: systemId, url }),
        });
        if (r.ok) {
            const updated = await r.json();
            webhookRows = webhookRows.map((row) =>
                row.webhook_type === webhookType && row.system_id === systemId
                    ? { ...row, configured: updated.configured, last_four: updated.last_four }
                    : row
            );
            webhookInputs[key] = '';
            webhookMessage[key] = 'Saved.';
        } else {
            const body = await r.json().catch(() => ({}));
            webhookError[key] = body.detail || 'Save failed.';
        }
        webhookSaving[key] = false;
    }

    async function removeClubWebhook(webhookType: string, systemId: number | null) {
        const key = webhookKey(webhookType, systemId);
        webhookSaving[key] = true;
        webhookError[key] = null;
        webhookMessage[key] = null;
        const params = new URLSearchParams({ webhook_type: webhookType });
        if (systemId !== null) params.set('system_id', String(systemId));
        const r = await fetch(`${PUBLIC_API_URL}/admin/webhooks?${params}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (r.ok) {
            webhookRows = webhookRows.map((row) =>
                row.webhook_type === webhookType && row.system_id === systemId
                    ? { ...row, configured: false, last_four: undefined }
                    : row
            );
            webhookMessage[key] = 'Removed.';
        } else {
            const body = await r.json().catch(() => ({}));
            webhookError[key] = body.detail || 'Remove failed.';
        }
        webhookSaving[key] = false;
    }

    async function loadClubSystemsMine() {
        clubSystemsMineError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/club-systems`, { credentials: 'include' });
        if (r.ok) {
            clubSystemsMine = await r.json();
        } else {
            clubSystemsMineError = 'Failed to load systems.';
        }
    }

    async function loadFullCatalogue() {
        const r = await fetch(`${PUBLIC_API_URL}/systems`);
        if (r.ok) fullCatalogue = await r.json();
    }

    function onClubSystemPick(e?: Event) {
        csError = null;
        csMessage = null;
        // See onGameSystemPick's comment in platform-admin/+page.svelte for
        // why this reads the id off the event rather than csSelectId.
        const id = e ? (e.target as HTMLSelectElement).value : csSelectId;
        const existing = clubSystemsMine.find((s) => String(s.system_id) === id);
        if (existing) {
            csSessionDay = existing.session_day;
            csSessionCadence = existing.session_cadence;
            csCadenceAnchor = existing.cadence_anchor ?? '';
            csSessionStartTime = existing.session_start_time ?? '';
            csEnabled = existing.enabled;
            if (existing.vibe_options && existing.vibe_options.length > 0) {
                csUseDefaultVibes = false;
                csVibeOptions = existing.vibe_options;
                csDefaultVibe = existing.default_vibe ?? existing.vibe_options[0];
            } else {
                // No override: default to "use platform default", but pre-fill
                // the checkboxes with that default for when they opt into custom.
                csUseDefaultVibes = true;
                csVibeOptions = existing.default_vibe_options ?? [];
                csDefaultVibe = existing.default_default_vibe ?? (existing.default_vibe_options ?? [])[0] ?? '';
            }
        } else {
            csSessionDay = 'Wednesday';
            csSessionCadence = 'weekly';
            csCadenceAnchor = '';
            csSessionStartTime = '';
            csEnabled = true;
            csUseDefaultVibes = true;
            csVibeOptions = [];
            csDefaultVibe = '';
        }
    }

    async function saveClubSystemMine() {
        if (!csSelectId) return;
        csSaving = true;
        csError = null;
        csMessage = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/club-systems`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_id: Number(csSelectId),
                enabled: csEnabled,
                session_day: csSessionDay,
                session_cadence: csSessionCadence,
                cadence_anchor: csSessionCadence === 'fortnightly' ? csCadenceAnchor || null : null,
                session_start_time: csSessionStartTime || null,
                // [] clears the override (use the platform default); a list sets
                // this club's own vibes.
                vibe_options: csUseDefaultVibes ? [] : csVibeOptions,
                default_vibe: csUseDefaultVibes ? null : csDefaultVibe
            })
        });
        if (r.ok) {
            csMessage = 'Saved.';
            await loadClubSystemsMine();
            csSelectId = '';
        } else {
            const body = await r.json().catch(() => ({}));
            csError = body.detail || 'Failed to save.';
        }
        csSaving = false;
    }

    async function toggleClubSystemMine(row: ClubSystemMineRow) {
        clubSystemsMineError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/club-systems`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_id: row.system_id,
                enabled: !row.enabled,
                session_day: row.session_day,
                session_cadence: row.session_cadence,
                cadence_anchor: row.cadence_anchor,
                session_start_time: row.session_start_time
            })
        });
        if (r.ok) {
            await loadClubSystemsMine();
        } else {
            const body = await r.json().catch(() => ({}));
            clubSystemsMineError = body.detail || 'Failed to update.';
        }
    }

    async function loadAdminMe() {
        const r = await fetch(`${PUBLIC_API_URL}/admin/me`, { credentials: 'include' });
        adminMe = r.ok ? await r.json() : null;
    }

    // GET /admin/me exposes no club identity at all (just is_super_admin +
    // scopes), so the admin's own club is looked up via GET /auth/me's
    // user.club_id, resolved to a slug against GET /clubs. Left undefined
    // on any failure (including an inactive club_id not present in
    // /clubs) so fetchWeekId falls back to today's existing behaviour.
    async function loadAdminClubSlug() {
        try {
            const meResp = await fetch(`${PUBLIC_API_URL}/auth/me`, { credentials: 'include' });
            if (!meResp.ok) return;
            const me = await meResp.json();
            const clubId = me?.user?.club_id;
            if (clubId == null) return;
            const clubsResp = await fetch(`${PUBLIC_API_URL}/clubs`);
            if (!clubsResp.ok) return;
            const clubs: { id: number; slug: string }[] = await clubsResp.json();
            adminClubSlug = clubs.find((c) => c.id === clubId)?.slug;
        } catch (_) {}
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

    function initLeagueState(): LeagueState {
        return {
            config: null, configLoading: false, configSaving: false, configError: null, configMessage: null,
            seasons: [], seasonsLoading: false, seasonCreating: false, seasonError: null,
            newSeasonName: '', newSeasonStart: '', newSeasonEnd: '',
            viewingSeasonId: null,
            results: [], resultsLoading: false, resultsError: null,
            logWeek: '', logRows: [], logLoading: false, logSaving: false, logError: null, logMessage: null,
        };
    }

    // Load a week's saved pairings and turn the two-player games into
    // outcome-entry rows (BYEs skipped). Defaults the week to the scope's
    // current pairings week.
    async function loadLogResults(scope: string) {
        const ls = leagueState[scope];
        if (!ls.logWeek) ls.logWeek = pairings[scope]?.week ?? '';
        if (!ls.logWeek) { ls.logError = 'Pick a week first.'; return; }
        ls.logLoading = true;
        ls.logError = null;
        ls.logMessage = null;
        const params = new URLSearchParams({ system: scope, week: ls.logWeek });
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairings?${params}`, { credentials: 'include' });
        if (r.ok) {
            const data = await r.json();
            ls.logRows = (data.rows ?? [])
                .filter((row: any) => row.id != null && row.b_signup_id != null)
                .map((row: any) => ({
                    pairing_id: row.id,
                    a_name: row.a_name,
                    a_faction: row.a_faction,
                    b_name: row.b_name,
                    b_faction: row.b_faction,
                    result: '',
                    game_type: 'Competitive',
                    a_painting: '',
                    b_painting: '',
                }));
            if (ls.logRows.length === 0) {
                ls.logError = 'No two-player games found for that week (generate + publish pairings first).';
            }
        } else {
            ls.logError = 'Failed to load pairings for that week.';
        }
        ls.logLoading = false;
    }

    async function saveLogResults(scope: string) {
        const ls = leagueState[scope];
        const chosen = ls.logRows.filter((row) => row.result);
        if (chosen.length === 0) { ls.logError = 'Pick a winner (or draw) for at least one game.'; return; }
        ls.logSaving = true;
        ls.logError = null;
        ls.logMessage = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/league/results/from-pairings`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system: scope,
                week: ls.logWeek,
                results: chosen.map((row) => ({
                    pairing_id: row.pairing_id,
                    result: row.result,
                    game_type: row.game_type,
                    player_1_painting_bonus: row.a_painting || null,
                    player_2_painting_bonus: row.b_painting || null,
                })),
            }),
        });
        const body = await r.json().catch(() => ({}));
        if (r.ok) {
            const skipped = (body.skipped ?? []).length;
            ls.logMessage = `Logged ${body.created} result${body.created === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped)` : ''} — ratings updated.`;
            ls.logRows = [];
            await loadLeagueResults(scope);
        } else {
            ls.logError = body.detail || 'Failed to log results.';
        }
        ls.logSaving = false;
    }

    async function loadLeagueConfig(scope: string) {
        const ls = leagueState[scope];
        ls.configLoading = true;
        ls.configError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/league-config?system=${encodeURIComponent(scope)}`, { credentials: 'include' });
        if (r.ok) {
            ls.config = await r.json();
        } else {
            ls.configError = 'Failed to load league config.';
        }
        ls.configLoading = false;
    }

    async function saveLeagueEnabled(scope: string, enabled: boolean) {
        const ls = leagueState[scope];
        ls.configError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/league-settings`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system: scope, league_enabled: enabled }),
        });
        if (r.ok) {
            if (ls.config) ls.config.league_enabled = enabled;
            if (enabled) {
                await Promise.all([loadLeagueSeasons(scope), loadLeagueResults(scope)]);
            }
        } else {
            const body = await r.json().catch(() => ({}));
            ls.configError = body.detail || 'Failed to update.';
            if (ls.config) ls.config.league_enabled = !enabled; // revert the optimistic toggle
        }
    }

    async function saveLeagueConfig(scope: string) {
        const ls = leagueState[scope];
        if (!ls.config) return;
        ls.configSaving = true;
        ls.configError = null;
        ls.configMessage = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/league-config`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ system: scope, ...ls.config }),
        });
        if (r.ok) {
            ls.configMessage = 'Saved — this season’s ratings have been recalculated.';
            await loadLeagueResults(scope);
        } else {
            const body = await r.json().catch(() => ({}));
            ls.configError = body.detail || 'Failed to save config.';
        }
        ls.configSaving = false;
    }

    // Live "share of total" readout next to each slider — the sliders don't
    // rebalance each other (independent magnitude units, matching the
    // underlying linear-score formula in pairings_engine.py), but seeing
    // each one's share of the current total makes their relative influence
    // visible without that added complexity.
    function pwPercent(cfg: PairingWeightConfigData, field: keyof PairingWeightConfigData): number {
        const fields: (keyof PairingWeightConfigData)[] = [
            'weight_mirror', 'weight_rematch', 'weight_vibe', 'weight_experience', 'weight_eta',
        ];
        if (cfg.uses_scenarios) fields.push('weight_scenario');
        if (cfg.uses_points) fields.push('weight_points');
        const total = fields.reduce((sum, f) => sum + (Number(cfg[f]) || 0), 0);
        if (total <= 0) return 0;
        return Math.round((Number(cfg[field]) / total) * 1000) / 10;
    }

    // Validated 7-slot categorical order (dataviz skill) for the live donut —
    // order is the CVD-safety mechanism, not cosmetic; matches the sliders'
    // display order below (mirror, rematch, vibe, experience, eta, scenario,
    // points). Do not reorder without re-validating with the palette script.
    const PAIRING_WEIGHT_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'];

    function pairingWeightSlices(cfg: PairingWeightConfigData): { label: string; value: number; color: string }[] {
        const rows: { label: string; value: number }[] = [
            { label: 'Avoid same-faction rematch', value: cfg.weight_mirror },
            { label: 'Avoid recent repeat opponent', value: cfg.weight_rematch },
            { label: 'Vibe match', value: cfg.weight_vibe },
            { label: 'Experience match', value: cfg.weight_experience },
            { label: 'Arrival time (ETA) match', value: cfg.weight_eta },
        ];
        if (cfg.uses_scenarios) rows.push({ label: 'Scenario match', value: cfg.weight_scenario });
        if (cfg.uses_points) rows.push({ label: 'Points closeness', value: cfg.weight_points });
        return rows.map((r, i) => ({ ...r, color: PAIRING_WEIGHT_COLORS[i] }));
    }

    function initPairingWeightState(): PairingWeightState {
        return { config: null, loading: false, saving: false, error: null, message: null };
    }

    async function loadPairingWeightConfig(scope: string) {
        const ws = pairingWeightState[scope];
        ws.loading = true;
        ws.error = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairing-config?system=${encodeURIComponent(scope)}`, { credentials: 'include' });
        if (r.ok) {
            ws.config = await r.json();
        } else {
            ws.error = 'Failed to load pairing weighting config.';
        }
        ws.loading = false;
    }

    async function savePairingWeightConfig(scope: string) {
        const ws = pairingWeightState[scope];
        if (!ws.config) return;
        ws.saving = true;
        ws.error = null;
        ws.message = null;
        // Empty window inputs → null so the platform default is used.
        const cleanWeeks = (v: number | null) => (v === null || Number.isNaN(v) || v < 1 ? null : Math.round(v));
        const r = await fetch(`${PUBLIC_API_URL}/admin/pairing-config`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...ws.config,
                system: scope,
                recent_weeks: cleanWeeks(ws.config.recent_weeks),
                extended_weeks: cleanWeeks(ws.config.extended_weeks),
            }),
        });
        if (r.ok) {
            ws.message = 'Saved — takes effect on the next pairings preview/generate.';
        } else {
            const body = await r.json().catch(() => ({}));
            ws.error = body.detail || 'Failed to save.';
        }
        ws.saving = false;
    }

    async function initPairingWeightForScope(scope: string) {
        pairingWeightState[scope] = initPairingWeightState();
        await loadPairingWeightConfig(scope);
    }

    async function loadTableBooking(scope: string) {
        tbSelectScope = scope;
        tbLoading = true;
        tbError = null;
        tbMessage = null;
        tbPreview = null;
        tbPreviewError = null;
        tbSendMessage = null;
        loadTableBookingHistory(scope);
        try {
            const r = await fetch(`${PUBLIC_API_URL}/admin/table-booking-settings?system=${encodeURIComponent(scope)}`, { credentials: 'include' });
            if (!r.ok) throw new Error('Failed to load.');
            const d: TableBookingData = await r.json();
            tbEnabled = d.table_booking_enabled;
            tbVenueName = d.venue_name ?? '';
            tbVenueEmail = d.venue_email;
            tbCcEmailsText = (d.cc_emails ?? []).join(', ');
            tbPlayersPerTable = d.players_per_table;
            tbIncludeNames = d.include_player_names;
            tbSendMode = d.send_mode;
            tbCutoffDay = d.cutoff_day ?? 'Wednesday';
            tbCutoffTime = d.cutoff_time ?? '17:00';
            tbSubjectTemplate = d.subject_template ?? '';
            tbNotes = d.notes ?? '';
        } catch (e) {
            tbError = e instanceof Error ? e.message : 'Failed to load.';
        } finally {
            tbLoading = false;
        }
    }

    async function saveTableBooking() {
        if (!tbSelectScope) return;
        tbSaving = true;
        tbError = null;
        tbMessage = null;
        try {
            const settingsRes = await fetch(`${PUBLIC_API_URL}/admin/table-booking-settings`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system: tbSelectScope, table_booking_enabled: tbEnabled }),
            });
            if (!settingsRes.ok) {
                const body = await settingsRes.json().catch(() => ({}));
                throw new Error(body.detail || 'Failed to save toggle.');
            }

            const configRes = await fetch(`${PUBLIC_API_URL}/admin/table-booking-config`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: tbSelectScope,
                    venue_name: tbVenueName.trim() || null,
                    venue_email: tbVenueEmail.trim(),
                    cc_emails: tbCcEmailsText.split(',').map((s) => s.trim()).filter(Boolean),
                    players_per_table: tbPlayersPerTable,
                    include_player_names: tbIncludeNames,
                    send_mode: tbSendMode,
                    cutoff_day: tbSendMode === 'cutoff' ? tbCutoffDay : null,
                    cutoff_time: tbSendMode === 'cutoff' ? tbCutoffTime : null,
                    subject_template: tbSubjectTemplate.trim() || null,
                    notes: tbNotes.trim() || null,
                }),
            });
            if (!configRes.ok) {
                const body = await configRes.json().catch(() => ({}));
                throw new Error(body.detail || 'Failed to save config.');
            }
            tbMessage = 'Saved.';
            await loadTableBookingHistory(tbSelectScope);
        } catch (e) {
            tbError = e instanceof Error ? e.message : 'Failed to save.';
        } finally {
            tbSaving = false;
        }
    }

    async function loadTableBookingHistory(scope: string) {
        tbHistoryLoading = true;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/admin/table-booking-history?system=${encodeURIComponent(scope)}`, { credentials: 'include' });
            tbHistory = r.ok ? await r.json() : [];
        } finally {
            tbHistoryLoading = false;
        }
    }

    async function refreshTableBookingPreview() {
        if (!tbSelectScope || !tbPreviewWeek.trim()) return;
        tbPreviewLoading = true;
        tbPreviewError = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/admin/table-booking/preview`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system: tbSelectScope, week: tbPreviewWeek.trim() }),
            });
            if (!r.ok) {
                const body = await r.json().catch(() => ({}));
                throw new Error(body.detail || 'Failed to compute preview.');
            }
            tbPreview = await r.json();
        } catch (e) {
            tbPreviewError = e instanceof Error ? e.message : 'Failed to compute preview.';
        } finally {
            tbPreviewLoading = false;
        }
    }

    async function previewTableBooking() {
        tbSendMessage = null;
        tbPreview = null;
        await refreshTableBookingPreview();
    }

    async function sendTableBookingNow() {
        if (!tbSelectScope || !tbPreviewWeek.trim()) return;
        tbSendLoading = true;
        tbSendMessage = null;
        try {
            const r = await fetch(`${PUBLIC_API_URL}/admin/table-booking/send`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ system: tbSelectScope, week: tbPreviewWeek.trim() }),
            });
            const body = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(body.detail || 'Failed to send.');
            tbSendMessage = body.status === 'sent' ? 'Sent.' : `Failed: ${body.error ?? 'unknown error'}`;
            await Promise.all([refreshTableBookingPreview(), loadTableBookingHistory(tbSelectScope)]);
        } catch (e) {
            tbSendMessage = e instanceof Error ? `Failed: ${e.message}` : 'Failed to send.';
        } finally {
            tbSendLoading = false;
        }
    }

    async function loadLeagueSeasons(scope: string) {
        const ls = leagueState[scope];
        ls.seasonsLoading = true;
        ls.seasonError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/league-seasons?system=${encodeURIComponent(scope)}`, { credentials: 'include' });
        if (r.ok) {
            ls.seasons = await r.json();
        } else {
            ls.seasonError = 'Failed to load seasons.';
        }
        ls.seasonsLoading = false;
    }

    async function createLeagueSeason(scope: string) {
        const ls = leagueState[scope];
        if (!ls.newSeasonName.trim() || !ls.newSeasonStart) {
            ls.seasonError = 'Name and start date are required.';
            return;
        }
        ls.seasonCreating = true;
        ls.seasonError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/league-seasons`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system: scope,
                name: ls.newSeasonName.trim(),
                start_date: ls.newSeasonStart,
                end_date: ls.newSeasonEnd || null,
            }),
        });
        if (r.ok) {
            ls.newSeasonName = '';
            ls.newSeasonStart = '';
            ls.newSeasonEnd = '';
            ls.viewingSeasonId = null; // back to (the new) current season
            await Promise.all([loadLeagueSeasons(scope), loadLeagueResults(scope)]);
        } else {
            const body = await r.json().catch(() => ({}));
            ls.seasonError = body.detail || 'Failed to create season.';
        }
        ls.seasonCreating = false;
    }

    function viewSeason(scope: string, seasonId: number | null) {
        const ls = leagueState[scope];
        ls.viewingSeasonId = seasonId;
        loadLeagueResults(scope);
    }

    async function loadLeagueResults(scope: string) {
        const ls = leagueState[scope];
        ls.resultsLoading = true;
        ls.resultsError = null;
        const params = new URLSearchParams({ system: scope });
        if (ls.viewingSeasonId !== null) params.set('season_id', String(ls.viewingSeasonId));
        const r = await fetch(`${PUBLIC_API_URL}/admin/league/results?${params}`, { credentials: 'include' });
        if (r.ok) {
            const data: LeagueResultRow[] = await r.json();
            ls.results = data.map((row) => ({
                ...row,
                player_1_faction: row.player_1_faction ?? '',
                player_2_faction: row.player_2_faction ?? '',
                player_1_painting_bonus: row.player_1_painting_bonus ?? NONE_FACTION,
                player_2_painting_bonus: row.player_2_painting_bonus ?? NONE_FACTION,
            }));
        } else {
            ls.resultsError = 'Failed to load league results.';
        }
        ls.resultsLoading = false;
    }

    async function patchLeagueResult(scope: string, resultId: number, field: string, rawValue: any) {
        const ls = leagueState[scope];
        ls.resultsError = null;
        let v: any = rawValue;
        if (field === 'player_1_id' || field === 'player_2_id') {
            v = Number(v);
        } else if (field === 'player_1_faction' || field === 'player_2_faction') {
            v = v === '' ? null : v;
        } else if (field === 'player_1_painting_bonus' || field === 'player_2_painting_bonus') {
            v = v === NONE_FACTION ? null : v;
        }
        const r = await fetch(`${PUBLIC_API_URL}/admin/league/results/${resultId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: v }),
        });
        if (r.ok) {
            await loadLeagueResults(scope);
        } else {
            const body = await r.json().catch(() => ({}));
            ls.resultsError = body.detail || 'Failed to update result.';
        }
    }

    async function deleteLeagueResult(scope: string, resultId: number) {
        if (!confirm('Delete this result? This recalculates ELO ratings for all players.')) return;
        const ls = leagueState[scope];
        ls.resultsError = null;
        const r = await fetch(`${PUBLIC_API_URL}/admin/league/results/${resultId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (r.ok) {
            await loadLeagueResults(scope);
        } else {
            const body = await r.json().catch(() => ({}));
            ls.resultsError = body.detail || 'Failed to delete result.';
        }
    }

    async function initLeagueForScope(scope: string) {
        leagueState[scope] = initLeagueState();
        await loadLeagueConfig(scope);
        if (leagueState[scope].config?.league_enabled) {
            await Promise.all([loadLeagueSeasons(scope), loadLeagueResults(scope)]);
        }
    }

    async function initSystemScope(scope: string) {
        const week = await fetchWeekId(scope, fetch, adminClubSlug);
        pairings[scope] = initPairingsState(scope, week);
        await Promise.all([
            loadPairings(scope), loadAutoPairingsSettings(scope), loadCallToArmsSettings(scope),
            loadMissions(scope), initLeagueForScope(scope), initPairingWeightForScope(scope),
            loadCarousel(scope), loadSystemEvents(scope), loadSignupCap(scope),
        ]);
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
        await Promise.all([loadAdminMe(), loadAdminClubSlug()]);
        // adminClubSlug comes from the admin's own authenticated club (not
        // hostname-guessed — an admin could be viewing the panel from a
        // different club's subdomain), so has_league/vibe overrides reflect
        // the club they actually administer.
        getSystemsConfig(adminClubSlug).then((c) => (systemsConfig = c));
        if (adminMe && adminMe.scopes.length > 0) {
            activeSystem = adminMe.scopes.find((s) => isSystemScope(s)) ?? adminMe.scopes[0];
        }
        if (!adminMe || (!adminMe.is_super_admin && adminMe.scopes.length === 0)) {
            pageLoading = false;
            return;
        }
        const tasks: Promise<void>[] = [loadBlocks()];
        if (adminMe.is_super_admin) {
            tasks.push(
                loadRoles(),
                loadGrantableUsers(),
                loadEditPlayerList(),
                loadClubWebhooks(),
                loadClubSystemsMine(),
                loadFullCatalogue(),
                loadClubProfile(),
                loadClubWideEvents()
            );
        }
        if (adminMe.is_super_admin || adminMe.scopes.length > 0) {
            // Shared player picker used by the League results grid and the
            // per-system "add signup" form, both inside system scopes.
            tasks.push(loadBlockPlayers());
            // Command Table overview (status tiles + trend charts at the top).
            tasks.push(loadAnalytics());
        }
        for (const scope of adminMe.scopes) {
            tasks.push(loadHistory(scope));
            if (isSystemScope(scope)) {
                tasks.push(initSystemScope(scope));
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

    <div class="admin-shell">
        <aside class="admin-sidebar">
            <button
                type="button"
                class="nav-item"
                class:active={activeNav === 'overview'}
                onclick={() => (activeNav = 'overview')}
            >Overview</button>

            {#if adminMe.scopes.length > 0}
                <div class="nav-group-label">This system</div>
                <select
                    class="field-select nav-system-select"
                    bind:value={activeSystem}
                    aria-label="Select system"
                >
                    {#each adminMe.scopes.filter(isSystemScope) as s}
                        <option value={s}>{s}</option>
                    {/each}
                </select>
                {#each SYSTEM_NAV as item}
                    <button
                        type="button"
                        class="nav-item"
                        class:active={activeNav === item.id}
                        onclick={() => (activeNav = item.id)}
                    >{item.label}</button>
                {/each}
            {/if}

            {#if adminMe.is_super_admin || adminMe.scopes.length > 0}
                <div class="nav-group-label">Club admin</div>
                {#each CLUB_NAV as item}
                    {#if !item.super || adminMe.is_super_admin}
                        <button
                            type="button"
                            class="nav-item"
                            class:active={activeNav === item.id}
                            onclick={() => (activeNav = item.id)}
                        >{item.label}</button>
                    {/if}
                {/each}
            {/if}
        </aside>

        <div class="admin-main">

    {#if activeNav === 'overview'}
    <!-- ══ Command Table — at-a-glance dashboard overview ══ -->
    <section class="command-table">
        <header class="ct-head">
            <span class="ct-eyebrow">Command Table</span>
            <h3 class="ct-title">This week across the club</h3>
        </header>

        {#if analytics.loading}
            <p class="muted small">Reading the board…</p>
        {:else if analytics.overview.length === 0}
            <p class="muted small">No systems to report on yet.</p>
        {:else}
            <!-- SITUATION: one status tile per system -->
            <div class="ct-label">Situation</div>
            <div class="status-grid">
                {#each analytics.overview as s (s.system)}
                    <button
                        type="button"
                        class="status-tile"
                        class:selected={analytics.trendSystem === s.system}
                        onclick={() => loadTrends(s.system)}
                        title={`Show trends for ${s.name}`}
                    >
                        <div class="st-top">
                            <img class="st-logo" src={systemLogoUrl(s.system, systemsConfig)} alt="" />
                            <span class="st-name">{s.name}</span>
                        </div>
                        <div class="st-count">
                            <span class="st-num">{s.signups}{#if s.cap_max_players}<span class="st-cap">/{s.cap_max_players}</span>{/if}</span>
                            <span class="st-num-label">signed up</span>
                        </div>
                        <div class="st-status {STATUS_META[s.status].cls}">
                            <span class="st-led" aria-hidden="true">{STATUS_META[s.status].glyph}</span>
                            <span>{STATUS_META[s.status].label}</span>
                        </div>
                        <div class="st-next">{s.session_day} · next {s.next_session}</div>
                    </button>
                {/each}
            </div>

            <!-- TRENDS: charts for the focused system -->
            <div class="ct-label ct-label-trends">
                Trends
                {#if analytics.trendSystem}<span class="ct-trend-sys">· {analytics.trendSystem}</span>{/if}
            </div>
            {#if analytics.trendsLoading}
                <p class="muted small">Loading trends…</p>
            {:else}
                <div class="trend-grid">
                    <div class="chart-card">
                        <div class="chart-card-title">Signups over time</div>
                        <LineChart data={analytics.signups} yLabel="Signups" />
                    </div>
                    <div class="chart-card">
                        <div class="chart-card-title">Games per session</div>
                        <BarChart data={analytics.games} />
                    </div>
                    <div class="chart-card">
                        <div class="chart-card-title">League rating spread</div>
                        <BarChart data={analytics.ratings} />
                    </div>
                    <div class="chart-card">
                        <div class="chart-card-title">Faction popularity</div>
                        <HBarChart data={analytics.factions} />
                    </div>
                </div>
            {/if}
        {/if}
    </section>
    {/if}

    {#if activeNav === 'clubpage' && adminMe.is_super_admin}
        <!-- ══ Club Page (super-admin: club-wide profile) ══ -->
        <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">Club Page</span>
            </div>
            <div class="dash-group-body">
                <section class="admin-section">
                    <h3 class="section-heading">Club Profile</h3>
                    <p class="section-intro">
                        The blurb, logo, links, and opening hours shown at the top of the Club page.
                        Each system's own admin manages that system's carousel card and events from
                        its own section below.
                    </p>
                    {#if clubProfile}
                        <!-- Profile -->
                        <div class="field">
                            <label class="field-label" for="club-blurb">Blurb</label>
                            <textarea id="club-blurb" class="field-input" rows="3"
                                placeholder="A short welcome for players landing on the Club page…"
                                bind:value={clubProfile.blurb}></textarea>
                        </div>

                        <!-- Links & Location -->
                        <h4 class="sub-heading">Links &amp; Location</h4>
                        <div class="form-grid">
                            <div class="field">
                                <label class="field-label" for="club-website">Website</label>
                                <input id="club-website" class="field-input" type="text" placeholder="https://…" bind:value={clubProfile.website_url} />
                            </div>
                            <div class="field">
                                <label class="field-label" for="club-discord">Discord invite</label>
                                <input id="club-discord" class="field-input" type="text" placeholder="https://discord.gg/…" bind:value={clubProfile.discord_url} />
                            </div>
                        </div>
                        <div class="field">
                            <label class="field-label" for="club-address">Address</label>
                            <input id="club-address" class="field-input" type="text" placeholder="123 Example St, Manchester, UK" bind:value={clubProfile.address} />
                        </div>
                        <div class="form-grid">
                            <div class="field">
                                <label class="field-label" for="club-lat">Latitude</label>
                                <input id="club-lat" class="field-input" type="number" step="any" placeholder="53.4808" bind:value={clubProfile.latitude} />
                            </div>
                            <div class="field">
                                <label class="field-label" for="club-lng">Longitude</label>
                                <input id="club-lng" class="field-input" type="number" step="any" placeholder="-2.2426" bind:value={clubProfile.longitude} />
                            </div>
                        </div>
                        <p class="field-label-hint">
                            Coordinates place the pin on the Club page's map and on the multi-club map
                            logged-out visitors see. No coordinates, no pin — the address text still shows.
                            <a class="hint-link" href={googleMapsSearchUrl(clubProfile.address)} target="_blank" rel="noopener noreferrer">
                                Find this address on Google Maps ↗
                            </a> — right-click the exact spot, click the lat/long shown at the top of the menu to copy it, then paste the two numbers in above.
                        </p>

                        {#if clubProfileError}<p class="field-error">{clubProfileError}</p>{/if}
                        {#if clubProfileMessage}<p class="pairing-message">{clubProfileMessage}</p>{/if}
                        <div class="actions">
                            <button class="primary-button" type="button" disabled={clubProfileSaving} onclick={saveClubProfile}>
                                {clubProfileSaving ? 'Saving…' : 'Save'}
                            </button>
                        </div>

                        <!-- Logo -->
                        <h4 class="sub-heading">Logo</h4>
                        <p class="field-label-hint mission-guidelines">
                            <strong>Image guidelines:</strong> square, at least 400×400px. Transparent PNG
                            works best against the dark background. Accepted formats: PNG, JPEG, WEBP. Max 5 MB.
                        </p>
                        {#if clubProfile.logo_url}
                            <div class="club-logo-preview">
                                <img src={clubProfile.logo_url} alt="Club logo" />
                                <button class="secondary-button" type="button" onclick={deleteClubLogo}>Remove logo</button>
                            </div>
                        {/if}
                        {#key clubLogoFileKey}
                            <input
                                class="field-input mission-file"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onchange={(e) => (clubLogoFile = e.currentTarget.files?.[0] ?? null)}
                            />
                        {/key}
                        {#if clubLogoError}<p class="field-error">{clubLogoError}</p>{/if}
                        <div class="actions">
                            <button class="primary-button" type="button" disabled={clubLogoUploading || !clubLogoFile} onclick={uploadClubLogo}>
                                {clubLogoUploading ? 'Uploading…' : 'Upload logo'}
                            </button>
                        </div>

                        <!-- Opening Hours -->
                        <div class="league-settings-details">
                            <div class="league-settings-heading">Opening Hours</div>
                            <div class="league-settings-body">
                                <div class="club-hours-grid">
                                    {#each clubHours as row}
                                        <div class="club-hours-row">
                                            <label class="check-row ap-toggle club-hours-day">
                                                <input type="checkbox" bind:checked={row.enabled} />
                                                <span>{row.day}</span>
                                            </label>
                                            {#if row.enabled}
                                                <div class="club-hours-times">
                                                    <select class="field-select" bind:value={row.open}>
                                                        {#each HALF_HOUR_OPTIONS as t}
                                                            <option value={t}>{t}</option>
                                                        {/each}
                                                    </select>
                                                    <span class="club-hours-times-sep">&ndash;</span>
                                                    <select class="field-select" bind:value={row.close}>
                                                        {#each HALF_HOUR_OPTIONS as t}
                                                            <option value={t}>{t}</option>
                                                        {/each}
                                                    </select>
                                                </div>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                                <div class="actions">
                                    <button class="primary-button" type="button" disabled={clubProfileSaving} onclick={saveClubProfile}>
                                        {clubProfileSaving ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Club-wide Events -->
                        <div class="league-settings-details">
                            <div class="league-settings-heading">Club-wide Events</div>
                            <div class="league-settings-body">
                                <p class="section-intro">
                                    Dates that apply to the whole club, not one system — closures, open days. For a
                                    single system's own event (a tournament, a campaign day), use that system's
                                    Events section instead.
                                </p>
                                {#if clubWideEvents.events.length === 0 && !clubWideEvents.loading}
                                    <p class="muted small">No club-wide events yet — add one below.</p>
                                {:else}
                                    <ul class="history-list">
                                        {#each clubWideEvents.events as ev (ev.id)}
                                            <li class="history-row">
                                                <span class="history-date">{ev.event_date}</span>
                                                <span class="history-matchup">{ev.title}</span>
                                                <button class="secondary-button" type="button" onclick={() => deleteClubWideEvent(ev.id)}>Delete</button>
                                            </li>
                                        {/each}
                                    </ul>
                                {/if}
                                <div class="form-grid event-add-form">
                                    <div class="field">
                                        <label class="field-label" for="club-ev-title">Title</label>
                                        <input id="club-ev-title" class="field-input" type="text" bind:value={clubWideEvents.addTitle} />
                                    </div>
                                    <div class="field">
                                        <label class="field-label" for="club-ev-date">Date</label>
                                        <input id="club-ev-date" class="field-input" type="date" bind:value={clubWideEvents.addDate} />
                                    </div>
                                    <label class="check-row ap-toggle">
                                        <input type="checkbox" bind:checked={clubWideEvents.addAllDay} />
                                        <span>All day</span>
                                    </label>
                                    {#if !clubWideEvents.addAllDay}
                                        <div class="field">
                                            <label class="field-label" for="club-ev-start">Start time</label>
                                            <select id="club-ev-start" class="field-select" bind:value={clubWideEvents.addStart}>
                                                <option value="">— Not set —</option>
                                                {#each HALF_HOUR_OPTIONS as t}
                                                    <option value={t}>{t}</option>
                                                {/each}
                                            </select>
                                        </div>
                                        <div class="field">
                                            <label class="field-label" for="club-ev-end">End time</label>
                                            <select id="club-ev-end" class="field-select" bind:value={clubWideEvents.addEnd}>
                                                <option value="">— Not set —</option>
                                                {#each HALF_HOUR_OPTIONS as t}
                                                    <option value={t}>{t}</option>
                                                {/each}
                                            </select>
                                        </div>
                                    {/if}
                                </div>
                                {#if clubWideEvents.addError}<p class="field-error">{clubWideEvents.addError}</p>{/if}
                                <div class="actions">
                                    <button class="primary-button" type="button" disabled={clubWideEvents.adding} onclick={addClubWideEvent}>
                                        {clubWideEvents.adding ? 'Adding…' : 'Add event'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    {:else}
                        <p class="muted small">Loading…</p>
                    {/if}
                </section>
            </div>
        </div>
    {/if}

    {#if activeNav === 'pairings' && activeSystem}
        {@const scope = activeSystem}
        <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">Recent Games</span>
            </div>
            <div class="dash-group-body">
        <section class="admin-section">
                        <div class="sub-section">
                            {#if historyLoading[scope]}
                                <p class="muted small">Loading…</p>
                            {:else if !(historyByScope[scope]?.length)}
                                <p class="muted small">No games recorded yet.</p>
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
        </section>
            </div>
        </div>
    {/if}

    {#if activeNav === 'league' && activeSystem}
        {@const scope = activeSystem}
        <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">League</span>
            </div>
            <div class="dash-group-body">
        <section class="admin-section">
                        <!-- League (system scopes only) — enable toggle, scoring config,
                             seasons, and this season's editable results grid. -->
                        {#if isSystemScope(scope) && leagueState[scope]}
                            {@const ls = leagueState[scope]}
                            <div class="sub-section pairings-section">

                                {#if ls.configLoading}
                                    <p class="muted small">Loading…</p>
                                {:else if ls.config}
                                    <label class="check-row ap-toggle">
                                        <input
                                            type="checkbox"
                                            checked={ls.config.league_enabled}
                                            onchange={(e) => saveLeagueEnabled(scope, e.currentTarget.checked)}
                                        />
                                        <span>Run a league for this system</span>
                                    </label>

                                    {#if ls.configError}<p class="field-error">{ls.configError}</p>{/if}

                                    {#if ls.config.league_enabled}
                                        <!-- League settings: scoring config + seasons
                                             (results stay outside, always visible below). -->
                                        <div class="league-settings-details">
                                            <div class="league-settings-heading">League settings</div>
                                            <div class="league-settings-body">
                                                <p class="league-help-text">
                                                    <strong>ELO rating</strong> gives every player a number (starting
                                                    at 1000 by default) that goes up after a win and down after a
                                                    loss — how much it moves depends on the gap between the two
                                                    players' ratings, so beating a higher-rated opponent earns more
                                                    than beating a lower-rated one, and vice versa. The
                                                    <strong>K value</strong> controls how big those swings are (higher
                                                    K = ratings move faster); it's common to use a lower K for casual
                                                    games and a higher K for competitive ones. <strong>Painting
                                                    bonuses</strong> add a small flat boost for fielding a painted
                                                    army, on top of the result. <strong>Flat win/loss points</strong>
                                                    is the simpler alternative: everyone just earns a fixed number of
                                                    points per win/draw/loss, with no opponent-strength weighting.
                                                    The defaults below (1000 start, K 10/40, +3/+1 painting) match a
                                                    typical club setup — adjust them if you like.
                                                </p>

                                                <!-- Scoring config -->
                                                <div class="league-config-form">
                                                    <div class="field">
                                                        <span class="field-label">Scoring method</span>
                                                        <label class="radio-row">
                                                            <input type="radio" bind:group={ls.config.scoring_method} value="elo" />
                                                            <span>ELO rating</span>
                                                        </label>
                                                        <label class="radio-row">
                                                            <input type="radio" bind:group={ls.config.scoring_method} value="winloss" />
                                                            <span>Flat win/loss points</span>
                                                        </label>
                                                    </div>

                                                    <div class="field field-narrow">
                                                        <label class="field-label" for="lc-start-{scope}">Starting rating</label>
                                                        <input id="lc-start-{scope}" class="field-input" type="number" step="any" bind:value={ls.config.starting_rating} />
                                                    </div>

                                                    {#if ls.config.scoring_method === 'elo'}
                                                        <div class="field field-narrow">
                                                            <label class="field-label" for="lc-kc-{scope}">K (casual)</label>
                                                            <input id="lc-kc-{scope}" class="field-input" type="number" bind:value={ls.config.k_casual} />
                                                        </div>
                                                        <div class="field field-narrow">
                                                            <label class="field-label" for="lc-kk-{scope}">K (competitive)</label>
                                                            <input id="lc-kk-{scope}" class="field-input" type="number" bind:value={ls.config.k_competitive} />
                                                        </div>
                                                        <div class="field field-narrow">
                                                            <label class="field-label" for="lc-pf-{scope}">Painting bonus (fully)</label>
                                                            <input id="lc-pf-{scope}" class="field-input" type="number" step="any" bind:value={ls.config.painting_fully_bonus} />
                                                        </div>
                                                        <div class="field field-narrow">
                                                            <label class="field-label" for="lc-pp-{scope}">Painting bonus (partial)</label>
                                                            <input id="lc-pp-{scope}" class="field-input" type="number" step="any" bind:value={ls.config.painting_partial_bonus} />
                                                        </div>
                                                    {:else}
                                                        <div class="field field-narrow">
                                                            <label class="field-label" for="lc-pw-{scope}">Points (win)</label>
                                                            <input id="lc-pw-{scope}" class="field-input" type="number" step="any" bind:value={ls.config.points_win} />
                                                        </div>
                                                        <div class="field field-narrow">
                                                            <label class="field-label" for="lc-pd-{scope}">Points (draw)</label>
                                                            <input id="lc-pd-{scope}" class="field-input" type="number" step="any" bind:value={ls.config.points_draw} />
                                                        </div>
                                                        <div class="field field-narrow">
                                                            <label class="field-label" for="lc-pl-{scope}">Points (loss)</label>
                                                            <input id="lc-pl-{scope}" class="field-input" type="number" step="any" bind:value={ls.config.points_loss} />
                                                        </div>
                                                        <label class="check-row ap-toggle">
                                                            <input type="checkbox" bind:checked={ls.config.winloss_use_painting} />
                                                            <span>Also apply the painting bonuses above</span>
                                                        </label>
                                                        {#if ls.config.winloss_use_painting}
                                                            <div class="field field-narrow">
                                                                <label class="field-label" for="lc-pf2-{scope}">Painting bonus (fully)</label>
                                                                <input id="lc-pf2-{scope}" class="field-input" type="number" step="any" bind:value={ls.config.painting_fully_bonus} />
                                                            </div>
                                                            <div class="field field-narrow">
                                                                <label class="field-label" for="lc-pp2-{scope}">Painting bonus (partial)</label>
                                                                <input id="lc-pp2-{scope}" class="field-input" type="number" step="any" bind:value={ls.config.painting_partial_bonus} />
                                                            </div>
                                                        {/if}
                                                    {/if}

                                                    {#if ls.configMessage}<p class="pairing-message">{ls.configMessage}</p>{/if}
                                                    <button
                                                        class="primary-button"
                                                        type="button"
                                                        disabled={ls.configSaving}
                                                        onclick={() => saveLeagueConfig(scope)}
                                                    >{ls.configSaving ? 'Saving…' : 'Save scoring config'}</button>
                                                    <p class="muted small">Saving replays this season's results under the new config — ratings update immediately.</p>
                                                </div>

                                                <!-- Seasons -->
                                                <div class="league-seasons">
                                                    <h5 class="sub-heading-minor">Seasons</h5>
                                                    {#if ls.seasonsLoading}
                                                        <p class="muted small">Loading…</p>
                                                    {:else if ls.seasons.length === 0}
                                                        <p class="muted small">No season yet — create one below to start recording results.</p>
                                                    {:else}
                                                        <p class="muted small">Click a season to browse its results below.</p>
                                                        <ul class="season-list">
                                                            {#each ls.seasons as s}
                                                                <li>
                                                                    <button
                                                                        type="button"
                                                                        class="season-row-button"
                                                                        class:active={ls.viewingSeasonId === s.id || (ls.viewingSeasonId === null && s.current)}
                                                                        onclick={() => viewSeason(scope, s.current ? null : s.id)}
                                                                    >
                                                                        <strong>{s.name}</strong>
                                                                        <span class="muted small">{s.start_date} – {s.end_date ?? 'ongoing'}</span>
                                                                        {#if s.current}<span class="season-current-badge">current</span>{/if}
                                                                        {#if s.champion}<span class="season-champion">🏆 {s.champion.name}</span>{/if}
                                                                    </button>
                                                                </li>
                                                            {/each}
                                                        </ul>
                                                    {/if}
                                                    {#if ls.seasonError}<p class="field-error">{ls.seasonError}</p>{/if}
                                                    <div class="add-signup-form">
                                                        <div class="field">
                                                            <label class="field-label" for="ns-name-{scope}">New season name</label>
                                                            <input id="ns-name-{scope}" class="field-input" type="text" placeholder="e.g. 2027" bind:value={ls.newSeasonName} />
                                                        </div>
                                                        <div class="field field-narrow">
                                                            <label class="field-label" for="ns-start-{scope}">Start date</label>
                                                            <input id="ns-start-{scope}" class="field-input" type="date" bind:value={ls.newSeasonStart} />
                                                        </div>
                                                        <div class="field field-narrow">
                                                            <label class="field-label" for="ns-end-{scope}">End date (optional)</label>
                                                            <input id="ns-end-{scope}" class="field-input" type="date" bind:value={ls.newSeasonEnd} />
                                                        </div>
                                                        <p class="muted small">Starting a new season resets ratings to the starting rating above; the currently open season (if any) is automatically closed the day before this one starts. Past seasons and their results stay archived.</p>
                                                        <button
                                                            class="primary-button"
                                                            type="button"
                                                            disabled={ls.seasonCreating}
                                                            onclick={() => createLeagueSeason(scope)}
                                                        >{ls.seasonCreating ? 'Creating…' : 'Start season'}</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Log results from a week's published pairings -->
                                        <div class="league-log-results">
                                            <h5 class="sub-heading-minor">Log results from pairings</h5>
                                            <p class="muted small">
                                                Pull a week's games straight from its pairings — players and factions
                                                are already filled in, so you just record who won.
                                            </p>
                                            <div class="log-week-row">
                                                <div class="field field-narrow">
                                                    <label class="field-label" for="log-week-{scope}">Week</label>
                                                    <input id="log-week-{scope}" class="field-input" type="text" placeholder="DD/MM/YYYY" bind:value={ls.logWeek} />
                                                </div>
                                                <button class="secondary-button" type="button" disabled={ls.logLoading} onclick={() => loadLogResults(scope)}>
                                                    {ls.logLoading ? 'Loading…' : 'Load pairings'}
                                                </button>
                                            </div>
                                            {#if ls.logError}<p class="field-error">{ls.logError}</p>{/if}
                                            {#if ls.logMessage}<p class="pairing-message">{ls.logMessage}</p>{/if}

                                            {#if ls.logRows.length > 0}
                                                <div class="grid-wrap">
                                                    <table class="pairing-grid">
                                                        <thead>
                                                            <tr>
                                                                <th>Game</th>
                                                                <th>Outcome</th>
                                                                <th>Type</th>
                                                                <th>P1 painting</th>
                                                                <th>P2 painting</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {#each ls.logRows as row (row.pairing_id)}
                                                                <tr>
                                                                    <td><span class="cell-text">{row.a_name}{row.a_faction ? ` (${row.a_faction})` : ''} vs {row.b_name}{row.b_faction ? ` (${row.b_faction})` : ''}</span></td>
                                                                    <td>
                                                                        <select class="field-select" bind:value={row.result}>
                                                                            <option value="">— pick —</option>
                                                                            <option value="Player 1 Victory">{row.a_name} won</option>
                                                                            <option value="Draw">Draw</option>
                                                                            <option value="Player 2 Victory">{row.b_name} won</option>
                                                                        </select>
                                                                    </td>
                                                                    <td>
                                                                        <select class="field-select" bind:value={row.game_type}>
                                                                            <option value="Competitive">Competitive</option>
                                                                            <option value="Casual">Casual</option>
                                                                        </select>
                                                                    </td>
                                                                    <td>
                                                                        <select class="field-select" bind:value={row.a_painting}>
                                                                            <option value="">—</option>
                                                                            <option value="Partially Painted">Partial</option>
                                                                            <option value="Fully Painted">Full</option>
                                                                        </select>
                                                                    </td>
                                                                    <td>
                                                                        <select class="field-select" bind:value={row.b_painting}>
                                                                            <option value="">—</option>
                                                                            <option value="Partially Painted">Partial</option>
                                                                            <option value="Fully Painted">Full</option>
                                                                        </select>
                                                                    </td>
                                                                </tr>
                                                            {/each}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <button class="primary-button" type="button" disabled={ls.logSaving} onclick={() => saveLogResults(scope)}>
                                                    {ls.logSaving ? 'Saving…' : 'Save all results'}
                                                </button>
                                            {/if}
                                        </div>

                                        <!-- League Results (editing/deleting recalculates that season's ratings) -->
                                        <div class="league-results">
                                            <h5 class="sub-heading-minor">
                                                {ls.viewingSeasonId === null ? "This Season's Results" : `${ls.seasons.find((s) => s.id === ls.viewingSeasonId)?.name ?? 'Season'}'s Results (archived)`}
                                            </h5>
                                            {#if ls.resultsError}
                                                <p class="field-error">{ls.resultsError}</p>
                                            {/if}
                                            {#if ls.resultsLoading}
                                                <p class="muted small">Loading…</p>
                                            {:else if ls.results.length === 0}
                                                <p class="muted small">No results recorded yet this season.</p>
                                            {:else}
                                                <div class="grid-wrap league-results-wrap">
                                                    <table class="pairing-grid league-results-grid">
                                                        <thead>
                                                            <tr>
                                                                <th>Date</th>
                                                                <th>Player 1</th>
                                                                <th>P1 Faction</th>
                                                                <th>P1 Painting</th>
                                                                <th>P1 Before</th>
                                                                <th>P1 After</th>
                                                                <th>Result</th>
                                                                <th>Type</th>
                                                                <th>Player 2</th>
                                                                <th>P2 Faction</th>
                                                                <th>P2 Painting</th>
                                                                <th>P2 Before</th>
                                                                <th>P2 After</th>
                                                                <th></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {#each ls.results as r (r.id)}
                                                                <tr>
                                                                    <td><span class="cell-text">{r.result_date}</span></td>
                                                                    <td>
                                                                        <select
                                                                            class="cell-select"
                                                                            value={String(r.player_1_id)}
                                                                            onchange={(e) => patchLeagueResult(scope, r.id, 'player_1_id', (e.target as HTMLSelectElement).value)}
                                                                        >
                                                                            {#each blockPlayers as p}
                                                                                <option value={String(p.id)}>{p.name}</option>
                                                                            {/each}
                                                                        </select>
                                                                    </td>
                                                                    <td>
                                                                        <input
                                                                            class="cell-input"
                                                                            type="text"
                                                                            bind:value={r.player_1_faction}
                                                                            onchange={() => patchLeagueResult(scope, r.id, 'player_1_faction', r.player_1_faction)}
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <select
                                                                            class="cell-select"
                                                                            bind:value={r.player_1_painting_bonus}
                                                                            onchange={() => patchLeagueResult(scope, r.id, 'player_1_painting_bonus', r.player_1_painting_bonus)}
                                                                        >
                                                                            <option value={NONE_FACTION}>{NONE_FACTION}</option>
                                                                            {#each PAINTING_OPTIONS as opt}
                                                                                <option>{opt}</option>
                                                                            {/each}
                                                                        </select>
                                                                    </td>
                                                                    <td><span class="cell-readonly">{Math.round(r.player_1_rating_before)}</span></td>
                                                                    <td><span class="cell-readonly">{Math.round(r.player_1_rating_after)}</span></td>
                                                                    <td>
                                                                        <select
                                                                            class="cell-select"
                                                                            bind:value={r.result}
                                                                            onchange={() => patchLeagueResult(scope, r.id, 'result', r.result)}
                                                                        >
                                                                            <option value="Player 1 Victory">{r.player_1_name} Victory</option>
                                                                            <option value="Draw">Draw</option>
                                                                            <option value="Player 2 Victory">{r.player_2_name} Victory</option>
                                                                        </select>
                                                                    </td>
                                                                    <td>
                                                                        <select
                                                                            class="cell-select"
                                                                            bind:value={r.game_type}
                                                                            onchange={() => patchLeagueResult(scope, r.id, 'game_type', r.game_type)}
                                                                        >
                                                                            {#each GAME_TYPE_OPTIONS as opt}
                                                                                <option>{opt}</option>
                                                                            {/each}
                                                                        </select>
                                                                    </td>
                                                                    <td>
                                                                        <select
                                                                            class="cell-select"
                                                                            value={String(r.player_2_id)}
                                                                            onchange={(e) => patchLeagueResult(scope, r.id, 'player_2_id', (e.target as HTMLSelectElement).value)}
                                                                        >
                                                                            {#each blockPlayers as p}
                                                                                <option value={String(p.id)}>{p.name}</option>
                                                                            {/each}
                                                                        </select>
                                                                    </td>
                                                                    <td>
                                                                        <input
                                                                            class="cell-input"
                                                                            type="text"
                                                                            bind:value={r.player_2_faction}
                                                                            onchange={() => patchLeagueResult(scope, r.id, 'player_2_faction', r.player_2_faction)}
                                                                        />
                                                                    </td>
                                                                    <td>
                                                                        <select
                                                                            class="cell-select"
                                                                            bind:value={r.player_2_painting_bonus}
                                                                            onchange={() => patchLeagueResult(scope, r.id, 'player_2_painting_bonus', r.player_2_painting_bonus)}
                                                                        >
                                                                            <option value={NONE_FACTION}>{NONE_FACTION}</option>
                                                                            {#each PAINTING_OPTIONS as opt}
                                                                                <option>{opt}</option>
                                                                            {/each}
                                                                        </select>
                                                                    </td>
                                                                    <td><span class="cell-readonly">{Math.round(r.player_2_rating_before)}</span></td>
                                                                    <td><span class="cell-readonly">{Math.round(r.player_2_rating_after)}</span></td>
                                                                    <td class="cell-delete">
                                                                        <button
                                                                            class="remove-btn"
                                                                            type="button"
                                                                            title="Delete this result"
                                                                            onclick={() => deleteLeagueResult(scope, r.id)}
                                                                        >×</button>
                                                                    </td>
                                                                </tr>
                                                            {/each}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            {/if}
                                        </div>
                                    {/if}
                                {/if}
                            </div>
                        {/if}
        </section>
            </div>
        </div>
    {/if}

    {#if activeNav === 'weighting' && activeSystem}
        {@const scope = activeSystem}
        <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">Pairing Weighting</span>
            </div>
            <div class="dash-group-body">
        <section class="admin-section">
                        <!-- Pairing weighting (system scopes only) -->
                        {#if isSystemScope(scope) && pairingWeightState[scope]}
                            {@const ws = pairingWeightState[scope]}
                            <div class="sub-section pairings-section">

                                {#if ws.loading}
                                    <p class="muted small">Loading…</p>
                                {:else if ws.config}
                                    <div class="league-settings-details">
                                        <div class="league-settings-heading">Matchmaking weights</div>
                                        <div class="league-settings-body">
                                            <p class="league-help-text">
                                                Sliders control how much each factor matters when
                                                pairing opponents for this system — higher means
                                                the matcher works harder to satisfy that factor.
                                                Set a slider to 0 to ignore it entirely. Admin
                                                blocks and "don't repeat last week's opponent" are
                                                always enforced first, regardless of these weights.
                                            </p>

                                            <div class="pairing-weight-layout">
                                            <div class="league-config-form pairing-weight-form">
                                                <div class="field">
                                                    <label class="field-label" for="pw-mirror-{scope}">Avoid same-faction rematch: {ws.config.weight_mirror} ({pwPercent(ws.config, 'weight_mirror')}%)</label>
                                                    <input id="pw-mirror-{scope}" type="range" min="0" max="10" step="0.5" bind:value={ws.config.weight_mirror} />
                                                </div>
                                                <div class="field">
                                                    <label class="field-label" for="pw-rematch-{scope}">Avoid recent repeat opponent: {ws.config.weight_rematch} ({pwPercent(ws.config, 'weight_rematch')}%)</label>
                                                    <input id="pw-rematch-{scope}" type="range" min="0" max="10" step="0.5" bind:value={ws.config.weight_rematch} />
                                                </div>
                                                <div class="field">
                                                    <label class="field-label" for="pw-vibe-{scope}">Match by vibe (casual/competitive): {ws.config.weight_vibe} ({pwPercent(ws.config, 'weight_vibe')}%)</label>
                                                    <input id="pw-vibe-{scope}" type="range" min="0" max="10" step="0.5" bind:value={ws.config.weight_vibe} />
                                                </div>
                                                <div class="field">
                                                    <label class="field-label" for="pw-exp-{scope}">Match by experience: {ws.config.weight_experience} ({pwPercent(ws.config, 'weight_experience')}%)</label>
                                                    <input id="pw-exp-{scope}" type="range" min="0" max="10" step="0.5" bind:value={ws.config.weight_experience} />
                                                </div>
                                                <div class="field">
                                                    <label class="field-label" for="pw-eta-{scope}">Match by arrival time (ETA): {ws.config.weight_eta} ({pwPercent(ws.config, 'weight_eta')}%)</label>
                                                    <input id="pw-eta-{scope}" type="range" min="0" max="10" step="0.5" bind:value={ws.config.weight_eta} />
                                                </div>
                                                {#if ws.config.uses_scenarios}
                                                    <div class="field">
                                                        <label class="field-label" for="pw-scen-{scope}">Match by scenario pick: {ws.config.weight_scenario} ({pwPercent(ws.config, 'weight_scenario')}%)</label>
                                                        <input id="pw-scen-{scope}" type="range" min="0" max="10" step="0.5" bind:value={ws.config.weight_scenario} />
                                                    </div>
                                                {/if}
                                                {#if ws.config.uses_points}
                                                    <div class="field">
                                                        <label class="field-label" for="pw-pts-{scope}">Match by points closeness: {ws.config.weight_points} ({pwPercent(ws.config, 'weight_points')}%)</label>
                                                        <input id="pw-pts-{scope}" type="range" min="0" max="10" step="0.5" bind:value={ws.config.weight_points} />
                                                    </div>
                                                {/if}

                                                <div class="pw-window-block">
                                                    <div class="pw-window-title">Rematch windows</div>
                                                    <p class="muted small">How far back a repeat counts as a rematch. Leave blank to use the system default.</p>
                                                    <div class="pw-window-row">
                                                        <div class="field field-narrow">
                                                            <label class="field-label" for="pw-recent-{scope}">Don't rematch within (weeks)</label>
                                                            <input id="pw-recent-{scope}" class="field-input" type="number" min="1" placeholder={String(ws.config.default_recent_weeks)} bind:value={ws.config.recent_weeks} />
                                                        </div>
                                                        <div class="field field-narrow">
                                                            <label class="field-label" for="pw-extended-{scope}">Soft-avoid within (weeks)</label>
                                                            <input id="pw-extended-{scope}" class="field-input" type="number" min="1" placeholder={String(ws.config.default_extended_weeks)} bind:value={ws.config.extended_weeks} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {#if ws.message}<p class="pairing-message">{ws.message}</p>{/if}
                                                {#if ws.error}<p class="field-error">{ws.error}</p>{/if}
                                                <button
                                                    class="primary-button"
                                                    type="button"
                                                    disabled={ws.saving}
                                                    onclick={() => savePairingWeightConfig(scope)}
                                                >{ws.saving ? 'Saving…' : 'Save weighting'}</button>
                                            </div>

                                            <div class="pairing-weight-chart">
                                                <div class="chart-card-title">Share of total weighting</div>
                                                <PieChart data={pairingWeightSlices(ws.config)} />
                                            </div>
                                            </div>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/if}
        </section>
            </div>
        </div>
    {/if}

    {#if activeNav === 'pairings' && activeSystem}
        {@const scope = activeSystem}
        <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">This Week's Signups</span>
            </div>
            <div class="dash-group-body">
        <section class="admin-section">
                        {#if signupCapState[scope] && !signupCapState[scope].loading}
                            {@const cap = signupCapState[scope]}
                            <div class="sub-section signup-cap-section">
                                <label class="check-row ap-toggle">
                                    <input type="checkbox" bind:checked={cap.enabled} />
                                    <span>Cap signups for this system</span>
                                </label>
                                {#if cap.enabled}
                                    <div class="signup-cap-row">
                                        <div class="field field-narrow">
                                            <label class="field-label" for="cap-tables-{scope}">Tables</label>
                                            <input id="cap-tables-{scope}" class="field-input" type="number" min="1" bind:value={cap.tables} />
                                        </div>
                                        <p class="muted small">
                                            = up to <strong>{(Number(cap.tables) || 0) * cap.players_per_table}</strong> players
                                            ({cap.players_per_table} per table). New sign-ups are blocked once full;
                                            already-signed-up players can still edit.
                                        </p>
                                    </div>
                                {/if}
                                {#if cap.error}<p class="field-error">{cap.error}</p>{/if}
                                {#if cap.message}<p class="pairing-message">{cap.message}</p>{/if}
                                <button class="secondary-button" type="button" disabled={cap.saving} onclick={() => saveSignupCap(scope)}>
                                    {cap.saving ? 'Saving…' : 'Save signup cap'}
                                </button>
                            </div>
                        {/if}

                        <!-- Weekly Pairings (system scopes only) -->
                        {#if isSystemScope(scope) && pairings[scope]}
                            {@const ps = pairings[scope]}

                            <div class="sub-section">

                                {#if ps.signupsError}
                                    <p class="field-error">{ps.signupsError}</p>
                                {/if}

                                {#if ps.signupsLoading}
                                    <p class="muted small">Loading…</p>
                                {:else if ps.signupRows.length === 0}
                                    <p class="muted small">No signups for this week yet.</p>
                                {:else}
                                    <div class="grid-wrap">
                                        <table class="pairing-grid">
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Faction</th>
                                                    {#if ps.signupConfig?.show_points}<th>Pts</th>{/if}
                                                    <th>ETA</th>
                                                    <th>Exp</th>
                                                    <th>Vibe</th>
                                                    {#if ps.signupConfig?.show_standby}<th>Standby</th>{/if}
                                                    {#if ps.signupConfig?.show_scenario}<th>Scenario</th>{/if}
                                                    {#if ps.signupConfig?.show_can_demo}<th>Demo</th>{/if}
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {#each ps.signupRows as su (su.id)}
                                                    <tr>
                                                        <td><span class="cell-text">{su.player_name}</span></td>
                                                        <td>
                                                            <select
                                                                class="cell-select"
                                                                bind:value={su.faction}
                                                                onchange={() => patchSignup(scope, su, 'faction', su.faction)}
                                                            >
                                                                <option value={NONE_FACTION}>{NONE_FACTION}</option>
                                                                {#each factionsFor(scope) as f}
                                                                    <option>{f}</option>
                                                                {/each}
                                                            </select>
                                                        </td>
                                                        {#if ps.signupConfig?.show_points}
                                                            <td>
                                                                <input
                                                                    class="cell-input-num"
                                                                    type="number"
                                                                    min="0"
                                                                    max="10000"
                                                                    step="250"
                                                                    bind:value={su.points}
                                                                    onchange={() => patchSignup(scope, su, 'points', su.points)}
                                                                />
                                                            </td>
                                                        {/if}
                                                        <td>
                                                            <select
                                                                class="cell-select"
                                                                bind:value={su.eta}
                                                                onchange={() => patchSignup(scope, su, 'eta', su.eta)}
                                                            >
                                                                <option value="">—</option>
                                                                {#each ETA_OPTIONS as t}
                                                                    <option>{t}</option>
                                                                {/each}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <select
                                                                class="cell-select"
                                                                bind:value={su.experience}
                                                                onchange={() => patchSignup(scope, su, 'experience', su.experience)}
                                                            >
                                                                {#each EXPERIENCE_OPTIONS as e}
                                                                    <option>{e}</option>
                                                                {/each}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            {#if ps.signupConfig?.vibe_fixed}
                                                                <span class="cell-text">{ps.signupConfig.vibe_fixed}</span>
                                                            {:else}
                                                                <select
                                                                    class="cell-select"
                                                                    bind:value={su.vibe}
                                                                    onchange={() => patchSignup(scope, su, 'vibe', su.vibe)}
                                                                >
                                                                    {#each ps.signupConfig?.vibe_options ?? [] as v}
                                                                        <option>{v}</option>
                                                                    {/each}
                                                                </select>
                                                            {/if}
                                                        </td>
                                                        {#if ps.signupConfig?.show_standby}
                                                            <td class="cell-check">
                                                                <input
                                                                    type="checkbox"
                                                                    bind:checked={su.standby_ok}
                                                                    onchange={() => patchSignup(scope, su, 'standby_ok', su.standby_ok)}
                                                                />
                                                            </td>
                                                        {/if}
                                                        {#if ps.signupConfig?.show_scenario}
                                                            <td>
                                                                <input
                                                                    class="cell-input"
                                                                    type="text"
                                                                    bind:value={su.scenario}
                                                                    onchange={() => patchSignup(scope, su, 'scenario', su.scenario)}
                                                                />
                                                            </td>
                                                        {/if}
                                                        {#if ps.signupConfig?.show_can_demo}
                                                            <td class="cell-check">
                                                                <input
                                                                    type="checkbox"
                                                                    bind:checked={su.can_demo}
                                                                    onchange={() => patchSignup(scope, su, 'can_demo', su.can_demo)}
                                                                />
                                                            </td>
                                                        {/if}
                                                        <td class="cell-delete">
                                                            <button
                                                                class="remove-btn"
                                                                type="button"
                                                                title="Force drop this signup"
                                                                onclick={() => forceDropSignup(scope, su.id)}
                                                            >×</button>
                                                        </td>
                                                    </tr>
                                                {/each}
                                            </tbody>
                                        </table>
                                    </div>
                                {/if}

                                <details class="add-signup-details" bind:open={ps.addSignup.open}>
                                    <summary>+ Add signup</summary>
                                    <div class="add-signup-form">
                                        <div class="field">
                                            <label class="field-label" for="add-player-{scope}">Player</label>
                                            <select id="add-player-{scope}" class="field-select" bind:value={ps.addSignup.playerId}>
                                                <option value="">— Select —</option>
                                                {#each blockPlayers as p}
                                                    <option value={String(p.id)}>{p.name}</option>
                                                {/each}
                                            </select>
                                        </div>
                                        <div class="field">
                                            <label class="field-label" for="add-faction-{scope}">Faction</label>
                                            <select id="add-faction-{scope}" class="field-select" bind:value={ps.addSignup.faction}>
                                                <option value={NONE_FACTION}>{NONE_FACTION}</option>
                                                {#each factionsFor(scope) as f}
                                                    <option>{f}</option>
                                                {/each}
                                            </select>
                                        </div>
                                        {#if ps.signupConfig?.show_points}
                                            <div class="field">
                                                <label class="field-label" for="add-points-{scope}">Points</label>
                                                <input id="add-points-{scope}" class="field-input" type="number" min="0" max="10000" step="250" bind:value={ps.addSignup.points} />
                                            </div>
                                        {/if}
                                        <div class="field">
                                            <label class="field-label" for="add-eta-{scope}">ETA</label>
                                            <select id="add-eta-{scope}" class="field-select" bind:value={ps.addSignup.eta}>
                                                <option value="">—</option>
                                                {#each ETA_OPTIONS as t}
                                                    <option>{t}</option>
                                                {/each}
                                            </select>
                                        </div>
                                        <div class="field">
                                            <label class="field-label" for="add-exp-{scope}">Experience</label>
                                            <select id="add-exp-{scope}" class="field-select" bind:value={ps.addSignup.experience}>
                                                {#each EXPERIENCE_OPTIONS as e}
                                                    <option>{e}</option>
                                                {/each}
                                            </select>
                                        </div>
                                        {#if !ps.signupConfig?.vibe_fixed}
                                            <div class="field">
                                                <label class="field-label" for="add-vibe-{scope}">Vibe</label>
                                                <select id="add-vibe-{scope}" class="field-select" bind:value={ps.addSignup.vibe}>
                                                    {#each ps.signupConfig?.vibe_options ?? [] as v}
                                                        <option>{v}</option>
                                                    {/each}
                                                </select>
                                            </div>
                                        {/if}
                                        {#if ps.signupConfig?.show_standby}
                                            <label class="check-row">
                                                <input type="checkbox" bind:checked={ps.addSignup.standbyOk} />
                                                <span>Standby</span>
                                            </label>
                                        {/if}
                                        {#if ps.signupConfig?.show_scenario}
                                            <div class="field">
                                                <label class="field-label" for="add-scenario-{scope}">Scenario</label>
                                                <input id="add-scenario-{scope}" class="field-input" type="text" bind:value={ps.addSignup.scenario} />
                                            </div>
                                        {/if}
                                        {#if ps.signupConfig?.show_can_demo}
                                            <label class="check-row">
                                                <input type="checkbox" bind:checked={ps.addSignup.canDemo} />
                                                <span>Can demo</span>
                                            </label>
                                        {/if}
                                    </div>
                                    {#if ps.addSignup.error}
                                        <p class="field-error">{ps.addSignup.error}</p>
                                    {/if}
                                    <button
                                        class="primary-button"
                                        type="button"
                                        disabled={ps.addSignup.submitting}
                                        onclick={() => submitAddSignup(scope)}
                                    >{ps.addSignup.submitting ? 'Adding…' : 'Add signup'}</button>
                                </details>
                            </div>

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

                                {#if ps.summary && (ps.summary.games > 0 || ps.summary.byes > 0)}
                                    <div class="pairing-summary" title="How these pairings scored against your weighting. Lower rematch/mirror/mismatch counts mean the matcher satisfied your weights.">
                                        <span class="ps-stat"><strong>{ps.summary.games}</strong> game{ps.summary.games === 1 ? '' : 's'}</span>
                                        {#if ps.summary.byes > 0}<span class="ps-stat"><strong>{ps.summary.byes}</strong> BYE</span>{/if}
                                        <span class="ps-stat" class:ps-flag={ps.summary.rematches > 0}><strong>{ps.summary.rematches}</strong> rematch{ps.summary.rematches === 1 ? '' : 'es'}</span>
                                        <span class="ps-stat" class:ps-flag={ps.summary.mirrors > 0}><strong>{ps.summary.mirrors}</strong> mirror{ps.summary.mirrors === 1 ? '' : 's'}</span>
                                        <span class="ps-stat" class:ps-flag={ps.summary.vibe_mismatches > 0}><strong>{ps.summary.vibe_mismatches}</strong> vibe mismatch{ps.summary.vibe_mismatches === 1 ? '' : 'es'}</span>
                                        {#if ps.summary.widest_eta_gap_mins > 0}<span class="ps-stat">widest ETA gap <strong>{ps.summary.widest_eta_gap_mins}m</strong></span>{/if}
                                    </div>
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
                                                    <tr class:prearranged-row={er.prearranged}>
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

                                    <div class="save-row">
                                        {#if ps.dirty}
                                            <span class="dirty-indicator">Unsaved changes</span>
                                        {/if}
                                        <button
                                            class="primary-button"
                                            type="button"
                                            disabled={ps.saving || !ps.dirty}
                                            onclick={() => savePairings(scope)}
                                        >{ps.saving ? 'Saving…' : 'Save Pairing Changes'}</button>
                                    </div>
                                {/if}
                            </div>

                            {#if ps.published}
                                <div class="sub-section pairings-section">
                                    <h4 class="sub-heading">Re-arrange a Game</h4>
                                    <p class="section-intro">Select the two players to pair together. Their current opponents will receive a bye.</p>
                                    <form class="appoint-form" onsubmit={(e) => { e.preventDefault(); rearrangeGame(scope); }}>
                                        <div class="field">
                                            <label class="field-label" for="rearrange-p1-{scope}">Player 1</label>
                                            <select id="rearrange-p1-{scope}" class="field-select" bind:value={ps.rearrange.player1Id}>
                                                <option value="">— Select —</option>
                                                {#each ps.signupRows as su}
                                                    <option value={String(su.player_id)}>{su.player_name}</option>
                                                {/each}
                                            </select>
                                        </div>
                                        <div class="field">
                                            <label class="field-label" for="rearrange-p2-{scope}">Player 2</label>
                                            <select id="rearrange-p2-{scope}" class="field-select" bind:value={ps.rearrange.player2Id}>
                                                <option value="">— Select —</option>
                                                {#each ps.signupRows as su}
                                                    <option value={String(su.player_id)}>{su.player_name}</option>
                                                {/each}
                                            </select>
                                        </div>
                                        {#if ps.rearrange.player1Id && ps.rearrange.player2Id && ps.rearrange.player1Id === ps.rearrange.player2Id}
                                            <p class="field-error">Players must be different.</p>
                                        {/if}
                                        {#if ps.rearrange.error}
                                            <p class="field-error">{ps.rearrange.error}</p>
                                        {/if}
                                        {#if ps.rearrange.message}
                                            <p class="pairing-message">{ps.rearrange.message}</p>
                                        {/if}
                                        <button
                                            type="submit"
                                            class="primary-button"
                                            disabled={!ps.rearrange.player1Id || !ps.rearrange.player2Id || ps.rearrange.player1Id === ps.rearrange.player2Id || ps.rearrange.submitting}
                                        >{ps.rearrange.submitting ? 'Re-arranging…' : 'Re-arrange'}</button>
                                    </form>
                                </div>
                            {/if}
                        {/if}
        </section>
            </div>
        </div>
    {/if}

    {#if activeNav === 'autopairings' && activeSystem}
        {@const scope = activeSystem}
        <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">Auto-Pairings</span>
            </div>
            <div class="dash-group-body">
        <section class="admin-section">
                        <!-- Auto-Pairings settings (system scopes only) -->
                        {#if isSystemScope(scope) && autoPairingsSettings[scope]}
                            {@const aps = autoPairingsSettings[scope]}
                            <div class="sub-section pairings-section">
                                <div class="auto-pairings-form">
                                    <div class="field field-narrow">
                                        <label class="field-label" for="ap-day-{scope}">Day</label>
                                        <select id="ap-day-{scope}" class="field-select" bind:value={aps.day}>
                                            {#each DAYS as d}
                                                <option>{d}</option>
                                            {/each}
                                        </select>
                                    </div>
                                    <div class="field field-narrow">
                                        <label class="field-label" for="ap-time-{scope}">Time</label>
                                        <input id="ap-time-{scope}" class="field-input" type="time" bind:value={aps.time} />
                                    </div>
                                    <div class="ap-row-break"></div>
                                    <label class="check-row ap-toggle">
                                        <input type="checkbox" bind:checked={aps.enabled} />
                                        <span>Enabled</span>
                                    </label>
                                    {#if aps.enabled && aps.last_week}
                                        <div class="ap-last-ran">
                                            <span class="muted small">Last ran for: {aps.last_week}</span>
                                        </div>
                                    {/if}
                                </div>
                                {#if aps.error}
                                    <p class="field-error">{aps.error}</p>
                                {/if}
                                {#if aps.message}
                                    <p class="pairing-message">{aps.message}</p>
                                {/if}
                                <button
                                    class="primary-button"
                                    type="button"
                                    disabled={aps.saving}
                                    onclick={() => saveAutoPairingsSettings(scope)}
                                >{aps.saving ? 'Saving…' : 'Save'}</button>
                            </div>
                        {/if}
        </section>
            </div>
        </div>
    {/if}

    {#if activeNav === 'announcements' && activeSystem}
        {@const scope = activeSystem}
        <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">Announcements</span>
            </div>
            <div class="dash-group-body">
        <section class="admin-section">
                        <!-- Call to Arms settings (system scopes only) -->
                        {#if isSystemScope(scope) && callToArmsSettings[scope]}
                            {@const cta = callToArmsSettings[scope]}
                            <div class="sub-section pairings-section">
                                <h4 class="sub-heading">Call to Arms</h4>
                                <p class="section-intro">
                                    Automatically post the sign-up “Call to Arms” to Discord a set number of
                                    days before this system's session day. Posts to this system's Call to Arms
                                    webhook (set under Discord Integrations).
                                </p>
                                <div class="auto-pairings-form">
                                    <div class="field field-narrow">
                                        <label class="field-label" for="cta-days-{scope}">Days before</label>
                                        <input id="cta-days-{scope}" class="field-input" type="number" min="0" max="14" bind:value={cta.days_before} />
                                    </div>
                                    <div class="field field-narrow">
                                        <label class="field-label" for="cta-time-{scope}">Time</label>
                                        <input id="cta-time-{scope}" class="field-input" type="time" bind:value={cta.time} />
                                    </div>
                                    <div class="ap-row-break"></div>
                                    <label class="check-row ap-toggle">
                                        <input type="checkbox" bind:checked={cta.enabled} />
                                        <span>Enabled</span>
                                    </label>
                                    {#if cta.enabled && cta.last_week}
                                        <div class="ap-last-ran">
                                            <span class="muted small">Last posted for: {cta.last_week}</span>
                                        </div>
                                    {/if}
                                </div>
                                <div class="field cta-template-field">
                                    <label class="field-label" for="cta-template-{scope}">Message</label>
                                    <textarea
                                        id="cta-template-{scope}"
                                        class="field-input field-textarea cta-template"
                                        rows="12"
                                        bind:value={cta.template}
                                    ></textarea>
                                    {#if cta.tokens.length > 0}
                                        <p class="field-label-hint">
                                            Tokens filled in automatically when posted:
                                            {#each cta.tokens as tok}<code class="cta-token">&#123;{tok}&#125;</code>{/each}
                                        </p>
                                    {/if}
                                    <button
                                        class="secondary-button cta-reset"
                                        type="button"
                                        disabled={cta.template === cta.default_template}
                                        onclick={() => (cta.template = cta.default_template)}
                                    >Reset to default</button>
                                </div>
                                <div class="field cta-image-field">
                                    <span class="field-label">Image</span>
                                    <div class="cta-image-modes">
                                        {#if cta.supports_mission_image}
                                            <label class="radio-row">
                                                <input type="radio" bind:group={cta.image_mode} value="default" />
                                                <span>Mission image</span>
                                            </label>
                                        {/if}
                                        <label class="radio-row">
                                            <input type="radio" bind:group={cta.image_mode} value="none" />
                                            <span>No image</span>
                                        </label>
                                        <label class="radio-row">
                                            <input type="radio" bind:group={cta.image_mode} value="custom" />
                                            <span>Custom image URL</span>
                                        </label>
                                    </div>
                                    {#if cta.supports_mission_image && cta.image_mode === 'default'}
                                        <p class="field-label-hint">
                                            Attaches a random image from this system's Missions pool below
                                            (or the built-in mission list if custom missions aren't enabled).
                                        </p>
                                    {/if}
                                    {#if cta.image_mode === 'custom'}
                                        <input
                                            class="field-input cta-image-url"
                                            type="url"
                                            placeholder="https://…/image.png"
                                            bind:value={cta.image_url}
                                        />
                                    {/if}
                                </div>
                                {#if cta.error}
                                    <p class="field-error">{cta.error}</p>
                                {/if}
                                {#if cta.message}
                                    <p class="pairing-message">{cta.message}</p>
                                {/if}
                                <button
                                    class="primary-button"
                                    type="button"
                                    disabled={cta.saving}
                                    onclick={() => saveCallToArmsSettings(scope)}
                                >{cta.saving ? 'Saving…' : 'Save'}</button>
                            </div>
                        {/if}
        </section>
            </div>
        </div>
    {/if}

    {#if activeNav === 'missions' && activeSystem}
        {@const scope = activeSystem}
        <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">Missions</span>
            </div>
            <div class="dash-group-body">
        <section class="admin-section">
                        <!-- Missions pool (system scopes only) -->
                        {#if isSystemScope(scope) && missionsState[scope]}
                            {@const ms = missionsState[scope]}
                            <div class="sub-section pairings-section">
                                <h4 class="sub-heading">Missions</h4>
                                <p class="section-intro">
                                    Curate a pool of missions for this system. When enabled, the weekly Call to
                                    Arms post picks one at random and shows its image (plus secondary objectives,
                                    if this system uses them) — replacing the built-in list with your club's own.
                                </p>

                                <div class="auto-pairings-form">
                                    <label class="check-row ap-toggle">
                                        <input type="checkbox" bind:checked={ms.missions_enabled} onchange={() => saveMissionsSettings(scope)} />
                                        <span>Enable custom missions for this system</span>
                                    </label>
                                    <label class="check-row ap-toggle">
                                        <input type="checkbox" bind:checked={ms.missions_use_secondary} onchange={() => saveMissionsSettings(scope)} />
                                        <span>This system uses secondary objectives</span>
                                    </label>
                                </div>
                                {#if ms.error}<p class="field-error">{ms.error}</p>{/if}

                                {#if ms.missions_enabled}
                                <div class="league-settings-details">
                                    <div class="league-settings-heading">Mission pool</div>
                                    <div class="league-settings-body">
                                    {#if ms.guidelines}
                                        <p class="field-label-hint mission-guidelines">
                                            <strong>Image guidelines:</strong> {ms.guidelines.recommended}
                                            Accepted formats: {ms.guidelines.formats.join(', ')}. Max {ms.guidelines.max_size_mb} MB per image.
                                        </p>
                                    {/if}

                                    <div class="mission-upload">
                                        <div class="field">
                                            <label class="field-label" for="mission-name-{scope}">Name (optional)</label>
                                            <input id="mission-name-{scope}" class="field-input" type="text" placeholder="e.g. King of the Hill" bind:value={ms.uploadName} />
                                        </div>
                                        {#if ms.missions_use_secondary}
                                            <div class="field">
                                                <label class="field-label" for="mission-secondary-{scope}">Secondary objectives (optional)</label>
                                                <input id="mission-secondary-{scope}" class="field-input" type="text" placeholder="e.g. Baggage Train, Domination" bind:value={ms.uploadSecondary} />
                                            </div>
                                        {/if}
                                        <div class="field">
                                            <label class="field-label" for="mission-image-{scope}">Mission image</label>
                                            {#key ms.uploadFileKey}
                                                <input
                                                    id="mission-image-{scope}"
                                                    class="field-input mission-file"
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp"
                                                    onchange={(e) => (ms.uploadFile = e.currentTarget.files?.[0] ?? null)}
                                                />
                                            {/key}
                                        </div>
                                        {#if ms.uploadError}<p class="field-error">{ms.uploadError}</p>{/if}
                                        {#if ms.uploadMessage}<p class="pairing-message">{ms.uploadMessage}</p>{/if}
                                        <button
                                            class="primary-button"
                                            type="button"
                                            disabled={ms.uploading || !ms.uploadFile}
                                            onclick={() => uploadMission(scope)}
                                        >{ms.uploading ? 'Uploading…' : 'Add mission'}</button>
                                    </div>

                                    {#if ms.missions.length === 0}
                                        <p class="muted small">No missions yet — add your first one above.</p>
                                    {:else}
                                        <div class="mission-table-wrap">
                                            <table class="mission-table">
                                                <thead>
                                                    <tr>
                                                        <th>Image</th>
                                                        <th>Name</th>
                                                        {#if ms.missions_use_secondary}<th>Secondary objectives</th>{/if}
                                                        <th>Active</th>
                                                        <th></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {#each ms.missions as m (m.id)}
                                                        <tr class:mission-inactive={!m.active}>
                                                            <td>
                                                                {#if m.image_url}
                                                                    <img class="mission-thumb" src={m.image_url} alt={m.name ?? 'mission'} />
                                                                {:else}
                                                                    <span class="muted small">no image</span>
                                                                {/if}
                                                            </td>
                                                            <td>
                                                                <input class="field-input mission-edit" type="text" value={m.name ?? ''}
                                                                    onchange={(e) => patchMission(scope, m, { name: e.currentTarget.value })} />
                                                            </td>
                                                            {#if ms.missions_use_secondary}
                                                                <td>
                                                                    <input class="field-input mission-edit" type="text" value={m.secondary_objectives ?? ''}
                                                                        onchange={(e) => patchMission(scope, m, { secondary_objectives: e.currentTarget.value })} />
                                                                </td>
                                                            {/if}
                                                            <td class="mission-active-cell">
                                                                <input type="checkbox" checked={m.active}
                                                                    onchange={(e) => patchMission(scope, m, { active: e.currentTarget.checked })} />
                                                            </td>
                                                            <td>
                                                                <button class="secondary-button" type="button" onclick={() => deleteMission(scope, m)}>Delete</button>
                                                            </td>
                                                        </tr>
                                                    {/each}
                                                </tbody>
                                            </table>
                                        </div>
                                        <p class="muted small">
                                            Inactive missions stay in your pool but are never posted. Each week's post
                                            picks at random from the active ones. Edit a name or secondary objective
                                            inline — changes save automatically.
                                        </p>
                                    {/if}
                                    </div>
                                </div>
                                {/if}
                            </div>
                        {/if}
        </section>
            </div>
        </div>
    {/if}

    {#if activeNav === 'clubcard' && activeSystem}
        {@const scope = activeSystem}
        <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">Club Card</span>
            </div>
            <div class="dash-group-body">
        <section class="admin-section">
                        <!-- Club page carousel card + events (system scopes only) -->
                        {#if isSystemScope(scope) && carouselState[scope]}
                            {@const cs = carouselState[scope]}
                            <div class="sub-section pairings-section">
                                <h4 class="sub-heading">Club Page</h4>
                                <p class="section-intro">
                                    How this system appears in the Systems carousel on the Club page — blurb,
                                    photo, and the accent colour that threads through its carousel card and
                                    calendar entries. Position in the carousel isn't set here — it's shuffled
                                    for every visitor so no system is always shown first.
                                </p>

                                <div class="field">
                                    <label class="field-label" for="carousel-blurb-{scope}">Blurb</label>
                                    <textarea id="carousel-blurb-{scope}" class="field-input" rows="2"
                                        placeholder="A short line about how this system runs at your club…"
                                        bind:value={cs.blurb}></textarea>
                                </div>
                                <div class="field">
                                    <label class="field-label" for="carousel-accent-{scope}">Accent colour</label>
                                    <div class="accent-row">
                                        <input id="carousel-accent-{scope}" type="color" class="accent-swatch" bind:value={cs.accent_color} />
                                        <input class="field-input" type="text" bind:value={cs.accent_color} placeholder="#c9a14a" />
                                    </div>
                                </div>
                                {#if cs.error}<p class="field-error">{cs.error}</p>{/if}
                                {#if cs.message}<p class="pairing-message">{cs.message}</p>{/if}
                                <div class="actions">
                                    <button class="primary-button" type="button" disabled={cs.saving} onclick={() => saveCarousel(scope)}>
                                        {cs.saving ? 'Saving…' : 'Save'}
                                    </button>
                                </div>

                                <div class="field carousel-photo-field">
                                    <label class="field-label" for="carousel-photo-{scope}">Carousel photo (optional)</label>
                                    <p class="field-label-hint mission-guidelines">
                                        <strong>Image guidelines:</strong> landscape, 16:9 (e.g. 800×450px). Accepted
                                        formats: PNG, JPEG, WEBP. Max 5 MB. Leave unset to show the system's logo instead.
                                    </p>
                                    {#if cs.photo_url}
                                        <div class="carousel-photo-preview">
                                            <img src={cs.photo_url} alt="" />
                                            <button class="secondary-button" type="button" onclick={() => deleteCarouselPhoto(scope)}>Remove photo</button>
                                        </div>
                                    {/if}
                                    {#key cs.uploadFileKey}
                                        <input
                                            id="carousel-photo-{scope}"
                                            class="field-input mission-file"
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            onchange={(e) => (cs.uploadFile = e.currentTarget.files?.[0] ?? null)}
                                        />
                                    {/key}
                                    {#if cs.uploadError}<p class="field-error">{cs.uploadError}</p>{/if}
                                    <div class="actions">
                                        <button class="primary-button" type="button" disabled={cs.uploading || !cs.uploadFile} onclick={() => uploadCarouselPhoto(scope)}>
                                            {cs.uploading ? 'Uploading…' : 'Upload photo'}
                                        </button>
                                    </div>
                                </div>

                                {#if systemEventsState[scope]}
                                    {@const es = systemEventsState[scope]}
                                    <div class="league-settings-details">
                                        <div class="league-settings-heading">Events</div>
                                        <div class="league-settings-body">
                                            <p class="section-intro">
                                                One-off dates for this system — tournaments, campaign days — shown
                                                on the Club page calendar in this system's accent colour, alongside
                                                its regular weekly/fortnightly sessions.
                                            </p>
                                            {#if es.events.length === 0 && !es.loading}
                                                <p class="muted small">No events yet — add one below.</p>
                                            {:else}
                                                <ul class="history-list">
                                                    {#each es.events as ev (ev.id)}
                                                        <li class="history-row">
                                                            <span class="history-date">{ev.event_date}</span>
                                                            <span class="history-matchup">{ev.title}</span>
                                                            <button class="secondary-button" type="button" onclick={() => deleteSystemEvent(scope, ev.id)}>Delete</button>
                                                        </li>
                                                    {/each}
                                                </ul>
                                            {/if}
                                            <div class="form-grid event-add-form">
                                                <div class="field">
                                                    <label class="field-label" for="ev-title-{scope}">Title</label>
                                                    <input id="ev-title-{scope}" class="field-input" type="text" bind:value={es.addTitle} />
                                                </div>
                                                <div class="field">
                                                    <label class="field-label" for="ev-date-{scope}">Date</label>
                                                    <input id="ev-date-{scope}" class="field-input" type="date" bind:value={es.addDate} />
                                                </div>
                                                <label class="check-row ap-toggle">
                                                    <input type="checkbox" bind:checked={es.addAllDay} />
                                                    <span>All day</span>
                                                </label>
                                                {#if !es.addAllDay}
                                                    <div class="field">
                                                        <label class="field-label" for="ev-start-{scope}">Start time</label>
                                                        <select id="ev-start-{scope}" class="field-select" bind:value={es.addStart}>
                                                            <option value="">— Not set —</option>
                                                            {#each HALF_HOUR_OPTIONS as t}
                                                                <option value={t}>{t}</option>
                                                            {/each}
                                                        </select>
                                                    </div>
                                                    <div class="field">
                                                        <label class="field-label" for="ev-end-{scope}">End time</label>
                                                        <select id="ev-end-{scope}" class="field-select" bind:value={es.addEnd}>
                                                            <option value="">— Not set —</option>
                                                            {#each HALF_HOUR_OPTIONS as t}
                                                                <option value={t}>{t}</option>
                                                            {/each}
                                                        </select>
                                                    </div>
                                                {/if}
                                            </div>
                                            {#if es.addError}<p class="field-error">{es.addError}</p>{/if}
                                            <div class="actions">
                                                <button class="primary-button" type="button" disabled={es.adding} onclick={() => addSystemEvent(scope)}>
                                                    {es.adding ? 'Adding…' : 'Add event'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/if}
        </section>
            </div>
        </div>
    {/if}

    {#if activeNav === 'blocks'}
    <!-- ══ Players & Blocks ══ -->
    <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">Players &amp; Blocks</span>
            </div>
        <div class="dash-group-body">
    {#if adminMe.is_super_admin}
        <!-- ── Edit Player Profile ───────────────────────────────────────────── -->
        <section class="admin-section">
            <h3 class="section-heading">Edit Player Profile</h3>
            <div class="player-edit-form">
                <div class="field">
                    <label class="field-label" for="edit-player-picker">Choose a Player to Edit</label>
                    <select
                        id="edit-player-picker"
                        class="field-select"
                        bind:value={editPlayerIdStr}
                        onchange={onEditPlayerChange}
                    >
                        <option value="">— Select player —</option>
                        {#each editPlayerList as p}
                            <option value={String(p.id)}>{p.name} (#{p.id})</option>
                        {/each}
                    </select>
                </div>

                {#if editPlayerIdStr}
                    <div class="field player-edit-wide">
                        <label class="field-label" for="edit-player-name">Display Name</label>
                        <input id="edit-player-name" class="field-input" type="text" bind:value={editPlayerName} />
                    </div>
                    <div class="field player-edit-wide">
                        <label class="field-label" for="edit-player-titles">Titles (one per line)</label>
                        <textarea
                            id="edit-player-titles"
                            class="field-input field-textarea"
                            rows="3"
                            bind:value={editPlayerTitlesText}
                        ></textarea>
                    </div>
                    <label class="check-row">
                        <input type="checkbox" bind:checked={editPlayerActive} />
                        <span>Show this player publicly</span>
                    </label>
                    <div class="field player-edit-wide">
                        <label class="field-label" for="edit-player-notes">
                            Admin Notes <span class="field-label-hint">(private — not shown publicly)</span>
                        </label>
                        <textarea
                            id="edit-player-notes"
                            class="field-input field-textarea"
                            rows="3"
                            bind:value={editPlayerAdminNotes}
                        ></textarea>
                    </div>
                    {#if editPlayerError}
                        <p class="field-error">{editPlayerError}</p>
                    {/if}
                    {#if editPlayerMessage}
                        <p class="pairing-message">{editPlayerMessage}</p>
                    {/if}
                    <button
                        class="primary-button"
                        type="button"
                        disabled={editPlayerSaving}
                        onclick={saveEditPlayer}
                    >{editPlayerSaving ? 'Saving…' : 'Save'}</button>
                {/if}
            </div>
        </section>
    {/if}
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
        </div>
    </div>
    {/if}

    {#if activeNav === 'systems' && adminMe.is_super_admin}
        <!-- ══ Systems & Schedule ══ -->
        <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">Systems &amp; Schedule</span>
            </div>
            <div class="dash-group-body">
        <section class="admin-section">
            <p class="section-intro">
                Enable or disable which systems your club runs. Disabling a system stops new
                signups and pairing generation for it, and hides it from league standings —
                it does not touch any existing signups, pairings, or results.
            </p>

            {#if clubSystemsMineError}
                <p class="field-error">{clubSystemsMineError}</p>
            {/if}

            <ul class="block-list">
                {#each clubSystemsMine as row (row.system_id)}
                    <li class="block-row">
                        <span class="block-names"><strong>{row.system_name}</strong></span>
                        <span class="block-note">
                            {row.session_cadence} {row.session_day}
                            {#if row.session_start_time} {row.session_start_time}{/if}
                            {#if row.cadence_anchor}(anchor {row.cadence_anchor}){/if}
                        </span>
                        <span class="status-badge" class:status-active={row.enabled} class:status-inactive={!row.enabled}>
                            {row.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <button class="primary-button" type="button" onclick={() => { csSelectId = String(row.system_id); onClubSystemPick(); }}>
                            Edit
                        </button>
                        <button class="secondary-button" type="button" onclick={() => toggleClubSystemMine(row)}>
                            {row.enabled ? 'Disable' : 'Enable'}
                        </button>
                    </li>
                {/each}
                {#if clubSystemsMine.length === 0}
                    <p class="muted">No systems configured yet — add one below.</p>
                {/if}
            </ul>

            {#if fullCatalogue.some((s) => !clubSystemsMine.some((cs) => cs.system_id === s.id))}
                <div class="field field-narrow cs-add">
                    <label class="field-label" for="cs-add">Add a system</label>
                    <select
                        id="cs-add"
                        class="field-select"
                        value=""
                        onchange={(e) => { const v = (e.target as HTMLSelectElement).value; (e.target as HTMLSelectElement).value = ''; if (v) { csSelectId = v; onClubSystemPick(); } }}
                    >
                        <option value="">— Add a system —</option>
                        {#each fullCatalogue.filter((s) => !clubSystemsMine.some((cs) => cs.system_id === s.id)) as s}
                            <option value={String(s.id)}>{s.legacy_system_name}</option>
                        {/each}
                    </select>
                </div>
            {/if}

            {#if csSelectId}
                <form class="appoint-form system-form cs-edit-form" onsubmit={(e) => { e.preventDefault(); saveClubSystemMine(); }}>
                    <h4 class="sub-heading">Edit system: {csEditingName}</h4>
                    <div class="field field-narrow">
                        <label class="field-label" for="cs-day">Day</label>
                        <select id="cs-day" class="field-select" bind:value={csSessionDay}>
                            {#each DAYS as d}
                                <option>{d}</option>
                            {/each}
                        </select>
                    </div>
                    <div class="field field-narrow">
                        <label class="field-label" for="cs-cadence">Cadence</label>
                        <select id="cs-cadence" class="field-select" bind:value={csSessionCadence}>
                            {#each CADENCES as c}
                                <option>{c}</option>
                            {/each}
                        </select>
                    </div>
                    {#if csSessionCadence === 'fortnightly'}
                        <div class="field field-narrow">
                            <label class="field-label" for="cs-anchor">Anchor date</label>
                            <input id="cs-anchor" class="field-input" type="date" bind:value={csCadenceAnchor} />
                        </div>
                    {/if}
                    <div class="field field-narrow">
                        <label class="field-label" for="cs-start-time">Start time (optional)</label>
                        <select id="cs-start-time" class="field-select" bind:value={csSessionStartTime}>
                            <option value="">— Not set —</option>
                            {#each HALF_HOUR_OPTIONS as t}
                                <option value={t}>{t}</option>
                            {/each}
                        </select>
                        <p class="field-caption">Shown on the Club page calendar, e.g. "{csEditingName || 'System'} session {csSessionStartTime || '18:00'}".</p>
                    </div>
                    <div class="field-row-break"></div>
                    <label class="check-row">
                        <input type="checkbox" bind:checked={csEnabled} />
                        <span>Enabled</span>
                    </label>
                    <div class="field-row-break"></div>

                    <div class="field cs-vibes-field">
                        <span class="field-label">Vibes</span>
                        <label class="check-row">
                            <input type="checkbox" bind:checked={csUseDefaultVibes} />
                            <span>Use the platform default vibes for this system</span>
                        </label>
                        {#if !csUseDefaultVibes}
                            <div class="vibe-checkboxes">
                                {#each CANONICAL_VIBES as v}
                                    <label class="check-row">
                                        <input
                                            type="checkbox"
                                            checked={csVibeOptions.includes(v)}
                                            onchange={(e) => {
                                                const set = new Set(csVibeOptions);
                                                if ((e.target as HTMLInputElement).checked) set.add(v);
                                                else set.delete(v);
                                                csVibeOptions = CANONICAL_VIBES.filter((x) => set.has(x));
                                                if (!csVibeOptions.includes(csDefaultVibe)) csDefaultVibe = csVibeOptions[0] ?? '';
                                            }}
                                        />
                                        <span>{v}</span>
                                    </label>
                                {/each}
                            </div>
                            {#if csVibeOptions.length > 0}
                                <div class="field field-narrow">
                                    <label class="field-label" for="cs-default-vibe">Default vibe</label>
                                    <select id="cs-default-vibe" class="field-select" bind:value={csDefaultVibe}>
                                        {#each csVibeOptions as v}
                                            <option value={v}>{v}</option>
                                        {/each}
                                    </select>
                                </div>
                            {:else}
                                <p class="field-error">Pick at least one vibe, or use the platform default.</p>
                            {/if}
                        {/if}
                    </div>

                    {#if csError}
                        <p class="field-error">{csError}</p>
                    {/if}
                    {#if csMessage}
                        <p class="pairing-message">{csMessage}</p>
                    {/if}
                    <div class="system-form-actions">
                        <button type="submit" class="primary-button" disabled={csSaving || (!csUseDefaultVibes && csVibeOptions.length === 0)}>
                            {csSaving ? 'Saving…' : 'Save system'}
                        </button>
                        <button type="button" class="secondary-button" onclick={() => { csSelectId = ''; csError = null; csMessage = null; }}>Cancel</button>
                    </div>
                </form>
            {/if}
        </section>
            </div>
        </div>
    {/if}

    {#if activeNav === 'discord' && adminMe.is_super_admin}
        <!-- ══ Discord Integrations ══ -->
        <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">Discord Integrations</span>
            </div>
            <div class="dash-group-body">
        <section class="admin-section">
            <h3 class="section-heading">Discord Webhooks</h3>
            <p class="section-intro">
                Configure this club's Discord webhook URLs. Once saved, a URL is never shown again —
                only the last 4 characters, so you can confirm you saved the right one.
            </p>

            {#if webhookListError}
                <p class="field-error">{webhookListError}</p>
            {:else if webhookRows.length === 0}
                <p class="muted">Loading…</p>
            {:else}
                {#each PER_SYSTEM_WEBHOOK_TYPES.filter((t) => webhookRows.some((r) => r.webhook_type === t)) as webhookType}
                    <div class="sub-section">
                        <h4 class="sub-heading">
                            {WEBHOOK_TYPE_LABELS[webhookType]}
                        </h4>
                        <ul class="block-list">
                            {#each webhookRows.filter((r) => r.webhook_type === webhookType) as row (row.system_id)}
                                {@const key = webhookKey(row.webhook_type, row.system_id)}
                                <li class="block-row webhook-row">
                                    <span class="block-names">
                                        <strong>{row.system_name}</strong>
                                    </span>
                                    <span class="block-note">
                                        {row.configured ? `Configured (${row.last_four})` : 'Not configured'}
                                    </span>
                                    <span class="webhook-actions">
                                        <input
                                            class="field-input"
                                            type="url"
                                            placeholder="https://discord.com/api/webhooks/…"
                                            bind:value={webhookInputs[key]}
                                        />
                                        <button
                                            class="primary-button"
                                            type="button"
                                            disabled={!(webhookInputs[key] ?? '').trim() || webhookSaving[key]}
                                            onclick={() => saveClubWebhook(row.webhook_type, row.system_id)}
                                        >{webhookSaving[key] ? 'Saving…' : 'Save'}</button>
                                        {#if row.configured}
                                            <button
                                                class="remove-btn"
                                                type="button"
                                                title="Remove webhook"
                                                disabled={webhookSaving[key]}
                                                onclick={() => removeClubWebhook(row.webhook_type, row.system_id)}
                                            >×</button>
                                        {/if}
                                    </span>
                                    {#if webhookError[key]}
                                        <p class="field-error">{webhookError[key]}</p>
                                    {/if}
                                    {#if webhookMessage[key]}
                                        <p class="pairing-message webhook-message">{webhookMessage[key]}</p>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/each}
            {/if}
        </section>
            </div>
        </div>
    {/if}

    {#if activeNav === 'admins' && adminMe.is_super_admin}
        <!-- ══ Admins & Delegates ══ -->
        <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">Admins &amp; Delegates</span>
            </div>
            <div class="dash-group-body">
        <section class="admin-section">

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
                            <option value="">— Select scope —</option>
                            {#each adminMe.scopes as s}
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
    {/if}

    {#if activeNav === 'booking' && adminMe.is_super_admin}
        <!-- ══ Table Booking ══ -->
        <div class="dash-group">
            <div class="dash-group-header static">
                <span class="dash-group-title">Table Booking</span>
            </div>
            <div class="dash-group-body">
        <section class="admin-section">
            <h3 class="section-heading">Venue Table-Booking Emails</h3>
            <p class="section-intro">
                When enabled, this system automatically emails the venue how many tables and
                players to expect for a session, so they can manage capacity. Super-admin only —
                this is venue/billing configuration, not day-to-day system administration.
            </p>

            <div class="field field-narrow">
                <label class="field-label" for="tb-scope">System</label>
                <select
                    id="tb-scope"
                    class="field-select"
                    value={tbSelectScope}
                    onchange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v) loadTableBooking(v); }}
                >
                    <option value="">— Select a system —</option>
                    {#each adminMe.scopes as s}
                        <option value={s}>{s}</option>
                    {/each}
                </select>
            </div>

            {#if tbLoading}
                <p class="muted">Loading…</p>
            {:else if tbSelectScope}
                <form class="appoint-form system-form" onsubmit={(e) => { e.preventDefault(); saveTableBooking(); }}>
                    <label class="check-row">
                        <input type="checkbox" bind:checked={tbEnabled} />
                        <span>Send table-booking emails for {tbSelectScope}</span>
                    </label>
                    <div class="field-row-break"></div>

                    <div class="field field-narrow">
                        <label class="field-label" for="tb-venue-name">Venue name</label>
                        <input id="tb-venue-name" class="field-input" type="text" bind:value={tbVenueName} placeholder="e.g. EG NWGC" />
                    </div>
                    <div class="field field-narrow">
                        <label class="field-label" for="tb-venue-email">Venue email</label>
                        <input id="tb-venue-email" class="field-input" type="email" bind:value={tbVenueEmail} placeholder="bookings@venue.example" />
                    </div>
                    <div class="field field-narrow">
                        <label class="field-label" for="tb-cc-emails">CC emails (comma-separated)</label>
                        <input id="tb-cc-emails" class="field-input" type="text" bind:value={tbCcEmailsText} placeholder="manager@venue.example, you@calltoarms.app" />
                    </div>
                    <div class="field-row-break"></div>

                    <div class="field field-narrow">
                        <label class="field-label" for="tb-players-per-table">Players per table</label>
                        <input id="tb-players-per-table" class="field-input" type="number" min="1" bind:value={tbPlayersPerTable} />
                    </div>
                    <label class="check-row">
                        <input type="checkbox" bind:checked={tbIncludeNames} />
                        <span>Include player names in the email</span>
                    </label>
                    <div class="field-row-break"></div>

                    <div class="field field-narrow">
                        <label class="field-label" for="tb-send-mode">Send trigger</label>
                        <select id="tb-send-mode" class="field-select" bind:value={tbSendMode}>
                            <option value="on_publish">When pairings are published (auto or manual)</option>
                            <option value="cutoff">At a fixed day/time each week</option>
                        </select>
                    </div>
                    {#if tbSendMode === 'cutoff'}
                        <div class="field field-narrow">
                            <label class="field-label" for="tb-cutoff-day">Cutoff day</label>
                            <select id="tb-cutoff-day" class="field-select" bind:value={tbCutoffDay}>
                                {#each TABLE_BOOKING_CUTOFF_DAYS as d}
                                    <option>{d}</option>
                                {/each}
                            </select>
                        </div>
                        <div class="field field-narrow">
                            <label class="field-label" for="tb-cutoff-time">Cutoff time</label>
                            <input id="tb-cutoff-time" class="field-input" type="time" bind:value={tbCutoffTime} />
                        </div>
                        <p class="field-caption">
                            Sent at this day/time (UK local) based on headcount so far — pairings may not exist yet.
                        </p>
                    {/if}
                    <div class="field-row-break"></div>

                    <div class="field player-edit-wide">
                        <label class="field-label" for="tb-subject">Custom subject (optional)</label>
                        <input id="tb-subject" class="field-input" type="text" bind:value={tbSubjectTemplate} placeholder="Leave blank for the default subject" />
                    </div>
                    <div class="field player-edit-wide">
                        <label class="field-label" for="tb-notes">Notes (optional, internal)</label>
                        <textarea id="tb-notes" class="field-input field-textarea" rows="2" bind:value={tbNotes}></textarea>
                    </div>

                    {#if tbError}
                        <p class="field-error">{tbError}</p>
                    {/if}
                    {#if tbMessage}
                        <p class="pairing-message">{tbMessage}</p>
                    {/if}
                    <div class="system-form-actions">
                        <button type="submit" class="primary-button" disabled={tbSaving || !tbVenueEmail.trim()}>
                            {tbSaving ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </form>

                <div class="sub-section">
                    <h4 class="sub-heading">Preview / send for a specific week</h4>
                    <div class="field field-narrow">
                        <label class="field-label" for="tb-preview-week">Week (DD/MM/YYYY)</label>
                        <input id="tb-preview-week" class="field-input" type="text" bind:value={tbPreviewWeek} placeholder="e.g. 05/03/2026" />
                    </div>
                    <div class="system-form-actions">
                        <button
                            type="button"
                            class="secondary-button"
                            disabled={tbPreviewLoading || !tbPreviewWeek.trim()}
                            onclick={previewTableBooking}
                        >{tbPreviewLoading ? 'Computing…' : 'Preview'}</button>
                        <button
                            type="button"
                            class="primary-button"
                            disabled={tbSendLoading || !tbPreviewWeek.trim()}
                            onclick={sendTableBookingNow}
                        >{tbSendLoading ? 'Sending…' : 'Send now'}</button>
                    </div>

                    {#if tbPreviewError}
                        <p class="field-error">{tbPreviewError}</p>
                    {/if}
                    {#if tbSendMessage}
                        <p class="pairing-message">{tbSendMessage}</p>
                    {/if}
                    {#if tbPreview}
                        <div class="tb-preview-box">
                            <p>
                                <strong>{tbPreview.tables} table{tbPreview.tables === 1 ? '' : 's'}</strong>
                                for <strong>{tbPreview.headcount} player{tbPreview.headcount === 1 ? '' : 's'}</strong>
                                {#if tbPreview.already_sent}
                                    <span class="status-badge status-active">Already sent</span>
                                {/if}
                            </p>
                            <p class="muted small">Subject: {tbPreview.subject}</p>
                            <details>
                                <summary>Email preview</summary>
                                <div class="tb-preview-html">{@html tbPreview.html}</div>
                            </details>
                        </div>
                    {/if}
                </div>

                <div class="sub-section">
                    <h4 class="sub-heading">Recent sends</h4>
                    {#if tbHistoryLoading}
                        <p class="muted">Loading…</p>
                    {:else if tbHistory.length === 0}
                        <p class="muted">No sends yet for this system.</p>
                    {:else}
                        <ul class="block-list">
                            {#each tbHistory as h}
                                <li class="block-row">
                                    <span class="block-names"><strong>{h.week}</strong></span>
                                    <span class="block-note">{h.tables} tables, {h.headcount} players</span>
                                    <span class="status-badge" class:status-active={h.status === 'sent'} class:status-inactive={h.status !== 'sent'}>
                                        {h.status}
                                    </span>
                                    <span class="muted small">{new Date(h.sent_at).toLocaleString()}</span>
                                    {#if h.error}
                                        <span class="field-error small">{h.error}</span>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>
            {/if}
        </section>
            </div>
        </div>
    {/if}

        </div>
    </div>

{/if}

<style>
    .page-heading {
        font-size: 1.5rem;
        margin: 0 0 1.5rem;
    }

    /* ── Console shell (sidebar + main panel) ────────────────────────────── */
    .admin-shell {
        display: grid;
        grid-template-columns: minmax(180px, 220px) 1fr;
        gap: 1.5rem;
        align-items: start;
    }

    .admin-sidebar {
        position: sticky;
        top: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        background: var(--color-surface);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        padding: 0.6rem;
    }

    .nav-group-label {
        text-transform: uppercase;
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 1.4px;
        color: var(--color-steel);
        margin: 0.8rem 0 0.35rem 0.5rem;
    }

    .nav-group-label:first-child {
        margin-top: 0.2rem;
    }

    .nav-system-select {
        margin: 0 0.15rem 0.35rem;
        width: auto;
    }

    .nav-item {
        text-align: left;
        background: transparent;
        border: none;
        border-left: 3px solid transparent;
        border-radius: 0;
        color: var(--color-text-muted);
        font-size: 0.85rem;
        font-weight: 600;
        padding: 0.5rem 0.6rem;
        cursor: pointer;
        transition: background 0.12s ease, color 0.12s ease, border-left-color 0.12s ease;
    }

    .nav-item:hover {
        background: var(--color-surface-hover);
        color: var(--color-text-bright);
    }

    .nav-item.active {
        background: var(--color-surface-hover);
        border-left-color: var(--color-accent);
        color: var(--color-accent-bright);
    }

    .admin-main {
        min-width: 0;
    }

    @media (max-width: 860px) {
        .admin-shell {
            grid-template-columns: 1fr;
        }
        .admin-sidebar {
            position: static;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 0.35rem;
        }
        .nav-group-label {
            width: 100%;
            margin: 0.4rem 0 0.1rem 0.2rem;
        }
        .nav-system-select {
            width: 100%;
        }
        .nav-item {
            border-left: none;
            border-bottom: 2px solid transparent;
        }
        .nav-item.active {
            border-bottom-color: var(--color-accent);
        }
    }

    /* Static (non-interactive) module header — used where a panel used to be
       a collapsible <details> but is now shown standalone via the sidebar. */
    .dash-group-header.static {
        cursor: default;
        border-left-color: var(--color-accent-border);
    }

    /* ── Command Table (dashboard overview) ─────────────────────────────── */
    .command-table {
        margin-bottom: 2.25rem;
        padding: 1.4rem 1.5rem 1.6rem;
        background: var(--color-surface);
        border: 1px solid var(--color-steel-border);
        /* the "gilt edge" of the command table — a single accent hairline on top */
        border-top: 2px solid var(--color-accent-border);
        border-radius: var(--radius);
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.34);
    }
    .ct-head {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        margin-bottom: 1.25rem;
    }
    .ct-eyebrow {
        text-transform: uppercase;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 2.5px;
        color: var(--color-accent);
    }
    .ct-title {
        margin: 0;
        font-size: 1.25rem;
        color: var(--color-text-bright);
        letter-spacing: -0.01em;
    }
    .ct-label {
        text-transform: uppercase;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 1.8px;
        color: var(--color-steel);
        padding-bottom: 0.5rem;
        border-bottom: 1px solid var(--color-steel-border-soft);
        margin-bottom: 0.9rem;
    }
    .ct-label-trends {
        margin-top: 1.6rem;
    }
    .ct-trend-sys {
        color: var(--color-text-dim);
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    .status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.85rem;
    }
    .status-tile {
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        padding: 0.85rem 0.95rem;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        /* status-tile signature: a 3px gilt left rule, echoing the global .stat-card */
        border-left: 3px solid var(--color-accent-border);
        border-radius: var(--radius);
        cursor: pointer;
        transition: border-color 0.14s ease, transform 0.08s ease, background 0.14s ease;
    }
    .status-tile:hover {
        border-color: var(--color-accent-border);
        background: var(--color-surface-hover);
    }
    .status-tile:active {
        transform: translateY(1px);
    }
    .status-tile.selected {
        border-color: var(--color-accent);
        border-left-color: var(--color-accent);
        box-shadow: 0 0 0 1px var(--color-accent-border) inset;
    }
    .st-top {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .st-logo {
        width: 26px;
        height: 26px;
        object-fit: contain;
        flex-shrink: 0;
    }
    .st-name {
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--color-text-bright);
        line-height: 1.15;
    }
    .st-count {
        display: flex;
        align-items: baseline;
        gap: 0.4rem;
    }
    .st-num {
        font-size: 1.9rem;
        font-weight: 800;
        color: var(--color-accent-bright);
        font-variant-numeric: tabular-nums;
        line-height: 1;
    }
    .st-cap {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-text-dim);
    }
    .signup-cap-section {
        border-bottom: 1px solid var(--color-steel-border-soft);
        padding-bottom: 1rem;
        margin-bottom: 0.5rem;
    }
    .signup-cap-row {
        display: flex;
        align-items: flex-end;
        gap: 0.85rem;
        flex-wrap: wrap;
    }
    .st-num-label {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-text-dim);
    }
    .st-status {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.76rem;
        color: var(--color-text-muted);
    }
    .st-led {
        font-size: 0.7rem;
        line-height: 1;
    }
    .st-status.live .st-led {
        color: var(--color-win);
    }
    .st-status.drafted .st-led {
        color: var(--color-accent);
    }
    .st-status.none .st-led {
        color: var(--color-steel);
    }
    .st-next {
        font-size: 0.72rem;
        color: var(--color-text-faint);
        font-variant-numeric: tabular-nums;
    }

    .trend-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1rem;
    }
    .chart-card {
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border-soft);
        border-radius: var(--radius);
        padding: 0.95rem 1.05rem 1.05rem;
    }
    .chart-card-title {
        text-transform: uppercase;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 1.4px;
        color: var(--color-accent);
        margin-bottom: 0.85rem;
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

    /* ── Dashboard groups (collapsible) ──────────────────────────────────── */

    /* Clean squared panel — matches .card in app.css for cross-page consistency. */
    .dash-group {
        margin-bottom: 1.25rem;
        background: var(--color-surface);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.34);
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
        /* Gilt left rule — the shared dashboard-module signature, echoing the
           Command Table's status tiles so every panel reads as one system. */
        border-left: 3px solid var(--color-accent-border);
        user-select: none;
        list-style: none;
        transition: border-left-color 0.15s ease, color 0.15s ease;
    }

    .dash-group-header:hover {
        border-left-color: var(--color-accent);
        color: var(--color-accent-bright);
    }

    .dash-group-title {
        flex: 1;
    }

    .dash-group-body {
        padding: 1.25rem 1.5rem;
    }

    /* Member sections sit inside the group card — the card is the frame, so
       drop their own bottom-margin scaffolding and don't let the last one
       add trailing space. */
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
        border-radius: var(--radius);
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
        color: var(--color-loss);
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
        border-radius: var(--radius);
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

    /* ── Discord Webhooks ─────────────────────────────────────────────────
       .field-input is globally width:100% (app.css), which assumes it's
       wrapped in a .field div. Here it sits directly in a flex row, so
       override to a bounded, flexible width — otherwise it fills the
       whole row and pushes Save/Remove onto a disconnected trailing line. */
    .webhook-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1 1 320px;
    }

    .webhook-actions .field-input {
        width: auto;
        flex: 1 1 240px;
        min-width: 180px;
    }

    .webhook-message {
        width: 100%;
        margin-left: 0;
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

    .field-row-break {
        flex-basis: 100%;
        height: 0;
    }

    .system-form {
        margin-top: 0.5rem;
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
        border-radius: var(--radius);
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
        border-radius: var(--radius);
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
        color: var(--color-loss);
        margin: 0.25rem 0 0;
        width: 100%;
    }

    .primary-button {
        background: var(--color-accent);
        color: #111;
        border: none;
        border-radius: var(--radius);
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

    .primary-button:not(:disabled):hover {
        opacity: 0.85;
    }

    .secondary-button {
        background: transparent;
        color: var(--color-accent);
        border: 1px solid var(--color-accent-border);
        border-radius: var(--radius);
        padding: 0 14px;
        height: 2.2rem;
        box-sizing: border-box;
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
        border-radius: var(--radius);
        padding: 0 14px;
        height: 2.2rem;
        box-sizing: border-box;
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        transition: opacity 0.15s;
        white-space: nowrap;
    }

    .pub-on {
        background: #7f1d1d;
        color: #fca5a5;
    }

    .pub-off {
        background: #166534;
        color: #bbf7d0;
    }

    .publish-btn:hover {
        opacity: 0.85;
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
        min-width: 5.5rem;
        font-variant-numeric: tabular-nums;
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
        flex-direction: column;
        align-items: flex-start;
        gap: 0.6rem;
        margin-bottom: 0.75rem;
    }

    /* Force the same explicit height as the action buttons — <input> and
       <button> have different intrinsic height behaviour even with identical
       padding/font/border, so matching those properties alone isn't enough. */
    .week-input {
        padding: 0 14px;
        height: 2.2rem;
        box-sizing: border-box;
        font-size: 0.85rem;
    }

    .pairing-btn-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
    }

    .preview-row td {
        opacity: 0.75;
    }

    .pairing-message {
        font-size: 0.8rem;
        color: var(--color-win);
        margin: 0 0 0.5rem;
    }

    /* ── Pairing quality summary strip ──────────────────────────────────── */
    .pairing-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem 1rem;
        padding: 0.6rem 0.85rem;
        margin: 0 0 0.85rem;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border-soft);
        border-left: 3px solid var(--color-accent-border);
        border-radius: var(--radius);
        font-size: 0.8rem;
        color: var(--color-text-muted);
    }
    .ps-stat {
        white-space: nowrap;
    }
    .ps-stat strong {
        color: var(--color-text-bright);
        font-variant-numeric: tabular-nums;
    }
    /* Non-zero rematch/mirror/mismatch counts are the things a weighting tweak
       is meant to reduce — tint them so they read as "worth a look". */
    .ps-stat.ps-flag strong {
        color: var(--color-tnt);
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

    .cell-readonly {
        font-size: 0.78rem;
        color: var(--color-text-muted);
        font-variant-numeric: tabular-nums;
    }

    .league-results-grid {
        min-width: 1300px;
    }

    .league-results-wrap {
        max-height: 320px;
        overflow-y: auto;
    }

    .league-results-grid thead th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: var(--color-sidebar-bg);
    }

    .cell-delete {
        width: 28px;
        text-align: center;
    }

    .cell-check {
        width: 50px;
        text-align: center;
    }

    .cell-input {
        background: var(--color-surface-dark);
        border: 1px solid var(--color-accent-border-soft);
        border-radius: 4px;
        color: var(--color-text-base);
        padding: 3px 6px;
        font-size: 0.75rem;
        width: 100%;
        max-width: 140px;
        font-family: inherit;
    }

    .cell-input:focus {
        outline: none;
        border-color: var(--color-accent);
    }

    .add-signup-details {
        margin-top: 0.5rem;
    }

    .add-signup-details summary {
        cursor: pointer;
        font-weight: 600;
        color: var(--color-accent);
        font-size: 0.85rem;
        list-style: none;
    }

    .add-signup-details summary::-webkit-details-marker { display: none; }

    .add-signup-form {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin: 0.75rem 0;
    }

    .add-signup-form .field {
        min-width: 140px;
    }

    .check-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.85rem;
        color: var(--color-text-base);
    }

    .save-row {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-top: 0.5rem;
    }

    .dirty-indicator {
        font-size: 0.78rem;
        color: var(--color-accent-bright);
        font-style: italic;
    }

    /* ── Auto-Pairings settings ─────────────────────────────────────────── */

    .auto-pairings-form {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
    }

    .ap-row-break {
        flex-basis: 100%;
        height: 0;
    }

    .ap-toggle {
        padding-bottom: 6px;
    }

    .ap-last-ran {
        padding-bottom: 6px;
    }

    .cta-template-field {
        margin-top: 0.25rem;
        max-width: 640px;
    }

    .cta-template {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.82rem;
        line-height: 1.45;
        resize: vertical;
        min-height: 8rem;
    }

    .cta-token {
        display: inline-block;
        font-size: 0.72rem;
        background: rgba(201, 161, 74, 0.12);
        border: 1px solid rgba(201, 161, 74, 0.35);
        color: var(--color-accent);
        padding: 1px 5px;
        border-radius: 4px;
        margin: 0 0.3rem 0.25rem 0;
    }

    .cta-reset {
        margin-top: 0.5rem;
    }

    .cs-add {
        margin-bottom: 1rem;
    }

    .cs-edit-form {
        border-top: 1px solid var(--color-accent-border-soft);
        padding-top: 1rem;
    }

    .cs-vibes-field {
        max-width: 560px;
    }

    .vibe-checkboxes {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 1.1rem;
        margin: 0.35rem 0;
    }

    .system-form-actions {
        display: flex;
        gap: 0.6rem;
        align-items: center;
    }

    .tb-preview-box {
        margin-top: 0.75rem;
        padding: 0.75rem 1rem;
        border: 1px solid var(--color-accent-border-soft);
        border-radius: 6px;
        background: var(--color-surface-dark);
    }

    .tb-preview-html {
        margin-top: 0.5rem;
        padding: 0.75rem;
        border: 1px solid rgba(148, 163, 184, 0.25);
        border-radius: 4px;
        max-width: 640px;
    }

    .cta-image-field {
        margin-top: 0.5rem;
        max-width: 640px;
    }

    .cta-image-modes {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 1.25rem;
        margin: 0.35rem 0;
    }

    .radio-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.88rem;
        cursor: pointer;
    }

    .cta-image-url {
        margin-top: 0.35rem;
    }

    /* ── Edit Player Profile ────────────────────────────────────────────── */

    .player-edit-form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-width: 480px;
    }

    .player-edit-wide {
        min-width: 0;
        width: 100%;
    }

    .field-textarea {
        resize: vertical;
        min-height: 4rem;
        line-height: 1.5;
    }

    .field-label-hint {
        font-size: 0.65rem;
        font-weight: 400;
        text-transform: none;
        letter-spacing: 0;
        color: var(--color-text-faint);
    }

    .field-label-hint .hint-link {
        color: var(--color-accent);
        text-decoration: underline;
    }

    .field-label-hint .hint-link:hover {
        color: var(--color-accent-bright);
    }

    /* Missions */
    .mission-guidelines {
        margin: 0.5rem 0 0.75rem;
        line-height: 1.4;
    }
    .mission-upload {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        padding: 0.75rem;
        border: 1px solid var(--color-steel-border);
        border-radius: 6px;
        background: var(--color-surface-dark);
        margin-bottom: 1rem;
    }
    .mission-file {
        padding: 0.4rem;
        font-size: 0.8rem;
    }
    .mission-table-wrap {
        overflow-x: auto;
    }
    .mission-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
    }
    .mission-table th,
    .mission-table td {
        text-align: left;
        padding: 0.4rem 0.5rem;
        border-bottom: 1px solid var(--color-steel-border);
        vertical-align: middle;
    }
    .mission-table th {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-faint);
    }
    .mission-thumb {
        width: 72px;
        height: 48px;
        object-fit: cover;
        border-radius: 4px;
        border: 1px solid var(--color-steel-border);
        display: block;
    }
    .mission-edit {
        min-width: 10rem;
        font-size: 0.8rem;
    }
    .mission-active-cell {
        text-align: center;
    }
    .mission-inactive {
        opacity: 0.5;
    }

    /* League */
    .sub-heading-minor {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--color-text-muted);
        margin: 1rem 0 0.5rem;
    }
    .league-config-form,
    .league-seasons,
    .league-results {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        margin-top: 0.5rem;
    }

    .league-log-results {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        margin-top: 1.25rem;
        padding-top: 1rem;
        border-top: 1px solid var(--color-steel-border-soft);
    }
    .log-week-row {
        display: flex;
        align-items: flex-end;
        gap: 0.75rem;
        flex-wrap: wrap;
    }

    /* ── Pairing weighting: sliders + live donut side by side ────────────── */
    .pairing-weight-layout {
        display: grid;
        grid-template-columns: minmax(280px, 420px) minmax(260px, 1fr);
        gap: 1.75rem;
        align-items: start;
    }
    .pw-window-block {
        margin-top: 0.6rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--color-steel-border-soft);
    }
    .pw-window-title {
        text-transform: uppercase;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 1.4px;
        color: var(--color-accent);
        margin-bottom: 0.35rem;
    }
    .pw-window-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 0.4rem;
    }
    .pairing-weight-form {
        min-width: 0;
    }
    .pairing-weight-chart {
        min-width: 0;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border-soft);
        border-radius: var(--radius);
        padding: 0.95rem 1.05rem 1.05rem;
        position: sticky;
        top: 1rem;
    }
    @media (max-width: 760px) {
        .pairing-weight-layout {
            grid-template-columns: 1fr;
        }
        .pairing-weight-chart {
            position: static;
        }
    }
    .season-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }
    .season-list li {
        display: flex;
    }
    .season-row-button {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 0.5rem;
        font-size: 0.85rem;
        width: 100%;
        text-align: left;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 0.25rem 0.4rem;
        cursor: pointer;
        color: inherit;
        font-family: inherit;
    }
    .season-row-button:hover {
        border-color: var(--color-steel-border);
    }
    .season-row-button.active {
        border-color: var(--color-accent-border);
        background: rgba(148, 163, 184, 0.06);
    }
    .season-current-badge {
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-win);
        border: 1px solid var(--color-win);
        border-radius: 4px;
        padding: 0.05rem 0.35rem;
    }
    .season-champion {
        font-size: 0.75rem;
        color: var(--color-accent);
    }
    .league-settings-details {
        margin-top: 0.5rem;
        border: 1px solid var(--color-steel-border);
        border-radius: 6px;
        padding: 0.6rem 0.75rem;
        background: var(--color-surface-dark);
    }
    .league-settings-details summary,
    .league-settings-heading {
        font-weight: 700;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-text-muted);
    }
    .league-settings-details summary {
        cursor: pointer;
    }
    .league-settings-body {
        margin-top: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .league-help-text {
        font-size: 0.8rem;
        line-height: 1.5;
        color: var(--color-text-dim);
        margin: 0 0 0.25rem;
    }

    /* Club landing page: carousel accent picker, photo preview, event form */
    .accent-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .accent-swatch {
        flex: 0 0 auto;
        width: 40px;
        height: 38px;
        padding: 2px;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        cursor: pointer;
    }

    .carousel-photo-field {
        margin-top: 1rem;
    }

    .carousel-photo-preview {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.6rem;
    }

    .carousel-photo-preview img {
        width: 120px;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        border-radius: var(--radius);
        border: 1px solid var(--color-steel-border);
    }

    .event-add-form {
        margin-top: 0.7rem;
    }

    /* Was used in markup (Website/Discord, Latitude/Longitude, event fields)
       without ever being defined — every ".form-grid" div silently rendered
       as a single stacked column instead of a real grid. */
    .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.75rem;
        margin-bottom: 0.85rem;
    }

    .club-hours-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.6rem;
        margin-bottom: 0.9rem;
    }

    .club-hours-row {
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        padding: 0.6rem;
    }

    /* Overrides only what .check-row doesn't already set (weight/size/
       spacing) — must NOT touch display, or it cancels .check-row's flex
       layout (same specificity, this rule comes later) and the checkbox +
       day name wrap onto separate lines instead of sitting in a row. */
    .club-hours-day {
        font-weight: 700;
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
        white-space: nowrap;
    }

    .club-hours-times {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin-top: 0.4rem;
    }

    .club-hours-times select {
        flex: 1 1 0;
        min-width: 0;
    }

    .club-hours-times-sep {
        color: var(--color-text-faint);
        flex: 0 0 auto;
    }

    .club-logo-preview {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        margin-bottom: 0.7rem;
    }

    .club-logo-preview img {
        width: 72px;
        height: 72px;
        object-fit: contain;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        padding: 0.4rem;
    }
</style>
