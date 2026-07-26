<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { groupByRegion } from '$lib/regions';

	type Club = {
		name: string;
		slug: string;
		region: string | null;
	};

	// Optional: highlight the club the visitor is currently on, and let the
	// caller reuse this as a "My Clubs" switcher later (Phase 4) by tweaking
	// the heading. Defaults suit the logged-out discovery use.
	let { currentSlug = null, heading = 'Jump to a club' }: {
		currentSlug?: string | null;
		heading?: string;
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
	<div class="club-network">
		<label class="club-network-heading" for="club-network-select">{heading}</label>
		<select id="club-network-select" class="club-network-select" onchange={go}>
			<option value="" selected={currentSlug === null}>Choose a club…</option>
			{#each grouped as group}
				<optgroup label={group.region}>
					{#each group.items as club}
						<option value={club.slug} selected={club.slug === currentSlug}>
							{club.name}{club.slug === currentSlug ? ' (here)' : ''}
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
</style>
