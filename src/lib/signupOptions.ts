/** Signup form options, ported verbatim from the original Streamlit app. */

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
    pointsCaption: string | null;
    vibeOptions: string[] | null; // null => vibe is fixed, no selector shown
    fixedVibe: string | null;
    defaultVibe: string;
    showScenario: boolean;
    showCanDemo: boolean;
};

export function formConfig(system: string): SignupFormConfig {
    if (system === 'The Horus Heresy') {
        return {
            factionLabel: 'Your Faction',
            factions: HH_FACTIONS,
            showPoints: true,
            defaultPoints: 3000,
            pointsCaption: null,
            vibeOptions: ['Standard', 'Intro'],
            fixedVibe: null,
            defaultVibe: 'Standard',
            showScenario: false,
            showCanDemo: true
        };
    }
    if (system === 'Kill Team') {
        return {
            factionLabel: 'Your Kill Team',
            factions: KT_FACTIONS,
            showPoints: false,
            defaultPoints: 0,
            pointsCaption: null,
            vibeOptions: null,
            fixedVibe: 'Standard',
            defaultVibe: 'Standard',
            showScenario: false,
            showCanDemo: false
        };
    }
    return {
        factionLabel: 'Your Faction',
        factions: TOW_FACTIONS,
        showPoints: true,
        defaultPoints: 2000,
        pointsCaption: 'If selecting an Escalation game, please input backup army points limit.',
        vibeOptions: ['Casual', 'Competitive', 'Escalation', 'Intro', 'Either'],
        fixedVibe: null,
        defaultVibe: 'Casual',
        showScenario: true,
        showCanDemo: true
    };
}