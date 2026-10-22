<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_API_URL } from '$env/static/public';

	/**
	 * The platform admin's review queue for faction requests.
	 *
	 * Grouped by submission (batch), because a new season arrives as six teams
	 * from one admin with one note, and reading them together is how you spot
	 * the one that is a typo of another. Each name is decided on its own
	 * (approve, approve with the spelling fixed, decline with a reason, or
	 * leave for later), and a batch's decisions go in one call so the list is
	 * edited once and the updates channel gets one post.
	 *
	 * Approving adds the name to the shared list straight away. The icon is the
	 * one thing the app can't do for you, so each approval lists the file to
	 * commit and where.
	 */
	let { onchange }: { onchange?: (pending: number) => void } = $props();

	type Req = {
		id: number;
		batch_id: string;
		created_at: string;
		club_name: string | null;
		system: string;
		name: string;
		suggested_group: string | null;
		note: string | null;
		status: 'pending' | 'approved' | 'declined';
		requested_by_name: string;
		approved_name: string | null;
		decline_reason: string | null;
		reviewed_by_name: string | null;
		icon_file: string;
	};
	type Choice = { action: 'approve' | 'decline' | 'leave'; name: string; group: string; reason: string };

	let status = $state<'pending' | 'all'>('pending');
	let rows = $state<Req[]>([]);
	let systems = $state<Record<string, { groups: string[]; icon_folder: string | null }>>({});
	let choices = $state<Record<number, Choice>>({});
	let loading = $state(false);
	let saving = $state<string | null>(null);
	let error = $state('');
	let icons = $state<{ system: string; folder: string | null; files: string[] }[]>([]);

	const batches = $derived.by(() => {
		const out: { id: string; rows: Req[] }[] = [];
		for (const r of rows) {
			const b = out.find((x) => x.id === r.batch_id);
			if (b) b.rows.push(r);
			else out.push({ id: r.batch_id, rows: [r] });
		}
		return out;
	});

	async function load() {
		loading = true;
		error = '';
		try {
			const r = await fetch(
				`${PUBLIC_API_URL}/admin/platform/faction-requests?${new URLSearchParams({ status })}`,
				{ credentials: 'include' }
			);
			if (!r.ok) {
				error = 'Could not load faction requests.';
				return;
			}
			const data = await r.json();
			rows = data.requests ?? [];
			systems = data.systems ?? {};
			const next: Record<number, Choice> = {};
			for (const x of rows) {
				next[x.id] = choices[x.id] ?? {
					action: 'leave',
					name: x.name,
					group: x.suggested_group ?? '',
					reason: ''
				};
			}
			choices = next;
			if (status === 'pending') onchange?.(rows.length);
		} catch (_) {
			error = 'Could not reach the server.';
		} finally {
			loading = false;
		}
	}

	function decided(batch: { rows: Req[] }): number {
		return batch.rows.filter((r) => r.status === 'pending' && choices[r.id]?.action !== 'leave').length;
	}

	function setAll(batch: { rows: Req[] }, action: Choice['action']) {
		for (const r of batch.rows) if (r.status === 'pending') choices[r.id].action = action;
	}

	async function apply(batch: { id: string; rows: Req[] }) {
		error = '';
		const decisions = batch.rows
			.filter((r) => r.status === 'pending' && choices[r.id].action !== 'leave')
			.map((r) => {
				const c = choices[r.id];
				return c.action === 'approve'
					? { id: r.id, action: 'approve', name: c.name.trim() || r.name, group: c.group || null }
					: { id: r.id, action: 'decline', reason: c.reason.trim() || null };
			});
		if (!decisions.length) return;
		saving = batch.id;
		try {
			const r = await fetch(`${PUBLIC_API_URL}/admin/platform/faction-requests/review`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ decisions })
			});
			const data = await r.json().catch(() => ({}));
			if (!r.ok) {
				error = typeof data.detail === 'string' ? data.detail : 'Could not save those decisions.';
				return;
			}
			const added = (data.added ?? {}) as Record<string, string[]>;
			const reviewed = (data.reviewed ?? []) as Req[];
			icons = [
				...icons,
				...Object.entries(added).map(([system, names]) => ({
					system,
					folder: systems[system]?.icon_folder ?? null,
					files: names.map(
						(n) => reviewed.find((x) => x.approved_name === n)?.icon_file ?? n
					)
				}))
			];
			await load();
		} catch (_) {
			error = 'Could not reach the server.';
		} finally {
			saving = null;
		}
	}

	function when(iso: string): string {
		return new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'short'
		});
	}

	onMount(load);
</script>

