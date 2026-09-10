<script lang="ts">
	/**
	 * A faction's icon, preferring the SVG and falling back to the PNG.
	 *
	 * Both files have existed side by side in static/icons/<FOLDER>/ for
	 * months — about ninety SVGs across five systems — and nothing ever served
	 * them, because factionIconUrl() has always returned `.png`. On a retina
	 * screen the difference is obvious on the pairings page, where the icon
	 * sits next to a name at a size the PNG was never cut for.
	 *
	 * Why an onerror swap rather than <picture>: <picture> chooses a source by
	 * MIME type, not by whether the file is actually there, and every browser
	 * claims SVG support. It would pick the SVG unconditionally and show a
	 * broken image for the systems that only ever got PNGs. A 404 handler is
	 * the only thing that reacts to the file being missing.
	 *
	 * The cost is one wasted request per PNG-only faction, once, then the
	 * browser caches the 404. That is the right way round: new systems are
	 * expected to ship SVGs, so the wasted request shrinks over time rather
	 * than growing.
	 */
	import { factionSlug } from './factions';

	let {
		faction,
		folder,
		class: className = '',
		alt = ''
	}: {
		faction: string | null | undefined;
		/* Undefined where a caller has not resolved a system yet (the league
		   page renders before its system picker settles). Nothing renders in
		   that case, rather than requesting /icons/undefined/. */
		folder: string | null | undefined;
		class?: string;
		alt?: string;
	} = $props();

	const slug = $derived(factionSlug(faction));

	/* Which format this element is currently attempting. Keyed off slug+folder
	   so that a row re-rendering with a different faction starts again at the
	   SVG rather than inheriting the previous faction's fallback state. */
	let attempt = $state<'svg' | 'png' | 'gone'>('svg');
	let attemptKey = $state('');

	const key = $derived(`${folder}/${slug}`);
	$effect(() => {
		if (key !== attemptKey) {
			attemptKey = key;
			attempt = 'svg';
		}
	});

	const src = $derived(
		!slug || !folder || attempt === 'gone'
			? null
			: `/icons/${folder}/${slug}.${attempt}`
	);

	function onError() {
		// SVG missing is the ordinary case for the older systems. PNG missing
		// too means this faction simply has no artwork, which is allowed
		// everywhere — the name still renders, here and in the posted image.
		attempt = attempt === 'svg' ? 'png' : 'gone';
	}
</script>

{#if src}
	<img class={className} {src} {alt} loading="lazy" onerror={onError} />
{/if}
