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
        // Esri's dark grey canvas. Keyless, and dark enough to sit under the
        // app's own palette.
        //
        // Was CARTO's dark_all, which was keyless when it went in and is not
        // any more: as of 09/2026 every tile comes back stamped "API KEY
        // REQUIRED / carto.com/basemaps/apikey" across the middle of it. The
        // tiles still return HTTP 200, so nothing failed loudly, it just
        // quietly started looking broken to every visitor.
        //
        // Note the {z}/{y}/{x} order: Esri puts y before x, unlike the usual
        // Leaflet template.
        L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            attribution:
                'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, HERE, Garmin, ' +
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
            // The layer stops at 16; upscale past it rather than 404.
            maxNativeZoom: 16,
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

    /* Zoom buttons + attribution strip also default to light chrome —
       recolour them to match the dark/gold theme too. */
    .location-map :global(.leaflet-control-zoom a) {
        background: var(--color-surface);
        color: var(--color-text-base);
        border-color: var(--color-steel-border) !important;
    }

    .location-map :global(.leaflet-control-zoom a:hover) {
        background: var(--color-surface-hover);
        color: var(--color-accent);
    }

    .location-map :global(.leaflet-control-attribution) {
        background: var(--color-surface-dark);
        color: var(--color-text-faint);
    }

    .location-map :global(.leaflet-control-attribution a) {
        color: var(--color-text-dim);
    }
</style>
