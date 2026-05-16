<script lang="ts">
    import '../app.css';
    import { page } from '$app/state';

    let { children } = $props();

    const navItems = [
        { href: '/', label: 'Call to Arms' },
        { href: '/pairings', label: 'Pairings' },
        { href: '/league', label: 'Old World League' },
        { href: '/players', label: 'Players' }
    ];

    function isActive(href: string): boolean {
        if (href === '/') return page.url.pathname === '/';
        return page.url.pathname.startsWith(href);
    }
</script>

<svelte:head>
    <title>Call to Arms</title>
</svelte:head>

<div class="page-wrap">
    <aside class="sidebar">
        <div class="sidebar-block">
            <h2 class="sidebar-heading">Access</h2>
            <p class="sidebar-note">Admin tools coming soon.</p>
        </div>

        <div class="sidebar-divider"></div>

        <a class="sidebar-link" href="https://elementgames.co.uk" target="_blank" rel="noopener">
            <img src="/brand/element_games.png" alt="Element Games" />
            <span class="sidebar-label">Venue Partner</span>
        </a>

        <a class="sidebar-link" href="https://discord.gg/tnwUCRYH" target="_blank" rel="noopener">
            <img src="/brand/discord.png" alt="Discord" />
        </a>
    </aside>

    <main class="container">
        <header class="banner">
            <div class="logos">
                <img src="/logos/tow.png" alt="Warhammer: The Old World" class="logo" />
                <img src="/logos/hh.png" alt="Warhammer: The Horus Heresy" class="logo" />
                <img src="/logos/kt.png" alt="Warhammer: Kill Team" class="logo" />
            </div>
            <h1 class="call-to-arms-title">CALL TO ARMS</h1>
        </header>

        <nav class="nav-tabs">
            {#each navItems as item}
                <a href={item.href} class="nav-tab" class:active={isActive(item.href)}>
                    {item.label}
                </a>
            {/each}
        </nav>

        <div class="page-content">
            {@render children()}
        </div>
    </main>
</div>

<style>
    .page-wrap {
        display: flex;
        min-height: 100vh;
        gap: 1rem;
        padding: 1rem;
    }

    .sidebar {
        flex: 0 0 180px;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding-top: 0.25rem;
    }

    .sidebar-heading {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-text-base);
        margin: 0 0 0.3rem;
    }

    .sidebar-note {
        font-size: 0.8rem;
        color: var(--color-text-dim);
        margin: 0;
    }

    .sidebar-block { padding: 0.25rem 0.25rem 0.5rem; }

    .sidebar-divider {
        height: 1px;
        background: var(--color-accent-border-soft);
        margin: 0.25rem 0;
    }

    .sidebar-link {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.2rem;
        text-decoration: none;
        color: var(--color-text-dim);
        font-size: 0.8rem;
        font-style: italic;
        padding: 0.4rem 0;
    }

    .sidebar-link img {
        max-width: 140px;
        max-height: 45px;
        height: auto;
        object-fit: contain;
    }

    .container {
        flex: 1;
        min-width: 0;
        border: 1px solid var(--color-accent-border);
        border-radius: 14px;
        padding: 1.8rem 2rem 1.5rem;
        background: var(--color-bg-base);
    }

    .banner {
        text-align: center;
        margin-bottom: 0.75rem;
    }

    .logos {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3rem;
        flex-wrap: nowrap;
    }

    .logo {
        height: 90px;
        max-width: 220px;
        object-fit: contain;
    }

    .call-to-arms-title {
        font-size: 2.4rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: var(--color-text-bright);
        margin: 0;
    }

    .nav-tabs {
        display: flex;
        gap: 1.5rem;
        border-bottom: 1px solid var(--color-accent-border);
        padding-bottom: 0.6rem;
        margin-bottom: 1.5rem;
    }

    .nav-tab {
        color: var(--color-text-base);
        text-decoration: none;
        font-size: 0.95rem;
        padding-bottom: 0.4rem;
        margin-bottom: -0.7rem;
        border-bottom: 3px solid transparent;
        transition: color 0.15s ease;
    }

    .nav-tab:hover { color: var(--color-text-bright); }

    .nav-tab.active {
        color: var(--color-accent);
        border-bottom-color: var(--color-accent-soft);
    }

    .page-content { padding-top: 0.5rem; }

    @media (max-width: 768px) {
        .page-wrap { flex-direction: column; padding: 0.5rem; }
        .sidebar {
            flex: none;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            padding: 0.25rem 0.5rem;
            gap: 0.5rem;
        }
        .sidebar-block { padding: 0; }
        .sidebar-divider { display: none; }
        .sidebar-link { flex-direction: row; font-size: 0.7rem; padding: 0; }
        .sidebar-link img { max-height: 28px; }
        .container { padding: 1rem; }
        .logo { height: 42px; max-width: 105px; }
        .logos { gap: 0.6rem; }
        .call-to-arms-title { font-size: 2.2rem; letter-spacing: 0.06em; }
        .nav-tabs {
            gap: 0.8rem;
            font-size: 0.85rem;
            overflow-x: auto;
            white-space: nowrap;
            -webkit-overflow-scrolling: touch;
        }
    }
</style>