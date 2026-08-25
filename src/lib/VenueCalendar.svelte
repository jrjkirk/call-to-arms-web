<script lang="ts">
    import { PUBLIC_API_URL } from '$env/static/public';

    // `version` is bumped by the parent whenever anything changes a day —
    // an event created, a booking confirmed. Without it the month kept showing
    // the state it loaded with: add an event and its star never appeared,
    // because nothing here had any reason to look again.
    let { selected, onpick, version = 0 }:
        { selected: string; onpick: (iso: string) => void; version?: number } = $props();

    type Day = {
        date: string; weekday: string; tables_total: number; tables_committed: number;
        load: number | null; over_capacity: boolean; outgrown: boolean;
        bookings: number; events: number;
        club_nights: { system: string; accent_color: string | null }[];
    };

    const now = new Date();
    let month = $state(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    let days = $state<Day[]>([]);
    let padding = $state(0);
    let loading = $state(true);

    async function load() {
        loading = true;
        const r = await fetch(`${PUBLIC_API_URL}/venue/admin/calendar?month=${month}`, {
            credentials: 'include'
        });
        if (r.ok) {
            const body = await r.json();
            days = body.days;
            padding = body.first_weekday;
        }
        loading = false;
    }

    $effect(() => { month; version; load(); });

    function shift(by: number) {
        const [y, m] = month.split('-').map(Number);
        const d = new Date(y, m - 1 + by, 1);
        month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    const label = $derived(
        new Date(month + '-01T00:00:00').toLocaleDateString('en-GB', {
            month: 'long', year: 'numeric'
        })
    );
    const todayIso = new Date().toISOString().slice(0, 10);
    const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
</script>

<div class="cal-head">
    <button class="secondary-button" type="button" onclick={() => shift(-1)}>←</button>
    <span class="cal-month">{label}</span>
    <button class="secondary-button" type="button" onclick={() => shift(1)}>→</button>
</div>

{#if loading}
    <p class="a-note">Loading…</p>
{:else}
    <div class="cal-grid">
        {#each DOW as d}<div class="cal-dow">{d}</div>{/each}
        {#each Array(padding) as _}<div class="cal-pad"></div>{/each}
        {#each days as d (d.date)}
            <button
                class="cal-day"
                class:selected={d.date === selected}
                class:today={d.date === todayIso}
                class:over={d.over_capacity}
                onclick={() => onpick(d.date)}
            >
                <span class="cal-num">{Number(d.date.slice(8))}</span>
                <span class="cal-bar">
                    <span class="cal-fill" style="width: {Math.min(100, Math.round((d.load ?? 0) * 100))}%"></span>
                </span>
                <span class="cal-marks">
                    {#each d.club_nights as n}
                        <span class="cal-dot" style="--dot: {n.accent_color ?? 'var(--color-accent)'}"
                              title={n.system}></span>
                    {/each}
                    {#if d.events}<span class="cal-ev" title="{d.events} event(s)">★</span>{/if}
                    {#if d.bookings}<span class="cal-count">{d.bookings}</span>{/if}
                </span>
            </button>
        {/each}
    </div>
    <p class="a-note cal-key">
        Bar shows how full the day is · dot per club night · ★ event · number is bookings
    </p>
{/if}

<style>
    .cal-head {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-bottom: 0.7rem;
    }
    .cal-month {
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--color-text-bright);
        min-width: 10rem;
    }

    .cal-grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.3rem;
    }

    .cal-dow {
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-faint);
        text-align: center;
        padding-bottom: 0.2rem;
    }

    .cal-pad { min-height: 1px; }

    .cal-day {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.25rem;
        min-height: 3.6rem;
        padding: 0.35rem 0.4rem;
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        background: rgba(0, 0, 0, 0.2);
        font-family: inherit;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
    }
    .cal-day:hover { border-color: var(--color-accent-border); }
    .cal-day.selected {
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 15%, transparent);
    }
    .cal-day.today .cal-num { color: var(--color-accent); }
    .cal-day.over { border-color: var(--color-loss); }

    .cal-num {
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--color-text-bright);
        text-align: left;
    }

    .cal-bar {
        height: 3px;
        border-radius: 2px;
        background: rgba(255, 255, 255, 0.08);
        overflow: hidden;
    }
    .cal-fill { display: block; height: 100%; background: var(--color-accent); }
    .cal-day.over .cal-fill { background: var(--color-loss); }

    .cal-marks {
        display: flex;
        align-items: center;
        gap: 0.2rem;
        flex-wrap: wrap;
        margin-top: auto;
    }
    .cal-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--dot);
    }
    .cal-ev { font-size: 0.6rem; color: var(--color-accent); line-height: 1; }
    .cal-count {
        margin-left: auto;
        font-size: 0.62rem;
        color: var(--color-text-muted);
    }

    .cal-key { margin-top: 0.6rem; font-size: 0.72rem; }
</style>
