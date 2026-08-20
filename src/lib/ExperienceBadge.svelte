<script lang="ts">
	import HelpTip from './HelpTip.svelte';

	/**
	 * A player's standing in one game system: games played, the tier that lands
	 * in, and a way to add games played elsewhere.
	 *
	 * Replaces the "Experience" dropdown on the signup form. That asked the same
	 * question every week and accepted a different answer each time, so nobody's
	 * status ever moved as they gained experience — someone fifteen games in
	 * could still be showing as New. This is counted from the games the club
	 * actually paired them for, so it moves on its own.
	 */
	export type ExperienceSummary = {
		system: string;
		tracked_games: number;
		extra_games: number;
		total_games: number;
		tier: string;
		experienced_at: number;
		veteran_at: number;
		next_tier_at: number | null;
	};

	let {
		exp,
		saving = false,
		error = null,
		onSaveExtra
	}: {
		exp: ExperienceSummary | null;
		saving?: boolean;
		error?: string | null;
		onSaveExtra: (extra: number) => void;
	} = $props();

	let editing = $state(false);
	let extraInput = $state('');

	function open() {
		extraInput = String(exp?.extra_games ?? 0);
		editing = true;
	}

	const tierClass = $derived(`exp-${(exp?.tier ?? 'new').toLowerCase()}`);
	// How many more games until the next tier. Shown because "3 games" alone
	// doesn't tell anyone what it takes to stop being New.
	const toGo = $derived(
		exp && exp.next_tier_at !== null ? exp.next_tier_at - exp.total_games : null
	);
</script>

{#if exp}
	<div class="exp">
		<div class="exp-row">
			<span class="exp-badge {tierClass}">{exp.tier}</span>
			<span class="exp-count">
				{exp.total_games}
				{exp.total_games === 1 ? 'game' : 'games'} of {exp.system}
			</span>
			<HelpTip
				label="experience"
				text={`Counted from the games your club has paired you for in ${exp.system} — it goes up on its own as you play, so you don't have to keep it updated. ${exp.experienced_at}+ games is Experienced, ${exp.veteran_at}+ is Veteran. Your opponent sees this on the pairing, so you both know what you're sitting down to.`}
			/>
		</div>

		{#if toGo !== null && toGo > 0}
			<p class="exp-next">{toGo} more to go before your next level.</p>
		{/if}

		{#if editing}
			<div class="exp-edit">
				<label class="field-label" for="exp-extra">Games played elsewhere</label>
				<div class="exp-edit-row">
					<input
						id="exp-extra"
						class="field-input exp-input"
						type="number"
						min="0"
						max="1000"
						bind:value={extraInput}
						disabled={saving}
					/>
					<button
						class="primary-button"
						type="button"
						disabled={saving}
						onclick={() => onSaveExtra(Number(extraInput) || 0)}
					>{saving ? 'Saving…' : 'Save'}</button>
					<button class="secondary-button" type="button" disabled={saving} onclick={() => (editing = false)}>
						Cancel
					</button>
				</div>
				{#if error}<p class="field-error">{error}</p>{/if}
			</div>
		{:else}
			<button class="exp-link" type="button" onclick={open}>
				{exp.extra_games > 0
					? `Includes ${exp.extra_games} you played elsewhere — edit`
					: 'Played some elsewhere?'}
			</button>
		{/if}
	</div>
{/if}

<style>
	.exp {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.exp-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	/* Outlined, matching the badge on the pairing card — a player should
	   recognise the thing on their pairing as the same thing they saw here. */
	.exp-badge {
		display: inline-block;
		padding: 0 8px;
		border-radius: 999px;
		border: 1px solid currentColor;
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.4px;
		white-space: nowrap;
	}
	.exp-new { color: #6eb46e; }
	.exp-experienced { color: #b8a878; }
	.exp-veteran { color: #d08a50; }

	.exp-count {
		font-size: 0.88rem;
		color: var(--color-text-base);
	}

	.exp-next {
		margin: 0;
		font-size: 0.78rem;
		color: var(--color-text-faint);
	}

	/* A quiet text button: correcting the count is rare, so it shouldn't look
	   like one of the form's real actions. */
	.exp-link {
		align-self: flex-start;
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		font-size: 0.78rem;
		color: var(--color-accent);
		text-decoration: underline;
		cursor: pointer;
	}
	.exp-link:hover { color: var(--color-text-bright); }

	.exp-edit {
		margin-top: 0.35rem;
	}
	.exp-edit-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.exp-input {
		width: 6.5rem;
		flex: 0 0 auto;
	}
</style>
