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
        max-width: 60ch;
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
