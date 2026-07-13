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
};

export const FALLBACK_SYSTEMS_CONFIG: SystemConfig[] = [
    {
        slug: 'tow',
        name: 'The Old World',
        legacy_system_name: 'The Old World',
        uses_points: true,
        default_points: 2000,
        max_points: 10000,
        vibe_options: ['Casual', 'Competitive', 'Escalation', 'Intro', 'Either'],
        default_vibe: 'Casual',
        uses_scenarios: true,
        scenario_options: ['Open Battle', 'Weekly Scenario'],
        default_scenario: 'Open Battle',
        allows_demo: true
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
        allows_demo: true
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
        allows_demo: false
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
        allows_demo: !!raw.allows_demo
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
const VIBE_DISPLAY_ORDER = ['Casual', 'Competitive', 'Escalation', 'Standard', 'Intro', 'Either'];

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
