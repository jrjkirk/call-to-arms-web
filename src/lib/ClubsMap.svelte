<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import 'leaflet/dist/leaflet.css';

    type ClubPin = {
        name: string;
        slug: string;
        address: string | null;
        latitude: number | null;
        longitude: number | null;
    };

    let container: HTMLDivElement;
    let map: any = null;
    let pinCount = $state(0);
    let ready = $state(false);

    onMount(async () => {
        let clubs: ClubPin[] = [];
        try {
            const r = await fetch(`${PUBLIC_API_URL}/clubs`);
            if (r.ok) clubs = await r.json();
        } catch (_) {
            /* no clubs available — the section below just stays hidden */
        }

        const pins = clubs.filter((c) => c.latitude != null && c.longitude != null);
        pinCount = pins.length;
        if (pins.length === 0) {
            ready = true;
            return;
        }

        const L = (await import('leaflet')).default;
        const iconUrl = (await import('leaflet/dist/images/marker-icon.png')).default;
        const iconRetinaUrl = (await import('leaflet/dist/images/marker-icon-2x.png')).default;
        const shadowUrl = (await import('leaflet/dist/images/marker-shadow.png')).default;
        // See ClubLocationMap.svelte for why this delete is needed first.
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

        map = L.map(container, { scrollWheelZoom: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);

        const bounds = L.latLngBounds(pins.map((c) => [c.latitude as number, c.longitude as number]));
        for (const club of pins) {
            const href = `https://${club.slug}.calltoarms.app`;
            L.marker([club.latitude as number, club.longitude as number])
                .addTo(map)
                .bindPopup(`<a href="${href}" target="_blank" rel="noopener noreferrer">${club.name}</a>`);
        }
        if (pins.length === 1) {
            map.setView(bounds.getCenter(), 12);
        } else {
            map.fitBounds(bounds, { padding: [30, 30] });
        }
        ready = true;
    });

    onDestroy(() => {
        map?.remove();
    });
</script>

{#if pinCount > 0}
    <div class="clubs-map-section">
        <div class="clubs-map-heading">Clubs already using Call to Arms</div>
        <div class="clubs-map" bind:this={container}></div>
    </div>
{/if}

<style>
    .clubs-map-section {
        width: 100%;
        margin-top: clamp(2.2rem, 5vw, 3rem);
    }

    .clubs-map-heading {
        color: var(--color-accent);
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        margin-bottom: 0.7rem;
    }

    .clubs-map {
        width: 100%;
        height: 280px;
        border-radius: var(--radius);
        border: 1px solid var(--color-steel-border);
        overflow: hidden;
    }

    .clubs-map :global(.leaflet-popup-content-wrapper),
    .clubs-map :global(.leaflet-popup-tip) {
        background: var(--color-surface);
        color: var(--color-text-base);
    }

    .clubs-map :global(.leaflet-popup-content a) {
        color: var(--color-accent);
        font-family: var(--font-display);
        font-weight: 700;
        text-decoration: none;
    }

    .clubs-map :global(.leaflet-popup-content a:hover) {
        color: var(--color-accent-bright);
    }
</style>
