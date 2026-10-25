<!--
  The club's game nights as a grid of cards, one per system: the day in the
  system's colour, its logo, how often it runs, and the system's own Discord.
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

<div class="nights flow">
    {#each ordered as s (s.slug)}
        {@const logo = systemLogoUrl(s.legacy_system_name, systemsConfig)}
        <article class="night" style={`--accent: ${s.accent_color}`}>
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
    .nights {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 10px;
    }

    @media (max-width: 560px) {
        .nights { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    }

    .night {
        display: flex;
        flex-direction: column;
        background: #13161e;
        border: 1px solid #232733;
        border-top: 3px solid var(--accent);
        border-radius: 6px;
        overflow: hidden;
    }

    .photo { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }

    .body { display: flex; flex-direction: column; gap: 8px; padding: 12px; flex: 1; }

    .day { font-size: 0.85rem; font-weight: 700; color: var(--accent); }

    .logo { height: 28px; width: 100%; object-fit: contain; object-position: left center; }

    .name { font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-bright); }

    .cadence { font-size: 0.82rem; color: var(--color-text-dim); }

    .blurb {
        margin: 0;
        font-size: 0.85rem;
        color: var(--color-text-muted);
        display: -webkit-box;
        -webkit-line-clamp: 3;
        line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .discord {
        margin-top: auto;
        font-size: 0.82rem;
        font-weight: 600;
        color: #8b96ff;
        text-decoration: none;
    }

    .discord:hover { text-decoration: underline; }
</style>
