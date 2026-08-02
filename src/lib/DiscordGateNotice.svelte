<script lang="ts">
	import type { DiscordGateBlock } from './discordGate';

	/**
	 * Shown when the Discord membership gate refuses an action.
	 *
	 * The retry button is the important part: without it a player joins the
	 * Discord in another tab and then has no idea what to do next. It re-runs
	 * whatever they were trying to do, so "join, come back, click" is the whole
	 * recovery path.
	 */
	let {
		gate,
		onRetry,
		retrying = false
	}: {
		gate: DiscordGateBlock;
		onRetry: () => void;
		retrying?: boolean;
	} = $props();
</script>

<div class="gate">
	<p class="gate-title">One more step</p>
	<p class="gate-msg">{gate.message}</p>

	{#if gate.discord_url}
		<div class="gate-actions">
			<a class="gate-join" href={gate.discord_url} target="_blank" rel="noopener noreferrer">
				Join the Discord
			</a>
			<button class="gate-retry" type="button" onclick={onRetry} disabled={retrying}>
				{retrying ? 'Checking…' : "I've joined — try again"}
			</button>
		</div>
		<p class="gate-hint">Join in the new tab, then come back and hit “try again”.</p>
	{:else}
		<!-- The club has a gate switched on but no invite link saved. Nothing the
		     player can do about it, so point them at a human rather than
		     leaving a dead end. -->
		<p class="gate-hint">
			Ask a club admin for the Discord invite, then
			<button class="gate-inline" type="button" onclick={onRetry} disabled={retrying}>
				{retrying ? 'checking…' : 'try again'}
			</button>.
		</p>
	{/if}
</div>

<style>
	.gate {
		background: rgba(88, 101, 242, 0.1); /* Discord blurple, kept subtle */
		border: 1px solid rgba(88, 101, 242, 0.55);
		border-radius: var(--radius);
		padding: 0.9rem 1rem;
		margin-top: 0.75rem;
	}
	.gate-title {
		margin: 0 0 0.35rem;
		font-weight: 700;
		color: var(--color-text-bright);
	}
	.gate-msg {
		margin: 0 0 0.75rem;
		color: var(--color-text-base);
	}
	.gate-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.gate-join,
	.gate-retry {
		display: inline-block;
		padding: 0.5rem 0.9rem;
		border-radius: var(--radius);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
	}
	.gate-join {
		background: #5865f2;
		border: 1px solid #5865f2;
		color: #fff;
	}
	.gate-retry {
		background: transparent;
		border: 1px solid var(--color-accent);
		color: var(--color-accent);
	}
	.gate-retry:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.gate-hint {
		margin: 0.6rem 0 0;
		font-size: 0.85rem;
		color: var(--color-text-dim);
	}
	.gate-inline {
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--color-accent);
		text-decoration: underline;
		cursor: pointer;
	}
</style>
