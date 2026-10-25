<!--
  Where a club is, on its Club page: one pin on the shared dark map
  ($lib/map/ClubMap).
-->
<script lang="ts">
    import ClubMap from './map/ClubMap.svelte';

    let { latitude, longitude, label }: { latitude: number; longitude: number; label: string } = $props();
</script>

<div class="location-map">
    <ClubMap pins={[{ id: label, lat: latitude, lng: longitude, label, active: true }]} zoom={14} />
</div>

<style>
    .location-map { height: 220px; }
</style>
