<script lang="ts">
    /**
     * A sign-in page to link to when there is a choice of how to sign in
     * (account overhaul Slab 4). With Discord as the only method the header's
     * Sign in goes straight to Discord; once Google is offered it comes here,
     * so nobody is sent down one route without seeing the other.
     *
     * `next` is where to land afterwards: a path on this site, re-checked by
     * the API like every other sign-in link.
     */
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { PUBLIC_API_URL } from '$env/static/public';
    import SignInPrompt from '$lib/SignInPrompt.svelte';
    import { loginHrefTo } from '$lib/loginUrl';

    const next = $derived.by(() => {
        const n = page.url.searchParams.get('next');
        return n && n.startsWith('/') && !n.startsWith('//') ? n : '/';
    });

    // Already signed in: nothing to choose, carry on.
    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/auth/me`, { credentials: 'include' });
            if (r.ok && (await r.json()).authenticated) goto(next, { replaceState: true });
        } catch (_) {
            /* stay on the choice */
        }
    });
</script>

<SignInPrompt loginUrl={loginHrefTo(next)} pathname={next} next={next} />
