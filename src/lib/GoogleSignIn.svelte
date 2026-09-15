<script lang="ts">
    /**
     * "Sign in with Google", beside a page's own Discord button, and only when
     * the API offers Google on sign-in screens ($lib/signInProviders). Renders
     * nothing otherwise, so a page can include it unconditionally.
     *
     * Takes the page's button class so it sits in whatever style that page
     * already uses for signing in.
     */
    import { signInProviders } from '$lib/signInProviders';
    import { loginHref, loginHrefTo } from '$lib/loginUrl';

    let {
        url = null,
        to = null,
        class: className = 'secondary-button'
    }: { url?: URL | null; to?: string | null; class?: string } = $props();

    const href = $derived(to ? loginHrefTo(to, 'google') : loginHref(url, 'google'));
</script>

{#if $signInProviders.includes('google')}
    <a class={className} {href}>Sign in with Google</a>
{/if}
