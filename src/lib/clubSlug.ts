/**
 * Maps the browser's hostname to a club slug for the `?club=` param the
 * backend's public endpoints (GET /pairings, GET /league/factions,
 * GET /week-id) now accept. `X.calltoarms.app` -> `X`; the bare/`www`
 * domain, localhost, and Vercel preview URLs all default to the primary
 * club's slug.
 */
const PRIMARY_DOMAIN = 'calltoarms.app';
// Kept in sync with backend database.py _DEFAULT_CLUB_SLUG. The primary club
// was rebranded manchester -> egnwgc (2026-07-26); the DB slug matches.
const DEFAULT_CLUB_SLUG = 'egnwgc';

// Old subdomains that have been renamed. A visitor landing on a legacy
// subdomain (existing bookmarks/QR codes) is redirected to the new one so no
// link breaks — see +layout.svelte. Add old->new pairs here on any future
// rename.
export const LEGACY_SLUG_REDIRECTS: Record<string, string> = {
	manchester: 'egnwgc',
	yorkshire: 'theoutpost'
};

export function getClubSlugFromHostname(hostname: string): string {
	const host = hostname.toLowerCase();

	if (host === PRIMARY_DOMAIN || host === `www.${PRIMARY_DOMAIN}`) {
		return DEFAULT_CLUB_SLUG;
	}

	const subdomainSuffix = `.${PRIMARY_DOMAIN}`;
	if (host.endsWith(subdomainSuffix)) {
		return host.slice(0, -subdomainSuffix.length) || DEFAULT_CLUB_SLUG;
	}

	// localhost, *.vercel.app, and anything else unrecognised: default to the
	// primary club, matching today's local-dev / preview behaviour.
	return DEFAULT_CLUB_SLUG;
}

/**
 * If `hostname` is a renamed (legacy) club subdomain, return the new host to
 * redirect to (e.g. `manchester.calltoarms.app` -> `egnwgc.calltoarms.app`);
 * otherwise null. Only fires for real `*.calltoarms.app` subdomains.
 */
export function legacyRedirectHost(hostname: string): string | null {
	const host = hostname.toLowerCase();
	const subdomainSuffix = `.${PRIMARY_DOMAIN}`;
	if (!host.endsWith(subdomainSuffix)) return null;
	const slug = host.slice(0, -subdomainSuffix.length);
	const target = LEGACY_SLUG_REDIRECTS[slug];
	return target ? `${target}.${PRIMARY_DOMAIN}` : null;
}
