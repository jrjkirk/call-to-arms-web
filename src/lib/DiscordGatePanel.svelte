<script lang="ts">
	/**
	 * Admin configuration for the Discord membership gate.
	 *
	 * Extracted from the admin page so it can be previewed in isolation, and so
	 * it carries its own layout instead of borrowing utility classes built for
	 * other shapes (`.field-narrow` is 160px wide — fine for a numeric input,
	 * disastrous for paragraphs and a long select).
	 *
	 * Laid out as the three steps setup actually takes, because two of them
	 * belong to different people: pick the server (any app admin), get the bot
	 * added (needs Manage Server on the Discord, which at some clubs is someone
	 * outside the admin team), then turn it on.
	 */
	export type DiscordGate = {
		bot_configured: boolean;
		bot_username: string | null;
		bot_invite_url: string | null;
		guild_id: string | null;
		guild_name: string | null;
		connected: boolean;
		mode: string;
		can_enforce: boolean;
		suggested_guild_id: string | null;
		club_discord_url: string | null;
		available_guilds: { id: string; name: string }[] | null;
	};

	let {
		gate,
		guildInput = $bindable(''),
		saving = false,
		error = null,
		message = null,
		copied = false,
		onSave,
		onCopy
	}: {
		gate: DiscordGate | null;
		guildInput?: string;
		saving?: boolean;
		error?: string | null;
		message?: string | null;
		copied?: boolean;
		onSave: (body: { guild_id?: string; mode?: string }) => void;
		onCopy: () => void;
	} = $props();
</script>

<h3 class="gate-title">Discord Membership Gate</h3>
<p class="gate-intro">
	Optionally require players to be in your club's Discord server before they can sign up.
	Pairings, drops and call-outs are all announced there, so someone outside the server can't
	find out they've been paired. Only ever checked once, the first time a new player commits
	to a game — existing members are unaffected.
</p>

