<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import 'leaflet/dist/leaflet.css';

    type FinderClub = {
        slug: string;
        name: string;
        latitude: number | null;
        longitude: number | null;
        address?: string | null;
    };

    let {
        clubs,
        userLat = null,
        userLng = null,
        onselect
    }: {
        clubs: FinderClub[];
        userLat?: number | null;
        userLng?: number | null;
        onselect?: (slug: string) => void;
    } = $props();

    let container: HTMLDivElement;
    let map: any = null;
    let L: any = null;
    let markerLayer: any = null;
    let ready = $state(false);

    onMount(async () => {
        // Leaflet touches window/document at import time — browser-only, so
        // dynamic-import keeps this SSR-safe (same pattern as ClubLocationMap).
        L = (await import('leaflet')).default;
        const iconUrl = (await import('leaflet/dist/images/marker-icon.png')).default;
        const iconRetinaUrl = (await import('leaflet/dist/images/marker-icon-2x.png')).default;
        const shadowUrl = (await import('leaflet/dist/images/marker-shadow.png')).default;
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

        map = L.map(container, { center: [54.5, -3], zoom: 5, scrollWheelZoom: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
                '&copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 19,
        }).addTo(map);
        markerLayer = L.layerGroup().addTo(map);
        ready = true;
    });

    onDestroy(() => map?.remove());

    // Re-draw pins whenever the (filtered) club list changes, then fit the view
    // to the pins so the map always frames what's currently shown.
    $effect(() => {
        if (!ready || !map || !L || !markerLayer) return;
        markerLayer.clearLayers();
        const pts: [number, number][] = [];
        for (const c of clubs) {
            if (c.latitude == null || c.longitude == null) continue;
            const m = L.marker([c.latitude, c.longitude]);
            const safeName = c.name.replace(/</g, '&lt;');
            m.bindPopup(
                `<strong>${safeName}</strong>` +
                    (c.address ? `<br><span class="mp-addr">${c.address.replace(/</g, '&lt;')}</span>` : '') +
                    `<br><a href="https://${c.slug}.calltoarms.app">Visit club →</a>`
            );
            if (onselect) m.on('click', () => onselect(c.slug));
            m.addTo(markerLayer);
            pts.push([c.latitude, c.longitude]);
        }
        // The visitor's own location, if shared — a distinct accent dot.
        if (userLat != null && userLng != null) {
            L.circleMarker([userLat, userLng], {
                radius: 8,
                color: '#c9a14a',
                fillColor: '#c9a14a',
                fillOpacity: 0.9,
                weight: 2,
            })
                .bindPopup('You are here')
                .addTo(markerLayer);
            pts.push([userLat, userLng]);
        }
        if (pts.length === 1) {
            map.setView(pts[0], 12);
        } else if (pts.length > 1) {
            map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 });
        }
    });
</script>

<div class="finder-map" bind:this={container}></div>

<style>
    .finder-map {
        width: 100%;
        height: 100%;
        min-height: 320px;
        border-radius: var(--radius);
        border: 1px solid var(--color-steel-border);
        overflow: hidden;
    }

    .finder-map :global(.leaflet-popup-content-wrapper),
    .finder-map :global(.leaflet-popup-tip) {
        background: var(--color-surface);
        color: var(--color-text-base);
    }
    .finder-map :global(.leaflet-popup-content) { font-family: var(--font-display); }
    .finder-map :global(.leaflet-popup-content strong) { color: var(--color-text-bright); }
    .finder-map :global(.mp-addr) { color: var(--color-text-dim); font-weight: 400; font-size: 0.85em; }
    .finder-map :global(.leaflet-popup-content a) { color: var(--color-accent); font-weight: 700; }
    .finder-map :global(.leaflet-control-zoom a) {
        background: var(--color-surface);
        color: var(--color-text-base);
        border-color: var(--color-steel-border) !important;
    }
    .finder-map :global(.leaflet-control-zoom a:hover) { background: var(--color-surface-hover); color: var(--color-accent); }
    .finder-map :global(.leaflet-control-attribution) { background: var(--color-surface-dark); color: var(--color-text-faint); }
    .finder-map :global(.leaflet-control-attribution a) { color: var(--color-text-dim); }
</style>
