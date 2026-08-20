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
		onCopy
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
{:else if !gate.bot_configured}
	<p class="field-error">
		The Call to Arms Discord bot isn't set up on this platform yet. Contact the platform admin —
		this isn't something your club can fix.
	</p>
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

	<div class="field">
		<label class="check-row">
			<input
				type="checkbox"
				checked={gate.enabled}
				disabled={saving}
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
				Shown as the “Join the {system} Discord” button on this system's Club-page carousel
				card, and to anyone the gate turns away. It must point at the same server you set
				above, or you'll send players somewhere that won't get them past the gate.
				{#if gate.inherits_url}Currently falling back to your club's invite link.{/if}
			</p>
		</div>

		<div class="gate-step">
			<div class="league-settings-heading">2. Add the bot to that server</div>
			<p class="section-intro">
				This needs the <strong>Manage Server</strong> permission on that Discord. If that isn't
				you, send this link to whoever runs it. The bot asks for no permissions — it can't read
				messages, post, or see your member list. It only checks whether a given person has
				joined.
			</p>
			{#if gate.bot_invite_url}
				<div class="gate-row">
					<code class="gate-code">{gate.bot_invite_url}</code>
					<button class="secondary-button" type="button" onclick={onCopy}>
						{copied ? 'Copied!' : 'Copy'}
					</button>
				</div>
			{/if}
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
