<script lang="ts">
    import { onMount } from 'svelte';
    import { fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { PUBLIC_API_URL } from '$env/static/public';
    import ClubHero from '$lib/ClubHero.svelte';
    import SystemsCarousel from '$lib/SystemsCarousel.svelte';
    import OpeningHours from '$lib/OpeningHours.svelte';
    import ClubCalendar from '$lib/ClubCalendar.svelte';

    type ClubData = {
        club: {
            name: string;
            blurb: string | null;
            logo_url: string | null;
            website_url: string | null;
            discord_url: string | null;
            opening_hours: { day: string; open: string; close: string; note?: string | null }[];
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

    let data = $state<ClubData | null>(null);
    let loading = $state(true);
    let error = $state(false);
    let month = $state(currentMonth());

    async function load(m: string) {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/club?month=${m}`, { credentials: 'include' });
            if (!r.ok) throw new Error(`GET /club failed: ${r.status}`);
            data = await r.json();
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

    .page-reveal {
        display: flex;
        flex-direction: column;
    }
</style>
