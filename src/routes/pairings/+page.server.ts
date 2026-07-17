import { fetchWeekId } from '$lib/weekId';
import { getClubSlugFromHostname } from '$lib/clubSlug';
import { FALLBACK_SYSTEMS_CONFIG } from '$lib/systemsConfig';
import type { PageServerLoad } from './$types';

// SSR default system: the first catalogue system, not a hardcoded name.
const DEFAULT_SYSTEM = FALLBACK_SYSTEMS_CONFIG[0].legacy_system_name;

// SSR resolves only the default system + week (a date — not club-sensitive).
// The pairings themselves are fetched client-side in +page.svelte with
// `credentials: 'include'`, so an authenticated caller is scoped to their own
// club by the backend. Fetching them here (server-side) can't attach the
// session — the `cta_session` cookie is host-only to the backend's domain and
// never reaches this SvelteKit server — so a server-side fetch is always
// anonymous and would serve the hostname-slug club's data (Manchester) to a
// logged-in member of another club. That was the cross-club leak.
export const load: PageServerLoad = async ({ fetch, url }) => {
    const club = getClubSlugFromHostname(url.hostname);
    const system = url.searchParams.get('system') || DEFAULT_SYSTEM;
    const week = url.searchParams.get('week') || (await fetchWeekId(system, fetch, club));
    return { system, week };
};
