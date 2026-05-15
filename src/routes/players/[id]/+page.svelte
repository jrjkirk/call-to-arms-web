<script lang="ts">
    import { page } from '$app/state';

    const playerId = $derived(page.params.id);
</script>

<h1>Player profile</h1>

<p>Player ID: <strong>{playerId}</strong></p>

<p><a href="/players">← Back to all players</a></p>