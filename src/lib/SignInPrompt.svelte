<script lang="ts">
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';

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
    let { loginUrl, pathname }: { loginUrl: string; pathname: string } = $props();

    const destination = $derived(
        pathname.startsWith('/signup') ? 'to sign up for a game night'
        : pathname.startsWith('/players') ? 'to see this club’s players'
        : pathname.startsWith('/leagues') || pathname.startsWith('/league') ? 'to see the league tables'
        : pathname.startsWith('/claim') ? 'to set up your player profile'
        : 'to see this page'
    );
</script>

<div class="prompt" in:fly={{ y: 20, duration: 500, easing: cubicOut }}>
    <h1 class="prompt-title">Sign in {destination}</h1>
    <p class="prompt-body">
        Club nights run on Discord, so that's what you sign in with. It takes a moment,
        and you'll come straight back here.
    </p>
    <a class="prompt-button" href={loginUrl}>Sign in with Discord</a>
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

    .prompt-button {
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

    .prompt-button:hover {
        background: var(--color-accent-soft);
        transform: translateY(-1px);
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
