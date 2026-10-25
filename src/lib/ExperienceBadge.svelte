<script lang="ts">
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
	// "Some" is the retired name for the middle tier; it reads oddly alone.
	const tierLabel = $derived(
		(exp?.tier ?? '').toLowerCase() === 'some' ? 'Experienced' : (exp?.tier ?? '')
	);
	/** The tier after this one, and how many games away it is. */
	const nextTier = $derived(
		exp && exp.next_tier_at != null
			? { name: exp.next_tier_at >= exp.veteran_at ? 'Veteran' : 'Experienced', away: Math.max(0, exp.next_tier_at - exp.total_games) }
			: null
	);
</script>

{#if exp}
	<div class="exp">
		<!-- The tier as a coloured word, the games as the number, and how far
		     the next tier is. -->
		<div class="exp-row">
			<b class="exp-tier {tierClass}">{tierLabel}</b>
			<span class="exp-games"><b>{exp.total_games}</b> {exp.total_games === 1 ? 'game' : 'games'}</span>
			{#if nextTier}<span class="exp-next">{nextTier.away} to {nextTier.name}</span>{/if}
			{#if !editing}
				<button class="exp-link" type="button" onclick={open}>Edit</button>
			{/if}
		</div>

		{#if editing}
			<div class="exp-edit">
				<label class="field-label" for="exp-extra">Games elsewhere</label>
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
		align-items: baseline;
		gap: 0.4rem 0.9rem;
		flex-wrap: wrap;
	}

	/* A coloured word, not a pill (design rule 4). */
	.exp-tier {
		font-family: var(--font-heading);
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		white-space: nowrap;
	}
	.exp-games { color: var(--color-text-dim); font-size: 0.9rem; }
	.exp-games b {
		font-family: var(--font-heading);
		font-size: 1.3rem;
		color: var(--color-text-bright);
		font-variant-numeric: tabular-nums;
	}
	.exp-next { color: var(--color-text-faint); font-size: 0.85rem; }
	.exp-new { color: #6eb46e; }
	.exp-experienced { color: #b8a878; }
	.exp-veteran { color: #d08a50; }


	/* A quiet text button: correcting the count is rare, so it shouldn't look
	   like one of the form's real actions. */
	.exp-link {
		background: none;
		border: none;
		padding: 0.3rem 0;
		font-family: var(--font-heading);
		font-size: 0.9rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-accent);
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
