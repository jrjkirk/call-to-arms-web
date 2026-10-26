/**
 * Where to pin a club on a map, even if its admin never placed the pin.
 *
 * A club with saved coordinates goes there. One with only an address is
 * placed at that address ($lib/geocode: the postcode if there is one, else an
 * OpenStreetMap search). Alchemist Workshops had an address and no
 * coordinates, so it was missing from both the Clubs page and the landing
 * page map.
 *
 * Lookups are kept for the visit, so each club is looked up once, whichever
 * map asks.
 */
import { findPlace } from '../geocode';

export type Placeable = { slug: string; address: string | null; latitude: number | null; longitude: number | null };
export type Point = { lat: number; lng: number };

const placed: Record<string, Point> = {};

/** Where a club goes, if that's known yet. */
export function placeOf(c: Placeable): Point | null {
    if (c.latitude != null && c.longitude != null) return { lat: c.latitude, lng: c.longitude };
    return placed[c.slug] ?? null;
}

/** Look up every club that has an address but no pin, one at a time, calling
 *  `onPlaced` as each is found so a map can add it. */
export async function placeUnpinned(clubs: Placeable[], onPlaced: (slug: string, at: Point) => void): Promise<void> {
    for (const c of clubs) {
        if (placeOf(c) || !c.address) continue;
        const at = await findPlace(c.address);
        if (!at) continue;
        placed[c.slug] = { lat: at.lat, lng: at.lng };
        onPlaced(c.slug, placed[c.slug]);
    }
}