{#if error}
	<p class="gate-alert gate-alert-bad">{error}</p>
{/if}
{#if message}
	<p class="gate-alert gate-alert-ok">{message}</p>
{/if}

{#if !gate}
	<p class="gate-hint">Loading…</p>
{:else if !gate.bot_configured}
	<p class="gate-alert gate-alert-bad">
		The Call to Arms Discord bot isn't set up on this platform yet. Contact the platform
		admin — this isn't something your club can fix.
	</p>
{:else}
	<!-- Status first: the single thing an admin opens this panel to check,
	     especially while waiting on someone else to add the bot. -->
	<div class="gate-status" class:is-on={gate.connected}>
		{#if gate.connected}
			<span class="gate-dot on"></span>
			<span>Connected to <strong>{gate.guild_name}</strong></span>
		{:else if gate.guild_id}
			<span class="gate-dot off"></span>
			<span>Server set, but the bot hasn't been added to it yet</span>
		{:else}
			<span class="gate-dot off"></span>
			<span>Not set up</span>
		{/if}
	</div>

	<section class="gate-step">
		<h4 class="gate-step-title">1. Your Discord server</h4>

		{#if gate.available_guilds && gate.available_guilds.length > 0}
			<label class="gate-label" for="gate-guild-picker">Pick your server</label>
			<select
				id="gate-guild-picker"
				class="gate-select"
				value={gate.guild_id ?? ''}
				onchange={(e) => onSave({ guild_id: e.currentTarget.value })}
				disabled={saving}
			>
				<option value="">— not set —</option>
				{#each gate.available_guilds as g}
					<option value={g.id}>{g.name}</option>
				{/each}
			</select>
			<p class="gate-hint">Servers the bot has been added to.</p>
		{/if}

		<label class="gate-label" for="gate-guild-id">Server ID</label>
		<div class="gate-row">
			<input
				id="gate-guild-id"
				class="gate-input"
				bind:value={guildInput}
				placeholder="123456789012345678"
				disabled={saving}
			/>
			<button class="gate-btn" type="button" disabled={saving} onclick={() => onSave({ guild_id: guildInput })}>
				{saving ? 'Saving…' : 'Save'}
			</button>
		</div>
		<p class="gate-hint">
			You can paste a server invite link here instead and we'll work it out.
			<a
				href="https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID"
				target="_blank"
				rel="noopener noreferrer">How do I find my Server ID?</a
			>
		</p>

		{#if gate.suggested_guild_id}
			<p class="gate-suggest">
				We found a server from your club's Discord invite link.
				<button class="gate-btn gate-btn-ghost" type="button" disabled={saving} onclick={() => onSave({ guild_id: gate?.suggested_guild_id ?? '' })}>
					Use it
				</button>
			</p>
		{/if}
	</section>

	<section class="gate-step">
		<h4 class="gate-step-title">2. Add the bot to that server</h4>
		<p class="gate-body">
			This needs the <strong>Manage Server</strong> permission on your Discord. If that isn't
			you, send this link to whoever runs it. The bot asks for no permissions — it can't read
			messages, post, or see your member list. It only checks whether a given person has joined.
		</p>

		{#if gate.bot_invite_url}
			<div class="gate-row">
				<code class="gate-code">{gate.bot_invite_url}</code>
				<button class="gate-btn" type="button" onclick={onCopy}>
					{copied ? 'Copied!' : 'Copy'}
				</button>
			</div>
		{/if}
	</section>

	<section class="gate-step">
		<h4 class="gate-step-title">3. Turn it on</h4>

		{#if !gate.can_enforce}
			<p class="gate-hint">
				Locked until the bot is connected — otherwise the check can't run and the gate would
				look active while letting everyone through.
			</p>
		{/if}

		<label class="gate-label" for="gate-mode">Mode</label>
		<select
			id="gate-mode"
			class="gate-select gate-select-wide"
			value={gate.mode}
			onchange={(e) => onSave({ mode: e.currentTarget.value })}
			disabled={saving || !gate.can_enforce}
		>
			<option value="off">Off — anyone can sign up</option>
			<option value="monitor">Monitor — log who would be blocked, block nobody</option>
			<option value="enforce">Enforce — require Discord membership</option>
		</select>
		<p class="gate-hint">
			Start on <strong>Monitor</strong> for a couple of weeks to see who would be caught before
			anyone actually is.
		</p>
	</section>
{/if}

<style>
	.gate-title {
		font-size: 1rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-accent);
		margin: 0 0 0.6rem;
	}
	.gate-intro,
	.gate-body {
		margin: 0 0 1rem;
		max-width: 68ch;
		color: var(--color-text-base);
		line-height: 1.5;
		font-size: 0.9rem;
	}
	.gate-body {
		margin-bottom: 0.7rem;
	}

	.gate-alert {
		margin: 0 0 0.9rem;
		padding: 0.55rem 0.8rem;
		border-radius: var(--radius);
		font-size: 0.85rem;
		max-width: 68ch;
	}
	.gate-alert-bad {
		background: rgba(210, 80, 80, 0.12);
		border: 1px solid rgba(210, 80, 80, 0.5);
		color: var(--color-text-bright);
	}
	.gate-alert-ok {
		background: var(--color-accent-soft);
		border: 1px solid var(--color-accent-border);
		color: var(--color-text-bright);
	}

	.gate-status {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.6rem 0.85rem;
		margin-bottom: 1.4rem;
		border-radius: var(--radius);
		background: var(--color-surface-dark);
		border: 1px solid var(--color-steel-border);
		font-size: 0.88rem;
		color: var(--color-text-base);
		max-width: 68ch;
	}
	.gate-status.is-on {
		border-color: var(--color-accent-border);
	}
	.gate-dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		flex: 0 0 auto;
	}
	.gate-dot.on {
		background: var(--color-win);
	}
	.gate-dot.off {
		background: var(--color-text-faint);
	}

	.gate-step {
		margin-bottom: 1.6rem;
	}
	.gate-step-title {
		font-size: 0.8rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-bright);
		margin: 0 0 0.6rem;
	}

	.gate-label {
		display: block;
		font-size: 0.75rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--color-text-dim);
		margin-bottom: 0.3rem;
	}

	/* The row wraps rather than shrinking its input — the whole reason the
	   first pass looked cramped was a 160px cap inherited from .field-narrow. */
	.gate-row {
		display: flex;
		align-items: stretch;
		gap: 0.5rem;
		flex-wrap: wrap;
		max-width: 640px;
		margin-bottom: 0.45rem;
	}
	.gate-input {
		flex: 1 1 260px;
		min-width: 0;
		background: var(--color-surface-dark);
		border: 1px solid var(--color-accent-border);
		border-radius: var(--radius);
		color: var(--color-text-base);
		padding: 7px 10px;
		font-size: 0.9rem;
	}
	.gate-input:focus {
		outline: none;
		border-color: var(--color-accent);
	}

	.gate-select {
		background: var(--color-surface-dark);
		border: 1px solid var(--color-accent-border);
		border-radius: var(--radius);
		color: var(--color-text-base);
		padding: 7px 10px;
		font-size: 0.9rem;
		cursor: pointer;
		max-width: 100%;
	}
	/* Wide enough for the longest option rather than truncating it. */
	.gate-select-wide {
		width: 100%;
		max-width: 460px;
	}
	.gate-select:disabled {
		opacity: 0.55;
		cursor: default;
	}

	.gate-btn {
		flex: 0 0 auto;
		background: var(--color-accent);
		color: #111;
		border: 1px solid var(--color-accent);
		border-radius: var(--radius);
		padding: 0 14px;
		height: 2.2rem;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
	}
	.gate-btn:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.gate-btn-ghost {
		background: transparent;
		color: var(--color-accent);
		height: 1.9rem;
		font-weight: 600;
	}

	/* A URL, so monospace and breakable — not the italic .muted it borrowed
	   before, which read as a comment rather than something to copy. */
	.gate-code {
		flex: 1 1 320px;
		min-width: 0;
		display: block;
		background: var(--color-bg-deep);
		border: 1px solid var(--color-steel-border);
		border-radius: var(--radius);
		padding: 0.5rem 0.65rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.78rem;
		color: var(--color-text-dim);
		word-break: break-all;
		user-select: all;
	}

	.gate-hint {
		margin: 0 0 0.5rem;
		max-width: 68ch;
		font-size: 0.8rem;
		color: var(--color-text-dim);
		line-height: 1.45;
	}
	.gate-hint a {
		color: var(--color-accent);
	}

	.gate-suggest {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin: 0.5rem 0 0;
		font-size: 0.82rem;
		color: var(--color-text-dim);
	}
</style>
