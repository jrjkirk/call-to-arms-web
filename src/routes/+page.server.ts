import { fetchWeekId } from '$lib/weekId';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
    const system = url.searchParams.get('system') || 'The Old World';
    const week = url.searchParams.get('week') || (await fetchWeekId(system, fetch));
    return { system, week };
};
