import { fetchWeekId } from '$lib/weekId';
import { getClubSlugFromHostname } from '$lib/clubSlug';
import { FALLBACK_SYSTEMS_CONFIG } from '$lib/systemsConfig';
import type { PageServerLoad } from './$types';

// SSR default system: the first catalogue system, not a hardcoded name.
const DEFAULT_SYSTEM = FALLBACK_SYSTEMS_CONFIG[0].legacy_system_name;

export const load: PageServerLoad = async ({ fetch, url }) => {
    const club = getClubSlugFromHostname(url.hostname);
    const system = url.searchParams.get('system') || DEFAULT_SYSTEM;
    const week = url.searchParams.get('week') || (await fetchWeekId(system, fetch, club));
    return { system, week };
};
