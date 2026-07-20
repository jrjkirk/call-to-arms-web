<script lang="ts">
    type HoursRow = { day: string; open: string | null; close: string | null; note?: string | null };

    let { openingHours }: { openingHours: HoursRow[] } = $props();

    const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const DAY_SHORT: Record<string, string> = {
        Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
        Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun'
    };

    const byDay = $derived(new Map(openingHours.map((r) => [r.day, r])));
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
</script>

{#if openingHours.length > 0}
    <div class="hours-grid">
        {#each DAY_ORDER as day}
            {@const row = byDay.get(day)}
            <div class="hours-cell" class:is-today={day === today} class:is-open={!!row}>
                <div class="hours-day">{DAY_SHORT[day]}</div>
                {#if row}
                    <div class="hours-time">{row.open}&ndash;{row.close}</div>
                    {#if row.note}<div class="hours-note">{row.note}</div>{/if}
                {:else}
                    <div class="hours-time hours-closed">Closed</div>
                {/if}
            </div>
        {/each}
    </div>
{:else}
    <div class="empty-state">Opening hours haven't been set yet.</div>
{/if}

<style>
    .hours-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.5rem;
    }

    .hours-cell {
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        padding: 0.6rem 0.4rem;
        text-align: center;
    }

    .hours-cell.is-open {
        border-color: var(--color-accent-border);
    }

    .hours-cell.is-today {
        background: var(--color-surface-hover);
        border-color: var(--color-accent);
    }

    .hours-day {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 700;
        color: var(--color-text-dim);
        margin-bottom: 0.3rem;
    }

    .is-today .hours-day { color: var(--color-accent); }

    .hours-time {
        font-size: 0.82rem;
        color: var(--color-text-base);
        font-variant-numeric: tabular-nums;
    }

    .hours-closed {
        color: var(--color-text-faint);
    }

    .hours-note {
        font-size: 0.68rem;
        color: var(--color-text-faint);
        margin-top: 0.15rem;
    }

    @media (max-width: 640px) {
        .hours-grid {
            grid-template-columns: repeat(4, 1fr);
        }
    }
</style>
