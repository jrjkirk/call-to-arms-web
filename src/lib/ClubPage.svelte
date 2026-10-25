<!--
  A club's public page: hero, systems, hours, calendar, location. What a
  visitor sees at the club's address, and what a member reaches from the Club
  link now that their own address opens on "Your week".
-->
<script lang="ts">
    import { page } from '$app/state';
    import { setPageTitle } from './pageTitle';
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import { PUBLIC_API_URL } from '$env/static/public';
    import ClubHero from './ClubHero.svelte';
    import ClubNights from './ClubNights.svelte';
    import { getSystemsConfig, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from './systemsConfig';
    import { getClubSlugFromHostname } from './clubSlug';
    import OpeningHours from './OpeningHours.svelte';
    import ClubCalendar from './ClubCalendar.svelte';
    import ClubLocationMap from './ClubLocationMap.svelte';

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
            discord_url: string | null;
        }[];
        calendar: { month: string; entries: any[] };
    };

    // The hero's Book a table button only appears for a club that actually
    // sells table space, so every other club's page is unchanged.
    let venueEnabled = $state(false);
    // Whether the visitor is signed in, decided by the route that shows this
    // page: true hides the hero's "Sign in to Play" button.
    let { signedIn = true }: { signedIn?: boolean } = $props();
    onMount(async () => {
        try {
            const r = await fetch(`${PUBLIC_API_URL}/venue/info`, { credentials: 'include' });
            venueEnabled = r.ok ? (await r.json()).enabled === true : false;
        } catch (_) { venueEnabled = false; }
    });

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

    // The club's own name leads, because this page is public: it's what a
    // shared link and a search result show, and "Club" told a stranger nothing
    // about whose page they'd landed on. Announced to the layout rather than
    // set here — see $lib/pageTitle for why there is only one <title>.
    $effect(() => {
        setPageTitle(page.route.id, data?.club?.name ? `${data.club.name} · Call to Arms` : null);
    });

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

    // For the night cards' logos, which follow an uploaded logo when a
    // platform admin has set one.
    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);

    onMount(() => {
        load(month);
        getSystemsConfig(getClubSlugFromHostname(window.location.hostname)).then((c) => (systemsConfig = c));
    });

    function changeMonth(next: string) {
        month = next;
        load(next);
    }
</script>

<svelte:head>
    {#if data?.club?.blurb}
        <meta name="description" content={data.club.blurb} />
    {/if}
</svelte:head>

{#if loading}
    <div class="loading-state"></div>
{:else if error || !data}
    <div class="empty-state">Couldn't load the club page right now. Try refreshing.</div>
{:else}
    <div class="page-reveal" in:fade={{ duration: 140 }}>
        <div class="club-grid flow">
            <div class="hero"><ClubHero club={data.club} {venueEnabled} {signedIn} openingHours={data.club.opening_hours} /></div>

            <section class="panel hours">
                <h2 class="section-title">Opening hours</h2>
                <OpeningHours openingHours={data.club.opening_hours} />
            </section>

            {#if data.systems.length}
                <section class="nights">
                    <h2 class="section-title">Club nights</h2>
                    <ClubNights systems={data.systems} {systemsConfig} />
                </section>
            {/if}

            <section class="panel calendar">
                <ClubCalendar month={data.calendar.month} entries={data.calendar.entries} onMonthChange={changeMonth} />
            </section>

            {#if data.club.address || (data.club.latitude != null && data.club.longitude != null)}
                <section class="panel location">
                    <h2 class="section-title">Find us</h2>
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
                </section>
            {/if}
        </div>
    </div>
{/if}

<style>
    .loading-state {
        min-height: 40vh;
    }

    /* Desktop: the club and its hours side by side, every night in one row,
       the calendar beside the map. One column on a phone. */
    .club-grid {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 20px;
        align-items: start;
    }

    .hero { grid-column: span 8; }
    .hours { grid-column: span 4; }
    .nights { grid-column: span 12; }
    .calendar { grid-column: span 8; }
    .location { grid-column: span 4; }

    .hero :global(.club-hero) { height: 100%; box-sizing: border-box; }
    .hero, .hours { align-self: stretch; }

    .panel {
        padding: 18px 20px;
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 6px;
    }

    .panel .section-title, .nights .section-title { margin: 0 0 0.6rem; }

    .location {
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
    }

    @media (max-width: 900px) {
        .club-grid { gap: 16px; }
        .hero, .hours, .nights, .calendar, .location { grid-column: span 12; }
    }

    @media (max-width: 560px) {
        .panel { padding: 14px 16px; }
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
