<script lang="ts">
    import { onMount } from 'svelte';
    import { fly, fade } from 'svelte/transition';
    import { PUBLIC_API_URL } from '$env/static/public';
    import ClubsMap from './ClubsMap.svelte';
    import ClubRequestForm from './ClubRequestForm.svelte';
    import GoogleSignIn from './GoogleSignIn.svelte';
    import { signInProviders } from './signInProviders';

    let { loginUrl }: { loginUrl: string } = $props();

    /* Headline numbers, fetched rather than rendered server-side because this
       is the one page that must still draw when the API is unreachable. The
       API was down for hours on 2026-09-09 and the marketing page carried on
       serving; a stat that could break that trade is not worth having.

       So: null until it arrives, and the line simply does not render. Never a
       spinner, never "0 players" — an outage should cost a sentence, not put a
       wrong number on the front page. */
    let stats = $state<{ players: number; clubs: number; games: number } | null>(null);

    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/stats`);
            if (r.ok) stats = await r.json();
        } catch (_) {
            // Left null. See above.
        }
    });

    const pillars = [
        {
            glyph: 'sign-up',
            title: 'Sign up',
            text: 'Pick your night and your army. Your club’s Discord hears about it.'
        },
        {
            glyph: 'pairings',
            title: 'Get paired',
            text: 'A fair game every week, worked out for you. Organisers can still change anything.'
        },
        {
            glyph: 'rankings',
            title: 'Leagues',
            text: 'Results, rankings, and a record of the whole season.'
        }
    ];
</script>

<div class="hero">
    <div class="hero-inner">
        <img class="hero-logo" src="/logo-hero.svg" alt="Call to Arms" in:fly={{ y: 18, duration: 600, delay: 120 }} />

        <!-- Two doors, because two different people arrive here. A club member
             signs in. Someone who just wants a game near them has no account
             and nothing to sign in to, and used to have to scroll past the
             whole page to find the club finder. -->
        <div class="hero-cta" in:fly={{ y: 12, duration: 500, delay: 240 }}>
            <a class="hero-button" href={loginUrl}>
                <span>Sign in with Discord</span>
            </a>
            <GoogleSignIn class="hero-button hero-button-alt" />
            {#if $signInProviders.includes('email')}
                <a class="hero-button hero-button-alt" href="/signin">Sign in with email</a>
            {/if}
            <a class="hero-button hero-button-alt" href="/find">
                <span>Find a club near you</span>
            </a>
        </div>

        {#if stats && stats.players > 0}
            <!-- The club count is only worth saying once there is more than one
                 to say it about: "142 players across 1 club" undersells the
                 thing it is trying to sell. -->
            <!-- Each number guarded on its own. A brand-new deployment has
                 players before it has games, and "0 games paired" beside a real
                 player count reads as broken rather than as new. -->
            <!-- The numbers are the headline (design rule 5). -->
            <div class="hero-stats" in:fade={{ duration: 400, delay: 320 }}>
                <span class="hs"><b>{stats.players.toLocaleString()}</b><span>{stats.players === 1 ? 'Player' : 'Players'}</span></span>
                {#if stats.clubs > 1}
                    <span class="hs"><b>{stats.clubs}</b><span>Clubs</span></span>
                {/if}
                {#if stats.games > 0}
                    <span class="hs"><b>{stats.games.toLocaleString()}</b><span>{stats.games === 1 ? 'Game' : 'Games'} paired</span></span>
                {/if}
            </div>
        {/if}

        <div class="hero-about" in:fade={{ duration: 500, delay: 400 }}>
            <div class="hero-about-heading">What is Call to Arms?</div>
            <p class="hero-about-text">Sign-ups, fair pairings and leagues for tabletop wargaming clubs.</p>
        </div>

        <div class="hero-pillars" in:fade={{ duration: 500, delay: 480 }}>
            {#each pillars as p, i}
                <div class="pillar">
                    <span class="pillar-icon">
                        {#if p.glyph === 'sign-up'}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                                <path d="M12 3l7 3.2v5.4c0 4.6-3 7.9-7 9.4-4-1.5-7-4.8-7-9.4V6.2L12 3z" stroke-linejoin="round" />
                                <path d="M9 12.2l2.2 2.2L15.5 10" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        {:else if p.glyph === 'pairings'}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                                <circle cx="7" cy="7" r="3" />
                                <circle cx="17" cy="17" r="3" />
                                <path d="M9.6 9.2L14.4 14.8M17 7l-2.5 2.5M7 17l2.5-2.5" stroke-linecap="round" />
                            </svg>
                        {:else}
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
                                <path d="M4 20V13M12 20V6M20 20v-9" stroke-linecap="round" />
                                <path d="M2.5 13L8 8l4.5 3.5L20 5" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        {/if}
                    </span>
                    <div class="pillar-title">{p.title}</div>
                    <p class="pillar-text">{p.text}</p>
                </div>
            {/each}
        </div>

        <ClubsMap />
        <a class="find-club-cta" href="/find">See every club</a>
        <ClubRequestForm />

        <a class="hero-footer-link" href="/privacy">Privacy</a>
    </div>
</div>

<style>
    .hero {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: clamp(1.25rem, 3vw, 2.5rem) 1.5rem clamp(3rem, 7vw, 5.5rem);
        overflow: hidden;
        border-radius: 18px;
        isolation: isolate;
    }

    .hero-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        /* Match the main content container (.container, 1100px) so the hero —
           and especially the shared "Don't see your club?" form — wraps the
           same width as the /find page. The marketing bits (logo, about text)
           keep their own narrower caps below, so they stay readable/centred. */
        max-width: 1100px;
        width: 100%;
    }

    .hero-logo {
        width: 100%;
        max-width: 580px;
        height: auto;
        display: block;
    }

    .hero-about {
        width: 100%;
        max-width: 56ch;
        margin-top: clamp(2.4rem, 6vw, 3.4rem);
    }

    .hero-about-heading {
        font-family: var(--font-heading);
        color: var(--color-accent);
        font-size: 1rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        margin-bottom: 0.5rem;
    }

    .hero-about-text {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 1.05rem;
        line-height: 1.5;
    }

    .hero-pillars {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.1rem;
        width: 100%;
        margin-top: clamp(2rem, 4.5vw, 2.8rem);
    }

    /* A card each: the icon, a capitals title, one line. */
    .pillar {
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 6px;
        padding: 1.3rem 1.3rem 1.4rem;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        text-align: left;
        gap: 0.45rem;
    }

    .pillar-icon {
        color: var(--color-accent);
        line-height: 0;
    }

    .pillar-icon svg { width: 28px; height: 28px; }

    .pillar-title {
        font-family: var(--font-heading);
        color: var(--color-text-bright);
        font-weight: 700;
        font-size: 1.35rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }

    .pillar-text {
        margin: 0;
        color: var(--color-text-dim);
        font-size: 0.95rem;
        line-height: 1.5;
    }

    .hero-cta {
        margin-top: clamp(1rem, 2.4vw, 1.5rem);
        display: flex;
        flex-wrap: wrap;
        gap: 0.7rem;
        align-items: center;
        justify-content: center;
    }

    /* Under the doors: big condensed numbers, each with a capitals label. */
    .hero-stats {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.6rem 2.4rem;
        margin-top: 1.6rem;
    }
    .hs { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; }
    .hs b {
        font-family: var(--font-heading);
        font-size: 2.6rem;
        font-weight: 700;
        line-height: 1;
        color: var(--color-text-bright);
        font-variant-numeric: tabular-nums;
    }
    .hs span {
        font-family: var(--font-heading);
        font-size: 0.9rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--color-accent);
    }

    /* :global under .hero-cta so the Google link, rendered inside
       GoogleSignIn, gets the same button. */
    .hero-cta :global(.hero-button) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-accent);
        border: 1px solid var(--color-accent);
        color: #1b1206;
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.15rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 0.8rem 2rem;
        border-radius: var(--radius);
        text-decoration: none;
        cursor: pointer;
        transition: background 0.18s ease, transform 0.15s ease;
    }

    .hero-cta :global(.hero-button:hover) {
        background: var(--color-accent-soft);
        transform: translateY(-1px);
    }

    /* The quieter of the two doors. Same size and weight so neither reads as
       the afterthought, but only one of them is filled gold. */
    .hero-cta :global(.hero-button-alt) {
        background: transparent;
        border-color: var(--color-accent-border);
        color: var(--color-text-bright);
    }

    .hero-cta :global(.hero-button-alt:hover) {
        background: color-mix(in srgb, var(--color-accent) 14%, transparent);
        border-color: var(--color-accent);
    }

    .find-club-cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        margin: 0.9rem auto 0;
        padding: 0.7rem 1.6rem;
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.05rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-accent);
        background: transparent;
        border: 1px solid var(--color-accent-border);
        border-radius: var(--radius);
        text-decoration: none;
        transition: background 0.18s ease, border-color 0.18s ease, transform 0.15s ease;
    }

    .find-club-cta:hover {
        background: var(--color-surface-hover);
        border-color: var(--color-accent);
    }

    .hero-footer-link {
        margin-top: clamp(2rem, 4vw, 2.6rem);
        font-family: var(--font-heading);
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--color-text-faint);
        font-size: 0.9rem;
        text-decoration: none;
    }

    .hero-footer-link:hover {
        color: var(--color-text-muted);
    }

    @media (max-width: 640px) {
        .hero-pillars {
            grid-template-columns: 1fr;
        }
    }
</style>
