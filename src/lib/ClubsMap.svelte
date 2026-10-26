<!--
  Every club already on Call to Arms, on the logged-out landing page: one gold
  pin each on the shared dark map ($lib/map/ClubMap), including clubs that
  only have an address ($lib/map/placeClubs). Tapping a pin goes to that
  club. Hidden until there's at least one club with a location.
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import ClubMap, { type MapPin } from './map/ClubMap.svelte';
    import { placeOf, placeUnpinned, type Placeable } from './map/placeClubs';

    type ClubPin = Placeable & { name: string };

    let clubs = $state<ClubPin[]>([]);
    // Bumped as each unpinned club is placed, so the pins recompute.
    let placedCount = $state(0);
    const pins = $derived.by<MapPin[]>(() => {
        placedCount;
        return clubs.flatMap((c) => {
            const at = placeOf(c);
            return at ? [{ id: c.slug, lat: at.lat, lng: at.lng, label: c.name }] : [];
        });
    });

    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/clubs`);
            if (!r.ok) return;
            clubs = await r.json();
            // A club with an address but no pin is placed at its address.
            placeUnpinned(clubs, () => (placedCount += 1));
        } catch (_) {
            /* no clubs: the section stays hidden */
        }
    });
</script>

{#if pins.length > 0}
    <div class="clubs-map-section">
        <div class="clubs-map-heading">Clubs already using Call to Arms</div>
        <div class="clubs-map">
            <ClubMap {pins} onselect={(slug) => (window.location.href = `https://${slug}.calltoarms.app`)} />
        </div>
    </div>
{/if}

<style>
    .clubs-map-section {
        width: 100%;
        margin-top: clamp(2.2rem, 5vw, 3rem);
    }

    .clubs-map-heading {
        font-family: var(--font-heading);
        color: var(--color-accent);
        font-size: 0.95rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        margin-bottom: 0.7rem;
    }

    .clubs-map { height: 280px; }
</style>
