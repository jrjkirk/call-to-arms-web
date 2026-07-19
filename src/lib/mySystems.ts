/**
 * Fetches the caller's own club's currently-enabled systems from the
 * backend's authenticated GET /systems/mine. Returns null if not
 * authenticated (401) or on any other failure, so callers can fall back
 * to the full global catalogue for an anonymous visitor.
 *
 * Why this exists alongside systemsConfig.ts's getSystemsConfig(club):
 * this is the AUTHENTICATED path (GET /systems/mine, keyed off the caller's
 * real user.club_id server-side — correct even if they're viewing from a
 * different club's subdomain) and returns only bare system names, no
 * per-system config. getSystemsConfig(club) is the PUBLIC path (GET
 * /systems?club=<hostname-derived slug>, works for anonymous visitors) and
 * returns full SystemConfig objects (vibes/factions/has_league/etc).
 * Authenticated pages that only need "which systems does my club run"
 * (tab/filter lists) use this one; anything needing per-system config, or
 * that must work signed-out, uses getSystemsConfig instead.
 */
import { PUBLIC_API_URL } from '$env/static/public';

export async function fetchMySystems(): Promise<string[] | null> {
    try {
        const r = await fetch(`${PUBLIC_API_URL}/systems/mine`, { credentials: 'include' });
        if (!r.ok) return null;
        const rows: { legacy_system_name: string }[] = await r.json();
        return rows.map((row) => row.legacy_system_name);
    } catch (_) {
        return null;
    }
}
