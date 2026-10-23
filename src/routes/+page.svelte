<script lang="ts">
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import ClubPage from '$lib/ClubPage.svelte';
    import YourWeek from '$lib/home/YourWeek.svelte';

    // A member with a profile at this club opens on "Your week"; everyone
    // else (a visitor, or a member who hasn't made a profile here yet) gets
    // the club's public page, which is what a shared link to the club is for.
    // The club page stays one tap away for members, at /club.
    let mode = $state<'loading' | 'week' | 'club'>('loading');
    let signedIn = $state(false);
    let clubName = $state<string | null>(null);

    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/me`, { credentials: 'include' });
            const me = r.ok ? await r.json() : { authenticated: false };
            signedIn = me.authenticated === true;
            clubName = me.active_club?.name ?? null;
            mode = signedIn && me.player != null ? 'week' : 'club';
        } catch (_) {
            mode = 'club';
        }
    });
</script>

{#if mode === 'week'}
    <YourWeek {clubName} />
{:else if mode === 'club'}
    <ClubPage {signedIn} />
{:else}
    <div class="loading-state"></div>
{/if}

<style>
    .loading-state { min-height: 40vh; }
</style>
