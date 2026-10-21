<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { fly } from 'svelte/transition';

	/**
	 * The news a player who doesn't read the club's Discord would otherwise
	 * miss: pairings going up, an opponent dropping out, a late signup giving
	 * them a game after all.
	 *
	 * Server-side (GET /notices) rather than worked out in the browser, because
	 * a browser can spot a newly published week on its own but has no way to
	 * know your opponent dropped: nothing about a published week changes shape
	 * when that happens. Dismissing posts back, so reading it on a phone clears
	 * it on the laptop.
	 *
	 * Re-checked when the tab becomes visible again, at most once a minute, so
	 * a publish during an open session still lands without a reload. There is
	 * no service worker and no real push here on purpose: the one this app had
	 * was removed after it wedged clients on stale assets.
	 */
	let { authed = false }: { authed?: boolean } = $props();

	type Notice = {
		id: number;
		kind: string;
		system: string;
		week: string;
		body: string;
		created_at: string;
	};

	let notices = $state<Notice[]>([]);
	let lastChecked = 0;

	const MIN_GAP_MS = 60_000;

	async function load(force = false) {
		if (!authed) return;
		const now = Date.now();
		if (!force && now - lastChecked < MIN_GAP_MS) return;
		lastChecked = now;
		try {
			const r = await fetch(`${PUBLIC_API_URL}/notices`, { credentials: 'include' });
			if (!r.ok) return;
			const data = await r.json();
			// Signed out while this was in flight: these are no longer ours to show.
			if (!authed) return;
			notices = Array.isArray(data.notices) ? data.notices : [];
		} catch (_) {
			// A missing banner is not worth an error on the page.
		}
	}

	async function dismiss(n: Notice) {
		notices = notices.filter((x) => x.id !== n.id);
		try {
			await fetch(`${PUBLIC_API_URL}/notices/seen`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids: [n.id] })
			});
		} catch (_) {
			// It stays unseen server-side and comes back next visit. Better that
			// way round than a notice that vanishes without being read.
		}
	}

	function pairingsHref(n: Notice): string {
		const params = new URLSearchParams({ system: n.system, week: n.week });
		return `/pairings?${params.toString()}`;
	}

	function title(kind: string): string {
		if (kind === 'opponent_dropped') return 'Your game has changed';
		if (kind === 'game_found') return 'You have a game';
		if (kind === 'faction_request') return 'Faction request';
		return 'Pairings are up';
	}

	// The first load comes from the $effect below, once auth has resolved.
	onMount(() => {
		const onVisible = () => {
			if (document.visibilityState === 'visible') load();
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	// Signing in mid-session (or out) changes whose notices these are.
	$effect(() => {
		if (authed) {
			load(true);
		} else {
			notices = [];
		}
	});
</script>

{#if notices.length > 0}
	<div class="notice-stack" role="region" aria-label="Notifications" aria-live="polite">
		{#each notices as n (n.id)}
			<div class="notice" transition:fly={{ y: -8, duration: 220 }}>
				<div class="notice-text">
					<p class="notice-title">{title(n.kind)}</p>
					<p class="notice-body">{n.body}</p>
					<!-- A faction request's outcome isn't about a week, so there
					     are no pairings to point at. -->
					{#if n.kind !== 'faction_request'}
						<a class="notice-link" href={pairingsHref(n)} onclick={() => dismiss(n)}>
							View pairings
						</a>
					{/if}
				</div>
				<button
					type="button"
					class="notice-close"
					onclick={() => dismiss(n)}
					aria-label="Dismiss notification"
				>
					&times;
				</button>
			</div>
		{/each}
	</div>
{/if}

<style>
	/* Fixed rather than in the page flow: it is news that arrived, not part of
	   whatever page you happen to be on, and it must not shove the layout
	   around while you are reading it. */
	.notice-stack {
		position: fixed;
		z-index: 120;
		right: 1rem;
		bottom: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: min(22rem, calc(100vw - 2rem));
		pointer-events: none;
	}

	.notice {
		pointer-events: auto;
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		padding: 0.75rem 0.85rem;
		border-radius: var(--radius);
		border: 1px solid var(--color-accent);
		background: var(--color-surface);
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
	}

	.notice-text {
		flex: 1;
		min-width: 0;
	}

	.notice-title {
		margin: 0 0 0.2rem;
		font-family: var(--font-display, inherit);
		font-size: 0.8rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--color-accent);
	}

	.notice-body {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.35;
		color: var(--color-text-base);
	}

	.notice-link {
		display: inline-block;
		margin-top: 0.45rem;
		font-size: 0.82rem;
		color: var(--color-accent);
	}

	/* Sized as a real touch target: this is the only way out of the box, and a
	   1rem glyph on a phone is a coin toss. */
	.notice-close {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 2rem;
		min-height: 2rem;
		margin: -0.35rem -0.35rem 0 0;
		background: none;
		border: none;
		color: var(--color-text-muted);
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
	}

	.notice-close:hover {
		color: var(--color-text-base);
	}

	@media (max-width: 600px) {
		.notice-stack {
			left: 1rem;
			right: 1rem;
			width: auto;
		}
	}
</style>
