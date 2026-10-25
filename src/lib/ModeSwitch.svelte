<!--
  Club night / Pick-up game: the two modes of the Sign up tab, as one switch
  at the top of both pages (/signup and /pickups). The bottom bar keeps SIGN UP
  lit on either, so flipping between them feels like one place.

  The gold thumb is named for the browser's page crossfade (view-transition-
  name), so flipping slides it across instead of it jumping between pages.
-->
<script lang="ts">
    let { mode, system = '' }: { mode: 'club' | 'pickup'; system?: string } = $props();

    const query = $derived(system ? `?${new URLSearchParams({ system })}` : '');
</script>

<nav class="mode" aria-label="What kind of game">
    <span class="thumb" class:right={mode === 'pickup'} aria-hidden="true"></span>
    <a href={`/signup${query}`} aria-current={mode === 'club' ? 'page' : undefined}>Club night</a>
    <a href={`/pickups${query}`} aria-current={mode === 'pickup' ? 'page' : undefined}>Pick-up game</a>
</nav>

<style>
    .mode {
        position: relative;
        display: grid;
        grid-template-columns: 1fr 1fr;
        padding: 4px;
        margin: 0 0 1rem;
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 8px;
    }

    .thumb {
        position: absolute;
        top: 4px;
        bottom: 4px;
        left: 4px;
        width: calc(50% - 4px);
        border-radius: 5px;
        background: rgba(201, 161, 74, 0.18);
        border: 1px solid var(--color-accent);
        view-transition-name: mode-thumb;
    }

    .thumb.right { left: 50%; }

    a {
        position: relative;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-decoration: none;
        color: var(--color-text-dim);
        transition: color 0.2s ease;
    }

    a[aria-current='page'] { color: var(--color-text-bright); }
    a:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; border-radius: 5px; }
</style>
