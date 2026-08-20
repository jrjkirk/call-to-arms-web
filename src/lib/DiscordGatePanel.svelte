<script lang="ts">
	/**
	 * The club-wide DEFAULT Discord server — the one a game night uses when it
	 * hasn't been given its own.
	 *
	 * This panel used to be the whole gate, club-wide. It isn't any more: the
	 * gate is opted in and enforced PER GAME NIGHT (SystemDiscordGatePanel),
	 * because a club can run each night out of a different Discord server. Its
	 * old off/monitor/enforce selector has been REMOVED rather than left
	 * disabled — every gated action now resolves through the per-system opt-in,
	 * so that control could no longer switch anything on. An admin setting it to
	 * "Enforce" and believing they were protected is exactly the false
	 * reassurance the rest of this feature is built to avoid.
	 *
	 * What's left here is real and still used: the server set here is inherited
	 * by every system that hasn't set its own, and the bot invite is the same
	 * one those systems need.
	 */
	export type DiscordGate = {
		bot_configured: boolean;
		bot_username: string | null;
		bot_invite_url: string | null;
		guild_id: string | null;
		guild_name: string | null;
		connected: boolean;
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
		onSave: (body: { guild_id?: string }) => void;
		onCopy: () => void;
	} = $props();
</script>

<h3 class="gate-title">Club-wide Discord Server</h3>
<p class="gate-intro">
	The default server for your club. Any game night that hasn't been given its own Discord
	uses this one — so if everything at your club runs out of a single server, set it here once
	and you're done.
</p>
<p class="gate-alert gate-alert-info">
	<strong>Switching the membership gate on happens per game night</strong>, not here — open a
	system's <strong>Club card</strong> tab to opt it in and choose monitor or enforce. That's
	because a club can run each night out of a different Discord server, so “require the
	Discord” has to mean a specific one.
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
			<span>No club-wide server set</span>
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

		{#if gate.connected}
			<p class="gate-body">
				Already done — the bot is in <strong>{gate.guild_name}</strong> and can see who's a
				member.
			</p>
		{:else}
			<p class="gate-body">
				<strong>Someone with the “Manage Server” permission on that Discord has to do this</strong>,
				and at a lot of clubs that isn't the same person who runs the app. If it isn't you, send
				them the link below — they need no account here and no involvement beyond this one step.
			</p>

			<ol class="gate-steps">
				<li>Open the link below while signed in to Discord as someone with Manage Server.</li>
				<li>
					Discord shows an <strong>“Add to Server”</strong> screen with a dropdown. Pick your
					club's server.
					<span class="gate-note">
						Not in the list? That account doesn't have Manage Server on it — ask whoever set
						the server up.
					</span>
				</li>
				<li>
					Press <strong>Continue</strong>, then <strong>Authorize</strong>.
					<span class="gate-note">
						The permissions list will be <em>empty</em>. That's correct, not a bug — see below.
					</span>
				</li>
				<li>Solve the captcha if Discord shows one.</li>
				<li>Come back here and reload the page to confirm it worked.</li>
			</ol>
		{/if}

		{#if gate.bot_invite_url}
			<div class="gate-row">
				<code class="gate-code">{gate.bot_invite_url}</code>
				<button class="gate-btn" type="button" onclick={onCopy}>
					{copied ? 'Copied!' : 'Copy'}
				</button>
			</div>
		{/if}

		<!-- The "what can this thing see" answer, spelled out. Whoever adds the
		     bot is often outside the club's admin team and is being asked to put
		     an unknown app into their server — a vague reassurance is not enough
		     to get a reasonable person to say yes. -->
		<p class="gate-hint">
			<strong>What the bot can do:</strong> nothing except check whether a named person has
			joined. The invite requests <em>zero</em> permissions, which is why the authorize screen
			looks empty — it can't read or post messages, can't see your channels, and can't list your
			members.
			<a
				href="https://support.discord.com/hc/en-us/articles/21334461140375-Using-Apps-on-Discord"
				target="_blank"
				rel="noopener noreferrer">Discord's own guide to adding apps</a
			>
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

	/* Distinct from .gate-alert-bad/-ok: this one is a signpost, not a problem
	   or a success. */
	.gate-alert-info {
		background: rgba(88, 101, 242, 0.1);
		border: 1px solid rgba(88, 101, 242, 0.5);
		color: var(--color-text-base);
	}

	/* The add-the-bot walkthrough. Numbered because it's a sequence performed on
	   another site, often by someone who has never seen this app — prose would
	   make them guess at the order. */
	.gate-steps {
		margin: 0 0 0.9rem;
		padding-left: 1.3rem;
		max-width: 68ch;
		color: var(--color-text-base);
		font-size: 0.88rem;
		line-height: 1.55;
	}
	.gate-steps li {
		margin-bottom: 0.45rem;
	}
	/* The "if this goes wrong" line under a step, kept visually subordinate so
	   the happy path still reads as a straight sequence. */
	.gate-note {
		display: block;
		margin-top: 0.15rem;
		color: var(--color-text-muted);
		font-size: 0.85em;
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
