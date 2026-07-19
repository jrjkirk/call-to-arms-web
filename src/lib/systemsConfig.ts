/**
 * Fetches per-system signup config (vibes/points/scenarios) from the
 * backend's GET /systems, cached for the lifetime of the page load.
 * Falls back to today's hardcoded values if the fetch fails, so signup
 * forms don't break when the backend is unreachable.
 */
import { PUBLIC_API_URL } from '$env/static/public';

export type SystemConfig = {
    slug: string;
    name: string;
    legacy_system_name: string;
    uses_points: boolean;
    default_points: number;
    max_points: number;
    vibe_options: string[];
    default_vibe: string;
    uses_scenarios: boolean;
    scenario_options: string[];
    default_scenario: string;
    allows_demo: boolean;
    // Whether this system runs a league (ELO ladder + results). Drives which
    // systems the league UI surfaces — replaces the hardcoded
    // 'The Old World' league checks.
    has_league: boolean;
    // System *rules*, owned by backend code (call-to-arms-api systems/ modules)
    // and served by GET /systems. The values below in FALLBACK_SYSTEMS_CONFIG
    // are only the offline safety-net copy — same role as the vibe/points
    // fallbacks above — not a second editable source of truth.
    faction_list: string[];
    icon_folder: string;
};

export const FALLBACK_SYSTEMS_CONFIG: SystemConfig[] = [
    {
        slug: 'tow',
        name: 'The Old World',
        legacy_system_name: 'The Old World',
        uses_points: true,
        default_points: 2000,
        max_points: 10000,
        vibe_options: ['Casual', 'Competitive', 'Intro', 'Either'],
        default_vibe: 'Casual',
        uses_scenarios: true,
        scenario_options: ['Open Battle', 'Weekly Scenario'],
        default_scenario: 'Open Battle',
        allows_demo: true,
        has_league: true,
        faction_list: [
            'Empire of Man', 'Dwarfen Mountain Holds', 'Kingdom of Bretonnia',
            'Wood Elf Realms', 'High Elf Realms', 'Orc & Goblin Tribes',
            'Warriors of Chaos', 'Beastmen Brayheards', 'Tomb Kings of Khemri',
            'Skaven', 'Ogre Kingdoms', 'Lizardmen', 'Chaos Dwarfs', 'Dark Elves',
            'Daemons of Chaos', 'Vampire Counts', 'Grand Cathay', 'Renegade Crowns'
        ],
        icon_folder: 'TOW'
    },
    {
        slug: 'hh',
        name: 'The Horus Heresy',
        legacy_system_name: 'The Horus Heresy',
        uses_points: true,
        default_points: 3000,
        max_points: 10000,
        vibe_options: ['Standard', 'Intro'],
        default_vibe: 'Standard',
        uses_scenarios: false,
        scenario_options: [],
        default_scenario: '',
        allows_demo: true,
        has_league: false,
        faction_list: [
            'I - Dark Angels',
            "III - Emperor's Children",
            'IV - Iron Warriors',
            'V - White Scars',
            'VI - Space Wolves',
            'VII - Imperial Fists',
            'VIII - Night Lords',
            'IX - Blood Angels',
            'X - Iron Hands',
            'XII - World Eaters',
            'XIII - Ultramarines',
            'XIV - Death Guard',
            'XV - Thousand Sons',
            'XVI - Sons of Horus',
            'XVII - Word Bearers',
            'XVIII - Salamanders',
            'XIX - Raven Guard',
            'XX - Alpha Legion',
            'Anathema Psykana',
            'Legio Custodes',
            'Mechanicum',
            'Questoris Familia',
            'Solar Auxilia'
        ],
        icon_folder: 'HH'
    },
    {
        slug: 'kt',
        name: 'Kill Team',
        legacy_system_name: 'Kill Team',
        uses_points: false,
        default_points: 0,
        max_points: 10000,
        // Kill Team offers Standard + Intro. All three signup/admin surfaces
        // now read this from the catalogue (no per-surface hardcoding), so
        // this fallback must match the live catalogue row. Intro here is a
        // signup label only — KT has no intro pre-pass (has_intro_prepass is
        // false), so the matcher is unaffected.
        vibe_options: ['Standard', 'Intro'],
        default_vibe: 'Standard',
        uses_scenarios: false,
        scenario_options: [],
        default_scenario: '',
        allows_demo: false,
        has_league: false,
        faction_list: [
            'Angels Of Death', 'Battleclade', 'Blades Of Khaine', 'Blooded',
            'Brood Brothers', 'Canoptek Circle', 'Celestian Insidiants', 'Chaos Cult',
            'Corsair Voidscarred', 'Death Korps', 'Deathwatch', 'Elucidian Starstriders',
            'Exaction Squad', 'Farstalker Kinband', 'Fellgor Ravagers', 'Gellerpox Infected',
            'Goremongers', 'Hand Of The Archon', 'Hearthkyn Salvagers', 'Hernkyn Yaegirs',
            'Hierotek Circle', 'Hunter Clade', 'Imperial Navy Breachers', 'Inquisitorial Agents',
            'Kasrkin', 'Kommandos', 'Legionaries', 'Mandrakes', 'Murderwing', 'Nemesis Claw',
            'Novitiates', 'Pathfinders', 'Phobos Strike Team', 'Plague Marines', 'Ratlings',
            'Raveners', 'Sanctifiers', 'Scout Squad', 'Strike Force Variel', 'Tempestus Aquilon',
            'Vespid Stingwings', 'Void-Dancer Troupe', 'Warp Coven', 'Wolf Scouts',
            'Wrecka Krew', 'Wyrmblade', 'XV26 Stealth Battlesuits', 'Unlisted Kill Team'
        ],
        icon_folder: 'KT'
    }
];

