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
    <!-- A list, today in gold: the seven-tile grid squeezed "11:00–23:00"
         onto two lines on a phone. -->
    <ul class="hours">
        {#each DAY_ORDER as day}
            {@const row = byDay.get(day)}
            <li class:is-today={day === today}>
                <span class="day">{day}{#if day === today}<small> · today</small>{/if}</span>
                {#if row}
                    <span class="time">{row.open}–{row.close}{#if row.note}<small> · {row.note}</small>{/if}</span>
                {:else}
                    <span class="time closed">Closed</span>
                {/if}
            </li>
        {/each}
    </ul>
{:else}
    <div class="empty-state">Opening hours haven't been set yet.</div>
{/if}

<style>
    .hours { list-style: none; margin: 0; padding: 0; }

    li {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 0;
        border-bottom: 1px solid #1c2029;
        color: var(--color-text-muted);
    }

    li:last-child { border-bottom: none; }

    .time { font-variant-numeric: tabular-nums; text-align: right; }
    .closed { color: var(--color-text-faint); }
    small { font-size: 0.8em; color: var(--color-text-dim); font-weight: 400; }

    li.is-today { color: var(--color-accent-bright); font-weight: 700; }
    li.is-today small { color: var(--color-accent); }
</style>
