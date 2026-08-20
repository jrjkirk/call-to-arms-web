<script lang="ts">
	/**
	 * Per-system Discord membership gate, owned by that system's own admin —
	 * same ownership model as the carousel card and mission pool beside it.
	 *
	 * Per system rather than per club because a club's game nights can each run
	 * out of a DIFFERENT Discord server. At EGNWGC, Kill Team and The Old World
	 * are separate servers and neither is a club-wide one, so a single club
	 * setting could only ever be right for one of them.
	 *
	 * The gate is opt-in: off unless this system's admin deliberately turns it
	 * on. Plenty of game nights don't want the friction, and an opt-in that a
	 * club-wide switch could flip for you isn't one.
	 *
	 * Laid out as the steps setup actually takes, because they belong to
	 * different people: opt in and pick the server (this admin), get the bot
	 * added (needs Manage Server on that Discord, often someone outside the
	 * admin team), then escalate to enforce.
	 */
	export type SystemDiscordGate = {
		system: string;
		enabled: boolean;
		mode: string;
		guild_id: string | null;
		guild_id_own: string | null;
		inherits_guild: boolean;
		guild_name: string | null;
		connected: boolean;
		can_enforce: boolean;
		discord_url: string | null;
		discord_url_own: string | null;
		inherits_url: boolean;
		club_name: string;
		club_guild_id: string | null;
		club_discord_url: string | null;
		bot_configured: boolean;
		bot_invite_url: string | null;
		available_guilds: { id: string; name: string }[] | null;
	};

	let {
		gate,
		system,
		guildInput = $bindable(''),
		inviteInput = $bindable(''),
		saving = false,
		error = null,
		message = null,
		copied = false,
		onSave,
		onCopy,
		onRecheck
	}: {
		gate: SystemDiscordGate | null;
		system: string;
		guildInput?: string;
		inviteInput?: string;
		saving?: boolean;
		error?: string | null;
		message?: string | null;
		copied?: boolean;
		onSave: (body: {
			enabled?: boolean;
			mode?: string;
			guild_id?: string;
			discord_url?: string;
		}) => void;
		onCopy: () => void;
		/** Re-read the gate state. The bot is added on Discord's side, out of
		 *  this page's sight, so without this the admin's only way to find out
		 *  whether it worked is to reload the whole admin page. */
		onRecheck: () => void;
	} = $props();
</script>

<h4 class="sub-heading">Discord Membership Gate</h4>
<p class="section-intro">
	Optionally require players to be in <strong>{system}</strong>'s Discord server before they can
	sign up, arrange a game, post a call-out or submit a result. Pairings, drops and call-outs are
	all announced there, so someone outside the server can't find out they've been paired.
	Only ever checked once, the first time a new player commits to a game — existing members are
	unaffected.
</p>

