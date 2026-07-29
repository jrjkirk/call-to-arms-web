<script lang="ts">
    // Renders a system's faction <option>s inside a parent <select> — grouped
    // into <optgroup>s when the system defines groups (Middle Earth's Good/Evil),
    // otherwise a flat list. The parent keeps its own "— None —" option.
    import { factionGroupsFor, configFor, type SystemConfig } from './systemsConfig';

    let { systemsConfig, system }: { systemsConfig: SystemConfig[]; system: string } = $props();

    const groups = $derived(factionGroupsFor(systemsConfig, system));
    const flat = $derived(configFor(systemsConfig, system).faction_list);
</script>

{#if groups}
    {#each groups as g}
        <optgroup label={g.label}>
            {#each g.factions as f}
                <option value={f}>{f}</option>
            {/each}
        </optgroup>
    {/each}
{:else}
    {#each flat as f}
        <option value={f}>{f}</option>
    {/each}
{/if}
