<script lang="ts">
    type ClubProfile = {
        name: string;
        blurb: string | null;
        logo_url: string | null;
        website_url: string | null;
        discord_url: string | null;
    };

    let { club }: { club: ClubProfile } = $props();
</script>

<div class="club-hero">
    {#if club.logo_url}
        <img class="club-logo" src={club.logo_url} alt={`${club.name} logo`} />
    {/if}
    <div class="club-hero-text">
        <h1 class="club-name">{club.name}</h1>
        {#if club.blurb}
            <p class="club-blurb">{club.blurb}</p>
        {/if}
        {#if club.website_url || club.discord_url}
            <div class="club-links">
                {#if club.website_url}
                    <a class="club-link" href={club.website_url} target="_blank" rel="noopener noreferrer">Website</a>
                {/if}
                {#if club.discord_url}
                    <a class="club-link" href={club.discord_url} target="_blank" rel="noopener noreferrer">Discord</a>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .club-hero {
        display: flex;
        align-items: center;
        gap: 1.4rem;
        margin-bottom: 1.6rem;
    }

    .club-logo {
        flex: 0 0 auto;
        width: 88px;
        height: 88px;
        object-fit: contain;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        padding: 0.5rem;
    }

    .club-hero-text {
        min-width: 0;
    }

    .club-name {
        font-family: var(--font-display);
        font-size: clamp(1.6rem, 4vw, 2.3rem);
        font-weight: 700;
        color: var(--color-text-bright);
        letter-spacing: -0.01em;
        margin: 0 0 0.4rem;
    }

    .club-blurb {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 1rem;
        line-height: 1.5;
        max-width: 62ch;
    }

    .club-links {
        display: flex;
        gap: 0.6rem;
        margin-top: 0.7rem;
    }

    .club-link {
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.7px;
        color: var(--color-accent);
        text-decoration: none;
        border: 1px solid var(--color-accent-border);
        border-radius: var(--radius);
        padding: 0.35rem 0.7rem;
        transition: background 0.15s ease, border-color 0.15s ease;
    }

    .club-link:hover {
        background: var(--color-surface-hover);
        border-color: var(--color-accent);
    }

    @media (max-width: 560px) {
        .club-hero {
            flex-direction: column;
            align-items: flex-start;
            text-align: left;
        }
    }
</style>
