/**
 * Fetch the other tabs' data in the background, once per visit, so the
 * first tap on Sign up or Leagues opens already filled in rather than
 * filling in in front of you.
 *
 * Asks for exactly the paths those pages read through $lib/swr, built the
 * same way, so the page finds them under the same keys: for each of this
 * week's nights (from Home) the count, your signup and your experience; and
 * the first league's standings, seasons, factions and form. Run when the
 * browser is idle, one request at a time, and skipping anything already
 * cached, so it never competes with what you're actually looking at.
 */
import { fetchHome, peekHome } from './home/api';
import { getSystemsConfig, leagueSystems } from './systemsConfig';
import { fetchFresh, peek } from './swr';

let started = false;

export function warmTabs(club?: string): void {
    if (started || typeof window === 'undefined') return;
    started = true;

    const run = async () => {
        const paths = ['/players'];

        const home = peekHome() ?? (await fetchHome());
        for (const n of home?.nights ?? []) {
            const q = new URLSearchParams({ system: n.system, week: n.week });
            paths.push(
                `/signups/stats?${q}`,
                `/signups/mine?${q}`,
                `/signups/experience?system=${encodeURIComponent(n.system)}`
            );
        }

        const league = leagueSystems(await getSystemsConfig(club))[0];
        if (league) {
            const q = new URLSearchParams({ system: league.legacy_system_name });
            paths.push(`/league/rankings?${q}`, `/league/seasons?${q}`, `/league/factions?${q}`, `/league/config?${q}`);
        }

        for (const path of paths) {
            if (peek(path) === undefined) await fetchFresh(path);
        }
    };

    const idle = (window as any).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1200));
    idle(() => void run());
}