{#if error}
	<p class="field-error">{error}</p>
{/if}
{#if message}
	<p class="pairing-message">{message}</p>
{/if}

{#if !gate}
	<p class="muted small">Loading…</p>
{:else}
	<!-- Status first: the single thing an admin opens this panel to check,
	     especially while waiting on someone else to add the bot. -->
	<div class="gate-status" class:is-on={gate.enabled && gate.connected}>
		{#if !gate.enabled}
			<span class="gate-dot off"></span>
			<span>Off — anyone can sign up for {system}</span>
		{:else if gate.connected}
			<span class="gate-dot on"></span>
			<span>
				On ({gate.mode}) — checking <strong>{gate.guild_name}</strong>
				{#if gate.inherits_guild}<em class="gate-inherit">(your club's server)</em>{/if}
			</span>
		{:else if gate.guild_id}
			<span class="gate-dot off"></span>
			<span>Server set, but the bot hasn't been added to it yet — nobody is being checked</span>
		{:else}
			<span class="gate-dot off"></span>
			<span>On, but no server set — nobody is being checked</span>
		{/if}
	</div>

	<!-- The invite link is deliberately OUTSIDE the gate opt-in below. It is
	     primarily a Club-page setting — the "Join the … Discord" button on this
	     system's carousel card — and only secondarily what a blocked player is
	     pointed at. It was originally nested inside the gate, which meant a club
	     that wanted per-night Discord links but no membership check couldn't set
	     one at all. -->
	<section class="gate-step">
		<h4 class="sub-heading">Discord invite</h4>
		<p class="section-intro">
			Shown as the <strong>“Join the {system} Discord”</strong> button on this system's card on
			your Club page. Set one here if this game night runs out of its own Discord; leave it
			empty to use your club's link.
		</p>
		<label class="field-label" for="sysgate-invite-{system}">Invite link</label>
		<div class="gate-row">
			<input
				id="sysgate-invite-{system}"
				class="field-input"
				bind:value={inviteInput}
				placeholder="https://discord.gg/…"
				disabled={saving}
			/>
			<button
				class="primary-button"
				type="button"
				disabled={saving}
				onclick={() => onSave({ discord_url: inviteInput })}
			>{saving ? 'Saving…' : 'Save'}</button>
		</div>
		<p class="field-label-hint">
			{#if gate.inherits_url}
				Currently using your club's link — <code>{gate.discord_url}</code>.
			{:else if !gate.discord_url}
				No link set for this system or your club, so no button is shown on the carousel.
			{/if}
			If you switch the membership gate on below, this is also what a blocked player is sent
			to — so it must point at the same server the gate checks, or you'll send them somewhere
			that won't let them past.
		</p>
	</section>

	<h4 class="sub-heading">Membership gate</h4>
	{#if !gate.bot_configured}
		<!-- Scoped to the gate only. The invite link above works regardless —
		     it's just a link on your Club page and needs no bot. -->
		<p class="field-error">
			The Call to Arms Discord bot isn't set up on this platform yet, so the membership gate
			can't run. Contact the platform admin — this isn't something your club can fix.
		</p>
	{/if}
	<div class="field">
		<label class="check-row">
			<input
				type="checkbox"
				checked={gate.enabled}
				disabled={saving || !gate.bot_configured}
				onchange={(e) => onSave({ enabled: e.currentTarget.checked })}
			/>
			<span>Use the Discord gate for {system}</span>
		</label>
		<p class="field-label-hint">
			Off by default, and set per game night — your club's other systems are unaffected either
			way.
		</p>
	</div>

	{#if gate.enabled}
		<div class="gate-step">
			<div class="league-settings-heading">1. {system}'s Discord server</div>

			{#if gate.inherits_guild}
				<p class="field-label-hint">
					Currently using <strong>{gate.club_name}</strong>'s club-wide server. Set one below
					only if {system} runs out of its own separate Discord.
				</p>
			{/if}

			{#if gate.available_guilds && gate.available_guilds.length > 0}
				<label class="field-label" for="sysgate-picker-{system}">Pick the server</label>
				<select
					id="sysgate-picker-{system}"
					class="field-input"
					value={gate.guild_id_own ?? ''}
					onchange={(e) => onSave({ guild_id: e.currentTarget.value })}
					disabled={saving}
				>
					<option value="">— use my club's server —</option>
					{#each gate.available_guilds as g}
						<option value={g.id}>{g.name}</option>
					{/each}
				</select>
				<p class="field-label-hint">Servers the bot has been added to.</p>
			{/if}

			<label class="field-label" for="sysgate-guild-{system}">Server ID</label>
			<div class="gate-row">
				<input
					id="sysgate-guild-{system}"
					class="field-input"
					bind:value={guildInput}
					placeholder="123456789012345678"
					disabled={saving}
				/>
				<button
					class="primary-button"
					type="button"
					disabled={saving}
					onclick={() => onSave({ guild_id: guildInput })}
				>{saving ? 'Saving…' : 'Save'}</button>
			</div>
			<p class="field-label-hint">
				You can paste a server invite link here instead and we'll work it out. Leave empty to
				fall back to your club's server.
				<a
					href="https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID"
					target="_blank"
					rel="noopener noreferrer">How do I find my Server ID?</a
				>
			</p>

		</div>

		<div class="gate-step">
			<div class="league-settings-heading">2. Add the bot to that server</div>

			{#if gate.connected}
				<p class="section-intro">
					Already done — the bot is in <strong>{gate.guild_name}</strong> and can see who's a
					member. Nothing to do here unless you point this system at a different server.
				</p>
			{:else}
				<p class="section-intro">
					<strong>Someone with the “Manage Server” permission on that Discord has to do this</strong>,
					and at a lot of clubs that isn't the same person who runs the app. If it isn't you,
					send them the link below — they don't need an account here or any involvement beyond
					this one step.
				</p>

				<ol class="gate-steps">
					<li>Open the link below while signed in to Discord as someone with Manage Server.</li>
					<li>
						Discord shows an <strong>“Add to Server”</strong> screen with a dropdown. Pick the
						server this game night runs in.
						<span class="gate-note">
							Not in the list? That account doesn't have Manage Server on it — ask whoever
							set the server up.
						</span>
					</li>
					<li>
						Press <strong>Continue</strong>, then <strong>Authorize</strong>.
						<span class="gate-note">
							The permissions list will be <em>empty</em>. That's correct, not a bug — see
							below.
						</span>
					</li>
					<li>Solve the captcha if Discord shows one.</li>
					<li>Come back here and press <strong>Check connection</strong>.</li>
				</ol>
			{/if}

			{#if gate.bot_invite_url}
				<div class="gate-row">
					<code class="gate-code">{gate.bot_invite_url}</code>
					<button class="secondary-button" type="button" onclick={onCopy}>
						{copied ? 'Copied!' : 'Copy'}
					</button>
					<button class="secondary-button" type="button" disabled={saving} onclick={onRecheck}>
						{saving ? 'Checking…' : 'Check connection'}
					</button>
				</div>
			{/if}

			<!-- The "what can this thing see" answer, spelled out. Whoever adds the
			     bot is often outside the club's admin team and is being asked to
			     put an unknown app into their server — a vague reassurance is not
			     enough to get a reasonable person to say yes. -->
			<p class="field-label-hint">
				<strong>What the bot can do:</strong> nothing except check whether a named person has
				joined. The invite requests <em>zero</em> permissions, which is why the authorize screen
				looks empty — it can't read or post messages, can't see your channels, and can't list
				your members.
				<a
					href="https://support.discord.com/hc/en-us/articles/21334461140375-Using-Apps-on-Discord"
					target="_blank"
					rel="noopener noreferrer">Discord's own guide to adding apps</a
				>
			</p>
		</div>

		<div class="gate-step">
			<div class="league-settings-heading">3. Monitor or enforce</div>
			{#if !gate.can_enforce}
				<p class="field-label-hint">
					Enforce is locked until the bot is connected — otherwise the check can't run and the
					gate would look active while letting everyone through.
				</p>
			{/if}
			<select
				class="field-input"
				value={gate.mode}
				onchange={(e) => onSave({ mode: e.currentTarget.value })}
				disabled={saving || !gate.can_enforce}
			>
				<option value="monitor">Monitor — log who would be blocked, block nobody</option>
				<option value="enforce">Enforce — require Discord membership</option>
			</select>
			<p class="field-label-hint">
				Starts on <strong>Monitor</strong>. Leave it there for a couple of club nights to see
				who would be caught before anyone actually is.
			</p>
		</div>
	{/if}
{/if}

<style>
	/* Status pill — mirrors DiscordGatePanel's, since an admin who has seen the
	   club-level one should recognise this at a glance. */
	.gate-status {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.6rem 0.85rem;
		margin-bottom: 1.1rem;
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
	.gate-inherit {
		color: var(--color-text-muted);
		font-style: normal;
		font-size: 0.85em;
	}

	.gate-step {
		margin-bottom: 1.4rem;
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

	.check-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.92rem;
		color: var(--color-text-base);
		cursor: pointer;
	}

	.gate-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.gate-row :global(.field-input) {
		flex: 1 1 260px;
		min-width: 0;
	}

	/* The bot invite is long and must be copyable verbatim — wraps rather than
	   truncating, since an admin forwarding a half-copied URL is a silent
	   failure they'd only find out about days later. */
	.gate-code {
		flex: 1 1 260px;
		min-width: 0;
		font-family: var(--font-mono, monospace);
		font-size: 0.78rem;
		padding: 0.45rem 0.6rem;
		background: var(--color-surface-dark);
		border: 1px solid var(--color-steel-border);
		border-radius: var(--radius);
		color: var(--color-text-muted);
		word-break: break-all;
	}
</style>
