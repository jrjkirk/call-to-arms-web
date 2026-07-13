/** Signup form options, ported verbatim from the original Streamlit app. */

import { configFor, sortVibeOptions, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from './systemsConfig';

export const SYSTEMS = ['The Old World', 'The Horus Heresy', 'Kill Team'] as const;

export const NONE_FACTION = '— None —';

export const TOW_FACTIONS: string[] = [
    'Empire of Man', 'Dwarfen Mountain Holds', 'Kingdom of Bretonnia',
    'Wood Elf Realms', 'High Elf Realms', 'Orc & Goblin Tribes',
    'Warriors of Chaos', 'Beastmen Brayheards', 'Tomb Kings of Khemri',
    'Skaven', 'Ogre Kingdoms', 'Lizardmen', 'Chaos Dwarfs', 'Dark Elves',
    'Daemons of Chaos', 'Vampire Counts', 'Grand Cathay', 'Renegade Crowns'
];

export const HH_FACTIONS: string[] = [
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
];

export const KT_FACTIONS: string[] = [
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
];

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

    if (system === 'The Horus Heresy') {
        return {
            factionLabel: 'Your Faction',
            factions: HH_FACTIONS,
            showPoints: entry.uses_points,
            defaultPoints: entry.default_points,
            maxPoints: entry.max_points,
            pointsCaption: null,
            vibeOptions: sortVibeOptions(entry.vibe_options),
            fixedVibe: null,
            defaultVibe: entry.default_vibe,
            showScenario: entry.uses_scenarios,
            scenarioOptions: entry.scenario_options,
            defaultScenario: entry.default_scenario,
            showCanDemo: entry.allows_demo
        };
    }
    if (system === 'Kill Team') {
        return {
            factionLabel: 'Your Kill Team',
            factions: KT_FACTIONS,
            showPoints: entry.uses_points,
            defaultPoints: entry.default_points,
            maxPoints: entry.max_points,
            pointsCaption: null,
            vibeOptions: null,
            fixedVibe: entry.default_vibe,
            defaultVibe: entry.default_vibe,
            showScenario: entry.uses_scenarios,
            scenarioOptions: entry.scenario_options,
            defaultScenario: entry.default_scenario,
            showCanDemo: entry.allows_demo
        };
    }
    // The Old World — this form deliberately excludes "Escalation" from the
    // vibe list (the pre-arranged sub-form on the signup page shows the full
    // backend list including it — see PREARRANGED_VIBE_OPTIONS in
    // +page.svelte). Don't remove this filter to "sync" the two forms.
    return {
        factionLabel: 'Your Faction',
        factions: TOW_FACTIONS,
        showPoints: entry.uses_points,
        defaultPoints: entry.default_points,
        maxPoints: entry.max_points,
        pointsCaption: null,
        vibeOptions: sortVibeOptions(entry.vibe_options.filter((v) => v !== 'Escalation')),
        fixedVibe: null,
        defaultVibe: entry.default_vibe,
        showScenario: entry.uses_scenarios,
        scenarioOptions: entry.scenario_options,
        defaultScenario: entry.default_scenario,
        showCanDemo: entry.allows_demo
    };
}