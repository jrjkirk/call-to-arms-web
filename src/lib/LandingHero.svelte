<script lang="ts">
    import { fly, fade } from 'svelte/transition';
    import ClubsMap from './ClubsMap.svelte';
    import ClubRequestForm from './ClubRequestForm.svelte';

    let { loginUrl }: { loginUrl: string } = $props();

    const pillars = [
        {
            glyph: 'sign-up',
            title: 'Signup',
            text: 'Select your game system, choose your faction, and you\'re in. All with Discord integrations to keep your club informed.'
        },
        {
            glyph: 'pairings',
            title: 'Get Paired',
            text: 'Smart pairings keep game nights moving, while organisers stay in complete control.'
        },
        {
            glyph: 'rankings',
            title: 'Leagues',
            text: "Record results, follow rankings, and watch your club's campaign unfold over the season."
        }
    ];
</script>

<div class="hero">
    <div class="hero-inner">
        <img class="hero-logo" src="/logo-hero.svg" alt="Call to Arms" in:fly={{ y: 18, duration: 600, delay: 120 }} />

        <div class="hero-cta" in:fly={{ y: 12, duration: 500, delay: 240 }}>
            <a class="hero-button" href={loginUrl}>
                <span>Sign in with Discord</span>
            </a>
        </div>

        <div class="hero-about" in:fade={{ duration: 500, delay: 400 }}>
            <div class="hero-about-heading">What is Call to Arms?</div>
            <p class="hero-about-text">
                A sign-up and pairing tool for tabletop wargaming clubs. It's
                built for organisers who run weekly game nights, want fair
                matchups without doing the maths themselves, and want a
                season-long record of who's playing what.
            </p>
        </div>

        <div class="hero-pillars" in:fade={{ duration: 500, delay: 480 }}>
            {#each pillars as p, i}
                <div class="pillar" style={`transition-delay: ${540 + i * 90}ms`}>
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
        <ClubRequestForm />

        <a class="hero-footer-link" href="/privacy">Privacy Policy</a>
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
        max-width: 780px;
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
        color: var(--color-accent);
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        margin-bottom: 0.7rem;
    }

    .hero-about-text {
        margin: 0;
        color: var(--color-text-dim);
        font-size: 0.95rem;
        line-height: 1.65;
    }

    .hero-pillars {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.1rem;
        width: 100%;
        margin-top: clamp(2rem, 4.5vw, 2.8rem);
    }

    .pillar {
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.34);
        padding: 1.6rem 1.2rem 1.7rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .pillar:hover {
        border-color: var(--color-accent-border);
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.46);
        transform: translateY(-3px);
    }

    .pillar-icon {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        border: 1px solid var(--color-accent-border);
        background: var(--color-surface-dark);
        color: var(--color-accent);
        margin-bottom: 0.9rem;
        flex: 0 0 auto;
    }

    .pillar-icon svg { width: 19px; height: 19px; }

    .pillar-title {
        color: var(--color-text-bright);
        font-weight: 700;
        font-size: 0.98rem;
        letter-spacing: 0.02em;
        margin-bottom: 0.4rem;
    }

    .pillar-text {
        margin: 0;
        color: var(--color-text-dim);
        font-size: 0.83rem;
        line-height: 1.55;
    }

    .hero-cta {
        margin-top: clamp(1rem, 2.4vw, 1.5rem);
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .hero-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--color-accent);
        border: 1px solid var(--color-accent);
        color: #1b1206;
        font-weight: 700;
        font-size: 1.02rem;
        letter-spacing: 0.01em;
        padding: 0.85rem 2.2rem;
        border-radius: var(--radius);
        text-decoration: none;
        cursor: pointer;
        transition: background 0.18s ease, transform 0.15s ease;
    }

    .hero-button:hover {
        background: var(--color-accent-soft);
        transform: translateY(-1px);
    }

    .hero-footer-link {
        margin-top: clamp(2rem, 4vw, 2.6rem);
        color: var(--color-text-faint);
        font-size: 0.75rem;
        text-decoration: underline;
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
