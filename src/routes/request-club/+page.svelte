<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { loginHrefTo } from '$lib/loginUrl';

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
				discordName = d.discord_name;
				if (d.discord_name && !requesterName) requesterName = d.discord_name;
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
		<div class="request-heading">Add your club</div>
		<p class="request-tagline">
			Tell us about it and we'll get you set up, usually the same day.
		</p>

		{#if !identityLoaded}
			<div class="request-card request-success"><p>Loading…</p></div>
		{:else if submitted}
			<div class="request-card request-success">
				<p>
					Thanks, your request is in. We'll review it and be in touch at
					<strong>{requesterEmail}</strong>. Once it's approved you'll be able to sign in and
					you'll land straight in your club's admin.
				</p>
			</div>
		{:else if !signedIn}
			<div class="request-card request-success">
				<p>
					Sign in with Discord to request your club. It tells us who's asking, and it
					lets us make you the club's admin the moment we approve it.
				</p>
				<a class="request-button" href={loginHrefTo('/request-club')}>Sign in with Discord</a>
			</div>
		{:else}
			<form class="request-card" onsubmit={(e) => { e.preventDefault(); submit(); }}>
				<p class="request-as">Requesting as <strong>{discordName}</strong></p>

				<div class="request-grid">
					<div class="field">
						<label class="field-label" for="req-name">Your name</label>
						<input id="req-name" class="field-input" type="text" bind:value={requesterName} required />
					</div>
					<div class="field">
						<label class="field-label" for="req-email">Your email</label>
						<input id="req-email" class="field-input" type="email" bind:value={requesterEmail} required />
					</div>
					<div class="field">
						<label class="field-label" for="req-role">Your role at the club</label>
						<select id="req-role" class="field-input" bind:value={requesterRole}>
							<option value="">Select…</option>
							{#each ROLES as r (r)}<option>{r}</option>{/each}
						</select>
					</div>
				</div>

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
							<option value="">Select…</option>
							{#each regions as r (r)}<option>{r}</option>{/each}
						</select>
					</div>
					<div class="field">
						<label class="field-label" for="req-slug">Your web address</label>
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

				<div class="field">
					<span class="field-label">Which systems do you play?</span>
					<div class="chip-row">
						{#each systemOptions as s (s.legacy_system_name)}
							<button
								type="button"
								class="chip"
								class:chip-on={systems.includes(s.legacy_system_name)}
								onclick={() => toggleSystem(s.legacy_system_name)}
							>{s.name}</button>
						{/each}
					</div>
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
									<option value="">Select…</option>
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
								<label class="field-label" for="sys-players-{name}">Roughly how many players</label>
								<input id="sys-players-{name}" class="field-input" type="number" min="1"
								       bind:value={systemDetails[name].players} />
							</div>
						</div>
					</div>
				{/each}


				<div class="field">
					<label class="field-label" for="req-evidence">Where can we see your club?</label>
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

	.request-as {
		margin: 0 0 1rem;
		color: var(--color-text-muted);
		font-size: 0.85rem;
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

	.chip {
		background: var(--color-surface);
		border: 1px solid var(--color-steel-border);
		color: var(--color-text-muted);
		border-radius: 999px;
		padding: 0.4rem 0.85rem;
		font-family: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.chip:hover {
		border-color: var(--color-accent);
	}

	.chip-on {
		border-color: var(--color-accent);
		color: var(--color-accent);
		background: var(--color-accent-glow);
	}

	.request-section {
		width: 100%;
		margin-top: clamp(2.2rem, 5vw, 3rem);
		text-align: center;
	}

	.request-heading {
		color: var(--color-accent);
		font-size: 0.82rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		margin-bottom: 0.3rem;
	}

	.request-tagline {
		margin: 0 0 1rem;
		color: var(--color-text-dim);
		font-size: 0.88rem;
	}

	.request-card {
		text-align: left;
		background: var(--color-surface-dark);
		border: 1px solid var(--color-steel-border);
		border-radius: var(--radius);
		padding: 1.1rem 1.2rem 1.3rem;
	}

	.request-success {
		text-align: center;
		color: var(--color-text-muted);
		font-size: 0.92rem;
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

	.field-label {
		display: block;
		color: var(--color-text-muted);
		font-size: 0.85rem;
		margin-bottom: 0.32rem;
	}

	.field-input {
		width: 100%;
		background: var(--color-surface);
		border: 1px solid var(--color-steel-border);
		border-radius: var(--radius);
		color: var(--color-text-base);
		padding: 0.55rem 0.75rem;
		font-family: inherit;
		font-size: 0.92rem;
		box-sizing: border-box;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--color-accent);
		box-shadow: 0 0 0 3px var(--color-accent-glow);
	}

	.request-error {
		color: var(--color-loss);
		font-size: 0.82rem;
		margin: 0.6rem 0 0;
	}

	/* One system's schedule, set apart from the club-wide fields so four more
	   inputs per system read as a group rather than as the form getting longer. */
	.sys-block {
		margin: 0.6rem 0 0;
		padding: 0.7rem 0.8rem 0.8rem;
		border: 1px solid var(--color-steel-border);
		border-left: 2px solid var(--color-accent);
		border-radius: var(--radius);
		background: var(--color-bg-deep);
	}
	.sys-name {
		margin-bottom: 0.5rem;
		font-weight: 700;
		font-size: 0.85rem;
		color: var(--color-accent);
	}
	.sys-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.6rem;
	}

	/* Centred, because it is the one thing on the page you are meant to press
	   and it was hanging off the left edge under a full-width form. */
	.request-button {
		margin: 1rem auto 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-accent);
		border: 1px solid var(--color-accent);
		color: #1b1206;
		font-weight: 700;
		font-size: 0.9rem;
		padding: 0.65rem 1.6rem;
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
