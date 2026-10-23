<!--
  Shared system-tile picker: a row of logo buttons, one per system, used to
  pick which system a page is showing. Previously duplicated near-verbatim
  across the home, pairings, players, and leagues pages (markup + ~30 lines
  of CSS each) — consolidated here.

  Callback-prop design (isActive/onSelect) so this works for both a
  single-select tab row (isActive: s => selected === s) and a multi-select
  toggle filter (isActive: s => activeSystems.includes(s)) without the
  component needing to know which mode a caller is in.
-->
<script lang="ts">
    import { fly } from 'svelte/transition';
    import { systemLogoUrl, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from './systemsConfig';

    /* Systems whose logo has 404'd this page load, so the tile shows the
       system's name instead of a broken-image glyph.

       Needed because a logo is not guaranteed to exist. A system authored in
       the platform admin UI has no committed /logos/<slug>.png, and until
       someone uploads one there is simply no artwork. The name is the correct
       thing to show then — it is what the tile is FOR, and it beats both a
       broken image and the previous behaviour, which was to quietly borrow The
       Old World's logo (see systemsConfig.unknownSystem). */
    let brokenLogos = $state<Record<string, boolean>>({});

    let {
        systems,
        systemsConfig = FALLBACK_SYSTEMS_CONFIG,
        isActive,
        onSelect,
    }: {
        /** Legacy system names (e.g. "The Old World") to render as tiles, in order. */
        systems: string[];
        systemsConfig?: SystemConfig[];
        isActive: (system: string) => boolean;
        onSelect: (system: string) => void;
    } = $props();
</script>

<div class="system-grid">
    {#each systems as s, i (s)}
        {@const logo = systemLogoUrl(s, systemsConfig)}
        <button
            type="button"
            class="system-card"
            class:active={isActive(s)}
            onclick={() => onSelect(s)}
            in:fly={{ y: 16, duration: 400, delay: Math.min(i, 6) * 70 }}
        >
            {#if logo && !brokenLogos[s]}
                <img src={logo} alt={s} onerror={() => (brokenLogos = { ...brokenLogos, [s]: true })} />
            {:else}
                <span class="system-name">{s}</span>
            {/if}
        </button>
    {/each}
</div>

<style>
    /* Same tile as NightPicker, so a system looks the same wherever it is
       picked: dark panel, gold edge and tint when chosen. */
    .system-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 8px;
        margin-bottom: 1rem;
    }

    @media (max-width: 560px) {
        .system-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    }

    .system-card {
        /* Custom properties so a caller can still override the look by
           setting these on a wrapping element. */
        background: var(--system-card-bg, var(--color-surface-dark));
        border: 1px solid var(--system-card-border, var(--color-steel-border));
        border-radius: var(--system-card-radius, var(--radius));
        min-height: 72px;
        padding: 10px 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: border-color 0.15s ease, background 0.15s ease;
    }

    .system-card:hover {
        border-color: var(--system-card-hover-border, var(--color-accent-border));
    }

    .system-card:active {
        transform: scale(0.98);
    }

    .system-card.active {
        border-color: var(--color-accent);
        background: rgba(201, 161, 74, 0.12);
    }

    .system-card:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
    }

    .system-card img {
        display: block;
        width: 100%;
        height: 34px;
        object-fit: contain;
    }

    @media (max-width: 560px) {
        .system-card { min-height: 60px; }
        .system-card img { height: 24px; }
    }

    .system-name {
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        font-size: 0.85rem;
        line-height: 1.15;
        color: var(--color-text-muted, #b9b6ae);
    }
</style>
