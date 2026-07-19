import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The single-league /league page was replaced by /leagues (a system-tile
// picker over all of the club's league-enabled systems, not just one).
// Redirect old bookmarks/links rather than leaving them 404.
export const load: PageServerLoad = () => {
    throw redirect(308, '/leagues');
};
