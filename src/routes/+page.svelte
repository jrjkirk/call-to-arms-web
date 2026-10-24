<script lang="ts" module>
    // Which page this visitor got last time, for the rest of this page load:
    // a tap back to Home shows it at once instead of waiting on /auth/me again.
    let lastMode: 'week' | 'club' | null = null;
    let lastSignedIn = false;
    let lastClubName: string | null = null;
</script>

<script lang="ts">
    import { getMe } from '$lib/session';
    import { onMount } from 'svelte';
    import { PUBLIC_API_URL } from '$env/static/public';
    import ClubPage from '$lib/ClubPage.svelte';
    import YourWeek from '$lib/home/YourWeek.svelte';

    // A member with a profile at this club opens on "Your week"; everyone
    // else (a visitor, or a member who hasn't made a profile here yet) gets
    // the club's public page, which is what a shared link to the club is for.
    // The club page stays one tap away for members, at /club.
    let mode = $state<'loading' | 'week' | 'club'>(lastMode ?? 'loading');
    let signedIn = $state(lastSignedIn);
    let clubName = $state<string | null>(lastClubName);

    onMount(async () => {
        try {
            const me = (await getMe()) ?? { authenticated: false };
            signedIn = me.authenticated === true;
            clubName = me.active_club?.name ?? null;
            mode = signedIn && me.player != null ? 'week' : 'club';
        } catch (_) {
            mode = 'club';
        }
        lastMode = mode;
        lastSignedIn = signedIn;
        lastClubName = clubName;
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
