<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { systemLogoUrl } from '$lib/systemsConfig';

    type CarouselSystem = {
        slug: string;
        name: string;
        legacy_system_name: string;
        session_day: string;
        session_cadence: string;
        blurb: string | null;
        photo_url: string | null;
        accent_color: string;
        // This system's own Discord invite, already resolved server-side
        // (falls back to the club's link when the system hasn't set one).
        // Lives per-card rather than once in the club hero because a club's
        // game nights can each run out of a different Discord server.
        discord_url: string | null;
    };

    let { systems }: { systems: CarouselSystem[] } = $props();

    function cadenceLabel(cadence: string): string {
        return cadence.charAt(0).toUpperCase() + cadence.slice(1);
    }

    const AUTO_ADVANCE_MS = 6000;

    let active = $state(0);
    let paused = $state(false);
    let timer: ReturnType<typeof setInterval> | undefined;
    let reducedMotion = false;

    function goTo(i: number) {
        active = (i + systems.length) % systems.length;
    }

    function next() {
        goTo(active + 1);
    }

    function prev() {
        goTo(active - 1);
    }

    onMount(() => {
        reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reducedMotion && systems.length > 1) {
            timer = setInterval(() => {
                if (!paused) next();
            }, AUTO_ADVANCE_MS);
        }
    });

    onDestroy(() => {
        if (timer) clearInterval(timer);
    });
</script>

