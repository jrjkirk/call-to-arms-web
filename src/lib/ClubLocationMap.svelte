<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import 'leaflet/dist/leaflet.css';

    let { latitude, longitude, label }: { latitude: number; longitude: number; label: string } = $props();

    let container: HTMLDivElement;
    let map: any = null;

    onMount(async () => {
        // Leaflet touches `window`/`document` at import time, so it can only
        // load in the browser — dynamic import keeps this component SSR-safe.
        const L = (await import('leaflet')).default;

        // Bundle the marker icon assets ourselves (imported, not fetched from
        // a CDN) — works around Leaflet's default icon paths breaking under
        // Vite's bundler, without adding an external network dependency.
        const iconUrl = (await import('leaflet/dist/images/marker-icon.png')).default;
        const iconRetinaUrl = (await import('leaflet/dist/images/marker-icon-2x.png')).default;
        const shadowUrl = (await import('leaflet/dist/images/marker-shadow.png')).default;
        // Leaflet's default icon otherwise tries to auto-detect + prefix its
        // own image path on top of the URLs we just bundled, producing a
        // doubled/broken path under Vite. Deleting this method first is the
        // standard workaround.
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

        map = L.map(container, {
            center: [latitude, longitude],
            zoom: 14,
            scrollWheelZoom: false,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map);
        L.marker([latitude, longitude]).addTo(map).bindPopup(label);
    });

    onDestroy(() => {
        map?.remove();
    });
</script>

<div class="location-map" bind:this={container}></div>

<style>
    .location-map {
        width: 100%;
        height: 220px;
        border-radius: var(--radius);
        border: 1px solid var(--color-steel-border);
        overflow: hidden;
    }

    /* Leaflet's own popup chrome is styled for a light page by default —
       recolour it to sit inside the dark/gold theme. */
    .location-map :global(.leaflet-popup-content-wrapper),
    .location-map :global(.leaflet-popup-tip) {
        background: var(--color-surface);
        color: var(--color-text-base);
    }

    .location-map :global(.leaflet-popup-content) {
        font-family: var(--font-display);
        font-weight: 700;
    }
</style>
