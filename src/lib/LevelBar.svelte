<script lang="ts">
	/**
	 * A player's level in one game system, with a bar showing progress through
	 * the current level.
	 *
	 * The bar deliberately tracks the CURRENT level, not the road to 60. Level
	 * 60 is ~220 games — years of play — and a bar creeping from 3% to 4% over
	 * a season is the opposite of encouraging. Progress within a level moves
	 * every game or two, which is the point.
	 *
	 * Bands borrow the game this is modelled on: common, then rare from 30,
	 * epic from 50, legendary at the cap.
	 */
	export type LevelProgress = {
		system: string;
		games: number;
		level: number;
		band: string;
		at_cap: boolean;
		level_cap: number;
		games_into_level: number;
		games_for_level: number;
		games_to_next: number;
		percent: number;
	};

	let { lv }: { lv: LevelProgress } = $props();

	/**
	 * Band colours are applied as an INLINE custom property, not via a
	 * `band-{lv.band}` class.
	 *
	 * They were classes, and Svelte's CSS optimiser deleted them: the class
	 * name is built from data at runtime, so the compiler can't see
	 * `.band-rare` used anywhere and prunes the rule that defines `--band`.
	 * The fill then painted `background: var(--band)` with nothing behind it —
	 * a visible track and an invisible bar. Worse, `.band-legendary .lvl-fill`
	 * survived with its unmatched ancestor stripped, which would have given
	 * every bar the legendary glow.
	 *
	 * Setting the value inline means there is no selector to prune. Any colour
	 * driven by server data should be applied this way.
	 */
	const BAND_COLOURS: Record<string, string> = {
		common: 'var(--color-text-bright)',
		rare: '#4a9eda',
		epic: '#a335ee',
		legendary: '#ff8000'
	};
	const bandColour = $derived(BAND_COLOURS[lv.band] ?? BAND_COLOURS.common);
	const isLegendary = $derived(lv.band === 'legendary');
</script>

<div class="lvl" style={`--band: ${bandColour}`} class:is-legendary={isLegendary}>
	<div class="lvl-top">
		<span class="lvl-name">{lv.system}</span>
		<span class="lvl-num">Level {lv.level}</span>
	</div>

	<div
		class="lvl-track"
		role="progressbar"
		aria-valuenow={lv.percent}
		aria-valuemin="0"
		aria-valuemax="100"
		aria-label={`Level ${lv.level} progress in ${lv.system}`}
	>
		<div class="lvl-fill" style={`width: ${lv.at_cap ? 100 : lv.percent}%`}></div>
	</div>

	<div class="lvl-foot">
		{#if lv.at_cap}
			<span>Maximum level · {lv.games} games</span>
		{:else}
			<span>{lv.games_to_next} to level {lv.level + 1}</span>
			<span class="lvl-games">{lv.games} games</span>
		{/if}
	</div>
</div>

<style>
	.lvl {
		background: var(--color-surface-dark);
		border: 1px solid var(--color-steel-border);
		border-radius: var(--radius);
		padding: 0.7rem 0.85rem;
	}

	.lvl-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
		margin-bottom: 0.45rem;
	}

	.lvl-name {
		font-size: 0.82rem;
		color: var(--color-text-muted);
	}

	/* The band colours the level number itself — the number is the thing a
	   player is proud of, so it carries the rarity rather than the whole card
	   glowing. */
	.lvl-num {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: var(--band);
	}

	.lvl-track {
		height: 7px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.35);
		overflow: hidden;
	}
	.lvl-fill {
		height: 100%;
		border-radius: 999px;
		background: var(--band);
		/* A level just started is genuinely at 0%, which renders as no bar at
		   all and reads as broken. A minimum sliver shows the bar exists and
		   which colour the player is. */
		min-width: 4px;
		transition: width 0.5s ease;
	}

	.lvl-foot {
		display: flex;
		justify-content: space-between;
		gap: 0.6rem;
		margin-top: 0.35rem;
		font-size: 0.74rem;
		color: var(--color-text-faint);
	}
	.lvl-games {
		white-space: nowrap;
	}

	/* The cap earns a glow. Nothing else does — if every band shimmered,
	   reaching 60 wouldn't look like anything. `is-legendary` is a STATIC class
	   name (class:is-legendary), so unlike the old band-{...} classes the
	   compiler can see it and won't prune these. */
	.is-legendary .lvl-num {
		text-shadow: 0 0 12px rgba(255, 128, 0, 0.55);
	}
	.is-legendary .lvl-fill {
		box-shadow: 0 0 10px rgba(255, 128, 0, 0.6);
	}

	@media (prefers-reduced-motion: reduce) {
		.lvl-fill { transition: none; }
	}
</style>
