/**
 * Where "Sign in with Discord" points, in one place.
 *
 * Why this exists
 * ---------------
 * The backend has always accepted `?next=` on `/auth/discord/login` and carried
 * it through Discord, precisely so a player who followed a "sign up for
 * Thursday" link out of a club's Discord comes back to that signup page. Seven
 * sign-in links across the app were plain `<a href={API}/auth/discord/login>`
 * and none of them passed it, so everyone was returned to the club's front door
 * instead.
 *
 * On 09/09/2026 that surfaced properly: four Age of Sigmar players followed the
 * Call to Arms link, signed in, landed on the club home with no signup form,
 * and had to click the same link a second time. One of them called it "a loop
 * to log in then back to the main page".
 *
 * Regulars never saw it, because they were already signed in — it only ever hit
 * first-timers, which is the worst possible audience for it.
 *
 * So: never write the login URL by hand. `loginHref(page.url)` gives you a link
 * that returns the player to wherever they are now.
 */
import { PUBLIC_API_URL } from '$env/static/public';

/**
 * `next` must be a path on this origin — the backend re-checks and drops
 * anything else, but sending a full URL would just silently lose the
 * destination, so build it from pathname + search here.
 */
export function loginHref(url?: URL | null): string {
	const base = `${PUBLIC_API_URL}/auth/discord/login`;
	if (!url) return base;
	const next = `${url.pathname}${url.search}`;
	// The front door is where login lands anyway; a next of "/" is noise.
	if (!next || next === '/') return base;
	return `${base}?next=${encodeURIComponent(next)}`;
}

/**
 * For the handful of places that want to send someone to a specific page after
 * signing in rather than back to the current one.
 */
export function loginHrefTo(path: string): string {
	const base = `${PUBLIC_API_URL}/auth/discord/login`;
	if (!path || path === '/') return base;
	return `${base}?next=${encodeURIComponent(path)}`;
}
