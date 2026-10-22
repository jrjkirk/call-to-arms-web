<script lang="ts">
	import { PUBLIC_API_URL } from '$env/static/public';

	/**
	 * Ask for factions to be added to this system's list.
	 *
	 * A system's faction list is shared by every club, so a system admin asks
	 * rather than edits: the platform admin approves each name (fixing the
	 * spelling if needed) from the queue on Platform Admin. Additions only —
	 * renaming or removing a faction would orphan every signup holding the old
	 * name, so those go to the platform admin directly.
	 *
	 * The "similar to" warning is here, before submitting, because the server
	 * only catches exact (case- and spacing-blind) repeats. "Wolf Scout" next
	 * to an existing "Wolf Scouts" is far more likely a typo than a new team.
	 */
	let {
		system,
		factions = [],
		groups = []
	}: { system: string; factions?: string[]; groups?: string[] } = $props();

	type Row = {
		id: number;
		name: string;
		status: 'pending' | 'approved' | 'declined';
		approved_name: string | null;
		decline_reason: string | null;
		created_at: string;
	};

	let namesText = $state('');
	let note = $state('');
	let group = $state('');
	let busy = $state(false);
	let error = $state('');
	let result = $state('');
	let history = $state<Row[]>([]);

	const names = $derived(
		namesText
			.split('\n')
			.map((n) => n.trim().replace(/\s+/g, ' '))
			.filter(Boolean)
	);

	function key(s: string): string {
		return s.toLowerCase().replace(/[^a-z0-9]/g, '');
	}

	function distance(a: string, b: string): number {
		if (Math.abs(a.length - b.length) > 2) return 3;
		const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
		for (let j = 1; j <= b.length; j++) d[0][j] = j;
		for (let i = 1; i <= a.length; i++) {
			for (let j = 1; j <= b.length; j++) {
				d[i][j] = Math.min(
					d[i - 1][j] + 1,
					d[i][j - 1] + 1,
					d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
				);
			}
		}
		return d[a.length][b.length];
	}

	/** name -> the existing faction it most looks like, if any. */
	const similar = $derived.by(() => {
		const out: { name: string; existing: string; same: boolean }[] = [];
		for (const n of names) {
			const k = key(n);
			if (!k) continue;
			const hit = factions.find((f) => {
				const fk = key(f);
				return fk === k || (k.length > 4 && (fk.includes(k) || k.includes(fk))) || distance(fk, k) <= 2;
			});
			if (hit) out.push({ name: n, existing: hit, same: key(hit) === k });
		}
		return out;
	});

	async function loadHistory() {
		try {
			const r = await fetch(
				`${PUBLIC_API_URL}/admin/faction-requests?${new URLSearchParams({ system })}`,
				{ credentials: 'include' }
			);
			if (r.ok) history = (await r.json()).requests ?? [];
		} catch (_) {
			// The history is context; the form works without it.
		}
	}

	async function submit() {
		error = '';
		result = '';
		if (!names.length) {
			error = 'Add at least one faction, one per line.';
			return;
		}
		busy = true;
		try {
			const r = await fetch(`${PUBLIC_API_URL}/admin/faction-requests`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					system,
					names,
					note: note.trim() || null,
					suggested_group: group || null
				})
			});
			const data = await r.json().catch(() => ({}));
			if (!r.ok) {
				error = typeof data.detail === 'string' ? data.detail : 'Could not send the request.';
				return;
			}
			const sent = (data.requested ?? []) as string[];
			const skipped = (data.skipped ?? []) as { name: string; reason: string }[];
			result =
				`Sent ${sent.length === 1 ? '1 faction' : `${sent.length} factions`} for review.` +
				(skipped.length
					? ` Skipped: ${skipped.map((s) => `${s.name} (${s.reason})`).join(', ')}.`
					: '');
			namesText = '';
			note = '';
			await loadHistory();
		} catch (_) {
			error = 'Could not reach the server.';
		} finally {
			busy = false;
		}
	}

	// Runs on mount too, so it is the first load as well as the reset when
	// the admin switches to another system's tab.
	$effect(() => {
		system;
		namesText = '';
		note = '';
		group = '';
		error = '';
		result = '';
		loadHistory();
	});

	function statusText(r: Row): string {
		if (r.status === 'approved')
			return r.approved_name && r.approved_name !== r.name ? `added as ${r.approved_name}` : 'added';
		if (r.status === 'declined') return r.decline_reason ? `not added: ${r.decline_reason}` : 'not added';
		return 'waiting for review';
	}
</script>

<div class="fr">
	<p class="fr-lede">
		New teams or armies out? Ask for them here. Every club shares {system}'s list, so each name is
		checked before it goes live. You'll get a notice when it's done.
	</p>

	<label class="field-label" for="fr-names">Factions to add, one per line</label>
	<textarea
		id="fr-names"
		class="field-input fr-names"
		rows="4"
		placeholder={'One faction per line'}
		bind:value={namesText}
	></textarea>

	{#if similar.length}
		<ul class="fr-warn">
			{#each similar as s (s.name)}
				<li>
					{#if s.same}
						<strong>{s.name}</strong> is already in the list as <strong>{s.existing}</strong>.
					{:else}
						<strong>{s.name}</strong> looks like <strong>{s.existing}</strong>, which is already in
						the list. Check it's a different faction.
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<div class="fr-row">
		{#if groups.length}
			<div class="fr-field">
				<label class="field-label" for="fr-group">Category</label>
				<select id="fr-group" class="field-select" bind:value={group}>
					<option value="">Not sure</option>
					{#each groups as g}
						<option value={g}>{g}</option>
					{/each}
				</select>
			</div>
		{/if}
		<div class="fr-field fr-grow">
			<label class="field-label" for="fr-note">Note (optional)</label>
			<input
				id="fr-note"
				class="field-input"
				maxlength="500"
				placeholder="e.g. new in the latest season"
				bind:value={note}
			/>
		</div>
	</div>

	<div class="fr-actions">
		<button class="primary-button" type="button" disabled={busy || !names.length} onclick={submit}>
			{busy ? 'Sending…' : 'Request'}
		</button>
		{#if error}<p class="field-error">{error}</p>{/if}
		{#if result}<p class="fr-ok">{result}</p>{/if}
	</div>

	{#if history.length}
		<div class="fr-history">
			<p class="field-label">Requested from this club</p>
			<ul>
				{#each history.slice(0, 10) as r (r.id)}
					<li class="fr-h fr-{r.status}">
						<span class="fr-h-name">{r.name}</span>
						<span class="fr-h-status">{statusText(r)}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>

<style>
	.fr {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.fr-lede {
		margin: 0 0 0.35rem;
		font-size: 0.88rem;
		color: var(--color-text-muted);
		line-height: 1.4;
	}

	.fr-names {
		resize: vertical;
		min-height: 5rem;
	}

	.fr-warn {
		margin: 0;
		padding: 0.5rem 0.75rem 0.5rem 1.6rem;
		border: 1px solid var(--color-accent-border);
		border-radius: var(--radius);
		font-size: 0.85rem;
		color: var(--color-text-base);
	}

	.fr-row {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.fr-field {
		min-width: 9rem;
	}

	.fr-grow {
		flex: 1;
		min-width: 12rem;
	}

	.fr-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}


	.fr-ok {
		margin: 0;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.fr-history ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.fr-h {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.85rem;
		padding: 0.3rem 0;
		border-bottom: 1px solid var(--color-steel-border-soft);
	}

	.fr-h-status {
		color: var(--color-text-dim);
		text-align: right;
	}

	.fr-approved .fr-h-status {
		color: var(--color-accent);
	}
</style>
