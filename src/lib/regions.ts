/**
 * The 12 ONS ITL1 UK regions — the controlled vocabulary a club's super-admin
 * picks from for `Club.region`, and the group headers in the region-grouped
 * club-discovery dropdown.
 *
 * Mirrors the backend's `UK_REGIONS` (call-to-arms-api models.py) exactly and
 * in the same order — keep the two in sync. The backend also serves this list
 * at GET /regions; this static copy avoids a fetch for the common case where
 * the order is all the UI needs.
 */
export const UK_REGIONS = [
	'North East',
	'North West',
	'Yorkshire & the Humber',
	'East Midlands',
	'West Midlands',
	'East of England',
	'London',
	'South East',
	'South West',
	'Scotland',
	'Wales',
	'Northern Ireland'
] as const;

export type UkRegion = (typeof UK_REGIONS)[number];

/** Label used for clubs whose region is unset, so they still appear in the
 * grouped dropdown rather than vanishing. */
export const REGION_UNSET_LABEL = 'Other';

export type RegionGroupable = { region?: string | null };

/**
 * Group clubs (or anything with a `region`) into `{ region, items }` buckets in
 * canonical UK_REGIONS order, with any unrecognised/unset region collected last
 * under REGION_UNSET_LABEL. Empty groups are omitted, so the caller can render
 * one <optgroup>/heading per returned bucket directly.
 */
export function groupByRegion<T extends RegionGroupable>(
	items: T[]
): { region: string; items: T[] }[] {
	const buckets = new Map<string, T[]>();
	for (const item of items) {
		const key =
			item.region && (UK_REGIONS as readonly string[]).includes(item.region)
				? item.region
				: REGION_UNSET_LABEL;
		const bucket = buckets.get(key);
		if (bucket) bucket.push(item);
		else buckets.set(key, [item]);
	}
	const order = [...UK_REGIONS, REGION_UNSET_LABEL];
	return order
		.filter((r) => buckets.has(r))
		.map((r) => ({ region: r, items: buckets.get(r)! }));
}
