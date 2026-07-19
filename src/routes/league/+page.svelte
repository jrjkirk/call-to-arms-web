<!--
  Dead route, kept only so SvelteKit has a +page.svelte to pair with
  +page.server.ts's redirect to /leagues. Never actually renders — the
  server load throws redirect(308, '/leagues') before this reaches the
  browser. See /leagues/+page.svelte for the real page (a system-tile
  picker over all of the club's league-enabled systems).
-->
