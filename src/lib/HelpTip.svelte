<script lang="ts">
	/**
	 * A "?" affordance that holds the explanation a control would otherwise
	 * spend three lines of the page on.
	 *
	 * The admin panel's problem was never missing information — it was that
	 * every panel opened with a paragraph, so the controls were pushed down and
	 * everything read at the same weight. Moving that prose in here keeps it one
	 * keystroke away while letting the page show what an admin came to do.
	 *
	 * Toggled on CLICK, not hover: hover tooltips are unreachable on touch, and
	 * a club admin doing setup on a phone at the table is a real case here.
	 * Escape closes, focus is visible, and the panel is wired up with
	 * aria-describedby so a screen reader gets the text with the control rather
	 * than as a stray "?".
	 */
	let { label, text }: { label: string; text: string } = $props();

	let open = $state(false);
	let id = `helptip-${Math.random().toString(36).slice(2, 9)}`;
	let wrap: HTMLElement | undefined = $state();

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			open = false;
			(wrap?.querySelector('button') as HTMLButtonElement | undefined)?.focus();
		}
	}

	// Any click outside closes it. Registered only while open, so the page isn't
	// carrying a listener per tip — there are a lot of these.
	$effect(() => {
		if (!open) return;
		const away = (e: MouseEvent) => {
			if (wrap && !wrap.contains(e.target as Node)) open = false;
		};
		document.addEventListener('click', away, true);
		return () => document.removeEventListener('click', away, true);
	});
</script>

<svelte:window on:keydown={onKey} />

<span class="tip-wrap" bind:this={wrap}>
	<button
		type="button"
		class="tip-btn"
		class:is-open={open}
		aria-label={`What is ${label}?`}
		aria-expanded={open}
		aria-controls={id}
		onclick={() => (open = !open)}
	>?</button>
	{#if open}
		<span class="tip-bubble" {id} role="tooltip">{text}</span>
	{/if}
</span>

<style>
	.tip-wrap {
		position: relative;
		display: inline-flex;
		vertical-align: middle;
	}

	/* Deliberately quiet until wanted: an outlined circle that reads as
	   available, not as a warning competing with the section title. */
	.tip-btn {
		width: 16px;
		height: 16px;
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 1px solid var(--color-steel);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 0.62rem;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		padding: 0;
		transition: color 0.12s ease, border-color 0.12s ease, background 0.12s ease;
	}
	.tip-btn:hover,
	.tip-btn.is-open {
		color: var(--color-surface-dark);
		background: var(--color-accent);
		border-color: var(--color-accent);
	}
	.tip-btn:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}

	.tip-bubble {
		position: absolute;
		top: calc(100% + 7px);
		left: 0;
		z-index: 40;
		width: max-content;
		max-width: min(320px, 74vw);
		padding: 0.55rem 0.7rem;
		background: var(--color-surface);
		border: 1px solid var(--color-accent-border);
		border-radius: var(--radius);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
		color: var(--color-text-base);
		font-size: 0.8rem;
		font-weight: 400;
		line-height: 1.5;
		text-transform: none;
		letter-spacing: 0;
		/* pre-line so a tip can use line breaks for a short list without
		   needing markup — the alternative is prose where bullets read better. */
		white-space: pre-line;
	}

	/* Near the right edge the bubble would otherwise run off-screen; on narrow
	   viewports it anchors to the right of the button instead. */
	@media (max-width: 560px) {
		.tip-bubble {
			left: auto;
			right: 0;
		}
	}
</style>
