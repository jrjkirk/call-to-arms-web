/**
 * Fetches the caller's own club's currently-enabled systems from the
 * backend's authenticated GET /systems/mine. Returns null if not
 * authenticated (401) or on any other failure, so callers can fall back
 * to the full global catalogue for an anonymous visitor.
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
