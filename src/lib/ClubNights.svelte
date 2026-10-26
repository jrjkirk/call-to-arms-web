<!--
  The club's game nights, one wide card per system: its photo, the day in
  the system's colour, its logo, how often it runs, its blurb in full (capped
  at 250 characters when it's written) and the system's own Discord.
  Replaces the one-at-a-time carousel, which hid five of six nights behind
  arrows. The blurb and photo a system admin sets for the carousel still show
  here, when they've set them.
-->
<script lang="ts">
    import { systemLogoUrl, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from './systemsConfig';

    type Night = {
        slug: string;
        name: string;
        legacy_system_name: string;
        session_day: string;
        session_cadence: string;
        blurb: string | null;
        photo_url: string | null;
        accent_color: string;
        discord_url: string | null;
    };

    let { systems, systemsConfig = FALLBACK_SYSTEMS_CONFIG }: { systems: Night[]; systemsConfig?: SystemConfig[] } = $props();

    const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    // In the week's order, so the grid reads like the club's week.
    const ordered = $derived(
        [...systems].sort((a, b) => DAY_ORDER.indexOf(a.session_day) - DAY_ORDER.indexOf(b.session_day) || a.name.localeCompare(b.name))
    );

    function cadence(c: string): string {
        if (c === 'fortnightly') return 'Every other week';
        if (c === 'monthly') return 'Once a month';
        return 'Every week';
    }

    let brokenLogos = $state<Record<string, boolean>>({});
</script>

<div class="nights">
    {#each ordered as s (s.slug)}
        {@const logo = systemLogoUrl(s.legacy_system_name, systemsConfig)}
        <article class="night" class:no-photo={!s.photo_url} style={`--accent: ${s.accent_color}`}>
            {#if s.photo_url}
                <img class="photo" src={s.photo_url} alt="" loading="lazy" />
            {/if}
            <div class="body">
                <span class="day">{s.session_day}s</span>
                {#if logo && !brokenLogos[s.slug]}
                    <img class="logo" src={logo} alt={s.name} onerror={() => (brokenLogos = { ...brokenLogos, [s.slug]: true })} />
                {:else}
                    <span class="name">{s.name}</span>
                {/if}
                <span class="cadence">{cadence(s.session_cadence)}</span>
                {#if s.blurb}<p class="blurb">{s.blurb}</p>{/if}
                {#if s.discord_url}
                    <a class="discord" href={s.discord_url} target="_blank" rel="noopener noreferrer">{s.name} Discord ›</a>
                {/if}
            </div>
        </article>
    {/each}
</div>

<style>
    /* One wide card per night (2026-10-26): the small grid squares cut the
       blurb off and shrank the photo to a thumbnail. Photo left and text
       right where there's room, photo on top on a phone. */
    .nights {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .night {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 6px;
        overflow: hidden;
    }
    .night.no-photo { grid-template-columns: minmax(0, 1fr); }

    .photo { display: block; width: 100%; height: 100%; min-height: 11rem; object-fit: cover; }

    /* The system's colour is a standalone bar beside the text (design rule 1). */
    .body { position: relative; display: flex; flex-direction: column; gap: 8px; padding: 16px 18px 16px 34px; }
    .body::before {
        content: '';
        position: absolute;
        left: 16px;
        top: 16px;
        bottom: 16px;
        width: 4px;
        border-radius: 2px;
        background: var(--accent);
    }

    .day {
        font-family: var(--font-heading);
        font-size: 1.1rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
    }

    .logo { height: 34px; width: 100%; max-width: 15rem; object-fit: contain; object-position: left center; }

    .name {
        font-family: var(--font-heading);
        font-size: 1.2rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-bright);
    }

    .cadence { font-size: 0.9rem; font-weight: 600; color: var(--color-text-dim); }

    .blurb { margin: 2px 0 0; font-size: 0.95rem; line-height: 1.5; color: var(--color-text-muted); }

    .discord {
        margin-top: auto;
        padding-top: 4px;
        font-family: var(--font-heading);
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-accent);
        text-decoration: none;
    }

    .discord:hover { color: var(--color-accent-bright); }

    @media (max-width: 640px) {
        .night { grid-template-columns: minmax(0, 1fr); }
        .photo { height: auto; min-height: 0; aspect-ratio: 16 / 9; }
    }
</style>
