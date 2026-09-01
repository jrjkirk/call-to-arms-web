/**
 * The browser tab title, in one place.
 *
 * Why this exists
 * ---------------
 * The title used to be set in two competing places: `+layout.svelte` had its
 * own `<title>Call to Arms</title>`, and eight of the eighteen routes set
 * another inside their own `<svelte:head>`. Two `<title>` elements in one
 * document is undefined territory — which one wins depends on render order —
 * and the ten routes that set no title at all had nothing to reassert. The
 * result was that whichever title happened to load first stuck for the rest of
 * the session: clicking Events and then Pairings left the tab reading
 * "Events · Call to Arms" on the pairings page, and starting on /find left it
 * saying "Find a club" everywhere.
 *
 * So there is now exactly ONE `<title>`, owned by the layout, and it is
 * derived from the current route. A route added later with no entry here still
 * gets a correct (if generic) title rather than inheriting the last page's.
 *
 * Dynamic titles
 * --------------
 * Three pages can only name themselves once their data has loaded — the club
 * home page, an event, and a player profile. They call `setPageTitle()`, which
 * records the route it belongs to alongside the text. The layout uses an
 * override only when its route matches the route being displayed, so a stale
 * override from the page you just left is ignored automatically. That is
 * deliberate: relying on each page to clear up after itself on unmount would
 * reintroduce exactly the "nobody reset it" bug this replaces.
 */
import { writable } from 'svelte/store';

export const SITE_NAME = 'Call to Arms';

/**
 * Titles by SvelteKit route id (`page.route.id`), not pathname, so the
 * parameterised routes have one stable key each.
 *
 * The separator is inconsistent — some titles use an em dash, some a middot.
 * That is preserved from the original per-page titles rather than quietly
 * normalised: these strings are what shows in a shared link and a search
 * result, and changing them is a content decision, not a refactor.
 */
const ROUTE_TITLES: Record<string, string> = {
	'/': SITE_NAME, // replaced by the club's own name once loaded
	'/find': 'Find a club — Call to Arms',
	'/signup': 'Signup — Call to Arms',
	'/pairings': 'Pairings · Call to Arms',
	'/league': 'League · Call to Arms',
	'/leagues': 'Leagues · Call to Arms',
	'/players': 'Players · Call to Arms',
	'/players/[id]': 'Player · Call to Arms', // replaced by the player's name
	'/tournaments': 'Events · Call to Arms',
	'/tournaments/[id]': 'Event · Call to Arms', // replaced by the event's name
	'/book': 'Book a table · Call to Arms',
	'/book/manage': 'Your booking · Call to Arms',
	'/venue-admin': 'Venue Admin · Call to Arms',
	'/admin': 'Admin · Call to Arms',
	'/platform-admin': 'Platform Admin · Call to Arms',
	'/claim': 'Claim your profile · Call to Arms',
	'/join': 'Join a club · Call to Arms',
	'/privacy': 'Privacy · Call to Arms'
};

type TitleOverride = { routeId: string; title: string };

export const titleOverride = writable<TitleOverride | null>(null);

/**
 * Announce a data-derived title for the page currently being shown.
 *
 * Pass `null` for `title` while the data is still loading — the route's static
 * title stands in until there is something better to say, rather than the tab
 * flickering through an empty string.
 */
export function setPageTitle(routeId: string | null | undefined, title: string | null): void {
	if (!routeId) return;
	titleOverride.set(title ? { routeId, title } : null);
}

/** The title to render, given the current route and any override. */
export function resolveTitle(
	routeId: string | null | undefined,
	override: TitleOverride | null
): string {
	if (override && routeId && override.routeId === routeId) return override.title;
	return (routeId && ROUTE_TITLES[routeId]) || SITE_NAME;
}
