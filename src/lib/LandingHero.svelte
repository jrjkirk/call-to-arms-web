<script lang="ts">
    import { fly, fade } from 'svelte/transition';

    let { loginUrl }: { loginUrl: string } = $props();

    const pillars = [
        {
            glyph: 'sign-up',
            title: 'Sign Up',
            text: "Put your name down for this week's session — any system, any club, one place to do it."
        },
        {
            glyph: 'pairings',
            title: 'Get Paired',
            text: 'Fair matchups, generated automatically — factions, experience, and history all taken into account.'
        },
        {
            glyph: 'rankings',
            title: 'Climb the Ranks',
            text: 'Every result tracked. Standings, streaks, and titles that follow you from week to week.'
        }
    ];
</script>

<div class="hero">
    <div class="hero-glow" aria-hidden="true"></div>
    <div class="hero-grid" aria-hidden="true"></div>

    <div class="hero-inner">
        <h1 class="hero-title" in:fly={{ y: 18, duration: 600, delay: 120 }}>Call to Arms</h1>

        <p class="hero-tagline" in:fly={{ y: 14, duration: 550, delay: 240 }}>
            The home for your club's tabletop nights — sign-ups, pairings, and
            rankings, built for any system.
        </p>

        <div class="hero-pillars" in:fade={{ duration: 500, delay: 360 }}>
            {#each pillars as p, i}
                <div class="pillar" style={`transition-delay: ${420 + i * 90}ms`}>
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

        <div class="hero-cta" in:fly={{ y: 12, duration: 500, delay: 520 }}>
            <a class="hero-button" href={loginUrl}>
                <span>Sign in with Discord</span>
            </a>
            <p class="hero-cta-note">Free to join · Your club may already be here</p>
        </div>
    </div>
</div>

<style>
    .hero {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: clamp(2.5rem, 6vw, 5rem) 1.5rem clamp(3rem, 7vw, 5.5rem);
        overflow: hidden;
        border-radius: 18px;
        isolation: isolate;
    }

    .hero-glow {
        position: absolute;
        top: -18%;
        left: 50%;
        width: min(900px, 140%);
        height: 560px;
        transform: translateX(-50%);
        background: radial-gradient(closest-side, var(--color-accent-glow), transparent 72%);
        opacity: 0.55;
        filter: blur(6px);
        pointer-events: none;
        z-index: -2;
    }

    .hero-grid {
        position: absolute;
        inset: 0;
        background-image:
            linear-gradient(var(--color-accent-border-soft) 1px, transparent 1px),
            linear-gradient(90deg, var(--color-accent-border-soft) 1px, transparent 1px);
        background-size: 42px 42px;
        -webkit-mask-image: radial-gradient(ellipse 65% 55% at 50% 30%, black 0%, transparent 75%);
        mask-image: radial-gradient(ellipse 65% 55% at 50% 30%, black 0%, transparent 75%);
        opacity: 0.5;
        pointer-events: none;
        z-index: -1;
    }

    .hero-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        max-width: 780px;
    }

    .hero-title {
        width: 100%;
        text-align: center;
        font-family: var(--font-display);
        font-weight: 700;
        font-size: clamp(2.2rem, 6vw, 3.6rem);
        line-height: 1.15;
        letter-spacing: 0.01em;
        margin: 0;
        background: linear-gradient(180deg, var(--color-text-bright) 0%, var(--color-accent) 115%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0 0 46px var(--color-accent-glow);
    }

    .hero-tagline {
        margin: 1.35rem 0 0;
        max-width: 46ch;
        color: var(--color-text-muted);
        font-size: clamp(1rem, 1.6vw, 1.15rem);
        line-height: 1.6;
    }

    .hero-pillars {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1.1rem;
        width: 100%;
        margin-top: clamp(2.2rem, 5vw, 3.2rem);
    }

    .pillar {
        background: rgba(0, 0, 0, 0.22);
        border: 1px solid var(--color-accent-border-soft);
        border-radius: 14px;
        padding: 1.4rem 1.1rem 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
    }

    .pillar:hover {
        border-color: var(--color-accent-border);
        background: rgba(0, 0, 0, 0.32);
        transform: translateY(-2px);
    }

    .pillar-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        border: 1px solid var(--color-accent-border);
        color: var(--color-accent);
        margin-bottom: 0.85rem;
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
        margin-top: clamp(2.2rem, 5vw, 3rem);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
    }

    .hero-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(180deg, rgba(201, 161, 74, 0.24), rgba(201, 161, 74, 0.14));
        border: 1px solid var(--color-accent);
        color: var(--color-text-bright);
        font-weight: 700;
        font-size: 1.02rem;
        letter-spacing: 0.01em;
        padding: 0.85rem 2.2rem;
        border-radius: 10px;
        text-decoration: none;
        cursor: pointer;
        box-shadow: 0 0 0 rgba(201, 161, 74, 0);
        transition: background 0.18s ease, box-shadow 0.25s ease, transform 0.15s ease;
    }

    .hero-button:hover {
        background: linear-gradient(180deg, rgba(201, 161, 74, 0.34), rgba(201, 161, 74, 0.2));
        box-shadow: 0 0 28px var(--color-accent-glow);
        transform: translateY(-1px);
    }

    .hero-cta-note {
        margin: 0;
        color: var(--color-text-faint);
        font-size: 0.76rem;
        letter-spacing: 0.02em;
    }

    @media (max-width: 640px) {
        .hero-pillars {
            grid-template-columns: 1fr;
        }
    }
</style>
