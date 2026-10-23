<script lang="ts">
    type CalendarEntry = {
        type: 'session' | 'event';
        date: string; // YYYY-MM-DD
        title: string;
        description?: string | null;
        system_id: number | null;
        system_name: string | null;
        system_slug: string | null;
        accent_color: string;
        all_day: boolean;
        start_time: string | null;
        end_time: string | null;
    };

    // Coloured dots rather than "TOW"/"AOS" badges: on a phone the badges were
    // a few pixels tall and unreadable. The key under the grid names each
    // colour, and tapping a day still lists exactly what's on.
    const MAX_DOTS_PER_CELL = 4;

    let {
        month,
        entries,
        onMonthChange
    }: {
        month: string; // YYYY-MM
        entries: CalendarEntry[];
        onMonthChange: (nextMonth: string) => void;
    } = $props();

    const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    function shiftMonth(m: string, delta: number): string {
        const [y, mo] = m.split('-').map(Number);
        const d = new Date(y, mo - 1 + delta, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    const entriesByDate = $derived.by(() => {
        const map = new Map<string, CalendarEntry[]>();
        for (const e of entries) {
            const list = map.get(e.date) ?? [];
            list.push(e);
            map.set(e.date, list);
        }
        return map;
    });

    // Monday-first 6-week grid covering the visible month, padded with the
    // trailing/leading days of neighbouring months (shown dimmed).
    const weeks = $derived.by(() => {
        const [y, mo] = month.split('-').map(Number);
        const firstOfMonth = new Date(y, mo - 1, 1);
        const startOffset = (firstOfMonth.getDay() + 6) % 7; // Mon = 0
        const gridStart = new Date(y, mo - 1, 1 - startOffset);

        const days: { date: Date; iso: string; inMonth: boolean }[] = [];
        for (let i = 0; i < 42; i++) {
            const d = new Date(gridStart);
            d.setDate(gridStart.getDate() + i);
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            days.push({ date: d, iso, inMonth: d.getMonth() === mo - 1 });
        }
        const out: (typeof days)[] = [];
        for (let i = 0; i < 42; i += 7) out.push(days.slice(i, i + 7));
        return out;
    });

    const todayIso = new Date().toISOString().slice(0, 10);

    let expandedDay = $state<string | null>(null);

    /** One key entry per colour on show this month. */
    const legend = $derived.by(() => {
        const seen = new Map<string, string>();
        for (const e of entries) {
            const name = e.system_name ?? 'Club event';
            if (!seen.has(name)) seen.set(name, e.accent_color);
        }
        return [...seen].map(([name, colour]) => ({ name, colour }));
    });
</script>

<div class="calendar">
    <div class="calendar-nav">
        <button type="button" class="nav-arrow" onclick={() => onMonthChange(shiftMonth(month, -1))} aria-label="Previous month">&larr;</button>
        <div class="calendar-title">
            {MONTH_NAMES[Number(month.split('-')[1]) - 1]} {month.split('-')[0]}
        </div>
        <button type="button" class="nav-arrow" onclick={() => onMonthChange(shiftMonth(month, 1))} aria-label="Next month">&rarr;</button>
    </div>

    <div class="calendar-grid calendar-labels">
        {#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as label}
            <div class="day-label">{label}</div>
        {/each}
    </div>

    {#each weeks as week}
        <div class="calendar-grid">
            {#each week as day}
                {@const dayEntries = entriesByDate.get(day.iso) ?? []}
                <button
                    type="button"
                    class="day-cell"
                    class:dimmed={!day.inMonth}
                    class:is-today={day.iso === todayIso}
                    class:is-selected={day.iso === expandedDay}
                    onclick={() => (expandedDay = expandedDay === day.iso ? null : day.iso)}
                    aria-pressed={day.iso === expandedDay}
                >
                    <span class="day-num">{day.date.getDate()}</span>
                    {#if dayEntries.length > 0}
                        <span class="day-dots" aria-label={dayEntries.map((e) => e.system_name ?? e.title).join(', ')}>
                            {#each dayEntries.slice(0, MAX_DOTS_PER_CELL) as e}
                                <span class="day-dot" style={`background: ${e.accent_color}`}></span>
                            {/each}
                            {#if dayEntries.length > MAX_DOTS_PER_CELL}
                                <span class="day-label-more">+{dayEntries.length - MAX_DOTS_PER_CELL}</span>
                            {/if}
                        </span>
                    {/if}
                </button>
            {/each}
        </div>
    {/each}

    {#if legend.length}
        <div class="legend">
            {#each legend as l}
                <span class="legend-item"><span class="day-dot" style={`background: ${l.colour}`}></span>{l.name}</span>
            {/each}
        </div>
    {/if}

    {#if expandedDay && (entriesByDate.get(expandedDay)?.length ?? 0) > 0}
        <div class="day-detail fade-in">
            <div class="day-detail-heading">
                {new Date(expandedDay).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            {#each entriesByDate.get(expandedDay) ?? [] as e}
                <div class="detail-row" style={`--row-accent: ${e.accent_color}`}>
                    <span class="detail-marker"></span>
                    <div class="detail-body">
                        <div class="detail-title">{e.title}</div>
                        {#if e.type === 'event' && !e.all_day && (e.start_time || e.end_time)}
                            <!-- Sessions already carry their start time in the title
                                 (e.g. "The Old World session 18:30"); only one-off
                                 events need this separate time line. -->
                            <div class="detail-time">{e.start_time ?? ''}{e.end_time ? `–${e.end_time}` : ''}</div>
                        {/if}
                        {#if e.description}
                            <div class="detail-desc">{e.description}</div>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .calendar-nav {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1.1rem;
        margin-bottom: 0.7rem;
    }

    .calendar-title {
        font-family: var(--font-heading);
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--color-text-bright);
        min-width: 160px;
        text-align: center;
    }

    .nav-arrow {
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        color: var(--color-text-muted);
        width: 30px;
        height: 30px;
        cursor: pointer;
        font-size: 0.9rem;
        transition: border-color 0.15s ease, color 0.15s ease;
    }

    .nav-arrow:hover {
        border-color: var(--color-accent);
        color: var(--color-accent);
    }

    .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 0.3rem;
        margin-bottom: 0.3rem;
    }

    .day-label {
        text-align: center;
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.9px;
        color: var(--color-text-faint);
        padding-bottom: 0.2rem;
    }

    .day-cell {
        min-height: 62px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        gap: 0.22rem;
        padding: 0.3rem 0.15rem 0.35rem;
        background: #0f1218;
        border: 1px solid #1c2029;
        border-radius: 4px;
        color: var(--color-text-base);
        cursor: pointer;
        font-family: inherit;
        transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    }

    .day-cell:hover {
        border-color: var(--color-steel);
    }

    .day-cell.dimmed {
        color: var(--color-text-faint);
        opacity: 0.4;
    }

    /* Today: a quiet marker on the date itself — reserved so the selected
       state below reads as the stronger, more deliberate highlight. */
    .day-cell.is-today .day-num {
        color: var(--color-accent);
        font-weight: 700;
    }

    /* Selected: the cell the visitor actually clicked, driving the detail
       panel underneath — needs to read clearly at a glance, distinct from
       "today". */
    .day-cell.is-selected {
        background: var(--color-surface-hover);
        border-color: var(--color-accent-bright);
        box-shadow: 0 0 0 1px var(--color-accent-bright);
    }

    .day-num {
        font-size: 0.82rem;
        font-variant-numeric: tabular-nums;
    }

    .day-dots {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 3px;
    }

    .day-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex: none;
    }

    .legend {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px 16px;
    }

    .legend-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        color: var(--color-text-dim);
    }

    .legend-item .day-dot { width: 9px; height: 9px; }

    .day-label-more {
        color: var(--color-text-faint);
        font-size: 0.58rem;
        font-weight: 700;
        padding: 0.14rem 0.2rem;
    }

    .day-detail {
        margin-top: 0.9rem;
        padding: 0.9rem 1rem;
        background: var(--color-surface-dark);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
    }

    .day-detail-heading {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.9px;
        color: var(--color-text-dim);
        margin-bottom: 0.6rem;
    }

    .detail-row {
        display: flex;
        gap: 0.6rem;
        padding: 0.4rem 0;
        border-top: 1px solid var(--color-steel-border-soft);
    }

    .detail-row:first-of-type {
        border-top: none;
    }

    .detail-marker {
        flex: 0 0 auto;
        width: 3px;
        border-radius: 2px;
        background: var(--row-accent, var(--color-accent));
    }

    .detail-title {
        font-weight: 700;
        color: var(--color-text-bright);
        font-size: 0.92rem;
    }

    .detail-time {
        font-size: 0.78rem;
        color: var(--color-text-dim);
        font-variant-numeric: tabular-nums;
    }

    .detail-desc {
        font-size: 0.85rem;
        color: var(--color-text-muted);
        margin-top: 0.15rem;
    }

    @media (max-width: 560px) {
        .day-cell { min-height: 52px; padding: 0.24rem 0.1rem 0.28rem; }
        .day-num { font-size: 0.72rem; }
        .day-label { font-size: 0.6rem; }
    }
</style>
