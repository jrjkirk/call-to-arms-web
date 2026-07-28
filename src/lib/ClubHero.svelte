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
    <div class="club-hero-top">
        {#if club.logo_url}
            <img class="club-logo" src={club.logo_url} alt={`${club.name} logo`} />
        {/if}
        <h1 class="club-name">{club.name}</h1>
    </div>
    {#if club.blurb}
        <p class="club-blurb">{club.blurb}</p>
    {/if}
    {#if club.discord_url}
        <a class="discord-cta" href={club.discord_url} target="_blank" rel="noopener noreferrer">
            <svg class="discord-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.369a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            Join our Discord
        </a>
    {/if}
    {#if club.website_url}
        <div class="club-links">
            <a class="club-link" href={club.website_url} target="_blank" rel="noopener noreferrer">Visit website</a>
        </div>
    {/if}
</div>

<style>
    .club-hero {
        margin-bottom: 1.6rem;
    }

    /* Logo + name stay inline together at every width — only the blurb and
       links reflow to full-width below, rather than the whole block
       collapsing to a single stacked column on mobile. */
    .club-hero-top {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 0.9rem;
    }

    .club-logo {
        flex: 0 0 auto;
        width: 64px;
        height: 64px;
        object-fit: contain;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        padding: 0.4rem;
    }

    .club-name {
        font-family: var(--font-display);
        font-size: clamp(1.6rem, 4vw, 2.3rem);
        font-weight: 700;
        color: var(--color-text-bright);
        letter-spacing: -0.01em;
        margin: 0;
    }

    .club-blurb {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 1rem;
        line-height: 1.5;
    }

    /* Discord is the hub of every club's activity, so its invite is the primary
       call to action — full Discord "blurple", front and centre. */
    .discord-cta {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        margin-top: 1.1rem;
        padding: 0.65rem 1.3rem;
        background: #5865f2;
        color: #fff;
        font-size: 1rem;
        font-weight: 700;
        border-radius: var(--radius);
        text-decoration: none;
        box-shadow: 0 4px 16px rgba(88, 101, 242, 0.35);
        transition: background 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease;
    }

    .discord-cta:hover {
        background: #4752c4;
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(88, 101, 242, 0.45);
    }

    .discord-icon {
        width: 22px;
        height: 22px;
        flex: 0 0 auto;
    }

    /* Website is secondary — a quiet text link under the Discord button. */
    .club-links {
        display: flex;
        gap: 0.6rem;
        margin-top: 0.7rem;
    }

    .club-link {
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--color-text-dim);
        text-decoration: none;
        transition: color 0.15s ease;
    }

    .club-link:hover {
        color: var(--color-accent);
    }

    .club-link:hover {
        background: var(--color-surface-hover);
        border-color: var(--color-accent);
    }

    @media (min-width: 561px) {
        .club-logo {
            width: 88px;
            height: 88px;
            padding: 0.5rem;
        }
    }
</style>
