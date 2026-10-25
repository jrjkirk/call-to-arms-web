<!--
  Where a club is, set the way people think about it: type the address and
  FIND puts the pin there ($lib/geocode: the postcode if there is one, else an
  OpenStreetMap search), then drag the pin, or tap the map, to the door.
  Replaces typing latitude and longitude copied out of Google Maps.

  The region follows the place found; it stays editable, and dragging the
  pin only fills it in if it's empty. Pass `region` as undefined to leave the
  region out altogether (the platform admin's club form has none).
-->
<script lang="ts">
    import ClubMap from './ClubMap.svelte';
    import { findPlace, regionAt } from '../geocode';
    import { UK_REGIONS } from '../regions';

    let {
        address = $bindable(''),
        latitude = $bindable(null),
        longitude = $bindable(null),
        region = $bindable(undefined),
        id = 'loc'
    }: {
        address?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        region?: string | null | undefined;
        id?: string;
    } = $props();

    const withRegion = region !== undefined;
    let finding = $state(false);
    let notFound = $state(false);

    const point = $derived(latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null);

    async function find() {
        if (!address?.trim()) return;
        finding = true;
        notFound = false;
        const place = await findPlace(address);
        finding = false;
        if (!place) {
            notFound = true;
            return;
        }
        latitude = round(place.lat);
        longitude = round(place.lng);
        // A new address means a new region; dragging the pin (below) only
        // fills one in that's missing.
        if (withRegion && place.region) region = place.region;
    }

    async function moved(lat: number, lng: number) {
        latitude = round(lat);
        longitude = round(lng);
        notFound = false;
        if (withRegion && !region) region = (await regionAt(lat, lng)) ?? region;
    }

    // Six places is about 10cm: far finer than a pin needs, and keeps the
    // stored numbers readable.
    const round = (n: number) => Math.round(n * 1e6) / 1e6;
</script>

<div class="lp">
    <label class="field-label" for={`${id}-address`}>Address</label>
    <div class="lp-find">
        <input
            id={`${id}-address`}
            class="field-input"
            type="text"
            placeholder="Street, town, postcode"
            bind:value={address}
            onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); find(); } }}
        />
        <button type="button" class="secondary-button" disabled={finding || !address?.trim()} onclick={find}>
            {finding ? 'Finding…' : 'Find'}
        </button>
    </div>
    {#if notFound}<p class="field-error">Not found. Try the postcode.</p>{/if}

    <div class="lp-map">
        <ClubMap picker={point} onpick={moved} />
    </div>

    {#if withRegion}
        <label class="field-label" for={`${id}-region`}>Region</label>
        <select id={`${id}-region`} class="field-select" bind:value={region}>
            <option value={null}>Not set</option>
            {#each UK_REGIONS as r}<option value={r}>{r}</option>{/each}
        </select>
    {/if}
</div>

<style>
    .lp { display: flex; flex-direction: column; gap: 0.4rem; }
    .lp-find { display: flex; gap: 0.5rem; }
    .lp-find .field-input { flex: 1; min-width: 0; }
    .lp-map { height: 260px; margin: 0.4rem 0 0.6rem; }
    .lp .field-label { margin: 0.2rem 0 0; }
    .lp .field-error { margin: 0; }
</style>
