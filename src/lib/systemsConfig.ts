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
        // Matches the live backend's SystemConfig row today: just
        // "Standard". Note this is narrower than what the pre-arranged
        // sub-form on the signup page used to hardcode (["Standard",
        // "Intro"]) — see the flag in the Part 2 report about this gap.
        vibe_options: ['Standard'],
        default_vibe: 'Standard',
        uses_scenarios: false,
        scenario_options: [],
        default_scenario: '',
        allows_demo: false,
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
        faction_list: raw.faction_list ?? [],
        icon_folder: raw.icon_folder ?? ''
    };
}

let cachedFetch: Promise<SystemConfig[]> | null = null;

/** Fetches once per page load; every caller after the first gets the same cached promise. */
export function getSystemsConfig(): Promise<SystemConfig[]> {
    if (!cachedFetch) {
        cachedFetch = fetch(`${PUBLIC_API_URL}/systems`)
            .then((r) => {
                if (!r.ok) throw new Error(`GET /systems failed: ${r.status}`);
                return r.json();
            })
            .then((rows: any[]) => rows.map(normalize))
            .catch(() => FALLBACK_SYSTEMS_CONFIG);
    }
    return cachedFetch;
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
