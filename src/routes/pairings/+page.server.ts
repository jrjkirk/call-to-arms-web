import { PUBLIC_API_URL } from '$env/static/public';
import { fetchWeekId } from '$lib/weekId';
import { getClubSlugFromHostname } from '$lib/clubSlug';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
    const club = getClubSlugFromHostname(url.hostname);
    const system = url.searchParams.get('system') || 'The Old World';
    const week = url.searchParams.get('week') || (await fetchWeekId(system, fetch, club));

    const params = new URLSearchParams({ system, week, club });
    const response = await fetch(`${PUBLIC_API_URL}/pairings?${params}`);

    let data: any = { published: false, matchups: [], total_players: 0, total_matchups: 0, byes: 0 };
    if (response.ok) {
        data = await response.json();
    }

    return { system, week, ...data };
};