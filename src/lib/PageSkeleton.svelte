<!--
  A page's title and the rough shape of its content, shown while the page's
  first checks are still out. A tap on a bottom tab then shows that tab at
  once, rather than a blank screen until every request has answered.
-->
<script lang="ts">
    let { title, blocks = 3 }: { title: string; blocks?: number } = $props();
</script>

<div class="skel" aria-busy="true">
    <h1>{title}</h1>
    {#each Array(blocks) as _, i}
        <div class="block" class:short={i === 0}></div>
    {/each}
</div>

<style>
    h1 {
        font-size: 2.4rem;
        font-weight: 700;
        line-height: 1;
        text-transform: uppercase;
        margin: 0 0 1rem;
    }

    .block {
        height: 160px;
        margin-bottom: 14px;
        border-radius: 6px;
        border: 1px solid #232733;
        background: linear-gradient(100deg, #13161e 30%, #191d27 50%, #13161e 70%) 0 0 / 300% 100%;
        animation: shimmer 1.4s ease-in-out infinite;
    }

    .block.short { height: 84px; }

    @keyframes shimmer { to { background-position: -150% 0; } }

    @media (prefers-reduced-motion: reduce) { .block { animation: none; } }

    @media (max-width: 560px) { h1 { font-size: 2.1rem; } }
</style>
