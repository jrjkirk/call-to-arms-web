<script lang="ts">
	/**
	 * Jump anywhere in a console with the keyboard.
	 *
	 * The admin console is sixteen tabs across two groups, times however many
	 * game systems the club runs. Every one of them is reachable, and every one
	 * of them takes a scan of the sidebar and a click. That is fine on the tab
	 * you use weekly and tiresome on the one you touch twice a year, which is
	 * most of them.
	 *
	 * So: ⌘K (Ctrl+K on Windows) opens a filter over every destination, arrow
	 * keys move, Enter goes. Type "web" and you are on Discord webhooks; type
	 * the name of a game system and you have switched to it. Nothing here is
	 * new capability — it is the same nav, addressed by name instead of by
	 * position.
	 *
	 * **It renders nothing until it is opened.** There was a trigger button at
	 * the top of the sidebar advertising the shortcut, and it was cut: a box
	 * that says "Jump to" is exactly the kind of furniture this console has
	 * been having stripped out of it. The cost is discoverability — nobody
	 * finds ⌘K unless they try it — which is the right trade for a shortcut
	 * that speeds up someone who already knows the console and costs nothing
	 * to anyone who does not.
	 *
	 * Matching is subsequence, not substring: "gsc" finds "Game System Config".
	 * That is what makes a short query worth typing, and it is why the ranking
	 * below prefers matches that are contiguous and start on a word.
	 */
	import { tick } from 'svelte';

	export type Command = {
		id: string;
		label: string;
		/** Shown to the right, and searched. "Club admin", "The Old World". */
		group: string;
		/** Extra words to match on that are not worth showing. */
		keywords?: string;
		run: () => void;
	};

	let { commands, label = 'Search' }: { commands: Command[]; label?: string } = $props();

	let open = $state(false);
	let query = $state('');
	let cursor = $state(0);
	let input = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLElement | null>(null);

	const BOUNDARY = /[\s\-&·]/;

	/**
	 * Score one candidate against the query, or null if it does not match.
	 * Lower is better, and the two match kinds live in separate bands.
	 *
	 * A whole-word or substring hit is band 0. A scattered subsequence is band
	 * 1000. That separation matters more than any tuning inside either band,
	 * because the subsequence pass is greedy: it takes the FIRST run of
	 * characters that works and never looks for a better one later in the
	 * string. Scoring "elo" against "League … elo rankings" that way finds
	 * l-e-a-g-u-e's `e`, then `l` in "Old", then `o` in "World", and never
	 * reaches the actual word — while "Players & blocks" happens to contain
	 * e…l-o and scores respectably. So League lost to Players & blocks for a
	 * query that is literally one of its keywords.
	 *
	 * Checking for a substring first costs one indexOf and removes that whole
	 * class of wrong answer. Subsequence stays, because it is what makes "gsc"
	 * find "Game System Config", but it can no longer outrank a real word.
	 */
	function score(haystack: string, needle: string): number | null {
		if (!needle) return 0;
		const h = haystack.toLowerCase();
		const n = needle.toLowerCase();

		const at = h.indexOf(n);
		if (at !== -1) {
			// Starting a word beats landing mid-word, and an earlier hit beats
			// a later one, but both are worth far less than being a hit at all.
			const onBoundary = at === 0 || BOUNDARY.test(h[at - 1]);
			return (onBoundary ? 0 : 40) + at + h.length * 0.01;
		}

		let hi = 0;
		let penalty = 0;
		let prev = -2;
		for (const ch of n) {
			const found = h.indexOf(ch, hi);
			if (found === -1) return null;
			// A gap costs, and a gap that does not land on a word boundary
			// costs more: "gsc" over "Game System Config" is three word-starts
			// and should beat an accidental scatter of the same three letters.
			if (found !== prev + 1) {
				penalty += found === 0 || BOUNDARY.test(h[found - 1]) ? 1 : 4;
			}
			prev = found;
			hi = found + 1;
		}
		// All else equal, prefer the shorter label: an exact-ish hit on
		// "League" should not lose to "League rankings webhook".
		return 1000 + penalty * 10 + h.length;
	}

	/** Anything at or above this came from the subsequence pass, not a substring. */
	const SUBSEQUENCE = 1000;
	/** What it costs to have matched only in the keywords, not the label. */
	const KEYWORD_COST = 200;

	/**
	 * Rank one command: how GOOD the match is outranks WHERE it was found.
	 *
	 * Both of the obvious orderings are wrong, and each was tried:
	 *
	 * - One combined haystack ranks by total length, so an entry with more
	 *   search keywords scores worse on its own name. "pair" put Auto-pairings
	 *   above Pairings.
	 * - Label-first, keywords-only-as-fallback puts any label match above any
	 *   keyword match. "elo" then put Players & blocks (which contains e…l-o
	 *   scattered across two words) above League, whose keywords contain the
	 *   literal word.
	 *
	 * So the band comes from match quality — substring beats subsequence — and
	 * matching in the keywords is a fixed cost inside the band, never a
	 * promotion out of it.
	 */
	function rank(cmd: Command, q: string): number | null {
		const direct = score(cmd.label, q);
		if (direct !== null && direct < SUBSEQUENCE) return direct;
		const full = score(`${cmd.label} ${cmd.group} ${cmd.keywords ?? ''}`, q);
		if (full !== null && full < SUBSEQUENCE) return full + KEYWORD_COST;
		if (direct !== null) return direct;
		return full === null ? null : full + KEYWORD_COST;
	}

	const results = $derived.by(() => {
		const q = query.trim();
		const scored: { cmd: Command; s: number }[] = [];
		for (const cmd of commands) {
			const s = rank(cmd, q);
			if (s !== null) scored.push({ cmd, s });
		}
		// Stable within a score so an unfiltered palette shows the nav in its
		// own order rather than alphabetically by accident.
		scored.sort((a, b) => a.s - b.s);
		return scored.slice(0, 40).map((r) => r.cmd);
	});

	// Any change to the result set puts the cursor back on the first row.
	// Without this, typing a fourth letter could leave it highlighting row six
	// of a list that now has two.
	$effect(() => {
		void results;
		cursor = 0;
	});

	async function show() {
		open = true;
		query = '';
		cursor = 0;
		await tick();
		input?.focus();
	}

	function hide() {
		open = false;
	}

	function choose(cmd: Command | undefined) {
		if (!cmd) return;
		hide();
		cmd.run();
	}

	/** Keep the highlighted row on screen when arrowing past the fold. */
	function reveal() {
		const el = listEl?.querySelector('[data-active="true"]') as HTMLElement | null;
		el?.scrollIntoView({ block: 'nearest' });
	}

	function onWindowKey(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			open ? hide() : show();
		}
	}

	async function onPanelKey(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			hide();
			return;
		}
		if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
			e.preventDefault();
			cursor = Math.min(cursor + 1, results.length - 1);
			await tick();
			reveal();
		} else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
			e.preventDefault();
			cursor = Math.max(cursor - 1, 0);
			await tick();
			reveal();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			choose(results[cursor]);
		}
	}
