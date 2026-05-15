<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/state';

    let { data } = $props();

    let system = $state(data.system);
    let week = $state(data.week);

    const systems = ['The Old World', 'The Horus Heresy', 'Kill Team'];

    function applyFilters() {
        const params = new URLSearchParams({ system, week });
        goto(`/?${params}`, { invalidateAll: true });
    }
</script>

<h2 class="page-heading">Select a System</h2>

<div class="filter-row">
    <div class="field">
        <label class="field-label" for="system">System</label>
        <select id="system" class="field-select" bind:value={system} onchange={applyFilters}>
            {#each systems as s}
                <option value={s}>{s}</option>
            {/each}
        </select>
    </div>

    <div class="field">
        <label class="field-label" for="week">Week (DD/MM/YYYY)</label>
        <input id="week" class="field-input" type="text" bind:value={week} onblur={applyFilters} />
    </div>
</div>

<div class="stat-row">
    <div class="stat-card">
        <div class="stat-label">Signed Up</div>
        <div class="stat-value">{data.stats.signed_up}</div>
    </div>
    <div class="stat-card">
        <div class="stat-label">Newcomers</div>
        <div class="stat-value">{data.stats.newcomers}</div>
    </div>
    <div class="stat-card">
        <div class="stat-label">Veterans</div>
        <div class="stat-value">{data.stats.veterans}</div>
    </div>
</div>

<div class="placeholder card">
    <p class="placeholder-title">Signup form</p>
    <p class="placeholder-body">
        Sign-ups will move into a real form here once player login is enabled. For now the existing
        Streamlit signup at <a href="https://calltoarms.streamlit.app/" target="_blank" rel="noopener">calltoarms.streamlit.app</a>
        remains the source of truth.
    </p>
</div>

<style>
    .page-heading {
        font-size: 1.5rem;
        margin: 0 0 1rem;
    }

    .filter-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1rem;
    }

    @media (max-width: 600px) {
        .filter-row {
            grid-template-columns: 1fr;
        }
    }

    .placeholder {
        padding: 1.25rem 1.5rem;
        margin-top: 1rem;
    }

    .placeholder-title {
        margin: 0 0 0.4rem;
        color: var(--color-accent);
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        font-weight: 700;
    }

    .placeholder-body {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 0.95rem;
        line-height: 1.5;
    }

    .placeholder-body a {
        color: var(--color-accent);
        text-decoration: underline;
    }
</style>