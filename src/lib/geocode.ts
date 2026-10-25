/**
 * Turning what an admin types into a point on the map, with free, keyless
 * services, so nobody has to look up latitude and longitude again.
 *
 * - A UK postcode anywhere in the text goes to postcodes.io (open government
 *   data): exact, and it names the region too.
 * - Anything else goes to Photon (komoot's OpenStreetMap search), kept to the
 *   British Isles, and the region comes from postcodes.io's reverse lookup.
 *
 * Regions come back in our own vocabulary ($lib/regions). postcodes.io names
 * the English regions and leaves the other three nations' region empty, so the
 * country stands in for those.
 */
import { UK_REGIONS, type UkRegion } from './regions';

export type Place = { lat: number; lng: number; region: UkRegion | null };

const POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;
// West, south, east, north: the UK and Ireland, so a search for "Newport"
// doesn't land in Rhode Island.
const UK_BBOX = '-10.9,49.8,2.0,61.0';

function toRegion(region: string | null | undefined, country: string | null | undefined): UkRegion | null {
    const raw = (region || country || '').replace(/\band\b/i, '&').toLowerCase();
    return UK_REGIONS.find((r) => r.toLowerCase() === raw) ?? null;
}

async function json(url: string): Promise<any> {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
}

/** The region a point is in, or null outside the UK or if the lookup fails. */
export async function regionAt(lat: number, lng: number): Promise<UkRegion | null> {
    try {
        const d = await json(`https://api.postcodes.io/postcodes?lon=${lng}&lat=${lat}&limit=1&radius=2000`);
        const p = d.result?.[0];
        return p ? toRegion(p.region, p.country) : null;
    } catch (_) {
        return null;
    }
}

/** Find `text` (an address, a postcode, a town). Null if nothing matched. */
export async function findPlace(text: string): Promise<Place | null> {
    const q = text.trim();
    if (!q) return null;

    const pc = q.match(POSTCODE);
    if (pc) {
        try {
            const d = await json(`https://api.postcodes.io/postcodes/${encodeURIComponent(`${pc[1]} ${pc[2]}`)}`);
            const r = d.result;
            if (r?.latitude != null) return { lat: r.latitude, lng: r.longitude, region: toRegion(r.region, r.country) };
        } catch (_) {
            // A postcode that's mistyped or retired: try the words instead.
        }
    }

    try {
        const d = await json(`https://photon.komoot.io/api/?${new URLSearchParams({ q, limit: '1', lang: 'en', bbox: UK_BBOX })}`);
        const f = d.features?.[0];
        if (!f) return null;
        const [lng, lat] = f.geometry.coordinates as [number, number];
        return { lat, lng, region: await regionAt(lat, lng) };
    } catch (_) {
        return null;
    }
}
