<!--
  The one map: OpenFreeMap's dark style drawn by MapLibre, tinted to the
  app's own blacks, with gold pins.

  Replaced three Leaflet maps on Esri's dark tiles (keyless, but with terms
  that never clearly allowed it; CARTO's before that started stamping "API KEY
  REQUIRED" on every tile). OpenFreeMap is OpenStreetMap data, free, keyless
  and unmetered.

  Three uses:
    - pins: clubs, framed to fit; tapping one calls onselect.
    - user: the viewer's own position, a pale dot.
    - picker: one pin an admin drags, or places by tapping the map;
      onpick(lat, lng) after each move.
-->
<script lang="ts" module>
    export type MapPin = { id: string | number; lat: number; lng: number; label: string; active?: boolean };
</script>

<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import 'maplibre-gl/dist/maplibre-gl.css';

    let {
        pins = [],
        user = null,
        picker = null,
        onpick,
        onselect,
        zoom = 13,
        class: className = ''
    }: {
        pins?: MapPin[];
        user?: { lat: number; lng: number } | null;
        picker?: { lat: number; lng: number } | null;
        onpick?: (lat: number, lng: number) => void;
        onselect?: (id: string | number) => void;
        /** Zoom for a single point (one pin, or the picker). */
        zoom?: number;
        class?: string;
    } = $props();

    let container: HTMLDivElement;
    let map: any = null;
    let ml: any = null;
    let ready = $state(false);
    let markers: any[] = [];
    let pickMarker: any = null;

    const STYLE = 'https://tiles.openfreemap.org/styles/dark';
    const UK: [number, number] = [-3.2, 54.6];

    /* The style's greys, pulled toward the app's cool blacks: land as the
       page, water darker, roads and borders as its hairlines, labels as its
       faint text. Matched by layer type and id, so a style update that adds
       layers still lands in the right family. */
    function tint() {
        for (const layer of map.getStyle().layers) {
            const id: string = layer.id;
            try {
                if (layer.type === 'background') map.setPaintProperty(id, 'background-color', '#101319');
                else if (layer.type === 'fill' && /water/.test(id)) map.setPaintProperty(id, 'fill-color', '#07080b');
                else if (layer.type === 'fill') map.setPaintProperty(id, 'fill-color', '#13161e');
                else if (layer.type === 'line' && /water|river|canal/.test(id)) map.setPaintProperty(id, 'line-color', '#07080b');
                else if (layer.type === 'line' && /boundary|admin/.test(id)) map.setPaintProperty(id, 'line-color', '#3a4150');
                else if (layer.type === 'line') map.setPaintProperty(id, 'line-color', '#232733');
                else if (layer.type === 'symbol') {
                    map.setPaintProperty(id, 'text-color', '#767c8a');
                    map.setPaintProperty(id, 'text-halo-color', '#0a0b0e');
                }
            } catch (_) {
                // A layer without that property: leave it as styled.
            }
        }
    }

    function pinEl(active = false): HTMLElement {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = active ? 'cm-pin on' : 'cm-pin';
        return el;
    }

    function drawPins() {
        if (!ready) return;
        for (const m of markers) m.remove();
        markers = [];
        for (const p of pins) {
            const el = pinEl(p.active);
            el.setAttribute('aria-label', p.label);
            el.title = p.label;
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                onselect?.(p.id);
            });
            markers.push(new ml.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map));
        }
        if (user) {
            const el = document.createElement('span');
            el.className = 'cm-user';
            markers.push(new ml.Marker({ element: el }).setLngLat([user.lng, user.lat]).addTo(map));
        }
        frame();
    }

    /** Fit the view to what's on it: every pin and the viewer. */
    function frame() {
        const pts: [number, number][] = pins.map((p) => [p.lng, p.lat]);
        if (user) pts.push([user.lng, user.lat]);
        if (pts.length === 0) return;
        if (pts.length === 1) {
            map.jumpTo({ center: pts[0], zoom });
            return;
        }
        const b = new ml.LngLatBounds(pts[0], pts[0]);
        for (const pt of pts) b.extend(pt);
        map.fitBounds(b, { padding: { top: 40, bottom: 56, left: 40, right: 56 }, maxZoom: 12, duration: 0 });
    }

    function placePicker(lat: number, lng: number, move = true) {
        if (!pickMarker) {
            pickMarker = new ml.Marker({ element: pinEl(true), draggable: true }).setLngLat([lng, lat]).addTo(map);
            pickMarker.on('dragend', () => {
                const ll = pickMarker.getLngLat();
                onpick?.(ll.lat, ll.lng);
            });
        } else {
            pickMarker.setLngLat([lng, lat]);
        }
        if (move) map.jumpTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15) });
    }

    onMount(async () => {
        ml = (await import('maplibre-gl')).default;
        map = new ml.Map({
            container,
            style: STYLE,
            center: picker ? [picker.lng, picker.lat] : UK,
            zoom: picker ? 15 : 4.6,
            minZoom: 3,
            // Scrolling the page past a map shouldn't zoom it; pinch and the
            // buttons still do.
            scrollZoom: false,
            dragRotate: false,
            pitchWithRotate: false,
            touchPitch: false,
            attributionControl: { compact: true }
        });
        map.touchZoomRotate.disableRotation();
        map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
        map.on('style.load', tint);
        map.on('load', () => {
            ready = true;
            // The credit starts as the small (i) button, not the full strip
            // across the bottom of a small map; it opens on a tap.
            container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
            if (picker) placePicker(picker.lat, picker.lng, false);
            drawPins();
        });
        if (onpick) {
            map.on('click', (e: any) => {
                placePicker(e.lngLat.lat, e.lngLat.lng, false);
                onpick?.(e.lngLat.lat, e.lngLat.lng);
            });
        }
    });

    onDestroy(() => map?.remove());

    // Pins or the viewer changed (a filter, "near me"): redraw and reframe.
    $effect(() => {
        pins;
        user;
        if (ready) drawPins();
    });

    // The picker moved from outside (an address was found): follow it.
    $effect(() => {
        const p = picker;
        if (!ready || !p) return;
        const at = pickMarker?.getLngLat();
        if (!at || Math.abs(at.lat - p.lat) > 1e-6 || Math.abs(at.lng - p.lng) > 1e-6) placePicker(p.lat, p.lng);
    });
