import { configFor, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from './systemsConfig';

/**
 * Convert a faction name into the filename slug used in /static/icons/<system>/.
 * Mirrors the Python _faction_slug() in pairings.py.
 *
 * Examples:
 *   "Orc & Goblin Tribes"  -> "orc_and_goblin_tribes"
 *   "Dwarfen Mountain Holds" -> "dwarfen_mountain_holds"
 */
export function factionSlug(name: string | null | undefined): string {
    if (!name) return '';
    let s = name.toLowerCase().trim();
    s = s.replace(/&/g, 'and');
    // Replace any non-alphanumeric chars with spaces, then collapse to underscores
    s = s.replace(/[^a-z0-9]+/g, ' ').trim();
    s = s.replace(/\s+/g, '_');
    return s;
}

/**
 * Build the URL for a faction icon. `folder` is a system's icon directory
 * (e.g. "TOW"/"HH"/"KT") — get it from systemFolder(). Defaults to "TOW"
 * since that's where most icons live and league/profile data uses TOW
 * factions.
 */
export function factionIconUrl(
    name: string | null | undefined,
    folder: string = 'TOW'
): string | null {
    const slug = factionSlug(name);
    return slug ? `/icons/${folder}/${slug}.png` : null;
}

/**
 * A system's icon directory name, sourced from its backend-owned
 * SystemConfig.icon_folder (via GET /systems). Pass the page's loaded
 * systemsConfig; omit it to use FALLBACK_SYSTEMS_CONFIG, which carries the
 * same TOW/HH/KT values for the three real systems.
 */
export function systemFolder(
    system: string,
    systemsConfig: SystemConfig[] = FALLBACK_SYSTEMS_CONFIG
): string {
    return configFor(systemsConfig, system).icon_folder;
}