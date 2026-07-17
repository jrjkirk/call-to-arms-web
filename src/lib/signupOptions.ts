/** Signup form options, ported verbatim from the original Streamlit app. */

import { configFor, sortVibeOptions, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from './systemsConfig';

// Baseline system list, derived from the offline fallback catalogue rather
// than a hardcoded literal. This is only the synchronous default used before
// GET /systems loads (or when it's unreachable) and to scope club filters;
// live pages read the fetched catalogue. A new system in the catalogue is
// reflected here via FALLBACK_SYSTEMS_CONFIG.
export const SYSTEMS: string[] = FALLBACK_SYSTEMS_CONFIG.map((s) => s.legacy_system_name);

export const NONE_FACTION = '— None —';

// Faction lists are no longer hardcoded here. Each system's factions are
// owned by backend code (call-to-arms-api systems/ modules), served via
// GET /systems, and carried on SystemConfig.faction_list — read below in
// formConfig from the passed-in systemsConfig (which falls back to
// FALLBACK_SYSTEMS_CONFIG when the API hasn't loaded).

export const EXPERIENCE_OPTIONS = ['New', 'Some', 'Veteran'];

/** 15:00 → 19:30 in 15-minute steps, same as the original. */
export const ETA_OPTIONS: string[] = (() => {
    const out: string[] = [];
    for (const h of [15, 16, 17, 18, 19]) {
        for (const m of [0, 15, 30, 45]) {
            if (h === 19 && m > 30) continue;
            out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
    }
    return out;
})();

export type SignupFormConfig = {
    factionLabel: string;
    factions: string[];
    showPoints: boolean;
    defaultPoints: number;
    maxPoints: number;
    pointsCaption: string | null;
    vibeOptions: string[] | null; // null => vibe is fixed, no selector shown
    fixedVibe: string | null;
    defaultVibe: string;
    showScenario: boolean;
    scenarioOptions: string[];
    defaultScenario: string;
    showCanDemo: boolean;
};

/**
 * `systemsConfig` should come from getSystemsConfig() in systemsConfig.ts;
 * defaults to the hardcoded fallback so callers that haven't fetched yet
 * still get correct today's-values behavior.
 */
export function formConfig(system: string, systemsConfig: SystemConfig[] = FALLBACK_SYSTEMS_CONFIG): SignupFormConfig {
    const entry = configFor(systemsConfig, system);

    // A system with exactly one vibe option (Kill Team today) shows a fixed
    // label instead of a dropdown — derived from entry.vibe_options itself
    // (already the caller's own club-effective list, override included),
    // not a hardcoded system name, so this keeps working if a future system
    // is similarly single-vibe.
    const vibeIsFixed = entry.vibe_options.length === 1;

    return {
        // The one field with no backend equivalent — purely cosmetic copy.
        factionLabel: system === 'Kill Team' ? 'Your Kill Team' : 'Your Faction',
        factions: entry.faction_list,
        showPoints: entry.uses_points,
        defaultPoints: entry.default_points,
        maxPoints: entry.max_points,
        pointsCaption: null,
        vibeOptions: vibeIsFixed ? null : sortVibeOptions(entry.vibe_options),
        fixedVibe: vibeIsFixed ? entry.default_vibe : null,
        defaultVibe: entry.default_vibe,
        showScenario: entry.uses_scenarios,
        scenarioOptions: entry.scenario_options,
        defaultScenario: entry.default_scenario,
        showCanDemo: entry.allows_demo
    };
}