/**
 * Fetches the backend-authoritative next-session week id for a system
 * from GET /week-id, falling back to today's date (DD/MM/YYYY) on any
 * network error or non-200 response so callers never crash.
 */
import { PUBLIC_API_URL } from '$env/static/public';

export function todayUkDateStr(): string {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

export async function fetchWeekId(system: string, fetchFn: typeof fetch = fetch): Promise<string> {
    try {
        const response = await fetchFn(`${PUBLIC_API_URL}/week-id?system=${encodeURIComponent(system)}`);
        if (!response.ok) {
            console.warn(`GET /week-id failed (${response.status}) for system "${system}", falling back to today`);
            return todayUkDateStr();
        }
        const data = await response.json();
        return data.week_id ?? todayUkDateStr();
    } catch (err) {
        console.warn(`GET /week-id errored for system "${system}", falling back to today`, err);
        return todayUkDateStr();
    }
}