</script>

<div class="cm {className}" class:picking={!!onpick} bind:this={container}></div>

<style>
    .cm {
        width: 100%;
        height: 100%;
        min-height: 220px;
        border-radius: 6px;
        border: 1px solid #232733;
        overflow: hidden;
        background: #101319;
    }
    .cm.picking { cursor: crosshair; }

    :global(.cm-pin) {
        width: 18px;
        height: 18px;
        padding: 0;
        border-radius: 50%;
        background: var(--color-accent);
        border: 3px solid #0a0b0e;
        box-shadow: 0 0 0 1px rgba(201, 161, 74, 0.5);
        cursor: pointer;
    }
    :global(.cm-pin.on) {
        width: 24px;
        height: 24px;
        background: var(--color-accent-bright);
        box-shadow: 0 0 0 2px var(--color-accent), 0 4px 14px rgba(0, 0, 0, 0.6);
    }
    :global(.cm-user) {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #f5edd7;
        border: 3px solid #5a9bd4;
    }

    /* MapLibre's controls are white by default: dark them to match. */
    .cm :global(.maplibregl-ctrl-group) {
        background: #13161e;
        border: 1px solid #232733;
        box-shadow: none;
    }
    .cm :global(.maplibregl-ctrl-group button + button) { border-top: 1px solid #232733; }
    .cm :global(.maplibregl-ctrl-group button .maplibregl-ctrl-icon) { filter: invert(0.85); }
    .cm :global(.maplibregl-ctrl-attrib) {
        background: rgba(10, 11, 14, 0.8);
        color: var(--color-text-faint);
    }
    .cm :global(.maplibregl-ctrl-attrib a) { color: var(--color-text-dim); }
    .cm :global(.maplibregl-ctrl-attrib-button) { filter: invert(0.85); background-color: transparent; }
</style>