<div class="frq">
	<div class="frq-bar">
		<label class="frq-filter">
			<input type="checkbox" checked={status === 'all'} onchange={(e) => {
				status = e.currentTarget.checked ? 'all' : 'pending';
				load();
			}} />
			Show reviewed
		</label>
	</div>

	{#if error}<p class="field-error">{error}</p>{/if}

	{#if icons.length}
		<div class="frq-icons">
			<p class="frq-icons-title">Icons to add</p>
			{#each icons as i}
				<p class="frq-icons-line">
					<strong>{i.system}</strong>: commit
					{#each i.files as f, k}<code>{f}</code>{k < i.files.length - 1 ? ', ' : ''}{/each}
					to <code>icons/{i.folder ?? '?'}/</code> in the API repo and
					<code>static/icons/{i.folder ?? '?'}/</code> in the web repo.
				</p>
			{/each}
		</div>
	{/if}

	{#if loading && !rows.length}
		<p class="frq-empty">Loading…</p>
	{:else if !rows.length}
		<p class="frq-empty">{status === 'pending' ? 'Nothing waiting.' : 'No requests yet.'}</p>
	{/if}

	{#each batches as b (b.id)}
		{@const first = b.rows[0]}
		{@const groups = systems[first.system]?.groups ?? []}
		{@const open = b.rows.some((r) => r.status === 'pending')}
		<div class="frq-batch">
			<div class="frq-head">
				<span class="frq-system">{first.system}</span>
				<span class="frq-who">
					{first.requested_by_name}{first.club_name ? ` · ${first.club_name}` : ''} · {when(first.created_at)}
				</span>
			</div>
			{#if first.note}<p class="frq-note">“{first.note}”</p>{/if}

			{#each b.rows as r (r.id)}
				{@const c = choices[r.id]}
				<div class="frq-row">
					{#if r.status !== 'pending'}
						<span class="frq-name">{r.name}</span>
						<span class="frq-done frq-{r.status}">
							{r.status === 'approved'
								? `added${r.approved_name && r.approved_name !== r.name ? ` as ${r.approved_name}` : ''}`
								: `declined${r.decline_reason ? `: ${r.decline_reason}` : ''}`}
							{r.reviewed_by_name ? ` · ${r.reviewed_by_name}` : ''}
						</span>
					{:else if c}
						<input class="field-input frq-name-input" bind:value={c.name} aria-label="Faction name" />
						{#if groups.length}
							<select class="field-select frq-group" bind:value={c.group} aria-label="Category">
								<option value="">Category…</option>
								{#each groups as g}<option value={g}>{g}</option>{/each}
							</select>
						{/if}
						<div class="frq-seg" role="group" aria-label="Decision for {r.name}">
							{#each ['approve', 'decline', 'leave'] as a}
								<button
									type="button"
									class="frq-seg-btn"
									class:on={c.action === a}
									onclick={() => (c.action = a as Choice['action'])}
								>
									{a === 'approve' ? 'Add' : a === 'decline' ? 'Decline' : 'Later'}
								</button>
							{/each}
						</div>
						{#if c.action === 'decline'}
							<input
								class="field-input frq-reason"
								placeholder="Reason (shown to them)"
								bind:value={c.reason}
							/>
						{/if}
						{#if c.name.trim() && c.name.trim() !== r.name}
							<span class="frq-hint">was “{r.name}”</span>
						{/if}
					{/if}
				</div>
			{/each}

			{#if open}
				<div class="frq-actions">
					<button type="button" class="frq-link" onclick={() => setAll(b, 'approve')}>Add all</button>
					<button
						type="button"
						class="primary-button"
						disabled={!decided(b) || saving === b.id}
						onclick={() => apply(b)}
					>
						{saving === b.id ? 'Saving…' : `Apply ${decided(b) || ''}`.trim()}
					</button>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.frq {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.frq-bar {
		display: flex;
		justify-content: flex-end;
	}

	.frq-filter {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.85rem;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.frq-empty {
		margin: 0;
		color: var(--color-text-dim);
		font-size: 0.9rem;
	}

	.frq-batch {
		border: 1px solid var(--color-steel-border);
		border-radius: var(--radius);
		padding: 0.75rem 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.frq-head {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: baseline;
	}

	.frq-system {
		font-weight: 700;
		color: var(--color-accent);
	}

	.frq-who,
	.frq-hint {
		font-size: 0.82rem;
		color: var(--color-text-dim);
	}

	.frq-note {
		margin: 0;
		font-size: 0.88rem;
		color: var(--color-text-muted);
		font-style: italic;
	}

	.frq-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		padding: 0.35rem 0;
		border-top: 1px solid var(--color-steel-border-soft);
	}

	.frq-name-input {
		flex: 1;
		min-width: 10rem;
		width: auto;
	}

	.frq-group {
		width: auto;
		min-width: 8rem;
	}

	.frq-reason {
		flex-basis: 100%;
	}

	.frq-name {
		flex: 1;
	}

	.frq-done {
		font-size: 0.85rem;
		color: var(--color-text-dim);
	}

	.frq-done.frq-approved {
		color: var(--color-accent);
	}

	.frq-seg {
		display: inline-flex;
		border: 1px solid var(--color-steel-border);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.frq-seg-btn {
		background: none;
		border: none;
		color: var(--color-text-muted);
		font: inherit;
		font-size: 0.82rem;
		padding: 0.4rem 0.7rem;
		min-height: 2.2rem;
		cursor: pointer;
	}

	.frq-seg-btn + .frq-seg-btn {
		border-left: 1px solid var(--color-steel-border);
	}

	.frq-seg-btn.on {
		background: var(--color-accent);
		color: #111;
		font-weight: 700;
	}

	.frq-actions {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 0.85rem;
	}

	.frq-link {
		background: none;
		border: none;
		color: var(--color-accent);
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		padding: 0.4rem 0;
	}


	.frq-icons {
		border: 1px solid var(--color-accent-border);
		border-radius: var(--radius);
		padding: 0.6rem 0.85rem;
	}

	.frq-icons-title {
		margin: 0 0 0.3rem;
		font-weight: 700;
		font-size: 0.85rem;
		color: var(--color-accent);
	}

	.frq-icons-line {
		margin: 0.2rem 0 0;
		font-size: 0.85rem;
		line-height: 1.5;
		word-break: break-word;
	}
</style>
