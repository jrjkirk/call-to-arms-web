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
 * Build the URL for a faction icon. Defaults to The Old World since that's
 * where most icons live and league/profile data uses TOW factions.
 */
export function factionIconUrl(
    name: string | null | undefined,
    system: 'TOW' | 'HH' | 'KT' = 'TOW'
): string | null {
    const slug = factionSlug(name);
    return slug ? `/icons/${system}/${slug}.png` : null;
}

export function systemFolder(system: string): 'TOW' | 'HH' | 'KT' {
    if (system === 'The Horus Heresy') return 'HH';
    if (system === 'Kill Team') return 'KT';
    return 'TOW';
}