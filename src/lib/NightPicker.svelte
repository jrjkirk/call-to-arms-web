<!--
  The club's nights as a grid of tiles: the day in that system's colour, the
  system's logo under it. Used by the signup and pairings pages in place of
  SystemPicker wherever GET /home has answered (a signed-in member), because a
  night is what a player picks, and the day is the thing they plan around.

  A grid, never a sideways-scrolling row: a scrollbar under the tiles was the
  first thing anyone noticed on the old signup page.
-->
<script lang="ts">
    import { systemLogoUrl, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from './systemsConfig';
    import { shortDay, type HomeNight } from './home/api';

    let {
        nights,
        systemsConfig = FALLBACK_SYSTEMS_CONFIG,
        active,
        onSelect,
        label = 'Night'
    }: {
        nights: HomeNight[];
        systemsConfig?: SystemConfig[];
        active: string;
        onSelect: (system: string) => void;
        label?: string;
    } = $props();

    let brokenLogos = $state<Record<string, boolean>>({});
</script>

<div class="night-grid" role="group" aria-label={label}>
    {#each nights as n (n.system)}
        {@const logo = n.logo_url || systemLogoUrl(n.system, systemsConfig)}
        <button
            type="button"
            class="night-tile"
            aria-pressed={active === n.system}
            onclick={() => onSelect(n.system)}
        >
            <span class="night-day" style={`color: ${n.accent_color}`}>{shortDay(n.date)}</span>
            {#if logo && !brokenLogos[n.system]}
                <img src={logo} alt={n.name} onerror={() => (brokenLogos = { ...brokenLogos, [n.system]: true })} />
            {:else}
                <span class="night-name">{n.name}</span>
            {/if}
            {#if n.mine}
                <span class="night-mine">You're in</span>
            {/if}
        </button>
    {/each}
</div>

<style>
    .night-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 8px;
        margin-bottom: 1rem;
    }

    @media (max-width: 560px) {
        .night-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    }

    .night-tile {
        position: relative;
        min-height: 84px;
        padding: 10px 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-muted);
        font: inherit;
        cursor: pointer;
        transition: border-color 0.15s ease, background 0.15s ease;
    }

    .night-tile:hover { border-color: var(--color-accent-border); }

    .night-tile[aria-pressed='true'] {
        border-color: var(--color-accent);
        background: rgba(201, 161, 74, 0.12);
    }

    .night-tile:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
    }

    .night-day {
        font-size: 0.85rem;
        font-weight: 600;
        line-height: 1;
    }

    .night-tile img {
        display: block;
        height: 28px;
        width: 100%;
        object-fit: contain;
    }

    @media (max-width: 560px) {
        .night-tile { min-height: 76px; }
        .night-tile img { height: 22px; }
        .night-day { font-size: 0.78rem; }
    }

    .night-name {
        font-weight: 600;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        text-align: center;
        line-height: 1.15;
    }

    .night-mine {
        position: absolute;
        top: 4px;
        right: 6px;
        font-size: 0.65rem;
        font-weight: 700;
        color: var(--color-win);
    }

    @media (max-width: 560px) {
        /* No room for words on a third-of-a-phone tile: a dot says it. */
        .night-mine {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--color-win);
            font-size: 0;
        }
    }
</style>
