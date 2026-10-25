<!--
  The Me menu on a phone: a sheet that rises from the Me tab, so everything in
  it is under the thumb that opened it. Option C on the design canvas's "Me
  menu" page (2026-10-25): bold all-caps rows in groups, no icons, except on
  the two actions at the foot, Change club and Sign out.

  It drags: pull it down by the handle or header (or anywhere, when it isn't
  scrolled) and it follows the finger; let go past a third of its height, or
  with a flick, and it closes, otherwise it springs back. A drag never counts
  as a tap on a link. Tapping the handle closes it too.

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

    /* ---------- drag to dismiss ---------- */
    let sheetEl = $state<HTMLElement | null>(null);
    let dragY = $state(0);
    let dragging = $state(false);
    let settling = $state(false);
    let startY = 0;
    let startT = 0;
    let lastY = 0;
    let lastT = 0;
    let pointerId: number | null = null;
    let moved = false;

    function canDragFrom(target: EventTarget | null): boolean {
        if (!sheetEl) return false;
        if ((target as HTMLElement | null)?.closest('.grab')) return true;
        // Anywhere else only when the sheet isn't scrolled down, so dragging
        // inside a long sheet still scrolls it.
        return sheetEl.scrollTop <= 0;
    }

    function down(e: PointerEvent) {
        if (e.button !== 0 || !canDragFrom(e.target)) return;
        pointerId = e.pointerId;
        startY = lastY = e.clientY;
        startT = lastT = performance.now();
        moved = false;
        settling = false;
    }

    function move(e: PointerEvent) {
        if (pointerId !== e.pointerId) return;
        const dy = Math.max(0, e.clientY - startY);
        if (!dragging && dy > 6) {
            dragging = true;
            moved = true;
            sheetEl?.setPointerCapture(e.pointerId);
        }
        if (dragging) {
            dragY = dy;
            lastY = e.clientY;
            lastT = performance.now();
        }
    }

    function up(e: PointerEvent) {
        if (pointerId !== e.pointerId) return;
        pointerId = null;
        if (!dragging) return;
        dragging = false;
        const height = sheetEl?.offsetHeight ?? 400;
        const velocity = (e.clientY - lastY) / Math.max(1, performance.now() - lastT) || (dragY / Math.max(1, performance.now() - startT));
        if (dragY > height / 3 || velocity > 0.5) {
            onClose();
        } else {
            settling = true;
            dragY = 0;
        }
    }

    /** A drag that ends over a link must not follow it. */
    function swallowClickAfterDrag(e: MouseEvent) {
        if (moved) {
            e.preventDefault();
            e.stopPropagation();
            moved = false;
        }
    }

    $effect(() => {
        if (!open) {
            dragY = 0;
            dragging = false;
        }
    });

    /** Whether the sheet's content is taller than the sheet. When it isn't
     *  (the usual case), the whole sheet is a drag zone and the browser is
     *  told not to scroll or pull-to-refresh from it, which would cancel the
     *  drag mid-way. */
    let scrollable = $state(false);
    $effect(() => {
        if (open && sheetEl) scrollable = sheetEl.scrollHeight > sheetEl.clientHeight + 1;
    });

    const scrimOpacity = $derived(
        sheetEl && dragY > 0 ? Math.max(0, 1 - dragY / (sheetEl.offsetHeight || 400)) : 1
    );

    $effect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    });
</script>

{#if open}
    <button class="scrim" type="button" aria-label="Close menu" onclick={onClose}
            style={`opacity: ${scrimOpacity}`} transition:fade={{ duration: 160 }}></button>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Me" tabindex="-1"
         bind:this={sheetEl}
         class:dragging class:settling class:fixed={!scrollable}
         style={dragY ? `transform: translateY(${dragY}px)` : ''}
         onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}
         onclickcapture={swallowClickAfterDrag}
         ontransitionend={() => (settling = false)}
         transition:fly={{ y: 320, duration: 240, easing: cubicOut, opacity: 1 }}>
        <div class="grab">
        <button class="handle" type="button" aria-label="Close menu" onclick={onClose}><span></span></button>

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
        border-top: 1px solid #232733;
        border-radius: 14px 14px 0 0;
        box-shadow: 0 -18px 40px rgba(0, 0, 0, 0.6);
    }

    /* The handle and header: always a drag zone, and the browser doesn't
       try to scroll from here, so the drag gets every move. */
    .grab { touch-action: none; }

    .handle {
        display: block;
        width: 100%;
        height: 26px;
        margin: -10px 0 4px;
        padding: 0;
        background: none;
        border: none;
        cursor: grab;
    }

    .handle span {
        display: block;
        width: 44px;
        height: 5px;
        margin: 0 auto;
        border-radius: 3px;
        background: var(--color-accent);
    }

    .sheet.fixed { touch-action: none; }
    .sheet.dragging { transition: none; user-select: none; }
    .sheet.settling { transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1); }

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
