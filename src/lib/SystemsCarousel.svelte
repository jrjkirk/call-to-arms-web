<script lang="ts">
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
</script>

{#if systems.length > 0}
    <div class="carousel-track">
        {#each systems as sys (sys.slug)}
            <a class="system-card" href={`/signup?system=${encodeURIComponent(sys.legacy_system_name)}`} style={`--card-accent: ${sys.accent_color}`}>
                <div class="system-photo">
                    {#if sys.photo_url}
                        <img src={sys.photo_url} alt="" loading="lazy" />
                    {:else}
                        <img class="system-photo-fallback" src={systemLogoUrl(sys.legacy_system_name)} alt="" loading="lazy" />
                    {/if}
                </div>
                <div class="system-body">
                    <div class="system-name">{sys.name}</div>
                    <div class="system-schedule">{cadenceLabel(sys.session_cadence)} &middot; {sys.session_day}</div>
                    {#if sys.blurb}
                        <p class="system-blurb">{sys.blurb}</p>
                    {/if}
                </div>
            </a>
        {/each}
    </div>
{:else}
    <div class="empty-state">No systems are running at this club yet.</div>
{/if}

<style>
    .carousel-track {
        display: flex;
        gap: 0.9rem;
        overflow-x: auto;
        padding: 0.15rem 0.1rem 0.9rem;
        scroll-snap-type: x proximity;
    }

    .system-card {
        scroll-snap-align: start;
        flex: 0 0 auto;
        width: 260px;
        display: flex;
        flex-direction: column;
        background: var(--color-surface);
        border: 1px solid var(--color-steel-border);
        border-top: 3px solid var(--card-accent, var(--color-accent));
        border-radius: var(--radius);
        overflow: hidden;
        text-decoration: none;
        color: inherit;
        transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .system-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.32);
    }

    .system-photo {
        aspect-ratio: 16 / 9;
        background: var(--color-surface-dark);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
    }

    .system-photo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .system-photo-fallback {
        object-fit: contain !important;
        padding: 1.6rem;
        opacity: 0.9;
    }

    .system-body {
        padding: 0.85rem 1rem 1.05rem;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .system-name {
        font-family: var(--font-display);
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--color-text-bright);
    }

    .system-schedule {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.9px;
        color: var(--card-accent, var(--color-accent));
        font-weight: 700;
    }

    .system-blurb {
        margin: 0.2rem 0 0;
        font-size: 0.88rem;
        color: var(--color-text-muted);
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    @media (prefers-reduced-motion: reduce) {
        .system-card { transition: none; }
    }
</style>
