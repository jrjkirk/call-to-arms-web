import { pageWeek } from '$lib/pageWeek';
import type { PageLoad } from './$types';

// In the browser, not on Vercel's server: see $lib/pageWeek.
export const ssr = false;

export const load: PageLoad = async ({ fetch, url }) => pageWeek(url, fetch);
