<!--
  The Me menu on a phone: a sheet that rises from the Me tab, so everything in
  it is under the thumb that opened it. Option C on the design canvas's "Me
  menu" page (2026-10-25): bold all-caps rows in groups, no icons, except on
  the two actions at the foot, Change club and Sign out.

  What it lists is decided by the layout (the same permission checks the
  desktop account menu uses); this only lays it out.
-->
<script lang="ts">
    import { fly, fade } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';

    type Link = { href: string; label: string };
    type Group = { label: string; links: Link[] };

    let {
        open,
        name,
        clubName = null,
        avatarUrl = null,
        groups,
        onClose,
        onSignOut
    }: {
        open: boolean;
        name: string;
        clubName?: string | null;
        avatarUrl?: string | null;
        groups: Group[];
        onClose: () => void;
        onSignOut: () => void;
    } = $props();

    const initials = $derived(
        name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
    );

    $effect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    });
</script>

{#if open}
    <button class="scrim" type="button" aria-label="Close menu" onclick={onClose} transition:fade={{ duration: 160 }}></button>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Me" transition:fly={{ y: 320, duration: 240, easing: cubicOut, opacity: 1 }}>
        <span class="handle" aria-hidden="true"></span>

        <div class="who">
            {#if avatarUrl}
                <img class="avatar" src={avatarUrl} alt="" />
            {:else}
                <span class="avatar initials">{initials}</span>
            {/if}
            <div class="who-text">
                <span class="who-name">{name}</span>
                {#if clubName}<span class="who-club">{clubName}</span>{/if}
            </div>
        </div>

        {#each groups.filter((g) => g.links.length) as g (g.label)}
            <section class="group">
                <h2>{g.label}</h2>
                {#each g.links as l (l.href)}
                    <a class="row" href={l.href} onclick={onClose}>
                        <span>{l.label}</span>
                        <span class="chev" aria-hidden="true">›</span>
                    </a>
                {/each}
            </section>
        {/each}

        <div class="foot">
            <a class="foot-btn" href="/find" onclick={onClose}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3-3M20 16H7l3 3" /></svg>
                Change club
            </a>
            <button class="foot-btn out" type="button" onclick={() => { onClose(); onSignOut(); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" /></svg>
                Sign out
            </button>
        </div>
    </div>
{/if}

<style>
    .scrim {
        position: fixed;
        inset: 0;
        z-index: 790;
        background: rgba(0, 0, 0, 0.6);
        border: none;
        padding: 0;
        cursor: default;
    }

    /* Sits on the tab bar, which stays visible so Me can close it again. */
    .sheet {
        position: fixed;
        left: 0;
        right: 0;
        bottom: calc(64px + env(safe-area-inset-bottom));
        z-index: 795;
        max-height: calc(100dvh - 120px);
        overflow-y: auto;
        padding: 10px 22px 20px;
        background: #13161e;
        border-top: 1px solid var(--color-accent);
        border-radius: 14px 14px 0 0;
        box-shadow: 0 -18px 40px rgba(0, 0, 0, 0.6);
    }

    .handle {
        display: block;
        width: 40px;
        height: 4px;
        margin: 0 auto 14px;
        border-radius: 2px;
        background: #343a47;
    }

    .who { display: flex; align-items: center; gap: 12px; }

    .avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        flex: none;
        object-fit: cover;
    }

    .initials {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #2a2f3c;
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.25rem;
        color: var(--color-text-bright);
    }

    .who-text { display: flex; flex-direction: column; min-width: 0; }
    .who-name { font-weight: 700; font-size: 1.05rem; color: var(--color-text-bright); }
    .who-club { font-size: 0.82rem; color: var(--color-text-dim); }

    .group { margin-top: 16px; }

    .group h2 {
        margin: 0 0 2px;
        font-family: var(--font-heading);
        font-weight: 600;
        font-size: 0.82rem;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--color-accent);
    }

    .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 48px;
        border-top: 1px solid #1c2029;
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.3rem;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--color-text-bright);
        text-decoration: none;
    }

    .row:active { color: var(--color-accent-bright); }
    .chev { font-family: var(--font-body); font-size: 1.3rem; color: #4a5060; }

    .foot {
        margin-top: 18px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }

    .foot-btn {
        min-height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border-radius: 5px;
        border: 1px solid #343a47;
        background: none;
        color: var(--color-text-muted);
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        text-decoration: none;
        cursor: pointer;
    }

    .foot-btn.out { border-color: rgba(212, 120, 108, 0.45); color: #d4786c; }
</style>
