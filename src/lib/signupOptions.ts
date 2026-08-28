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

/** Admin-facing only. Players no longer choose their experience — it's counted
 *  from games played (see the API's experience.py). The retired name "Some" is
 *  deliberately absent: historical rows were renamed, and the API still accepts
 *  it so nothing breaks if one survives. */
export const EXPERIENCE_OPTIONS = ['New', 'Experienced', 'Veteran'];

/** 15:00 → 19:30 in 15-minute steps, same as the original. Used when a club
 *  hasn't set a session start time, so those clubs see exactly what they
 *  always have. */
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

/** Fallback default when a club hasn't set a session start time. */
export const DEFAULT_ETA = '18:30';

const toMins = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};
const toHHMM = (mins: number) =>
    `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

/**
 * Arrival times to offer for a session starting at `startTime`.
 *
 * A window around the start rather than one fixed list: "when will you get
 * here" for a night starting at seven is a different question to one starting
 * at half six, and the old fixed 15:00–19:30 could not even contain the answer
 * for a club meeting at eight. Three hours either side covers coming straight
 * from work, arriving early to set terrain out, and rolling in after dinner.
 *
 * No start time set → the original list, unchanged.
 */
export function etaOptionsFor(startTime?: string | null): string[] {
    const start = startTime ? toMins(startTime) : null;
    if (start === null) return ETA_OPTIONS;
    const out: string[] = [];
    for (let m = start - 180; m <= start + 180; m += 15) {
        if (m >= 0 && m < 24 * 60) out.push(toHHMM(m));
    }
    return out.length ? out : ETA_OPTIONS;
}

/**
 * What a player's ETA starts as. The session's own start time, because most
 * people arrive when it starts, and a default that is right most of the time
 * is the one nobody has to think about.
 */
export function defaultEtaFor(startTime?: string | null): string {
    const start = startTime ? toMins(startTime) : null;
    return start === null ? DEFAULT_ETA : toHHMM(start);
}
