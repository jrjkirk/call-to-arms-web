/**
 * Which system and week a signup or pairings page opens on, worked out in the
 * browser.
 *
 * These were server loads: every tap on Sign up or Pairings first asked
 * Vercel's server, which asked the API for the week, before the page could
 * start. Two round trips and sometimes a cold server, on every switch. Now the
 * week comes from what this visit already knows ("Your week" lists every
 * system's next session), then from the API directly, once per system.
 */
import { PUBLIC_API_URL } from '$env/static/public';
import { todayUkDateStr } from './weekId';
import { getClubSlugFromHostname } from './clubSlug';
import { FALLBACK_SYSTEMS_CONFIG } from './systemsConfig';
import { peekHome } from './home/api';

// The SSR-era default: the first catalogue system. The pages switch to the
// club's own first system once they know which ones it runs.
const DEFAULT_SYSTEM = FALLBACK_SYSTEMS_CONFIG[0].legacy_system_name;

const weekBySystem = new Map<string, Promise<string>>();

export async function pageWeek(url: URL, fetchFn: typeof fetch): Promise<{ system: string; week: string }> {
    const system = url.searchParams.get('system') || DEFAULT_SYSTEM;
    const asked = url.searchParams.get('week');
    if (asked) return { system, week: asked };

    const known = peekHome()?.nights.find((n) => n.system === system)?.week;
    if (known) return { system, week: known };

    if (!weekBySystem.has(system)) {
        const params = new URLSearchParams({ system });
        const club = getClubSlugFromHostname(url.hostname);
        if (club) params.set('club', club);
        const p = fetchFn(`${PUBLIC_API_URL}/week-id?${params}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((d) => d.week_id as string);
        weekBySystem.set(system, p);
        // Only a real answer is kept; a failure is asked again next time.
        p.catch(() => weekBySystem.delete(system));
    }
    // Today, as before, if the API can't say: the page still opens.
    const week = await weekBySystem.get(system)!.catch(() => todayUkDateStr());
    return { system, week };
}
