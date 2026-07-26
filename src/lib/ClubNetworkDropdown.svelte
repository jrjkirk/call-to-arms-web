<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { groupByRegion } from '$lib/regions';

	type Club = {
		name: string;
		slug: string;
		region: string | null;
	};

	// `compact` renders a small inline label + narrow select for the topbar;
	// the default (full-width block) suits the logged-out hero's vertical stack.
	let {
		currentSlug = null,
		heading = 'Jump to a club',
		compact = false
	}: {
		currentSlug?: string | null;
		heading?: string;
		compact?: boolean;
	} = $props();

	let clubs = $state<Club[]>([]);
	let loaded = $state(false);

	const grouped = $derived(groupByRegion(clubs));

	onMount(async () => {
		try {
			const r = await fetch(`${PUBLIC_API_URL}/clubs`);
			if (r.ok) clubs = await r.json();
		} catch (_) {
			/* no clubs — the section stays hidden */
		}
		loaded = true;
	});

	function go(event: Event) {
		const slug = (event.currentTarget as HTMLSelectElement).value;
		if (!slug || slug === currentSlug) return;
		window.location.href = `https://${slug}.calltoarms.app`;
	}
</script>

{#if loaded && clubs.length > 1}
	<div class="club-network" class:compact>
		<span class="club-network-heading" id="club-network-label">{heading}</span>
		<select
			class="club-network-select"
			aria-labelledby="club-network-label"
			onchange={go}
		>
			{#if currentSlug === null}
				<option value="" selected>Choose a club…</option>
			{/if}
			{#each grouped as group}
				<optgroup label={group.region}>
					{#each group.items as club}
						<option value={club.slug} selected={club.slug === currentSlug}>
							{club.name}
						</option>
					{/each}
				</optgroup>
			{/each}
		</select>
	</div>
{/if}

<style>
	.club-network {
		width: 100%;
		margin-top: clamp(1.4rem, 3vw, 2rem);
	}

	.club-network-heading {
		display: block;
		color: var(--color-accent);
		font-size: 0.82rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		margin-bottom: 0.7rem;
	}

	.club-network-select {
		width: 100%;
		padding: 0.7rem 0.9rem;
		background: var(--color-surface);
		color: var(--color-text-base);
		border: 1px solid var(--color-steel-border);
		border-radius: var(--radius);
		font-family: var(--font-body, inherit);
		font-size: 0.95rem;
	}

	.club-network-select:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	/* Compact topbar variant: tiny caption above a narrow, truncating select. */
	.club-network.compact {
		width: auto;
		margin-top: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		align-items: flex-start;
	}

	.club-network.compact .club-network-heading {
		margin-bottom: 0;
		font-size: 0.6rem;
		letter-spacing: 1.2px;
	}

	.club-network.compact .club-network-select {
		width: auto;
		max-width: 220px;
		padding: 0.35rem 0.55rem;
		font-size: 0.82rem;
	}

	/* On mobile the compact switcher lives in the hamburger drawer — make it
	   full-width and clearly readable there rather than a tiny inline control. */
	@media (max-width: 768px) {
		.club-network.compact {
			width: 100%;
		}

		.club-network.compact .club-network-heading {
			font-size: 0.72rem;
		}

		.club-network.compact .club-network-select {
			width: 100%;
			max-width: none;
			padding: 0.6rem 0.7rem;
			font-size: 0.95rem;
		}
	}
</style>
