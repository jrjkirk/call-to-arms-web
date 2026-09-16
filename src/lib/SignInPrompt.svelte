<script lang="ts">
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { page } from '$app/state';
    import GoogleSignIn from '$lib/GoogleSignIn.svelte';
    import EmailSignIn from '$lib/EmailSignIn.svelte';
    import PasswordSignIn from '$lib/PasswordSignIn.svelte';
    import { signInProviders } from '$lib/signInProviders';

    /**
     * What a signed-out visitor sees on a club subdomain when they've asked for
     * something that genuinely needs an account.
     *
     * The marketing hero used to stand in here, which was wrong in a specific
     * way: someone who followed "sign up for Wednesday" out of a club's Discord
     * landed on a page explaining what Call to Arms is, with no mention of
     * Wednesday, no sign-in prompt above the fold, and no way back to where
     * they were going. This says what they need to do and sends them onward
     * afterwards.
     */
    let { loginUrl, pathname, next = null }: { loginUrl: string; pathname: string; next?: string | null } = $props();

    const destination = $derived(
        pathname === '/' ? ''
        : pathname.startsWith('/signup') ? 'to sign up for a game night'
        : pathname.startsWith('/players') ? 'to see this club’s players'
        : pathname.startsWith('/leagues') || pathname.startsWith('/league') ? 'to see the league tables'
        : pathname.startsWith('/claim') ? 'to set up your player profile'
        : pathname.startsWith('/account') ? 'to your account'
        : 'to see this page'
    );
</script>

<div class="prompt" in:fly={{ y: 20, duration: 500, easing: cubicOut }}>
    <h1 class="prompt-title">Sign in {destination}</h1>
    <p class="prompt-body">
        {#if $signInProviders.length === 1}Club nights run on Discord, so that's what you sign in with.{/if}
        It takes a moment, and you'll come straight back here.
    </p>
    <div class="prompt-buttons">
        <a class="prompt-button" href={loginUrl}>Sign in with Discord</a>
        {#if next}
            <GoogleSignIn to={next} class="prompt-button prompt-button-alt" />
        {:else}
            <GoogleSignIn url={page.url} class="prompt-button prompt-button-alt" />
        {/if}
    </div>
    <EmailSignIn next={next ?? `${page.url.pathname}${page.url.search}`} />
    <PasswordSignIn next={next ?? `${page.url.pathname}${page.url.search}`} />
    <p class="prompt-aside">
        Just after a table? <a href="/book">Book one</a> without an account.
    </p>
</div>

<style>
    .prompt {
        max-width: 34rem;
        margin: clamp(2rem, 8vh, 5rem) auto;
        text-align: center;
        padding: 0 1rem;
    }

    .prompt-title {
        margin: 0 0 0.8rem;
        font-size: clamp(1.5rem, 3.6vw, 2rem);
        color: var(--color-text-bright);
        text-wrap: balance;
    }

    .prompt-body {
        margin: 0 0 1.6rem;
        color: var(--color-text-dim);
        line-height: 1.6;
    }

    /* :global, scoped under .prompt-buttons: GoogleSignIn renders its link
       inside its own component, where this page's scoped class wouldn't reach. */
    .prompt-buttons :global(.prompt-button) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-accent);
        border: 1px solid var(--color-accent);
        color: #1b1206;
        font-weight: 700;
        font-size: 1rem;
        padding: 0.8rem 2rem;
        border-radius: var(--radius);
        text-decoration: none;
        transition: background 0.15s ease, transform 0.12s ease;
    }

    .prompt-buttons :global(.prompt-button:hover) {
        background: var(--color-accent-soft);
        transform: translateY(-1px);
    }

    .prompt-buttons {
        display: flex;
        gap: 0.7rem;
        justify-content: center;
        flex-wrap: wrap;
    }

    .prompt-buttons :global(.prompt-button-alt) {
        background: transparent;
        border-color: var(--color-accent-border);
        color: var(--color-text-bright);
    }
    .prompt-buttons :global(.prompt-button-alt:hover) {
        background: color-mix(in srgb, var(--color-accent) 14%, transparent);
        border-color: var(--color-accent);
    }

    .prompt-aside {
        margin: 1.6rem 0 0;
        font-size: 0.85rem;
        color: var(--color-text-dim);
    }

    .prompt-aside a {
        color: var(--color-accent);
        text-decoration: underline;
    }
</style>