{#if systems.length > 0}
    {@const sys = systems[active]}
    <div
        class="carousel"
        style={`--card-accent: ${sys.accent_color}`}
        onmouseenter={() => (paused = true)}
        onmouseleave={() => (paused = false)}
        onfocusin={() => (paused = true)}
        onfocusout={() => (paused = false)}
        role="group"
        aria-roledescription="carousel"
        aria-label="Systems run at this club"
    >
        <div class="slide">
            <div class="slide-photo-wrap">
                <a class="slide-photo" href={`/signup?system=${encodeURIComponent(sys.legacy_system_name)}`}>
                    {#if sys.photo_url}
                        <img src={sys.photo_url} alt="" loading="lazy" />
                    {:else}
                        <img class="slide-photo-fallback" src={systemLogoUrl(sys.legacy_system_name)} alt="" loading="lazy" />
                    {/if}
                    <div class="slide-photo-scrim"></div>
                </a>

                {#if systems.length > 1}
                    <button type="button" class="carousel-arrow carousel-arrow-prev" onclick={prev} aria-label="Previous system">&larr;</button>
                    <button type="button" class="carousel-arrow carousel-arrow-next" onclick={next} aria-label="Next system">&rarr;</button>
                {/if}
            </div>
            <a class="slide-body" href={`/signup?system=${encodeURIComponent(sys.legacy_system_name)}`}>
                <div class="slide-name">{sys.name}</div>
                <div class="slide-schedule">{cadenceLabel(sys.session_cadence)} &middot; {sys.session_day}</div>
                {#if sys.blurb}
                    <p class="slide-blurb">{sys.blurb}</p>
                {/if}
            </a>
            {#if sys.discord_url}
                <!-- Outside .slide-body on purpose: that's an <a> wrapping the
                     whole card, and nesting an anchor inside one is invalid
                     HTML that browsers resolve by dropping the inner link. -->
                <div class="slide-actions">
                    <a
                        class="slide-discord"
                        href={sys.discord_url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <svg class="slide-discord-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.369a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                        Join the {sys.name} Discord
                    </a>
                </div>
            {/if}
        </div>

        {#if systems.length > 1}
            <div class="carousel-dots">
                {#each systems as s, i}
                    <button
                        type="button"
                        class="carousel-dot"
                        class:is-active={i === active}
                        style={`--dot-accent: ${s.accent_color}`}
                        onclick={() => goTo(i)}
                        aria-label={`Show ${s.name}`}
                        aria-current={i === active}
                    ></button>
                {/each}
            </div>
        {/if}
    </div>
{:else}
    <div class="empty-state">No systems are running at this club yet.</div>
{/if}

<style>
    .carousel {
        position: relative;
    }

    .slide {
        display: flex;
        flex-direction: column;
        background: var(--color-surface);
        border: 1px solid var(--color-steel-border);
        border-top: 3px solid var(--card-accent, var(--color-accent));
        border-radius: var(--radius);
        overflow: hidden;
        transition: box-shadow 0.15s ease;
    }

    .slide:hover {
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.36);
    }

    /* Positioning context for the prev/next arrows — sized by the photo's
       own aspect-ratio, so arrows stay vertically centred on the photo
       regardless of screen width (unlike a percentage `top` on the whole
       card, which would drift once the blurb below changes height). */
    .slide-photo-wrap {
        position: relative;
    }

    .slide-photo {
        display: flex;
        align-items: center;
        justify-content: center;
        aspect-ratio: 21 / 9;
        background: var(--color-surface-dark);
        overflow: hidden;
        text-decoration: none;
        color: inherit;
    }

    .slide-photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .slide-photo-fallback {
        object-fit: contain !important;
        padding: 3rem 4rem;
        opacity: 0.9;
    }

    .slide-photo-scrim {
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgba(10, 11, 14, 0.55), transparent 45%);
        pointer-events: none;
    }

    .slide-body {
        padding: 1.1rem 1.3rem 1.3rem;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        text-decoration: none;
        color: inherit;
    }

    .slide-name {
        font-family: var(--font-display);
        font-size: 1.35rem;
        font-weight: 700;
        color: var(--color-text-bright);
    }

    .slide-schedule {
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--card-accent, var(--color-accent));
        font-weight: 700;
    }

    .slide-blurb {
        margin: 0.3rem 0 0;
        font-size: 0.95rem;
        color: var(--color-text-muted);
        line-height: 1.55;
        /* No max-width cap — wraps to the full slide width instead of
           stopping short partway across the card. */
    }

    /* Sits below .slide-body rather than inside it (nested anchors), so it
       carries the card's horizontal padding itself and pulls up to close the
       gap .slide-body's bottom padding would otherwise leave. */
    .slide-actions {
        padding: 0 1.3rem 1.3rem;
        margin-top: -0.4rem;
    }

    /* Deliberately quieter than the club hero's old blurple Discord button.
       There's one of these on every carousel card, and three saturated
       buttons cycling through the same slot would fight the system photo and
       the accent colour for attention. Blurple is kept as the text/border so
       it still reads instantly as Discord. */
    .slide-discord {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        font-size: 0.9rem;
        font-weight: 700;
        color: #a6b0f8;
        background: rgba(88, 101, 242, 0.12);
        border: 1px solid rgba(88, 101, 242, 0.5);
        border-radius: var(--radius);
        text-decoration: none;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }

    .slide-discord:hover {
        background: #5865f2;
        border-color: #5865f2;
        color: #fff;
    }

    .slide-discord-icon {
        width: 18px;
        height: 18px;
        flex: 0 0 auto;
    }

    .carousel-arrow {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(10, 11, 14, 0.55);
        border: 1px solid var(--color-steel-border);
        border-radius: 50%;
        color: var(--color-text-bright);
        width: 38px;
        height: 38px;
        cursor: pointer;
        font-size: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s ease, border-color 0.15s ease;
    }

    .carousel-arrow:hover {
        background: rgba(10, 11, 14, 0.8);
        border-color: var(--color-accent);
        color: var(--color-accent);
    }

    .carousel-arrow-prev {
        left: 0.7rem;
    }

    .carousel-arrow-next {
        right: 0.7rem;
    }

    .carousel-dots {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 0.8rem;
    }

    .carousel-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        border: none;
        background: var(--color-steel-border);
        cursor: pointer;
        padding: 0;
        transition: background 0.15s ease, transform 0.15s ease;
    }

    .carousel-dot:hover {
        background: var(--color-text-dim);
    }

    .carousel-dot.is-active {
        background: var(--dot-accent, var(--color-accent));
        transform: scale(1.3);
    }

    @media (max-width: 640px) {
        .slide-photo {
            aspect-ratio: 4 / 3;
        }

        .slide-name {
            font-size: 1.15rem;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .slide,
        .carousel-arrow,
        .carousel-dot {
            transition: none;
        }
    }
</style>
