<script lang="ts">
    // Barlow (text) and Barlow Condensed (headings), self-hosted: only the
    // weights the site uses, so nothing extra downloads. See --font-body and
    // --font-heading in app.css.
    import '@fontsource/barlow/400.css';
    import '@fontsource/barlow/500.css';
    import '@fontsource/barlow/600.css';
    import '@fontsource/barlow/700.css';
    import '@fontsource/barlow-condensed/600.css';
    import '@fontsource/barlow-condensed/700.css';
    import '../app.css';
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { navigating } from '$app/stores';
    import { afterNavigate, goto, onNavigate } from '$app/navigation';
    import { PUBLIC_API_URL } from '$env/static/public';
    import LandingHero from '$lib/LandingHero.svelte';
    import SignInPrompt from '$lib/SignInPrompt.svelte';
    import SiteBanner from '$lib/SiteBanner.svelte';
    import NoticeBanner from '$lib/NoticeBanner.svelte';
    import PushPrompt from '$lib/PushPrompt.svelte';
    import MeSheet from '$lib/MeSheet.svelte';
    import { fitPhoneTitles } from '$lib/fitTitle';
    import { clearSession, getMySystemRows, prime } from '$lib/session';
    import { fetchHome } from '$lib/home/api';
    import { getSystemsConfig, leagueSystems } from '$lib/systemsConfig';
    import { getClubSlugFromHostname, legacyRedirectHost } from '$lib/clubSlug';
    import { resolveTitle, titleOverride } from '$lib/pageTitle';
    import { loginHref, loginHrefTo } from '$lib/loginUrl';
    import { signInProviders, type SignInProvider } from '$lib/signInProviders';

    let { children } = $props();

    // The single source of the browser tab title. Derived from the route so
    // every page gets one, including any added later that never thinks about it.
    let documentTitle = $derived(resolveTitle(page.route.id, $titleOverride));

    type AuthState = {
        authenticated: boolean;
        sign_in_providers?: SignInProvider[];
        user?: { id: number; name: string; discord_name: string | null; avatar_url: string | null; player_id: number | null; club_id: number };
        player?: { id: number; name: string } | null;
        has_club?: boolean;
        active_club?: { id: number; slug: string; name: string } | null;
        claim_candidates?: Array<{ id: number; name: string; default_faction: string | null }>;
    };

    type AdminState = {
        is_super_admin: boolean;
        is_platform_admin: boolean;
        scopes: string[];
    };

    let auth = $state<AuthState>({ authenticated: false });
    // Only clubs that actually sell table space get the booking tab. Fetched
    // once here rather than per page: the club page and the booking form both
    // need the same answer, and a tab that 404s is worse than no tab.
    let venueTakesBookings = $state(false);
    let adminState = $state<AdminState | null>(null);
    let authLoaded = $state(false);
    let drawerOpen = $state(false);
    // Whether THIS club runs a league for at least one system (has_league,
    // per-club via a club-scoped systems fetch — not the platform-wide
    // catalogue default). Hidden by default (before it resolves and for
    // every club with no leagues at all) so the nav tab never flashes in.
    let hasAnyLeague = $state(false);
    let venueState = $state<{ can_admin_venue: boolean; enabled: boolean } | null>(null);

    async function refreshAuth() {
        try {
            const [authResp, adminResp, venueResp, infoResp] = await Promise.all([
                fetch(`${PUBLIC_API_URL}/auth/me`, { credentials: 'include' }),
                fetch(`${PUBLIC_API_URL}/admin/me`, { credentials: 'include' }),
                // Venue access is NOT a system scope — the bar manager holds no
                // game-system rights at all — so it can't be read off
                // /admin/me's scopes and needs its own always-200 check.
                fetch(`${PUBLIC_API_URL}/venue/admin/me`, { credentials: 'include' }),
                // Public, so this one answers for a signed-out visitor too —
                // which is exactly who the booking tab is for.
                fetch(`${PUBLIC_API_URL}/venue/info`, { credentials: 'include' }),
            ]);
            auth = authResp.ok ? await authResp.json() : { authenticated: false };
            signInProviders.set(auth.sign_in_providers ?? ['discord']);
            adminState = adminResp.ok ? await adminResp.json() : null;
            // Every page reads these through $lib/session: give them the
            // fresh answers, so a tab switch never waits on them again.
            prime('/auth/me', auth);
            prime('/admin/me', adminState);
            // Warm what most tabs open with, in the background, so whichever
            // tab is first doesn't wait for it.
            if (auth.authenticated) {
                getMySystemRows();
                fetchHome();
            }
            venueState = venueResp.ok ? await venueResp.json() : null;
            venueTakesBookings = infoResp.ok ? (await infoResp.json()).enabled === true : false;
        } catch (_) {
            auth = { authenticated: false };
            adminState = null;
            venueState = null;
            venueTakesBookings = false;
        } finally {
            authLoaded = true;
        }
    }

    // On the bare/default domain (calltoarms.app / www), a LOGGED-IN visitor is
    // sent to their home club's own subdomain (path preserved) so every session
    // has a real club context. Anonymous visitors stay on the bare domain and
    // get the marketing hero. Only the bare/www host triggers this — a real
    // subdomain never matches, so there's no redirect loop.
    function redirectBareToHomeClub() {
        if (typeof window === 'undefined') return;
        const host = window.location.hostname.toLowerCase();
        const isBare = host === 'calltoarms.app' || host === 'www.calltoarms.app';
        if (!isBare) return;
        if (auth.authenticated !== true) return;
        // A brand-new player with no club anywhere yet lands on the club finder
        // to choose one, rather than being dropped onto a default club. Only
        // intercept the bare root — leave other public bare routes (/find,
        // /pairings, /join, /privacy) alone.
        if (auth.has_club === false) {
            if (window.location.pathname === '/') goto('/find');
            return;
        }
        const slug = auth.active_club?.slug;
        if (slug) {
            window.location.replace(
                `https://${slug}.calltoarms.app${window.location.pathname}${window.location.search}`
            );
        }
    }

    onMount(() => {
        // We mounted cleanly, so clear the stale-chunk reload guard (see
        // hooks.client.ts) — a future deploy can then trigger its own one-shot
        // recovery reload.
        try { sessionStorage.removeItem('cta_reloaded_for_stale_chunk'); } catch (_) {}
        // Renamed-club subdomains (manchester -> egnwgc, yorkshire -> theoutpost):
        // bounce legacy links to the new host before anything club-scoped runs.
        const legacyHost = legacyRedirectHost(window.location.hostname);
        if (legacyHost) {
            window.location.replace(
                `https://${legacyHost}${window.location.pathname}${window.location.search}`
            );
            return;
        }
        refreshAuth().then(redirectBareToHomeClub);
        // Push notifications only (static/sw.js): it caches nothing, so every
        // page still comes from the network exactly as it would without it.
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        }
        const club = getClubSlugFromHostname(window.location.hostname);
        getSystemsConfig(club).then((cfg) => {
            hasAnyLeague = leagueSystems(cfg).length > 0;
        });
    });

    // Expose refreshAuth on the window so the claim-profile page can trigger
    // a refresh after a successful claim, without a full page reload.
    $effect(() => {
        if (typeof window !== 'undefined') {
            (window as any).__refreshAuth = refreshAuth;
        }
    });

    const isAuthed = $derived(auth.authenticated === true);
    // Multi-club network model: "needs to claim" is about the ACTIVE club, so
    // it keys off auth.player (the active-club player /auth/me returns), NOT
    // auth.user.player_id (the legacy home-club link). A user with a player at
    // their home club but none at the club whose subdomain they're visiting
    // correctly sees the claim/create prompt for THIS club.
    const needsClaim = $derived(isAuthed && auth.player == null);
    const hasAdminAccess = $derived(
        authLoaded && adminState !== null && (adminState.is_super_admin || adminState.scopes.length > 0)
    );
    const hasPlatformAdminAccess = $derived(
        authLoaded && adminState !== null && adminState.is_platform_admin === true
    );
    const hasVenueAdminAccess = $derived(
        authLoaded && venueState !== null && venueState.can_admin_venue === true
    );
    // The bare/www host is the marketing site; a club subdomain is that club's
    // own public page. Same '/' path, different job, so the gate has to know
    // which host it's on. localhost counts as a club host so the club page and
    // booking form are reachable in local dev.
    const isBareHost = $derived(
        page.url.hostname === 'calltoarms.app' ||
        page.url.hostname === 'www.calltoarms.app'
    );

    const navItems = $derived([
        { href: '/', label: 'Home' },
        { href: '/signup', label: 'Sign up' },
        { href: '/pairings', label: 'Pairings' },
        { href: '/pickups', label: 'Pick-ups' },
        // Tournaments are still being built out, so they're platform-admin
        // only for now rather than in front of every club's players.
        ...(hasPlatformAdminAccess ? [{ href: '/tournaments', label: 'Events' }] : []),
        ...(hasAnyLeague ? [{ href: '/leagues', label: 'Leagues' }] : []),
        { href: '/players', label: 'Players' },
        { href: '/club', label: 'Club' }
    ]);

    /* The phone's bottom tab bar: the four places a player goes every week,
       and Me, which opens the drawer holding everything else (Players, Club,
       Admin, account). Leagues gives its slot to Players at a club with no
       league, so the bar never has a dead tab. */
    const tabItems = $derived([
        { href: '/', label: 'Home', icon: 'home' },
        { href: '/signup', label: 'Sign up', icon: 'signup' },
        { href: '/pairings', label: 'Pairings', icon: 'pairings' },
        hasAnyLeague
            ? { href: '/leagues', label: 'Leagues', icon: 'leagues' }
            : { href: '/players', label: 'Players', icon: 'players' }
    ]);

    /* The Me sheet on a phone ($lib/MeSheet): everything the bottom bar has
       no room for, with the same permission checks as the desktop account
       menu, grouped. */
    let sheetOpen = $state(false);
    const meGroups = $derived([
        {
            label: 'Club',
            links: navItems
                .filter((i) => i.href !== '/' && !tabItems.some((t) => t.href === i.href))
                .map((i) => ({ href: i.href, label: i.href === '/club' ? 'Club page' : i.href === '/pickups' ? 'Pick-up games' : i.label }))
        },
        {
            label: 'You',
            links: [
                ...(auth.player ? [{ href: `/players/${auth.player.id}`, label: 'Your player profile' }] : []),
                { href: '/account', label: 'Account & notifications' }
            ]
        },
        {
            label: 'Running things',
            links: [
                ...(hasAdminAccess ? [{ href: '/admin', label: 'Admin' }] : []),
                ...(hasVenueAdminAccess ? [{ href: '/venue-admin', label: 'Venue admin' }] : []),
                ...(hasPlatformAdminAccess ? [{ href: '/platform-admin', label: 'Platform admin' }] : [])
            ]
        }
    ]);

    // What a signed-out visitor on a club subdomain can actually reach. Without
    // this the club page, its pairings and its booking form are three separate
    // dead ends with no way between them, which is how a stranger who followed
    // one link finds nothing else the club does.
    const publicNavItems = $derived(
        isBareHost ? [] : [
            { href: '/', label: 'Club' },
            { href: '/pairings', label: 'Pairings' },
            ...(venueTakesBookings ? [{ href: '/book', label: 'Book a table' }] : [])
        ]
    );

    // Where the brand mark takes you. A signed-out visitor on a club subdomain
    // gets the marketing site, which is the thing they might actually want to
    // read and previously had no route back to. A member gets their club home,
    // because the marketing page has nothing on it for them — and because
    // redirectBareToHomeClub would bounce them straight back anyway, making the
    // logo look broken. The Club tab covers club home either way.
    const logoHref = $derived(
        !isBareHost && authLoaded && !isAuthed ? 'https://www.calltoarms.app' : '/'
    );

    function isActive(href: string, pathname: string = page.url.pathname): boolean {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    }

    /* The tab bar answers the tap, not the page load: while a navigation is
       in flight it already shows where you're going. Waiting for the new page
       before moving the highlight is what made the bar feel unresponsive. */
    const tabPath = $derived($navigating?.to?.url.pathname ?? page.url.pathname);
    const activeTab = $derived(tabItems.findIndex((t) => isActive(t.href, tabPath)));

    // The hero page carries its own large logo, so the header shouldn't
    // duplicate it there — only show the header logo everywhere else.
    // Routes a signed-out visitor can see without being bounced to the hero:
    // public pairings, the club finder, the join/add-my-club form, and privacy.
    //
    // On a club subdomain the club's own landing page and its booking form are
    // public too — that page is a shop window (name, hours, address, what they
    // run) and a stranger following a link to it should not hit a login wall.
    // Both stay gated on the bare host, which has no club context to resolve:
    // an anonymous /club there can't know which club is meant.
    const isPublicRoute = $derived(
        page.url.pathname.startsWith('/pairings') ||
        page.url.pathname.startsWith('/find') ||
        page.url.pathname === '/join' ||
        // Public by necessity: it is where someone with no club — and so no
        // possible account — comes to ask for one. The page runs its own
        // sign-in step, because the request needs a Discord identity even
        // though it cannot need an account.
        page.url.pathname === '/request-club' ||
        page.url.pathname === '/privacy' ||
        page.url.pathname.startsWith('/signin') ||
        (!isBareHost && (page.url.pathname === '/' || page.url.pathname === '/club' || page.url.pathname.startsWith('/book')))
    );
    // The three admin consoles. Not reading pages, so they get the wider
    // container above.
    const isConsole = $derived(
        page.url.pathname.startsWith('/admin') ||
        page.url.pathname.startsWith('/venue-admin') ||
        page.url.pathname.startsWith('/platform-admin')
    );
    // True only where the MARKETING page renders, which since the sign-in prompt
    // arrived means the bare host alone. It gates the header chrome, and a club
    // subdomain wants that chrome: the prompt is a stop on the way somewhere,
    // and without the logo and tabs it was a page with no exits.
    const showingHero = $derived(authLoaded && !isAuthed && !isPublicRoute && isBareHost);

    // Thin wrapper over $lib/loginUrl so there is one implementation, not two.
    function loginUrl(next?: string): string {
        return next ? loginHrefTo(next) : loginHref(null);
    }

    async function logout() {
        await fetch(`${PUBLIC_API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        clearSession();
        await refreshAuth();
        window.location.href = '/';
    }

    function closeDrawer() {
        drawerOpen = false;
    }

    /* The account menu (avatar button, desktop). Holds what used to crowd the
       header row: Account, Change club, Sign out, and the two admin areas only
       venue staff and the platform admin ever see. In the mobile drawer the
       same items show as a plain list, so this state only matters on desktop. */
    let userMenuOpen = $state(false);
    let userMenuEl = $state<HTMLElement | null>(null);

    $effect(() => {
        if (!userMenuOpen) return;
        const onPointer = (e: PointerEvent) => {
            if (userMenuEl && !userMenuEl.contains(e.target as Node)) userMenuOpen = false;
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') userMenuOpen = false;
        };
        document.addEventListener('pointerdown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    });

    /* Tab changes are a crossfade by the browser (View Transitions): it
       snapshots the old page, swaps in the new one, and fades between them,
       so nothing on the new page has to animate itself into place. The tab
       bar and the logo are named (see the styles) so they stay put instead
       of fading with the page. Browsers without it just swap instantly. */
    onNavigate((navigation) => {
        if (typeof document === 'undefined' || !('startViewTransition' in document)) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        return new Promise((resolve) => {
            (document as any).startViewTransition(async () => {
                resolve();
                await navigation.complete;
            });
        });
    });

    afterNavigate(() => {
        userMenuOpen = false;
        sheetOpen = false;
        scheduleTitleFit();
    });

    /* Phone page titles fill the space beside the logo ($lib/fitTitle). Fitted
       now and again a moment later, for a page whose title arrives with its
       data. */
    let titleFitTimer: ReturnType<typeof setTimeout> | null = null;
    function scheduleTitleFit() {
        if (typeof window === 'undefined') return;
        // Now, before the browser paints or takes the crossfade's snapshot of
        // the new page, so a title is never seen at the wrong size.
        fitPhoneTitles();
        requestAnimationFrame(() => fitPhoneTitles());
        if (titleFitTimer) clearTimeout(titleFitTimer);
        titleFitTimer = setTimeout(() => fitPhoneTitles(), 260);
    }

    onMount(() => {
        // A page that titles itself once its data arrives (a player's
        // profile) adds the title after navigation has finished.
        const content = document.querySelector('.page-content');
        const observer = new MutationObserver(() => scheduleTitleFit());
        if (content) observer.observe(content, { childList: true, subtree: true });
        window.addEventListener('resize', scheduleTitleFit);
        document.fonts?.ready.then(scheduleTitleFit);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', scheduleTitleFit);
        };
    });

    // The header's shape changes once auth answers (the big logo only shows
    // for members), so fit again then.
    $effect(() => {
        if (authLoaded && isAuthed) scheduleTitleFit();
    });

    function toggleDrawer() {
        drawerOpen = !drawerOpen;
    }
</script>

<!-- The app's ONLY <title>. Pages must not declare their own: a second
     <title> element is what left the tab stuck on whichever page loaded
     first. Data-derived names arrive via setPageTitle() — see $lib/pageTitle. -->
<svelte:head>
    <title>{documentTitle}</title>
</svelte:head>

{#if $navigating}
    <div class="nav-progress"></div>
{/if}

<SiteBanner />

<!-- Pairings published, opponent dropped, late signup: the Discord channel's
     news, for the players who aren't in the channel. Fixed-position, so it
     lives outside the page wrap. -->
<NoticeBanner authed={authLoaded && isAuthed} />

<!-- One tap to turn notifications on (or silently on, where the browser
     already allows them). See $lib/PushPrompt. -->
<PushPrompt authed={authLoaded && isAuthed} />

<!-- Mobile-only dimmed overlay, shown when the drawer is open -->
{#if drawerOpen}
    <div class="drawer-overlay" onclick={closeDrawer}></div>
{/if}

<div class="page-wrap" data-sveltekit-preload-data="hover">
    <header class="topbar" class:topbar-member={authLoaded && isAuthed} class:topbar-signed-out={authLoaded && !isAuthed && publicNavItems.length === 0}>
        <!-- Mobile-only: the logo doubles as the menu toggle. It's a normal
             flex child of the topbar row (not a floating fixed button), so
             it sits cleanly beside the nav-tab ribbon instead of
             overlapping it. Hidden on the hero page itself, same as the
             desktop logo below — the hero already carries its own big logo. -->
        {#if !showingHero && !(authLoaded && isAuthed)}
            <button class="hamburger" onclick={toggleDrawer} type="button" aria-label={drawerOpen ? 'Close menu' : 'Open menu'}>
                {#if drawerOpen}
                    <span class="hamburger-icon">✕</span>
                {:else}
                    <img class="hamburger-logo" src="/logo.svg" alt="" />
                {/if}
            </button>
        {/if}

        {#if !showingHero}
            <a class="topbar-logo-link" href={logoHref} aria-label="Call to Arms">
                <img class="topbar-logo" src="/logo.svg" alt="Call to Arms" />
            </a>
        {/if}
        <!-- Nav tabs only make sense once a Discord-authenticated club member
             is looking at them — a signed-out visitor (landing page, or one
             of the pre-auth exempt routes like /pairings, /join, /privacy)
             gets no tab ribbon, just the sign-in prompt. Gated on authLoaded
             too so it doesn't flash in during the brief pre-auth-check window. -->
        {#if authLoaded && !isAuthed && publicNavItems.length > 0 && !showingHero}
            <nav class="nav-tabs-wrap">
                <div class="nav-tabs">
                    {#each publicNavItems as item}
                        <a href={item.href} class="nav-tab" class:active={isActive(item.href)} data-sveltekit-preload-data="hover">{item.label}</a>
                    {/each}
                </div>
                <div class="nav-tabs-fade"></div>
            </nav>
        {:else if authLoaded && isAuthed}
            <nav class="nav-tabs-wrap">
                <div class="nav-tabs">
                    {#each navItems as item}
                        <a href={item.href} class="nav-tab" class:active={isActive(item.href)} data-sveltekit-preload-data="hover">{item.label}</a>
                    {/each}
                    {#if hasAdminAccess}
                        <a href="/admin" class="nav-tab" class:active={isActive('/admin')} data-sveltekit-preload-data="hover">Admin</a>
                    {/if}
                </div>
                <div class="nav-tabs-fade"></div>
            </nav>
        {/if}

        <aside class="auth-panel" class:drawer-open={drawerOpen}>
            {#if !authLoaded}
                <p class="auth-panel-note">…</p>
            {:else if isAuthed && auth.user}
                <div class="user-menu-wrap" bind:this={userMenuEl}>
                    <button
                        class="user-pill user-menu-toggle"
                        type="button"
                        aria-expanded={userMenuOpen}
                        aria-controls="user-menu"
                        onclick={() => (userMenuOpen = !userMenuOpen)}
                    >
                        {#if auth.user.avatar_url}
                            <img class="user-avatar" src={auth.user.avatar_url} alt="" />
                        {/if}
                        <span class="user-meta">
                            <span class="user-name">{auth.user.name}</span>
                            {#if auth.player}
                                <span class="user-sub">{auth.player.name}</span>
                            {:else}
                                <span class="user-sub user-sub-warn">No profile linked</span>
                            {/if}
                        </span>
                        <svg class="user-menu-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    </button>
                    <div id="user-menu" class="user-menu" class:open={userMenuOpen}>
                        <!-- On a phone the top tabs give way to the bottom bar,
                             so what the bar has no room for lives here. -->
                        {#each navItems.filter((i) => !tabItems.some((t) => t.href === i.href)) as item}
                            <a class="user-menu-item drawer-only" href={item.href} onclick={closeDrawer}>{item.label}</a>
                        {/each}
                        {#if hasAdminAccess}
                            <a class="user-menu-item drawer-only" href="/admin" onclick={closeDrawer}>Admin</a>
                        {/if}
                        {#if auth.player}
                            <a class="user-menu-item" href={`/players/${auth.player.id}`} onclick={closeDrawer}>Your player profile</a>
                        {/if}
                        <a class="user-menu-item" href="/account" onclick={closeDrawer}>Account</a>
                        {#if hasVenueAdminAccess}
                            <a class="user-menu-item" href="/venue-admin" onclick={closeDrawer}>Venue admin</a>
                        {/if}
                        {#if hasPlatformAdminAccess}
                            <a class="user-menu-item" href="/platform-admin" onclick={closeDrawer}>Platform admin</a>
                        {/if}
                        <a class="user-menu-item" href="/find" onclick={closeDrawer}>Change club</a>
                        <button class="user-menu-item" onclick={() => { closeDrawer(); logout(); }} type="button">Sign out</button>
                    </div>
                </div>
            {:else if !showingHero}
                <!-- Signed out on a public page (a club's own page, its booking
                     form, shared pairings, the finder). The hero has its own
                     sign-in button, so this only fills in the header everywhere
                     else — without it a visitor who lands on a club page from a
                     search or a shared link has no way to sign in and no way to
                     reach another club. -->
                <!-- Desktop reaches the marketing site by clicking the logo; on
                     mobile the logo is the drawer toggle instead, so this is the
                     only route back to it there. -->
                <a class="sidebar-button drawer-only" href="https://www.calltoarms.app" onclick={closeDrawer}>
                    About Call to Arms
                </a>
                <a class="sidebar-button" href="/find" onclick={closeDrawer}>Find a club</a>
                <!-- With a choice of sign-in methods this goes to /signin to
                     offer both; with Discord alone, straight to Discord. -->
                <a class="sidebar-button sidebar-button-primary"
                   href={$signInProviders.length > 1
                       ? `/signin?next=${encodeURIComponent(page.url.pathname === '/signin' ? (page.url.searchParams.get('next') ?? '/') : page.url.pathname + page.url.search)}`
                       : loginUrl(page.url.pathname + page.url.search)}>Sign in</a>
            {/if}
        </aside>
    </header>

    <main class="container" class:container-console={isConsole} class:has-tabbar={authLoaded && isAuthed}>
        <div class="page-content">
            {#if !authLoaded}
                <div class="auth-gate"></div>
            {:else if !isAuthed && !isPublicRoute && !isBareHost}
                <!-- On a club subdomain the visitor asked for something specific,
                     so answer that rather than pitching the product at them. The
                     bare host below is the one place the marketing page belongs. -->
                <SignInPrompt
                    loginUrl={loginUrl(page.url.pathname + page.url.search)}
                    pathname={page.url.pathname}
                />
            {:else if !isAuthed && !isPublicRoute}
                <LandingHero loginUrl={loginUrl()} />
            {:else}
                {#if needsClaim && page.url.pathname !== '/claim' && auth.user}
                    <div class="claim-banner">
                        <strong>Welcome, {auth.user.name}.</strong>
                        {#if auth.active_club}
                            You don't have a profile at <strong>{auth.active_club.name}</strong> yet.
                            <a href="/claim">Create one here</a> to play.
                        {:else}
                            Before you can use the app, please
                            <a href="/claim">create your player profile</a>.
                        {/if}
                    </div>
                {/if}
                {#key page.url.pathname}
                    <!-- Same fly-in feel as LandingHero's title/tagline (fly
                         animates position AND opacity, so this reads as a
                         fade+rise), applied to every route including admin /
                         platform-admin. Deliberately in-only, no out:
                         transition: an out+in pair here would overlap the
                         outgoing and incoming blocks in normal document flow
                         for the transition's duration (this div has no fixed
                         height to position them absolutely within), which reads
                         as a worse jump than an instant cut. -->
                    <div class="page-transition">
                        {@render children()}
                    </div>
                {/key}
            {/if}
        </div>
    </main>
</div>

{#if authLoaded && isAuthed}
    <MeSheet
        open={sheetOpen}
        name={auth.player?.name ?? auth.user?.name ?? ''}
        clubName={auth.active_club?.name ?? null}
        avatarUrl={auth.user?.avatar_url ?? null}
        groups={meGroups}
        onClose={() => (sheetOpen = false)}
        onSignOut={logout}
    />
    <nav class="tabbar" aria-label="Main" data-sveltekit-preload-code="eager">
        <!-- One gold marker that slides to the tab you picked. -->
        <span class="tab-marker" class:hidden={activeTab < 0 || sheetOpen}
              style={`transform: translateX(${Math.max(activeTab, 0) * 100}%)`} aria-hidden="true"></span>
        {#each tabItems as t, i}
            <a href={t.href} class="tab" class:on={i === activeTab && !sheetOpen} aria-current={isActive(t.href) ? 'page' : undefined} data-sveltekit-preload-data="tap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    {#if t.icon === 'home'}
                        <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />
                    {:else if t.icon === 'signup'}
                        <rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M12 13v4M10 15h4" />
                    {:else if t.icon === 'pairings'}
                        <path d="M5 5l6 6M19 5l-6 6M9 13l-4 4 2 2 4-4M15 13l4 4-2 2-4-4" />
                    {:else if t.icon === 'leagues'}
                        <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a2 2 0 0 0 3 4M16 6h3a2 2 0 0 1-3 4M12 13v4M8 20h8" />
                    {:else}
                        <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
                    {/if}
                </svg>
                {t.label}
            </a>
        {/each}
        <button type="button" class="tab" aria-expanded={sheetOpen} onclick={() => (sheetOpen = !sheetOpen)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" /></svg>
            Me
        </button>
    </nav>
{/if}

<style>
    .nav-progress {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
        background-size: 50% 100%;
        background-repeat: no-repeat;
        z-index: 1000;
        animation: nav-progress-slide 0.9s ease-in-out infinite;
        pointer-events: none;
    }

    @keyframes nav-progress-slide {
        0%   { background-position: -50% 0; }
        100% { background-position: 150% 0; }
    }

    /* The logo/menu button only exists as a mobile affordance — on desktop
       the nav tabs and .topbar-logo-link cover both jobs already. */
    .hamburger {
        display: none;
        background: none;
        border: none;
        padding: 0;
        color: var(--color-text-bright);
        font-size: 1.6rem;
        line-height: 1;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        flex: 0 0 auto;
    }

    .hamburger-icon {
        display: block;
    }

    .hamburger-logo {
        height: 32px;
        width: auto;
        display: block;
    }

    /* Dimmed backdrop behind the open drawer; mobile-only */
    .drawer-overlay {
        display: none;
    }

    .page-wrap {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        padding: 1rem;
    }

    /* Desktop: nav tabs + auth panel share one row. Mobile (see media query
       below) detaches the auth panel into a hamburger-toggled drawer, same
       mechanism as before — just no longer a persistent column. */
    .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
        width: 100%;
        max-width: 1100px;
        margin: 0 auto 1.5rem;
    }

    .topbar-logo-link {
        display: flex;
        align-items: center;
        flex: 0 0 auto;
    }

    .topbar-logo {
        height: 34px;
        width: auto;
        display: block;
    }

    /* No nav-tabs-wrap renders when signed out, so .auth-panel is the only
       flex child — space-between would otherwise pin it to the start
       (left) instead of its usual right-hand spot. */
    .topbar-signed-out {
        justify-content: flex-end;
    }

    .auth-panel {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 0.6rem 1rem;
        flex: 0 0 auto;
    }


    .auth-panel-note {
        font-size: 0.78rem;
        color: var(--color-text-dim);
        margin: 0;
        line-height: 1.4;
        text-align: right;
    }

    .sidebar-button {
        display: inline-block;
        width: auto;
        white-space: nowrap;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--color-accent-border-soft);
        color: var(--color-text-base);
        padding: 0.5rem 0.9rem;
        border-radius: var(--radius);
        font-size: 0.82rem;
        font-family: inherit;
        text-align: center;
        text-decoration: none;
        cursor: pointer;
        transition: background 0.1s ease, border-color 0.1s ease;
    }

    .sidebar-button:hover {
        background: rgba(201, 161, 74, 0.10);
        border-color: rgba(201, 161, 74, 0.55);
    }

    .sidebar-button-primary {
        background: var(--color-accent);
        border-color: var(--color-accent);
        color: #1b1206;
        font-weight: 700;
    }

    .sidebar-button-primary:hover {
        background: var(--color-accent-soft);
        border-color: var(--color-accent-soft);
    }

    /* The drawer is mobile-only, so is anything that exists purely to fill in
       for an affordance the mobile header doesn't have. */
    .drawer-only,
    .user-menu-item.drawer-only { display: none; }

    .user-pill {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .user-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
        border: 1px solid var(--color-accent-border-soft);
        flex: 0 0 auto;
    }


    .user-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; text-align: left; }

    /* ── Account menu ────────────────────────────────────────────────────
       Desktop: the avatar button opens a dropdown. Mobile: the drawer shows
       the same items as a plain list (see the max-width rules below). */
    .user-menu-wrap {
        position: relative;
    }

    .user-menu-toggle {
        background: none;
        border: 1px solid transparent;
        border-radius: var(--radius);
        padding: 4px 8px 4px 4px;
        min-height: 44px;
        color: inherit;
        font: inherit;
        cursor: pointer;
        transition: background 0.1s ease, border-color 0.1s ease;
    }

    .user-menu-toggle:hover,
    .user-menu-toggle[aria-expanded='true'] {
        background: rgba(201, 161, 74, 0.08);
        border-color: var(--color-accent-border-soft);
    }

    .user-menu-chevron {
        flex: 0 0 auto;
        color: var(--color-text-dim);
        transition: transform 0.15s ease;
    }

    .user-menu-toggle[aria-expanded='true'] .user-menu-chevron {
        transform: rotate(180deg);
    }

    .user-menu {
        display: none;
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 1000;
        min-width: 220px;
        flex-direction: column;
        padding: 6px;
        background: var(--color-sidebar-bg);
        border: 1px solid var(--color-steel-border);
        border-radius: var(--radius);
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
    }

    .user-menu.open {
        display: flex;
    }

    .user-menu-item {
        display: block;
        width: 100%;
        box-sizing: border-box;
        padding: 0.6rem 0.75rem;
        min-height: 40px;
        background: none;
        border: none;
        border-radius: calc(var(--radius) - 1px);
        color: var(--color-text-base);
        font: inherit;
        font-size: 0.92rem;
        text-align: left;
        text-decoration: none;
        cursor: pointer;
    }

    .user-menu-item:hover,
    .user-menu-item:focus-visible {
        background: rgba(201, 161, 74, 0.10);
        color: var(--color-text-bright);
        outline: none;
    }

    .user-name {
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--color-text-bright);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .user-sub {
        font-size: 0.72rem;
        color: var(--color-text-dim);
        font-style: italic;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .user-sub-warn { color: var(--color-tnt); font-style: normal; }

    .container {
        width: 100%;
        max-width: 1100px;
        margin: 0 auto;
        padding: 1.8rem 2rem 1.5rem;
        background: var(--color-bg-deep);
    }

    /* The three consoles are the only pages that are not reading. 1100px is a
       column of prose; an admin panel is a sidebar plus a form, and on a
       laptop the sidebar was eating a fifth of a column already narrower than
       the screen. Widened only here, and only once there is screen to spend:
       below 1400px it stays exactly as it was. */
    @media (min-width: 1400px) {
        .container-console {
            max-width: 1360px;
        }
    }

    /* Wrapper around the scrollable tab row, needed for the fade overlay */
    .nav-tabs-wrap {
        position: relative;
        flex: 1;
        min-width: 0;
    }

    .nav-tabs {
        display: flex;
        gap: 1.5rem;
        border-bottom: 1px solid var(--color-steel-border);
        padding-bottom: 0.6rem;
        position: relative;
        /* Scrolls horizontally on mobile; hide the scrollbar chrome so the
           tab ribbon stays clean (still swipeable + the fade hints overflow). */
        scrollbar-width: none;
        -ms-overflow-style: none;
    }

    .nav-tabs::-webkit-scrollbar { display: none; }

    .nav-tab {
        color: var(--color-text-muted);
        text-decoration: none;
        font-family: var(--font-heading);
        font-weight: 600;
        font-size: 1.05rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding-bottom: 0.4rem;
        border-bottom: 3px solid transparent;
        transition: color 0.2s ease, border-bottom-color 0.25s ease;
        position: relative;
        box-sizing: border-box;
    }

    .nav-tab:hover { color: var(--color-text-bright); }

    .nav-tab.active {
        color: var(--color-text-bright);
        border-bottom-color: var(--color-accent-soft);
    }

    .nav-tab.active::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        height: 3px;
        background: var(--color-accent-soft);
        border-radius: 2px;
        animation: tab-underline-pop 0.35s ease;
    }

    @keyframes tab-underline-pop {
        0%   { transform: scaleX(0.2); opacity: 0; }
        100% { transform: scaleX(1);   opacity: 1; }
    }

    /* Right-edge fade hinting the tab row scrolls; invisible unless overflowing */
    .nav-tabs-fade {
        display: none;
    }

    .page-content { padding-top: 0.5rem; }

    .claim-banner {
        background: rgba(217, 122, 42, 0.10);
        border: 1px solid rgba(217, 122, 42, 0.45);
        color: var(--color-text-bright);
        padding: 0.75rem 1rem;
        border-radius: 10px;
        margin-bottom: 1rem;
        font-size: 0.9rem;
    }

    .claim-banner a {
        color: var(--color-accent);
        text-decoration: underline;
        font-weight: 600;
    }

    .auth-gate {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        min-height: 50vh;
        gap: 1rem;
        padding: 2rem 1rem;
    }

    /* Named for the browser's page crossfade (onNavigate above): these two
       are the same on every tab, so they stay still while the page fades. */
    .tabbar { view-transition-name: tabbar; }
    .topbar-logo-link { view-transition-name: brand-logo; }

    /* Phone-only bottom tab bar, for members. */
    .tabbar { display: none; }

    @media (max-width: 768px) {
        .tabbar {
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 800;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            height: calc(64px + env(safe-area-inset-bottom));
            padding-bottom: env(safe-area-inset-bottom);
            background: #13161e;
            border-top: 1px solid #232733;
        }

        .tab {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            background: none;
            border: none;
            color: var(--color-text-dim);
            font-family: var(--font-heading);
            font-size: 0.8rem;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            text-decoration: none;
            cursor: pointer;
        }

        .tab {
            position: relative;
            -webkit-tap-highlight-color: transparent;
            transition: color 0.15s ease;
        }

        .tab svg { transition: transform 0.15s ease; }

        .tab.on,
        .tab[aria-expanded='true'] { color: var(--color-accent); }

        .tab.on svg { transform: translateY(-1px) scale(1.08); }

        /* Answers the finger before anything else does. */
        .tab:active svg { transform: scale(0.86); }

        .tab-marker {
            position: absolute;
            top: -1px;
            left: 0;
            width: 20%;
            height: 2px;
            pointer-events: none;
            transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.15s ease;
        }

        .tab-marker::before {
            content: '';
            position: absolute;
            left: 28%;
            right: 28%;
            top: 0;
            bottom: 0;
            border-radius: 0 0 2px 2px;
            background: var(--color-accent);
            box-shadow: 0 0 10px var(--color-accent-glow);
        }

        .tab-marker.hidden { opacity: 0; }

        @media (prefers-reduced-motion: reduce) {
            .tab-marker, .tab svg { transition: none; }
        }

        /* Clear the fixed tab bar. Two classes, because the phone rule
           `.container { padding: 1rem }` further down resets all four sides
           and, being later, won a tie with a single class. */
        .container.has-tabbar { padding-bottom: calc(84px + env(safe-area-inset-bottom)); }

        /* Members navigate by the bottom bar; the top ribbon would repeat it. */
        .topbar-member .nav-tabs-wrap { display: none; }

        /* Hidden until $lib/fitTitle has sized it, so a title never shows at
           the default size and then jumps to its fitted one. */
        .page-wrap:has(.topbar-member) :global(.page-title:not([data-fitted])) { visibility: hidden; }

        /* The phone header for a member is the logo, large, top right. Menu
           and navigation live in the bottom bar, so the row is free for it.
           Pages with a title (Home, Sign up, Pairings, Leagues) pull their
           title up beside it, so the logo and the title share one band
           instead of the logo sitting in a strip of its own. */
        /* No z-index here: that would make the header its own stacking
           layer, and the menu drawer inside it would be trapped beneath the
           drawer's dimmed overlay (greyed out, nothing tappable). Only the
           logo is lifted above the page that slides up under it. */
        .topbar-member {
            justify-content: flex-end;
            margin-bottom: 1rem;
            /* Taps on the empty part of the row reach the page under it. */
            pointer-events: none;
        }

        .topbar-member .topbar-logo-link,
        .topbar-member .auth-panel { pointer-events: auto; }

        .topbar-member .topbar-logo-link {
            position: relative;
            z-index: 2;
        }

        /* Right edge on the page's edge (the content sits 16px further in
           than the header), and moved until "Rally. Pair. Play." ends on the
           same line as the page title's lettering. Measured off a screenshot,
           not eyeballed: see the "Phone logo" board on the design canvas,
           version A2. Tied to the -60px pull-up below: change one, re-measure. */
        .topbar.topbar-member .topbar-logo-link {
            display: flex;
            margin-right: 16px;
            transform: translateY(6.3px);
        }

        .topbar-member .topbar-logo {
            height: auto;
            width: min(164px, 42vw);
        }

        .page-wrap:has(:global(.page-title)) .topbar-member { margin-bottom: -60px; }

        .page-wrap:has(.topbar-member) :global(.page-title) {
            max-width: calc(100% - min(164px, 42vw) - 12px);
            white-space: nowrap;
        }
        .user-menu-item.drawer-only { display: block; }

        /* Show the logo/menu button, inline in the topbar row rather than
           floating fixed over the page — that overlap was what made the
           nav-tab ribbon look broken and scroll underneath it. */
        .hamburger {
            display: flex;
        }

        .page-wrap {
            padding: 0.5rem;
        }

        /* Dim the page behind the open drawer */
        .drawer-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.55);
            z-index: 900;
        }

        .page-wrap {
            flex-direction: column;
            padding: 0.5rem;
            padding-top: 0.85rem;
        }

        .topbar {
            margin-bottom: 1rem;
        }

        /* On desktop, signed-out flips to flex-end because the auth-panel
           is the only in-flow child then. On mobile the auth-panel is a
           fixed drawer (out of flow) and the hamburger is the only child
           instead — flex-end would wrongly push it to the right. */
        .topbar-signed-out {
            justify-content: flex-start;
        }

        /* The mobile hamburger button already doubles as the brand mark
           (see .hamburger-logo), so the inline header logo would just
           duplicate it and throw off the nav-tabs spacing. */
        .topbar-logo-link {
            display: none;
        }

        /* The auth panel becomes a left slide-out drawer, hidden by default —
           same hamburger-toggled mechanism as before, just no longer a
           persistent column on desktop. */
        .auth-panel {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            z-index: 950;
            width: 78vw;
            max-width: 300px;
            background: var(--color-sidebar-bg);
            border-right: 1px solid var(--color-accent-border);
            padding: 1rem;
            padding-top: 2.75rem;
            overflow-y: auto;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            flex-direction: column;
            align-items: stretch;
            gap: 0.5rem;
        }

        .auth-panel.drawer-open {
            transform: translateX(0);
        }

        /* Drawer items stack from the TOP (the desktop panel is justified to
           the right of the topbar, which in a column would push them to the
           bottom). */
        .auth-panel {
            justify-content: flex-start;
        }

        .auth-panel-note { text-align: left; }

        .sidebar-button {
            display: block;
            width: 100%;
            font-size: 0.85rem;
            padding: 0.6rem;
        }

        .drawer-only { display: block; }

        .user-menu-toggle {
            pointer-events: none;
            padding: 0;
        }

        .user-menu-chevron { display: none; }

        .user-menu,
        .user-menu.open {
            display: flex;
            position: static;
            min-width: 0;
            margin-top: 0.75rem;
            padding: 0;
            gap: 0.5rem;
            background: none;
            border: none;
            box-shadow: none;
        }

        .user-menu-item {
            background: rgba(0, 0, 0, 0.25);
            border: 1px solid var(--color-accent-border-soft);
            border-radius: var(--radius);
            text-align: center;
            font-size: 0.85rem;
        }

        .container { padding: 1rem; }

        .nav-tabs {
            gap: 0.8rem;
            font-size: 0.85rem;
            overflow-x: auto;
            white-space: nowrap;
            -webkit-overflow-scrolling: touch;
        }

        /* Right-edge fade so a partially-hidden "Admin" tab reads as
           scrollable rather than clipped */
        .nav-tabs-fade {
            display: block;
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0.6rem;
            width: 28px;
            background: linear-gradient(to right, transparent, var(--color-bg-base));
            pointer-events: none;
        }
    }

</style>