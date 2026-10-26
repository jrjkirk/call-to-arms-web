<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { loginHrefTo } from '$lib/loginUrl';
	import GoogleSignIn from '$lib/GoogleSignIn.svelte';
	import { signInProviders } from '$lib/signInProviders';

	// Signing in is required before this form will submit. It doesn't prove
	// someone runs the club — that's what the evidence link and a human reading
	// the request are for — but it puts a real Discord account behind every
	// request, and it's the identity that lets provisioning make this person
	// their club's admin without a round of emails.
	//
	// A brand-new organiser can't hold an account yet: users.club_id is NOT NULL
	// and the club it would point at is the one they're asking for. So the API
	// accepts a half-finished sign-in here, and /auth/discord/callback sends them
	// straight to this page instead of the club picker they couldn't use.
	let identityLoaded = $state(false);
	let signedIn = $state(false);
	let discordName = $state<string | null>(null);

	let regions = $state<string[]>([]);
	let systemOptions = $state<{ name: string; legacy_system_name: string }[]>([]);

	let requesterName = $state('');
	let requesterEmail = $state('');
	let requesterRole = $state('');
	let clubName = $state('');
	let clubLocation = $state('');
	let region = $state('');
	let preferredSlug = $state('');
	let systems = $state<string[]>([]);

	/* One night per system, not one for the club.
	   A club running The Old World on a Thursday and Kill Team fortnightly on a
	   Tuesday is ordinary, and asking a single question got the answer that
	   fitted their biggest night and published the wrong one for the rest.
	   Keyed on legacy_system_name, which is what the API stores and what
	   ClubSystem resolves against. */
	type SystemDetail = { day: string; time: string; cadence: string; players: number | null };
	let systemDetails = $state<Record<string, SystemDetail>>({});

	const CADENCES = [
		{ value: 'weekly', label: 'Every week' },
		{ value: 'fortnightly', label: 'Every other week' },
		{ value: 'monthly', label: 'Once a month' }
	];

	/* Most clubs run everything on the same night, so a newly ticked system
	   copies whatever was filled in first and can then be changed. That keeps
	   the common case to one set of answers while still allowing the exception,
	   which is the whole reason this is per system. */
	function blankDetail(): SystemDetail {
		const seed = Object.values(systemDetails)[0];
		return seed
			? { day: seed.day, time: seed.time, cadence: seed.cadence, players: null }
			: { day: '', time: '', cadence: 'weekly', players: null };
	}
	let evidenceUrl = $state('');
	/* A game that isn't in the list. Nothing is set up for it on approval: the
	   platform admin reads it from the request and adds it to the catalogue. */
	let otherOn = $state(false);
	let otherSystems = $state('');
	let notes = $state('');

	let submitting = $state(false);
	let error = $state<string | null>(null);
	let submitted = $state(false);

	const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
	const ROLES = ['Club owner', 'Club organiser', 'Committee member', 'Regular member'];

	// Auto-fills as they type the club name, but stays editable — they know what
	// their players will actually type into a browser.
	let slugTouched = $state(false);
	const slugify = (s: string) =>
		s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '')
			.slice(0, 30);
	$effect(() => {
		if (!slugTouched) preferredSlug = slugify(clubName);
	});

	onMount(async () => {
		try {
			const r = await fetch(`${PUBLIC_API_URL}/club-requests/identity`, {
				credentials: 'include'
			});
			if (r.ok) {
				const d = await r.json();
				signedIn = d.signed_in;
				discordName = d.name ?? d.discord_name;
				if (discordName && !requesterName) requesterName = discordName;
			}
		} catch {
			/* leave signed out; the sign-in button is the safe default */
		}
		identityLoaded = true;

		fetch(`${PUBLIC_API_URL}/regions`)
			.then((r) => (r.ok ? r.json() : []))
			.then((d) => (regions = d))
			.catch(() => {});
		fetch(`${PUBLIC_API_URL}/systems`)
			.then((r) => (r.ok ? r.json() : []))
			.then((d) => (systemOptions = d))
			.catch(() => {});
	});

	function toggleSystem(name: string) {
		if (systems.includes(name)) {
			systems = systems.filter((s) => s !== name);
			// Drop its schedule too, or unticking and resubmitting would send
			// detail for a system they no longer play. The API narrows to the
			// selected list as well, but the form should not be sending it.
			const { [name]: _removed, ...rest } = systemDetails;
			systemDetails = rest;
		} else {
			systems = [...systems, name];
			systemDetails = { ...systemDetails, [name]: blankDetail() };
		}
	}

	async function submit() {
		error = null;
		if (!requesterName.trim() || !requesterEmail.trim() || !clubName.trim() || !clubLocation.trim()) {
			error = 'Your name, email, club name and location are all required.';
			return;
		}
		if (!systems.length) {
			error = 'Pick at least one game system. It decides what we switch on for you.';
			return;
		}
		// A night per system, because provisioning SKIPS any system it has no
		// night for rather than guessing one — guessing published a specific
		// wrong night on a club's public page. Caught here so that shows up as a
		// question rather than as a system quietly missing after approval.
		const missing = systems.filter((s) => !systemDetails[s]?.day);
		if (missing.length) {
			error =
				missing.length === systems.length
					? 'Tell us which night you meet. It sets up your schedule when we approve you.'
					: `Which night do you play ${missing.join(' and ')}?`;
			return;
		}
		if (!region) {
			error = 'Pick your region so players can find you.';
			return;
		}
		submitting = true;
		try {
			const r = await fetch(`${PUBLIC_API_URL}/club-requests`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					requester_name: requesterName.trim(),
					requester_email: requesterEmail.trim(),
					requester_role: requesterRole || null,
					club_name: clubName.trim(),
					club_location: clubLocation.trim(),
					region: region || null,
					preferred_slug: preferredSlug.trim() || null,
					systems,
					system_details: Object.fromEntries(
						systems.map((s) => [
							s,
							{
								day: systemDetails[s]?.day || null,
								time: systemDetails[s]?.time || null,
								cadence: systemDetails[s]?.cadence || 'weekly',
								players: systemDetails[s]?.players ?? null
							}
						])
					),
					// Still sent, and still what the API falls back to. The first
					// system's answers stand in for the club as a whole so a
					// reviewer glancing at the old fields sees something true.
					club_night_day: systemDetails[systems[0]]?.day || null,
					club_night_time: systemDetails[systems[0]]?.time || null,
					player_count: systems.reduce(
						(sum, s) => sum + (systemDetails[s]?.players ?? 0),
						0
					) || null,
					evidence_url: evidenceUrl.trim() || null,
					other_systems: otherOn ? otherSystems.trim() || null : null,
					notes: notes.trim() || null
				})
			});
			if (r.ok) {
				submitted = true;
			} else {
				const body = await r.json().catch(() => ({}));
				error = body.detail || 'Something went wrong. Try again in a moment.';
			}
		} catch {
			error = 'Something went wrong. Try again in a moment.';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="container">
	<div class="request-section">
		<h1 class="page-title">Add your club</h1>

		{#if !identityLoaded}
			<div class="request-card request-success"><p>Loading…</p></div>
		{:else if submitted}
			<div class="request-card request-success">
				<p class="state-word">Request sent</p>
				<p class="request-lead">We’ll be in touch at <strong>{requesterEmail}</strong>. Once it’s approved, signing in takes you straight to your club’s admin.</p>
			</div>
		{:else if !signedIn}
			<div class="request-card request-success">
				<p class="request-lead">Sign in first, so we can make you the club’s admin when it’s approved.</p>
				<div class="request-signin">
					<a class="request-button" href={loginHrefTo('/request-club')}>Sign in with Discord</a>
					<GoogleSignIn to="/request-club" class="request-button request-button-alt" />
					{#if $signInProviders.includes('email')}
						<a class="request-button request-button-alt" href="/signin?next=%2Frequest-club">Sign in with email</a>
					{/if}
				</div>
			</div>
		{:else}
			<form class="request-card" onsubmit={(e) => { e.preventDefault(); submit(); }}>
				<p class="request-as"><span class="field-label">Signed in as</span> <strong>{discordName}</strong></p>

				<h2 class="group-title">You</h2>
				<div class="request-grid">
					<div class="field">
						<label class="field-label" for="req-name">Name</label>
						<input id="req-name" class="field-input" type="text" bind:value={requesterName} required />
					</div>
					<div class="field">
						<label class="field-label" for="req-email">Email</label>
						<input id="req-email" class="field-input" type="email" bind:value={requesterEmail} required />
					</div>
					<div class="field">
						<label class="field-label" for="req-role">Role</label>
						<select id="req-role" class="field-input" bind:value={requesterRole}>
							<option value="">Select</option>
							{#each ROLES as r (r)}<option>{r}</option>{/each}
						</select>
					</div>
				</div>

				<h2 class="group-title">Your club</h2>
				<div class="request-grid">
					<div class="field">
						<label class="field-label" for="req-club-name">Club name</label>
						<input id="req-club-name" class="field-input" type="text" bind:value={clubName} required />
					</div>
					<div class="field">
						<label class="field-label" for="req-club-location">Town or city</label>
						<input id="req-club-location" class="field-input" type="text" bind:value={clubLocation} required />
					</div>
					<div class="field">
						<label class="field-label" for="req-region">Region</label>
						<select id="req-region" class="field-input" bind:value={region}>
							<option value="">Select</option>
							{#each regions as r (r)}<option>{r}</option>{/each}
						</select>
					</div>
					<div class="field">
						<label class="field-label" for="req-slug">Web address</label>
						<div class="slug-row">
							<input
								id="req-slug"
								class="field-input"
								type="text"
								bind:value={preferredSlug}
								oninput={() => (slugTouched = true)}
							/>
							<span class="slug-suffix">.calltoarms.app</span>
						</div>
					</div>
				</div>

				<h2 class="group-title">Your nights</h2>
				<div class="field">
					<span class="field-label">Systems you play</span>
					<div class="chip-row">
						{#each systemOptions as s (s.legacy_system_name)}
							<button
								type="button"
								class="chip"
								class:chip-on={systems.includes(s.legacy_system_name)}
								onclick={() => toggleSystem(s.legacy_system_name)}
							>{s.name}</button>
						{/each}
						<button type="button" class="chip" class:chip-on={otherOn} onclick={() => (otherOn = !otherOn)}>Other</button>
					</div>
					{#if otherOn}
						<input class="field-input other-input" type="text" maxlength="200"
						       placeholder="Which game?" aria-label="Other game" bind:value={otherSystems} />
					{/if}
				</div>

				<!-- One block per system they picked, in the order they picked
				     them. Nothing shows until a chip is on, so the form is no
				     longer than it was for a club running one game. -->
				{#each systems as name (name)}
					{@const label = systemOptions.find((o) => o.legacy_system_name === name)?.name ?? name}
					<div class="sys-block">
						<div class="sys-name">{label}</div>
						<div class="sys-grid">
							<div class="field">
								<label class="field-label" for="sys-day-{name}">Night</label>
								<select id="sys-day-{name}" class="field-input" bind:value={systemDetails[name].day}>
									<option value="">Select</option>
									{#each DAYS as d (d)}<option>{d}</option>{/each}
								</select>
							</div>
							<div class="field">
								<label class="field-label" for="sys-time-{name}">Start time</label>
								<input id="sys-time-{name}" class="field-input" type="time"
								       bind:value={systemDetails[name].time} />
							</div>
							<div class="field">
								<label class="field-label" for="sys-cadence-{name}">How often</label>
								<select id="sys-cadence-{name}" class="field-input"
								        bind:value={systemDetails[name].cadence}>
									{#each CADENCES as c (c.value)}<option value={c.value}>{c.label}</option>{/each}
								</select>
							</div>
							<div class="field">
								<label class="field-label" for="sys-players-{name}">Players</label>
								<input id="sys-players-{name}" class="field-input" type="number" min="1"
								       bind:value={systemDetails[name].players} />
							</div>
						</div>
					</div>
				{/each}


				<div class="field">
					<label class="field-label" for="req-evidence">Where we can see your club</label>
					<input
						id="req-evidence"
						class="field-input"
						type="url"
						placeholder="Discord invite, Facebook group or website"
						bind:value={evidenceUrl}
					/>
				</div>

				<div class="field">
					<label class="field-label" for="req-notes">Anything else</label>
					<textarea id="req-notes" class="field-input" rows="2" bind:value={notes}></textarea>
				</div>

				{#if error}<p class="request-error">{error}</p>{/if}
				<button class="request-button" type="submit" disabled={submitting}>
					{submitting ? 'Sending…' : 'Request my club'}
				</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.container {
		max-width: 760px;
		margin: 0 auto;
		padding: 0 1rem 3rem;
	}

	.request-as { display: flex; align-items: baseline; gap: 0.6rem; margin: 0 0 0.4rem; }
	.request-as .field-label { margin: 0; }
	.request-as strong { color: var(--color-text-bright); }

	.page-title {
		font-size: 2.4rem;
		font-weight: 700;
		line-height: 1;
		text-transform: uppercase;
		margin: 0 0 1rem;
	}
	@media (max-width: 560px) { .page-title { font-size: 2.1rem; } }

	.group-title {
		margin: 1.4rem 0 0.7rem;
		font-family: var(--font-heading);
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--color-accent);
	}

	.request-lead { margin: 0 0 0.4rem; color: var(--color-text-muted); line-height: 1.5; }
	.state-word {
		margin: 0 0 0.5rem;
		font-family: var(--font-heading);
		font-size: 1.2rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-win);
	}

	.slug-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.slug-suffix {
		color: var(--color-text-dim);
		font-size: 0.85rem;
		white-space: nowrap;
	}

	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	/* Tiles, like the rest of the app's choices, not pills. */
	.chip {
		min-height: 44px;
		background: #0f1218;
		border: 1px solid #343a47;
		color: var(--color-text-muted);
		border-radius: var(--radius);
		padding: 0 0.9rem;
		font-family: inherit;
		font-size: 0.92rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.chip:hover {
		border-color: var(--color-accent);
	}

	.other-input { margin-top: 0.5rem; }

	.chip-on {
		border-color: var(--color-accent);
		color: var(--color-text-bright);
		background: rgba(201, 161, 74, 0.16);
	}

	.request-section {
		width: 100%;
		margin-top: 1rem;
	}

	.request-card {
		background: #13161e;
		border: 1px solid #232733;
		border-radius: 6px;
		padding: 1.1rem 1.25rem 1.3rem;
	}

	.request-success {
		color: var(--color-text-muted);
	}

	.request-success p {
		margin: 0 0 1rem;
	}

	.request-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.75rem;
		margin-bottom: 0.85rem;
	}

	.field {
		margin-bottom: 0.85rem;
	}




	.request-error {
		color: var(--color-loss);
		font-size: 0.82rem;
		margin: 0.6rem 0 0;
	}

	/* One system's schedule, set apart from the club-wide fields so four more
	   inputs per system read as a group rather than as the form getting longer. */
	.sys-block {
		position: relative;
		margin: 0.6rem 0 0;
		padding: 0.8rem 0.9rem 0.9rem calc(0.9rem + 16px);
		border: 1px solid #232733;
		border-radius: 6px;
		background: #0f1218;
	}
	/* A gold bar beside each night (design rule 1). */
	.sys-block::before {
		content: '';
		position: absolute;
		left: 0.9rem;
		top: 0.8rem;
		bottom: 0.8rem;
		width: 4px;
		border-radius: 2px;
		background: var(--color-accent);
	}
	/* The field that follows the last system block. Without this it sits flush
	   against the block's border and reads as part of it, rather than as the
	   club-wide question it is. Only applies when a block is actually there, so
	   spacing is unchanged before any system is picked. */
	.sys-block + .field {
		margin-top: 1.1rem;
	}

	.sys-name {
		margin-bottom: 0.6rem;
		font-family: var(--font-heading);
		font-weight: 700;
		font-size: 1.1rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-bright);
	}
	/* Two rows, and each field spans both via subgrid, so every label sits in
	   the same band and every input starts on the same line. Without it the one
	   label long enough to wrap ("Roughly how many players") pushed its own
	   input a line lower than the other three.

	   Fixed to two rows rather than auto-fit: four columns that reflow to two
	   would put a wrapped label in one row and not the other, and the problem
	   comes back. They stack below 620px instead. */
	.sys-grid {
		display: grid;
		/* The last column is wider because "Roughly how many players" is the
		   only label long enough to wrap, and a wrapped label makes every block
		   a line taller for the sake of one word. Night and How often are
		   dropdowns with short fixed contents, so they can give the room up. */
		grid-template-columns: 0.9fr 0.9fr 1fr 1.2fr;
		grid-template-rows: auto auto;
		gap: 0.35rem 0.6rem;
		align-items: start;
	}
	.sys-grid .field {
		display: grid;
		grid-template-rows: subgrid;
		grid-row: span 2;
		margin-bottom: 0;
	}
	.sys-grid .field-label {
		align-self: end;
		margin-bottom: 0;
	}

	/* Below the four-across width, let the columns decide for themselves. Two
	   across on a phone squeezed "How often" until it read "Every we…", which
	   is the one field where weekly and fortnightly have to be told apart at a
	   glance. 170px is enough for the longest option; a 390px screen therefore
	   gets one column, a tablet two. */
	@media (max-width: 620px) {
		.sys-grid {
			grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
			grid-auto-rows: auto;
		}
	}

	/* Centred, because it is the one thing on the page you are meant to press
	   and it was hanging off the left edge under a full-width form. */
	.request-signin {
		display: flex;
		gap: 0.6rem;
		justify-content: flex-start;
		flex-wrap: wrap;
		margin-top: 1rem;
	}
	/* :global under .request-signin reaches the Google link inside GoogleSignIn. */
	.request-signin :global(.request-button-alt) {
		margin: 0;
		display: flex;
		align-items: center;
		background: transparent;
		border: 1px solid var(--color-accent-border);
		color: var(--color-text-bright);
		font-family: var(--font-heading);
		font-weight: 700;
		font-size: 1rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.65rem 1.4rem;
		border-radius: var(--radius);
		text-decoration: none;
	}
	.request-signin .request-button { margin: 0; }

	.request-button {
		margin: 1.2rem 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-accent);
		border: 1px solid var(--color-accent);
		color: #1b1206;
		font-family: var(--font-heading);
		font-weight: 700;
		font-size: 1.05rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.7rem 1.6rem;
		border-radius: var(--radius);
		cursor: pointer;
		text-decoration: none;
		transition: background 0.18s ease;
	}

	.request-button:hover:not(:disabled) {
		background: var(--color-accent-soft);
	}

	.request-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