</script>

<svelte:window onkeydown={onWindowKey} />

{#if open}
	<!-- The scrim closes on click. It is not a focus trap: the panel takes
	     focus on open and Escape closes, which is the behaviour people expect
	     from this control and is enough for something that owns the screen for
	     a couple of seconds. -->
	<div
		class="palette-scrim"
		role="button"
		tabindex="-1"
		aria-label="Close"
		onclick={hide}
		onkeydown={(e) => e.key === 'Escape' && hide()}
	></div>
	<div class="palette" role="dialog" aria-modal="true" aria-label={label}>
		<input
			bind:this={input}
			class="palette-input"
			type="text"
			placeholder="Jump to…"
			autocomplete="off"
			spellcheck="false"
			bind:value={query}
			onkeydown={onPanelKey}
		/>
		<div class="palette-list" bind:this={listEl} role="listbox" aria-label="Results">
			{#each results as cmd, i (cmd.id)}
				<button
					type="button"
					class="palette-row"
					class:active={i === cursor}
					data-active={i === cursor}
					role="option"
					aria-selected={i === cursor}
					onmouseenter={() => (cursor = i)}
					onclick={() => choose(cmd)}
				>
					<span class="pr-label">{cmd.label}</span>
					<span class="pr-group">{cmd.group}</span>
				</button>
			{:else}
				<p class="palette-empty">Nothing matches “{query}”.</p>
			{/each}
		</div>
		<div class="palette-foot">
			<span><kbd>↑</kbd><kbd>↓</kbd> move</span>
			<span><kbd>↵</kbd> go</span>
			<span><kbd>esc</kbd> close</span>
		</div>
	</div>
{/if}

<style>
	.palette-scrim {
		position: fixed;
		inset: 0;
		background: rgba(4, 5, 8, 0.72);
		z-index: 90;
		border: 0;
		padding: 0;
	}
	.palette {
		position: fixed;
		/* Sat high rather than centred: the eye is already near the top of a
		   console, and a centred panel jumps the gaze down and back. */
		top: 12vh;
		left: 50%;
		transform: translateX(-50%);
		width: min(560px, calc(100vw - 2rem));
		z-index: 91;
		background: var(--color-surface);
		border: 1px solid var(--color-accent);
		border-radius: var(--radius);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
		overflow: hidden;
	}
	.palette-input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.85rem 1rem;
		background: transparent;
		border: 0;
		border-bottom: 1px solid var(--color-steel-border);
		color: var(--color-text-base);
		font-size: 1rem;
		font-family: inherit;
	}
	.palette-input:focus {
		outline: none;
	}
	.palette-list {
		max-height: min(52vh, 380px);
		overflow-y: auto;
		padding: 0.3rem;
	}
	.palette-row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		width: 100%;
		padding: 0.5rem 0.65rem;
		background: transparent;
		border: 0;
		border-radius: 4px;
		color: var(--color-text-base);
		font-size: 0.9rem;
		font-family: inherit;
		text-align: left;
		cursor: pointer;
	}
	.palette-row.active {
		background: var(--color-accent);
		color: #1b1206;
	}
	.pr-group {
		font-size: 0.74rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-dim);
		white-space: nowrap;
	}
	.palette-row.active .pr-group {
		color: rgba(27, 18, 6, 0.7);
	}
	.palette-empty {
		margin: 0;
		padding: 1rem 0.65rem;
		color: var(--color-text-dim);
		font-size: 0.85rem;
	}
	.palette-foot {
		display: flex;
		gap: 1rem;
		padding: 0.45rem 0.75rem;
		border-top: 1px solid var(--color-steel-border);
		color: var(--color-text-dim);
		font-size: 0.72rem;
	}
	.palette-foot kbd {
		border: 1px solid var(--color-steel-border);
		border-radius: 3px;
		padding: 0 0.25rem;
		margin-right: 0.15rem;
	}
</style>
