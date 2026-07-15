/**
 * Maps the browser's hostname to a club slug for the `?club=` param the
 * backend's public endpoints (GET /pairings, GET /league/factions,
 * GET /week-id) now accept. `X.calltoarms.app` -> `X`; the bare/`www`
 * domain, localhost, and Vercel preview URLs all default to
 * "manchester" permanently, preserving every existing bookmark/QR-code
 * link Manchester's real users already have.
 */
const PRIMARY_DOMAIN = 'calltoarms.app';
const DEFAULT_CLUB_SLUG = 'manchester';

export function getClubSlugFromHostname(hostname: string): string {
    const host = hostname.toLowerCase();

    if (host === PRIMARY_DOMAIN || host === `www.${PRIMARY_DOMAIN}`) {
        return DEFAULT_CLUB_SLUG;
    }

    const subdomainSuffix = `.${PRIMARY_DOMAIN}`;
    if (host.endsWith(subdomainSuffix)) {
        return host.slice(0, -subdomainSuffix.length) || DEFAULT_CLUB_SLUG;
    }

    // localhost, *.vercel.app, and anything else unrecognised: default to
    // Manchester, matching today's local-dev / preview behaviour.
    return DEFAULT_CLUB_SLUG;
}
