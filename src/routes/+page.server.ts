import { fetchWeekId } from '$lib/weekId';
import { getClubSlugFromHostname } from '$lib/clubSlug';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
    const club = getClubSlugFromHostname(url.hostname);
    const system = url.searchParams.get('system') || 'The Old World';
    const week = url.searchParams.get('week') || (await fetchWeekId(system, fetch, club));
    return { system, week };
};
