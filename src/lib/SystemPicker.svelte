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
        <button
            type="button"
            class="system-card"
            class:active={isActive(s)}
            onclick={() => onSelect(s)}
            in:fly={{ y: 16, duration: 400, delay: Math.min(i, 6) * 70 }}
        >
            <img src={systemLogoUrl(s, systemsConfig)} alt={s} />
        </button>
    {/each}
</div>

<style>
    .system-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .system-card {
        /* Custom properties so a caller can override the look (e.g.
           pairings/+page.svelte's slightly different card style) by setting
           these on a wrapping element, without duplicating the whole
           component. Defaults match the majority (home/players/leagues). */
        background: var(--system-card-bg, var(--color-surface-dark));
        border: 2px solid var(--system-card-border, var(--color-steel-border-soft));
        border-radius: var(--system-card-radius, var(--radius));
        padding: 0.75rem 0.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: border-color 0.15s ease, transform 0.08s ease;
    }

    .system-card:hover {
        border-color: var(--system-card-hover-border, var(--color-accent-border));
    }

    .system-card:active {
        transform: scale(0.98);
    }

    .system-card.active {
        border-color: var(--color-accent);
    }

    .system-card img {
        max-width: 100%;
        max-height: 60px;
        object-fit: contain;
    }
</style>
