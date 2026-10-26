/**
 * Pick-up games: matchmaking outside club night (the API's pickups.py).
 *
 * A player asks to be found a game in a window they're free; the app pairs
 * compatible requests and both players accept or decline. Declines are
 * private: the reason goes to the club's admins only.
 */
import { PUBLIC_API_URL } from '$env/static/public';

export type PickupOpponent = {
    player_id: number;
    name: string;
    faction: string | null;
    points: number | null;
    vibe: string | null;
    notes: string | null;
    /** Only once the game is confirmed. */
    discord: string | null;
};

export type PickupMatch = {
    id: number;
    status: 'proposed' | 'confirmed' | 'declined' | 'cancelled';
    starts_at: string;
    when: string;
    expires_at: string;
    my_answer: 'pending' | 'accepted' | 'declined';
    their_answer: 'pending' | 'accepted' | 'declined';
    where: string;
    opponent: PickupOpponent | null;
};

export type PickupRequest = {
    id: number;
    system: string;
    player_id: number;
    player_name: string;
    window_start: string;
    window_end: string;
    when: string;
    venue: 'club' | 'tbc' | 'other';
    venue_text: string | null;
    where: string;
    faction: string | null;
    points: number | null;
    vibe: string | null;
    notes: string | null;
    status: 'open' | 'proposed' | 'matched' | 'declined' | 'cancelled' | 'expired';
    match?: PickupMatch | null;
};

export type PickupList = { mine: PickupRequest[]; others: PickupRequest[] };

async function call(path: string, body?: unknown) {
    const r = await fetch(`${PUBLIC_API_URL}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'include',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : 'Something went wrong. Try again.');
    return data;
}

let cache: PickupList | null = null;

/** What this visit last saw, for an instant first paint. */
export const peekPickups = () => cache;

export async function fetchPickups(): Promise<PickupList | null> {
    try {
        cache = await call('/pickups');
    } catch (_) {
        return cache;
    }
    return cache;
}

export const askForGame = (body: Record<string, unknown>) => call('/pickups', body);
export const acceptGame = (matchId: number) => call(`/pickups/matches/${matchId}/accept`, {});
export const declineGame = (matchId: number, reason: string) => call(`/pickups/matches/${matchId}/decline`, { reason });
export const cancelRequest = (requestId: number) => call(`/pickups/${requestId}/cancel`, {});
/** Take up someone's open request: a game is proposed at once, already
 *  accepted on your side, and they're asked to accept. */
export const claimGame = (requestId: number, body: { faction: string | null; points: number | null; notes?: string | null }) =>
    call(`/pickups/${requestId}/claim`, body);

/** A proposal still waiting on this player's answer. */
export const needsMyAnswer = (r: PickupRequest) =>
    r.match?.status === 'proposed' && r.match.my_answer === 'pending';
