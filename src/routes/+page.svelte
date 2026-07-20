<script lang="ts">
    import { onMount } from 'svelte';
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { PUBLIC_API_URL } from '$env/static/public';
    import ClubHero from '$lib/ClubHero.svelte';
    import SystemsCarousel from '$lib/SystemsCarousel.svelte';
    import OpeningHours from '$lib/OpeningHours.svelte';
    import ClubCalendar from '$lib/ClubCalendar.svelte';
    import ClubLocationMap from '$lib/ClubLocationMap.svelte';

    type ClubData = {
        club: {
            name: string;
            blurb: string | null;
            logo_url: string | null;
            website_url: string | null;
            discord_url: string | null;
            opening_hours: { day: string; open: string; close: string; note?: string | null }[];
            address: string | null;
            latitude: number | null;
            longitude: number | null;
        };
        systems: {
            slug: string;
            name: string;
            legacy_system_name: string;
            session_day: string;
            session_cadence: string;
            blurb: string | null;
            photo_url: string | null;
            accent_color: string;
        }[];
        calendar: { month: string; entries: any[] };
    };

    function currentMonth(): string {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }

    function shuffled<T>(items: T[]): T[] {
        const out = [...items];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    let data = $state<ClubData | null>(null);
    let loading = $state(true);
    let error = $state(false);
    let month = $state(currentMonth());

    // Carousel order isn't admin-configurable — every system gets an equal
    // shot at the front. Shuffled once per page load (not on every re-fetch,
    // e.g. changing the calendar month), so the carousel doesn't visibly
    // reshuffle itself under a visitor mid-visit.
    let systemOrder = $state<string[] | null>(null);

    async function load(m: string) {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/club?month=${m}`, { credentials: 'include' });
            if (!r.ok) throw new Error(`GET /club failed: ${r.status}`);
            const json: ClubData = await r.json();
            if (systemOrder === null) {
                systemOrder = shuffled(json.systems.map((s) => s.slug));
            }
            const order = systemOrder;
            const orderIndex = new Map(order.map((slug, i) => [slug, i]));
            json.systems.sort(
                (a, b) => (orderIndex.get(a.slug) ?? order.length) - (orderIndex.get(b.slug) ?? order.length)
            );
            data = json;
            error = false;
        } catch (_) {
            error = true;
        } finally {
            loading = false;
        }
    }

    onMount(() => load(month));

    function changeMonth(next: string) {
        month = next;
        load(next);
    }
</script>

<svelte:head>
    <title>Club — Call to Arms</title>
</svelte:head>

{#if loading}
    <div class="loading-state"></div>
{:else if error || !data}
    <div class="empty-state">Couldn't load the club page right now. Try refreshing.</div>
{:else}
    <div class="page-reveal" in:fly={{ y: 24, duration: 550, easing: cubicOut }}>
        <ClubHero club={data.club} />

        <div class="section-title">Systems</div>
        <SystemsCarousel systems={data.systems} />

        <div class="section-title">Opening Hours</div>
        <OpeningHours openingHours={data.club.opening_hours} />

        {#if data.club.address || (data.club.latitude != null && data.club.longitude != null)}
            <div class="section-title">Location</div>
            <div class="card location-card">
                {#if data.club.address}
                    <p class="location-address">{data.club.address}</p>
                {/if}
                {#if data.club.latitude != null && data.club.longitude != null}
                    <ClubLocationMap latitude={data.club.latitude} longitude={data.club.longitude} label={data.club.name} />
                {/if}
                <a
                    class="directions-link"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        data.club.latitude != null && data.club.longitude != null
                            ? `${data.club.latitude},${data.club.longitude}`
                            : data.club.address ?? ''
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                >Get directions ↗</a>
            </div>
        {/if}

        <div class="section-title">Calendar</div>
        <div class="card calendar-card">
            <ClubCalendar month={data.calendar.month} entries={data.calendar.entries} onMonthChange={changeMonth} />
        </div>
    </div>
{/if}

<style>
    .loading-state {
        min-height: 40vh;
    }

    .calendar-card {
        padding: 1.1rem 1rem 1.3rem;
    }

    .location-card {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
    }

    .location-address {
        margin: 0;
        color: var(--color-text-muted);
        font-size: 0.92rem;
    }

    .directions-link {
        align-self: flex-start;
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.7px;
        color: var(--color-accent);
        text-decoration: none;
        border: 1px solid var(--color-accent-border);
        border-radius: var(--radius);
        padding: 0.35rem 0.7rem;
        transition: background 0.15s ease, border-color 0.15s ease;
    }

    .directions-link:hover {
        background: var(--color-surface-hover);
        border-color: var(--color-accent);
    }

    .page-reveal {
        display: flex;
        flex-direction: column;
    }
</style>
