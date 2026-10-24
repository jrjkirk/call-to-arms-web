import { pageWeek } from '$lib/pageWeek';
import type { PageLoad } from './$types';

// Client-side only, as before: the pairings themselves must be fetched with
// the visitor's session cookie, which never reaches Vercel's server. The week
// is worked out here too now, rather than by a server load ($lib/pageWeek).
export const ssr = false;

export const load: PageLoad = async ({ fetch, url }) => pageWeek(url, fetch);