// The backend stores fields not relevant to a system as null (e.g. KT's
// default_points/max_points, HH/KT's scenario_options/default_scenario) —
// normalize those to the same "unused but harmless" values our own fallback
// uses, so consumers never have to null-check.
function normalize(raw: any): SystemConfig {
    return {
        slug: raw.slug,
        name: raw.name,
        legacy_system_name: raw.legacy_system_name,
        uses_points: !!raw.uses_points,
        default_points: raw.default_points ?? 0,
        max_points: raw.max_points ?? 10000,
        vibe_options: raw.vibe_options ?? [],
        default_vibe: raw.default_vibe ?? '',
        uses_scenarios: !!raw.uses_scenarios,
        scenario_options: raw.scenario_options ?? [],
        default_scenario: raw.default_scenario ?? '',
        allows_demo: !!raw.allows_demo,
        has_league: !!raw.has_league,
        faction_list: raw.faction_list ?? [],
        icon_folder: raw.icon_folder ?? ''
    };
}

/** Logo asset URL for a system, derived from its catalogue slug
 *  (/logos/<slug>.png) rather than a per-page hardcoded name→path map. Adding
 *  a system (with a matching /static/logos/<slug>.png) is picked up
 *  automatically. Defaults to the offline fallback config for pages that
 *  don't load the full catalogue. */
export function systemLogoUrl(
    legacySystemName: string,
    systemsConfig: SystemConfig[] = FALLBACK_SYSTEMS_CONFIG
): string {
    return `/logos/${configFor(systemsConfig, legacySystemName).slug}.png`;
}

/** Systems that run a league, in catalogue order. `has_league` reflects the
 *  caller's own club's ClubSystem.league_enabled when systemsConfig came from
 *  a club-scoped fetch (getSystemsConfig(club) / GET /systems/mine) — a club
 *  can now run more than one system's league, so callers should show ALL of
 *  these (e.g. the /leagues system-picker), not just take the first one. */
export function leagueSystems(systemsConfig: SystemConfig[]): SystemConfig[] {
    return systemsConfig.filter((c) => c.has_league);
}

const cachedByClub: Record<string, Promise<SystemConfig[]>> = {};

/** Fetches once per (club) per page load; later callers get the cached promise.
 *  Pass a club slug to get that club's vibe overrides (GET /systems?club=…);
 *  omit it for the global catalogue defaults. */
export function getSystemsConfig(club?: string): Promise<SystemConfig[]> {
    const key = club ?? '';
    if (!cachedByClub[key]) {
        const url = club
            ? `${PUBLIC_API_URL}/systems?club=${encodeURIComponent(club)}`
            : `${PUBLIC_API_URL}/systems`;
        cachedByClub[key] = fetch(url)
            .then((r) => {
                if (!r.ok) throw new Error(`GET /systems failed: ${r.status}`);
                return r.json();
            })
            .then((rows: any[]) => rows.map(normalize))
            .catch(() => FALLBACK_SYSTEMS_CONFIG);
    }
    return cachedByClub[key];
}

export function configFor(systemsConfig: SystemConfig[], legacySystemName: string): SystemConfig {
    return (
        systemsConfig.find((c) => c.legacy_system_name === legacySystemName) ??
        FALLBACK_SYSTEMS_CONFIG.find((c) => c.legacy_system_name === legacySystemName) ??
        FALLBACK_SYSTEMS_CONFIG[0]
    );
}

// The backend doesn't guarantee vibe_options order (observed alphabetical,
// e.g. HH comes back ["Intro", "Standard"]) but the UI has an established
// display order (common option first). Sort by this canonical order;
// anything not listed here sorts after, alphabetically, so a future new
// option still shows up instead of being silently dropped.
const VIBE_DISPLAY_ORDER = ['Casual', 'Competitive', 'Standard', 'Intro', 'Either'];

// The platform-level canonical vibe palette. Vibe configuration (platform
// catalogue + per-club) is chosen from this fixed set — never free text — so
// the special-meaning vibes can't be mistyped. `Intro` (drives the pairing
// intro pre-pass) and `Standard` (baseline) are protected members that always
// appear in the palette.
export const CANONICAL_VIBES = ['Casual', 'Competitive', 'Standard', 'Intro', 'Either'];
export const PROTECTED_VIBES = ['Intro', 'Standard'];

export function sortVibeOptions(options: string[]): string[] {
    return [...options].sort((a, b) => {
        const ia = VIBE_DISPLAY_ORDER.indexOf(a);
        const ib = VIBE_DISPLAY_ORDER.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });
}
