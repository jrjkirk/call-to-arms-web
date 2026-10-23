/**
 * Data for the "Your week" home tab, and the pieces of it the signup and
 * pairings pages share (the night tiles, a pairing's own game).
 *
 * GET /home answers everything the tab shows except the games themselves, in
 * one call: each system's next session, how many are in, whether the caller
 * is, and their league standings. The games come from GET /pairings, the same
 * feed the pairings page reads, so the two can never disagree.
 */
import { PUBLIC_API_URL } from '$env/static/public';

export type HomeNight = {
    system: string;
    name: string;
    slug: string;
    logo_url: string | null;
    accent_color: string;
    week: string;
    /** ISO date of the session. */
    date: string;
    signed_up: number;
    mine: boolean;
    is_full: boolean;
    published: boolean;
};

export type HomeLeague = {
    system: string;
    name: string;
    slug: string;
    logo_url: string | null;
    rank: number;
    of: number;
    rating: number;
    wins: number;
    draws: number;
    losses: number;
    level: number;
    level_percent: number;
    games_to_next: number;
    at_cap: boolean;
};

export type HomeData = {
    player_id: number | null;
    nights: HomeNight[];
    leagues: HomeLeague[];
};

export type Matchup = {
    id?: number;
    player_a_name: string;
    player_a_id: number | null;
    player_a_faction: string | null;
    player_a_experience: string | null;
    player_a_level: number | null;
    player_b_name: string | null;
    player_b_id: number | null;
    player_b_faction: string | null;
    player_b_experience: string | null;
    player_b_level: number | null;
    is_bye: boolean;
    game_type: string | null;
    eta: string | null;
    points: string | number | null;
    prearranged?: boolean;
    /** Only where a club has numbered its tables. */
    table?: string | null;
};

export type PairingsData = {
    published: boolean;
    matchups: Matchup[];
    total_players: number;
    total_matchups: number;
    byes: number;
};

export const EMPTY_PAIRINGS: PairingsData = {
    published: false, matchups: [], total_players: 0, total_matchups: 0, byes: 0
};

/* The last answer to each, kept for this page load. Switching tabs back to a
   page shows what it had at once and refreshes underneath, rather than a
   blank screen for every round trip: that wait was most of why the bottom
   tabs felt slow. Never shown as current for long: every visit re-fetches. */
let homeCache: HomeData | null = null;
const pairingsCache = new Map<string, PairingsData>();

/** What GET /home said last time, if anything, for an instant first paint. */
export function peekHome(): HomeData | null {
    return homeCache;
}

/** Null when signed out (401) or the API is unreachable, so callers can fall
 *  back to the plain system list. */
export async function fetchHome(): Promise<HomeData | null> {
    try {
        const r = await fetch(`${PUBLIC_API_URL}/home`, { credentials: 'include' });
        homeCache = r.ok ? await r.json() : null;
    } catch (_) {
        homeCache = null;
    }
    return homeCache;
}

export function peekPairings(system: string, week: string): PairingsData | null {
    return pairingsCache.get(`${system}|${week}`) ?? null;
}

export async function fetchPairings(system: string, week: string): Promise<PairingsData> {
    let out = EMPTY_PAIRINGS;
    try {
        const params = new URLSearchParams({ system, week });
        const r = await fetch(`${PUBLIC_API_URL}/pairings?${params}`, { credentials: 'include' });
        if (r.ok) out = await r.json();
    } catch (_) {}
    pairingsCache.set(`${system}|${week}`, out);
    return out;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];

/** Parsed as a local date: `new Date('2026-10-28')` is midnight UTC, which is
 *  the previous evening anywhere west of Greenwich. */
function parseIso(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/** "Wed 28 Oct" */
export function shortDay(iso: string): string {
    const d = parseIso(iso);
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Wednesday 28 October" */
export function longDay(iso: string): string {
    const d = parseIso(iso);
    return `${LONG_DAYS[d.getDay()]} ${d.getDate()} ${LONG_MONTHS[d.getMonth()]}`;
}

/** "Wednesday" */
export function weekday(iso: string): string {
    return LONG_DAYS[parseIso(iso).getDay()];
}

/** The caller's own game in a set of pairings, if they have one. */
export function myMatchup(matchups: Matchup[], playerId: number | null | undefined): Matchup | null {
    if (playerId == null) return null;
    return matchups.find((m) => m.player_a_id === playerId || m.player_b_id === playerId) ?? null;
}

/** "Table 4" where the club has numbered its tables, else "Game 4" in the
 *  order the pairings list them. Never an invented table: a player would walk
 *  to it. */
export function gameLabel(m: Matchup, index: number): string {
    return m.table ? `Table ${m.table}` : `Game ${index + 1}`;
}

/** The two sides of a game from the caller's seat: theirs first. */
export function sides(m: Matchup, playerId: number | null | undefined) {
    const a = { name: m.player_a_name, id: m.player_a_id, faction: m.player_a_faction, level: m.player_a_level, experience: m.player_a_experience };
    const b = { name: m.player_b_name, id: m.player_b_id, faction: m.player_b_faction, level: m.player_b_level, experience: m.player_b_experience };
    return m.player_b_id != null && m.player_b_id === playerId ? { me: b, them: a } : { me: a, them: b };
}
