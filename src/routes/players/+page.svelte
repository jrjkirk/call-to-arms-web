<script lang="ts">
    let { data } = $props();
</script>

<h1>Players</h1>

<ul>
    {#each data.players as player}
        <li>
            <a href="/players/{player.id}">
                {player.name}
                {#if player.default_faction}
                    <span class="faction">— {player.default_faction}</span>
                {/if}
            </a>
        </li>
    {/each}
</ul>

<style>
    ul {
        list-style: none;
        padding: 0;
    }
    li {
        padding: 0.25rem 0;
    }
    a {
        text-decoration: none;
        color: inherit;
    }
    a:hover {
        text-decoration: underline;
    }
    .faction {
        color: #888;
        font-size: 0.9em;
    }
</style>