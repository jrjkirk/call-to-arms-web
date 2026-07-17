<script lang="ts">
    import '../app.css';
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { navigating } from '$app/stores';
    import { PUBLIC_API_URL } from '$env/static/public';
    import { fly } from 'svelte/transition';
    import LandingHero from '$lib/LandingHero.svelte';

    let { children } = $props();

    type AuthState = {
        authenticated: boolean;
        user?: { id: number; discord_name: string; avatar_url: string | null; player_id: number | null; club_id: number };
        player?: { id: number; name: string } | null;
        claim_candidates?: Array<{ id: number; name: string; default_faction: string | null }>;
        leagues_enabled?: boolean;
    };

    type AdminState = {
        is_super_admin: boolean;
        is_platform_admin: boolean;
        scopes: string[];
    };

    let auth = $state<AuthState>({ authenticated: false });
    let adminState = $state<AdminState | null>(null);
    let authLoaded = $state(false);
    let drawerOpen = $state(false);

    async function refreshAuth() {
        try {
            const [authResp, adminResp] = await Promise.all([
                fetch(`${PUBLIC_API_URL}/auth/me`, { credentials: 'include' }),
                fetch(`${PUBLIC_API_URL}/admin/me`, { credentials: 'include' }),
            ]);
            auth = authResp.ok ? await authResp.json() : { authenticated: false };
            adminState = adminResp.ok ? await adminResp.json() : null;
        } catch (_) {
            auth = { authenticated: false };
            adminState = null;
        } finally {
            authLoaded = true;
        }
    }

    onMount(() => {
        refreshAuth();
    });

    // Expose refreshAuth on the window so the claim-profile page can trigger
    // a refresh after a successful claim, without a full page reload.
    $effect(() => {
        if (typeof window !== 'undefined') {
            (window as any).__refreshAuth = refreshAuth;
        }
    });

    // The league nav tab is gated on the caller's own club having leagues
    // enabled (Club.leagues_enabled, surfaced via GET /auth/me) rather than a
    // hardcoded club id — so it works correctly for any leagues-enabled club,
    // not just Manchester. Hidden by default (before auth resolves and for
    // every leagues-disabled club) so it never flashes in for them.
    const navItems = $derived([
        { href: '/', label: 'Call to Arms' },
        { href: '/pairings', label: 'Pairings' },
        ...(auth.leagues_enabled === true
            ? [{ href: '/league', label: 'Old World League' }]
            : []),
        { href: '/players', label: 'Players' }
    ]);

    function isActive(href: string): boolean {
        if (href === '/') return page.url.pathname === '/';
        return page.url.pathname.startsWith(href);
    }

    const isAuthed = $derived(auth.authenticated === true);
    const needsClaim = $derived(isAuthed && auth.user?.player_id == null);
    const hasAdminAccess = $derived(
        authLoaded && adminState !== null && (adminState.is_super_admin || adminState.scopes.length > 0)
    );
    const hasPlatformAdminAccess = $derived(
        authLoaded && adminState !== null && adminState.is_platform_admin === true
    );

    function loginUrl(): string {
        return `${PUBLIC_API_URL}/auth/discord/login`;
    }

    async function logout() {
        await fetch(`${PUBLIC_API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        await refreshAuth();
        window.location.href = '/';
    }

    function closeDrawer() {
        drawerOpen = false;
    }

    function toggleDrawer() {
        drawerOpen = !drawerOpen;
    }
</script>

<svelte:head>
    <title>Call to Arms</title>
</svelte:head>

{#if $navigating}
    <div class="nav-progress"></div>
{/if}

<!-- Mobile-only top bar with hamburger toggle -->
<div class="mobile-topbar">
    <button class="hamburger" onclick={toggleDrawer} type="button" aria-label="Open menu">
        {#if drawerOpen}
            <span class="hamburger-icon">✕</span>
        {:else}
            <span class="hamburger-icon">☰</span>
        {/if}
    </button>
</div>

<!-- Mobile-only dimmed overlay, shown when the drawer is open -->
{#if drawerOpen}
    <div class="drawer-overlay" onclick={closeDrawer}></div>
{/if}

<div class="page-wrap" data-sveltekit-preload-data="hover">
    <header class="topbar">
        <nav class="nav-tabs-wrap">
            <div class="nav-tabs">
                {#each navItems as item}
                    <a href={item.href} class="nav-tab" class:active={isActive(item.href)} data-sveltekit-preload-data="hover">{item.label}</a>
                {/each}
                {#if hasAdminAccess}
                    <a href="/admin" class="nav-tab" class:active={isActive('/admin')} data-sveltekit-preload-data="hover">Admin</a>
                {/if}
                {#if hasPlatformAdminAccess}
                    <a href="/platform-admin" class="nav-tab" class:active={isActive('/platform-admin')} data-sveltekit-preload-data="hover">Platform Admin</a>
                {/if}
            </div>
            <div class="nav-tabs-fade"></div>
        </nav>

        <aside class="auth-panel" class:drawer-open={drawerOpen}>
            {#if !authLoaded}
                <p class="auth-panel-note">…</p>
            {:else if isAuthed && auth.user}
                {#if auth.player}
                    <a class="user-pill user-pill-link" href={`/players/${auth.player.id}`} onclick={closeDrawer}>
                        {#if auth.user.avatar_url}
                            <img class="user-avatar" src={auth.user.avatar_url} alt="" />
                        {/if}
                        <div class="user-meta">
                            <div class="user-name">{auth.user.discord_name}</div>
                            <div class="user-sub">{auth.player.name}</div>
                        </div>
                    </a>
                {:else}
                    <div class="user-pill">
                        {#if auth.user.avatar_url}
                            <img class="user-avatar" src={auth.user.avatar_url} alt="" />
                        {/if}
                        <div class="user-meta">
                            <div class="user-name">{auth.user.discord_name}</div>
                            <div class="user-sub user-sub-warn">No profile linked</div>
                        </div>
                    </div>
                {/if}
                <button class="sidebar-button" onclick={() => { closeDrawer(); logout(); }} type="button">Sign out</button>
            {:else}
                <p class="auth-panel-note">Sign in to submit results and sign up for sessions.</p>
                <a class="sidebar-button sidebar-button-primary" href={loginUrl()} onclick={closeDrawer}>
                    Sign in with Discord
                </a>
            {/if}
        </aside>
    </header>

    <main class="container">
        <div class="page-content">
            {#if !authLoaded}
                <div class="auth-gate"></div>
            {:else if !isAuthed && !page.url.pathname.startsWith('/pairings') && page.url.pathname !== '/join'}
                <LandingHero loginUrl={loginUrl()} />
            {:else}
                {#if needsClaim && page.url.pathname !== '/claim' && auth.user}
                    <div class="claim-banner">
                        <strong>Welcome, {auth.user.discord_name}.</strong>
                        Before you can use the app, please
                        <a href="/claim">link your existing player profile</a>.
                    </div>
                {/if}
                {#key page.url.pathname}
                    <div class="page-transition" in:fly={{ y: 10, duration: 220 }}>
                        {@render children()}
                    </div>
                {/key}
            {/if}
        </div>
    </main>
</div>

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

    /* Mobile-only top bar; hidden entirely on desktop */
    .mobile-topbar {
        display: none;
    }

    .hamburger {
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--color-accent-border-soft);
        color: var(--color-text-bright);
        width: 40px;
        height: 40px;
        border-radius: 8px;
        font-size: 1.2rem;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }

    .hamburger-icon {
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

    .auth-panel {
        display: flex;
        align-items: center;
        gap: 0.75rem;
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
        border-radius: 8px;
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
        background: rgba(201, 161, 74, 0.18);
        border-color: rgba(201, 161, 74, 0.55);
        color: var(--color-text-bright);
        font-weight: 600;
    }

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

    .user-pill-link {
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        border-radius: 8px;
        transition: background 0.1s ease;
    }

    .user-pill-link:hover {
        background: rgba(201, 161, 74, 0.08);
    }

    .user-meta { flex: 1; min-width: 0; }

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

    /* Wrapper around the scrollable tab row, needed for the fade overlay */
    .nav-tabs-wrap {
        position: relative;
        flex: 1;
        min-width: 0;
    }

    .nav-tabs {
        display: flex;
        gap: 1.5rem;
        border-bottom: 1px solid var(--color-accent-border);
        padding-bottom: 0.6rem;
        position: relative;
    }

    .nav-tab {
        color: var(--color-text-base);
        text-decoration: none;
        font-size: 0.95rem;
        padding-bottom: 0.4rem;
        margin-bottom: -0.7rem;
        border-bottom: 3px solid transparent;
        transition: color 0.2s ease, border-bottom-color 0.25s ease;
        position: relative;
    }

    .nav-tab:hover { color: var(--color-text-bright); }

    .nav-tab.active {
        color: var(--color-accent);
        border-bottom-color: var(--color-accent-soft);
    }

    .nav-tab.active::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        bottom: -0.7rem;
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

    @media (max-width: 768px) {
        /* Show the hamburger bar on mobile */
        .mobile-topbar {
            display: block;
            position: fixed;
            top: 0.6rem;
            left: 0.6rem;
            z-index: 960;
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
            padding-top: 0;
        }

        .topbar {
            margin-bottom: 0;
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

        .auth-panel-note { text-align: left; }

        .sidebar-button {
            display: block;
            width: 100%;
            font-size: 0.85rem;
            padding: 0.6rem;
        }

        .container { padding: 1rem; }

        .nav-tabs {
            gap: 0.8rem;
            font-size: 0.85rem;
            overflow-x: auto;
            white-space: nowrap;
            -webkit-overflow-scrolling: touch;
            padding-left: 3rem;
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