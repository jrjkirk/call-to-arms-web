<script lang="ts">
    /**
     * discord_url is read here again, deliberately reversing an earlier call.
     *
     * It was pulled out because a club's game nights can each run out of a
     * DIFFERENT Discord server (at EGNWGC, Kill Team and The Old World are
     * separate), so one club-level button sent Kill Team players to whichever
     * server happened to be saved on the club. That reasoning still holds for
     * the PER-SYSTEM invite, which is why the carousel cards keep their own
     * Discord links and nothing here replaces them.
     *
     * What changed is that a venue now has a club-wide server of its own worth
     * linking — the front door beside Book a table, for someone who has just
     * found the place and wants to talk to somebody. That's a different link
     * doing a different job, set under Venue Admin → Settings → Venue.
     */
    type ClubProfile = {
        name: string;
        blurb: string | null;
        logo_url: string | null;
        website_url: string | null;
        discord_url?: string | null;
    };

    import { PUBLIC_API_URL } from '$env/static/public';

    let { club, venueEnabled = false, signedIn = true }: {
        club: ClubProfile;
        venueEnabled?: boolean;
        /** Defaults to true so nothing flashes before /auth/me answers. */
        signedIn?: boolean;
    } = $props();
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
    {#if club.website_url || venueEnabled || club.discord_url || !signedIn}
        <div class="club-actions">
            <!-- Leads the row when it's there. Booking a table needs no account
                 and playing in a club night does, and that difference is not
                 something a visitor can infer from the other buttons. -->
            {#if !signedIn}
                <a class="club-btn signin-btn" href={`${PUBLIC_API_URL}/auth/discord/login`}>Sign in to Play</a>
            {/if}
            {#if club.discord_url}
                <a class="club-btn discord-btn" href={club.discord_url} target="_blank" rel="noopener noreferrer">Join our Discord</a>
            {/if}
            {#if venueEnabled}
                <a class="club-btn book-btn" href="/book">Book a Table</a>
            {/if}
            {#if club.website_url}
                <a class="club-btn website-btn" href={club.website_url} target="_blank" rel="noopener noreferrer">Visit our Website</a>
            {/if}
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

    .club-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
        margin-top: 1.1rem;
    }

    /* Box shape/size for the hero's action buttons. Only the website button
       uses it now that Discord moved to the carousel, but it stays split from
       .website-btn so a second hero action doesn't have to re-derive it. */
    .club-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.65rem 1.3rem;
        font-size: 1rem;
        font-weight: 700;
        border: 1px solid transparent;
        border-radius: var(--radius);
        text-decoration: none;
        transition: background 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    }

    /* Discord in Blurple, so it reads as Discord at a glance rather than as a
       third variant of our own palette. Quieter than Book a table, which is
       the action a venue is paying for. */
    .discord-btn {
        background: #5865f2;
        color: #fff;
        border-color: #5865f2;
    }

    .discord-btn:hover {
        background: #4752c4;
        transform: translateY(-1px);
    }

    /* SystemsCarousel keeps its own .slide-discord for the PER-SYSTEM invites,
       deliberately quieter since there's one per card. */

    /* Book a table is the one action a venue is paying for, so it's the
       accented one and it leads. Website stays neutral beside it. */
    /* Gold is reserved for signing in, here and everywhere else, so one colour
       means one thing across the app. */
    .signin-btn {
        background: var(--color-accent);
        color: #1b1206;
        border-color: var(--color-accent);
    }

    .signin-btn:hover {
        background: var(--color-accent-soft);
        transform: translateY(-1px);
    }

    /* Cream, a shade down from --color-text-bright so it sits on the dark page
       without glaring. Distinct from the gold beside it at a glance. */
    .book-btn {
        background: #ded3b6;
        color: #241b09;
        border-color: #ded3b6;
    }

    .book-btn:hover {
        background: #ece3cb;
        transform: translateY(-1px);
    }

    /* Website is the same box, but neutral — not highlighted or coloured. */
    .website-btn {
        background: var(--color-surface-dark);
        color: var(--color-text-base);
        border-color: var(--color-steel-border);
        font-weight: 600;
    }

    .website-btn:hover {
        background: var(--color-surface);
        border-color: var(--color-steel);
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
