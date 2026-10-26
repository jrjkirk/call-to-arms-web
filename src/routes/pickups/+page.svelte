<!--
  Pick-up games: find a game outside club night (the API's pickups.py).

  Top to bottom, in the order a player needs them: a game waiting for your
  answer, games that are on, your open requests, open games from other
  players (PLAY takes one up at once), and the form to ask for one yourself.
  Declining asks why, and says plainly that only the club's admins see the
  answer.
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import PageSkeleton from '$lib/PageSkeleton.svelte';
    import SystemPicker from '$lib/SystemPicker.svelte';
    import ModeSwitch from '$lib/ModeSwitch.svelte';
    import FactionOptions from '$lib/FactionOptions.svelte';
    import { fetchMySystems } from '$lib/mySystems';
    import { getClubSlugFromHostname } from '$lib/clubSlug';
    import {
        getSystemsConfig, vibeOptionsFor, usesPoints, defaultVibeFor, configFor, systemLogoUrl,
        FALLBACK_SYSTEMS_CONFIG, type SystemConfig
    } from '$lib/systemsConfig';
    import { NONE_FACTION } from '$lib/signupOptions';
    import {
        acceptGame, askForGame, cancelRequest, claimGame, declineGame, fetchPickups, needsMyAnswer, peekPickups,
        type PickupList, type PickupRequest
    } from '$lib/pickups';

    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);
    let systems = $state<string[]>([]);
    const seen = peekPickups();
    let list = $state<PickupList | null>(seen);
    let ready = $state(seen !== null);
    let busy = $state(false);
    let message = $state<string | null>(null);
    let error = $state<string | null>(null);

    // The form.
    let system = $state(page.url.searchParams.get('system') ?? '');
    let date = $state(isoDay(1));
    let start = $state('18:00');
    let end = $state('22:00');
    /* Two choices: the club, or elsewhere. Elsewhere with a place typed in is
       sent as that place ('other'); left blank it is "to be agreed" ('tbc').
       There used to be a separate "We'll sort it", which meant the same. */
    let venue = $state<'club' | 'elsewhere'>('club');
    let venueText = $state('');
    let faction = $state(NONE_FACTION);
    let points = $state(2000);
    let vibe = $state('');
    let notes = $state('');

    // Playing someone's open request: which one is open for confirming, and
    // what you'd bring.
    let claiming = $state<number | null>(null);
    let claimFaction = $state(NONE_FACTION);
    let claimPoints = $state(2000);

    function openClaim(o: PickupRequest) {
        claiming = claiming === o.id ? null : o.id;
        claimFaction = NONE_FACTION;
        claimPoints = o.points ?? (configFor(systemsConfig, o.system).default_points || 2000);
    }

    function confirmClaim(o: PickupRequest) {
        return act(() => claimGame(o.id, {
            faction: claimFaction === NONE_FACTION ? null : claimFaction,
            points: usesPoints(systemsConfig, o.system) ? claimPoints : null
        }), () => {
            claiming = null;
            return `Sent. ${o.player_name} will accept or decline, and you'll be told.`;
        });
    }

    // Declining: which game, and the private reason.
    let declining = $state<number | null>(null);
    let reason = $state('');

    const TIMES = Array.from({ length: 29 }, (_, i) => {
        const mins = 9 * 60 + i * 30;
        return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    });

    function isoDay(offset: number): string {
        const d = new Date();
        d.setDate(d.getDate() + offset);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    async function refresh() {
        list = await fetchPickups();
        ready = true;
    }

    onMount(async () => {
        getSystemsConfig(getClubSlugFromHostname(window.location.hostname)).then((c) => (systemsConfig = c));
        const [mine] = await Promise.all([fetchMySystems(), refresh()]);
        systems = mine ?? [];
        if (!system || !systems.includes(system)) system = systems[0] ?? '';
    });

    // A new system: its own defaults for kind of game and points.
    $effect(() => {
        if (!system) return;
        vibe = defaultVibeFor(systemsConfig, system);
        points = configFor(systemsConfig, system).default_points || 2000;
        faction = NONE_FACTION;
    });

    const waiting = $derived((list?.mine ?? []).filter(needsMyAnswer));
    const on = $derived((list?.mine ?? []).filter((r) => r.match?.status === 'confirmed'));
    const pending = $derived((list?.mine ?? []).filter((r) => !needsMyAnswer(r) && r.match?.status !== 'confirmed'));
    /* Every open request at the club, whatever system the form below is set
       to: these are games you can take, not a filter on your own request. */
    const others = $derived(list?.others ?? []);
    /** Systems you already have a live request in: you can't take a second. */
    const busySystems = $derived(new Set((list?.mine ?? []).map((r) => r.system)));

    /* Home links to /pickups#open-<id>: open that game ready to confirm. */
    let jumped = false;
    $effect(() => {
        if (jumped || !ready || typeof window === 'undefined') return;
        const m = /^#open-(\d+)$/.exec(window.location.hash);
        if (!m) return;
        const o = others.find((x) => x.id === Number(m[1]));
        if (!o) return;
        jumped = true;
        openClaim(o);
        requestAnimationFrame(() => document.getElementById(`open-${o.id}`)?.scrollIntoView({ block: 'center' }));
    });
    const alreadyAsked = $derived((list?.mine ?? []).some((r) => r.system === system));

    async function act(fn: () => Promise<unknown>, done: string | ((result: any) => string)) {
        busy = true;
        error = null;
        message = null;
        try {
            const result = await fn();
            message = typeof done === 'function' ? done(result) : done;
            await refresh();
        } catch (e) {
            error = e instanceof Error ? e.message : 'Something went wrong. Try again.';
        } finally {
            busy = false;
        }
    }

    function ask() {
        return act(() => askForGame({
            system, date, start, end,
            venue: venue === 'club' ? 'club' : venueText.trim() ? 'other' : 'tbc',
            venue_text: venue === 'elsewhere' && venueText.trim() ? venueText.trim() : null,
            faction: faction === NONE_FACTION ? null : faction,
            points: usesPoints(systemsConfig, system) ? points : null,
            vibe, notes
        }), (r) => r?.match
            ? `Game found: you vs ${r.match.opponent?.name ?? 'another player'}. Accept or decline below.`
            : "You're in the pool. We'll let you know when there's a game.");
    }

    function confirmDecline(matchId: number) {
        const why = reason;
        declining = null;
        reason = '';
        return act(() => declineGame(matchId, why), "Declined. Ask again whenever you're free.");
    }

    function statusLine(r: PickupRequest): string {
        if (r.match?.status === 'proposed' && r.match.my_answer === 'accepted') {
            return `You said yes. Waiting for ${r.match.opponent?.name ?? 'them'} to answer.`;
        }
        return "Looking for a game. You'll get a notification when there's a match.";
    }
</script>

{#if !ready}
    <PageSkeleton title="Sign up" />
{:else}
<div class="pickups">
    <h1 class="page-title">Sign up</h1>
    <ModeSwitch mode="pickup" {system} />

    {#if message}<p class="message">{message}</p>{/if}
    {#if error}<p class="error">{error}</p>{/if}

    {#if waiting.length}
        <h2 class="section-title">Waiting for your answer</h2>
        {#each waiting as r (r.id)}
            {@const m = r.match!}
            <section class="panel game waiting">
                <div class="game-top">
                    <span class="game-system">{r.system}</span>
                    <span class="game-when">{m.when}</span>
                </div>
                <p class="game-vs">You vs <b>{m.opponent?.name}</b></p>
                <p class="game-detail">
                    {[m.opponent?.faction, m.opponent?.vibe, m.opponent?.points ? `${m.opponent.points.toLocaleString('en-GB')} pts` : null].filter(Boolean).join(' · ')}
                </p>
                <p class="game-detail">{m.where}</p>
                {#if m.opponent?.notes}<p class="game-notes">“{m.opponent.notes}”</p>{/if}
                <p class="game-due">Answer by {new Date(m.expires_at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</p>

                {#if declining === m.id}
                    <label class="field-label" for={`why-${m.id}`}>Why not? Only the club's admins see this.</label>
                    <textarea id={`why-${m.id}`} class="field-input field-textarea" rows="2" bind:value={reason}
                              placeholder="Optional"></textarea>
                    <div class="actions">
                        <button class="danger-button" type="button" disabled={busy} onclick={() => confirmDecline(m.id)}>Decline</button>
                        <button class="secondary-button" type="button" disabled={busy} onclick={() => (declining = null)}>Back</button>
                    </div>
                {:else}
                    <div class="actions">
                        <button class="primary-button" type="button" disabled={busy}
                                onclick={() => act(() => acceptGame(m.id), "Accepted. We'll tell you when they answer.")}>Accept</button>
                        <button class="secondary-button" type="button" disabled={busy} onclick={() => { declining = m.id; reason = ''; }}>Decline</button>
                    </div>
                {/if}
            </section>
        {/each}
    {/if}

    {#if on.length}
        <h2 class="section-title">Your games</h2>
        {#each on as r (r.id)}
            {@const m = r.match!}
            <section class="panel game on">
                <div class="game-top">
                    <span class="game-system">{r.system}</span>
                    <span class="game-when">{m.when}</span>
                </div>
                <p class="game-vs">You vs <b>{m.opponent?.name}</b></p>
                <p class="game-detail">{m.where}</p>
                <p class="game-detail">
                    {#if m.opponent?.discord}Message them on Discord: <b>{m.opponent.discord}</b>{:else}Sort the details between you.{/if}
                </p>
                <div class="actions">
                    <button class="secondary-button" type="button" disabled={busy}
                            onclick={() => act(() => cancelRequest(r.id), "Called off. They've been told, and they're back in the pool.")}>Can't make it</button>
                </div>
            </section>
        {/each}
    {/if}

    {#if pending.length}
        <h2 class="section-title">Your requests</h2>
        {#each pending as r (r.id)}
            <section class="panel game">
                <div class="game-top">
                    <span class="game-system">{r.system}</span>
                    <span class="game-when">{r.when}</span>
                </div>
                <p class="game-detail">{r.where}</p>
                <p class="game-status">{statusLine(r)}</p>
                <div class="actions">
                    <button class="secondary-button" type="button" disabled={busy}
                            onclick={() => act(() => cancelRequest(r.id), 'Request cancelled.')}>Cancel request</button>
                </div>
            </section>
        {/each}
    {/if}

    <!-- Open games: anyone at the club looking, each one yours to take. -->
    <h2 class="section-title">Open games</h2>
    {#if others.length}
        <ul class="panel others">
            {#each others as o (o.id)}
                {@const logo = systemLogoUrl(o.system, systemsConfig)}
                <li id={`open-${o.id}`} class:open={claiming === o.id}>
                    <div class="o-row">
                        <div class="o-main">
                            <span class="o-name">{o.player_name}</span>
                            <span class="o-when">{o.when}</span>
                            <span class="o-detail">{[o.where.charAt(0).toUpperCase() + o.where.slice(1), o.vibe, o.faction, o.points ? `${o.points.toLocaleString('en-GB')} pts` : null].filter(Boolean).join(' · ')}</span>
                            {#if o.notes}<span class="o-notes">“{o.notes}”</span>{/if}
                        </div>
                        <div class="o-side">
                            {#if logo}<img src={logo} alt={o.system} />{:else}<span class="o-sys">{o.system}</span>{/if}
                            {#if busySystems.has(o.system)}
                                <span class="o-busy">You’ve asked already</span>
                            {:else}
                                <button class="secondary-button" type="button" disabled={busy} aria-expanded={claiming === o.id}
                                        onclick={() => openClaim(o)}>{claiming === o.id ? 'Close' : 'Play'}</button>
                            {/if}
                        </div>
                    </div>
                    {#if claiming === o.id}
                        <div class="o-claim">
                            <label class="field">
                                <span class="field-label">Your faction</span>
                                <select class="field-select" bind:value={claimFaction}>
                                    <option value={NONE_FACTION}>Not sure yet</option>
                                    <FactionOptions {systemsConfig} system={o.system} />
                                </select>
                            </label>
                            {#if usesPoints(systemsConfig, o.system)}
                                <label class="field">
                                    <span class="field-label">Points</span>
                                    <input class="field-input" type="number" min="0" step="50" bind:value={claimPoints} />
                                </label>
                            {/if}
                            <button class="primary-button" type="button" disabled={busy} onclick={() => confirmClaim(o)}>
                                {busy ? 'Sending…' : `Play ${o.player_name}`}
                            </button>
                        </div>
                    {/if}
                </li>
            {/each}
        </ul>
    {:else}
        <p class="note">Nobody else is looking right now.</p>
    {/if}

    <h2 class="section-title">Find me a game</h2>
    {#if systems.length > 1}
        <SystemPicker {systems} {systemsConfig} isActive={(s) => s === system} onSelect={(s) => (system = s)} />
    {/if}

    {#if alreadyAsked}
        <p class="note">You already have a request in for {system}.</p>
    {:else if system}
        <section class="panel form">
            <div class="form-grid">
                <label class="field">
                    <span class="field-label">Day</span>
                    <input class="field-input" type="date" min={isoDay(0)} max={isoDay(30)} bind:value={date} />
                </label>
                <div class="field times">
                    <label>
                        <span class="field-label">Free from</span>
                        <select class="field-select" bind:value={start}>{#each TIMES as t}<option value={t}>{t}</option>{/each}</select>
                    </label>
                    <label>
                        <span class="field-label">Until</span>
                        <select class="field-select" bind:value={end}>{#each TIMES as t}<option value={t}>{t}</option>{/each}</select>
                    </label>
                </div>
            </div>

            <span class="field-label">Where</span>
            <div class="chips" role="radiogroup" aria-label="Where">
                <button type="button" class="chip" role="radio" aria-checked={venue === 'club'} onclick={() => (venue = 'club')}>The club</button>
                <button type="button" class="chip" role="radio" aria-checked={venue === 'elsewhere'} onclick={() => (venue = 'elsewhere')}>Elsewhere / to be agreed</button>
            </div>
            {#if venue === 'elsewhere'}
                <input class="field-input venue-text" type="text" maxlength="120" placeholder="Where, if you know (optional)" aria-label="Where" bind:value={venueText} />
            {/if}

            {#if vibeOptionsFor(systemsConfig, system).length}
                <span class="field-label">Kind of game</span>
                <div class="chips" role="radiogroup" aria-label="Kind of game">
                    {#each vibeOptionsFor(systemsConfig, system) as v}
                        <button type="button" class="chip" role="radio" aria-checked={vibe === v} onclick={() => (vibe = v)}>{v}</button>
                    {/each}
                </div>
            {/if}

            <div class="form-grid">
                <label class="field">
                    <span class="field-label">Faction</span>
                    <select class="field-select" bind:value={faction}>
                        <option value={NONE_FACTION}>Not sure yet</option>
                        <FactionOptions {systemsConfig} {system} />
                    </select>
                </label>
                {#if usesPoints(systemsConfig, system)}
                    <label class="field">
                        <span class="field-label">Points</span>
                        <input class="field-input" type="number" min="0" step="50" bind:value={points} />
                    </label>
                {/if}
            </div>

            <label class="field">
                <span class="field-label">Anything else (optional)</span>
                <input class="field-input" type="text" maxlength="500" placeholder="e.g. narrative game" bind:value={notes} />
            </label>

            <button class="primary-button ask" type="button" disabled={busy} onclick={ask}>
                {busy ? 'Adding you…' : 'Find me a game'}
            </button>
            <p class="disclaimer">
                We'll post that you're looking in the club's Discord. Games outside club night are arranged
                between players: Call to Arms and the club aren't responsible for them.
            </p>
        </section>
    {/if}

</div>
{/if}

<style>
    .page-title {
        font-size: 2.4rem;
        font-weight: 700;
        line-height: 1;
        text-transform: uppercase;
        /* The same as Sign up's, so the Club night / Pick-up game switch sits
           in exactly the same place on both pages and doesn't hop. */
        margin: 0 0 1rem;
    }


    .panel {
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 6px;
        padding: 16px 18px;
        margin-bottom: 12px;
    }

    .game.waiting { border-color: var(--color-accent); background: rgba(201, 161, 74, 0.08); }
    /* A confirmed game: a green bar beside it (design rule 1). */
    .game.on { position: relative; padding-left: 36px; }
    .game.on::before {
        content: '';
        position: absolute;
        left: 18px;
        top: 16px;
        bottom: 16px;
        width: 4px;
        border-radius: 2px;
        background: var(--color-win);
    }

    .game-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }

    .game-system {
        font-family: var(--font-heading);
        font-weight: 600;
        font-size: 0.85rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--color-accent);
    }

    .game-when { font-family: var(--font-heading); font-weight: 700; font-size: 1.15rem; color: var(--color-text-bright); }

    .game-vs { margin: 8px 0 2px; font-size: 1.1rem; color: var(--color-text-muted); }
    .game-vs b { color: var(--color-text-bright); }
    .game-detail { margin: 2px 0; color: var(--color-text-dim); }
    .game-detail b { color: var(--color-text-bright); }
    .game-notes { margin: 6px 0 0; color: var(--color-text-muted); font-style: italic; }
    .game-due { margin: 8px 0 0; font-size: 0.85rem; color: var(--color-accent); }
    .game-status { margin: 6px 0 0; color: var(--color-text-muted); }

    .actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
    .actions button { min-height: 44px; }

    /* One column on a phone, every field full width, so nothing is cut off
       at 360px or with a larger text size; two columns once there's room. */
    .form-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        margin-bottom: 12px;
    }

    @media (min-width: 640px) {
        .form-grid { grid-template-columns: 1fr 1fr; }
    }

    .field { display: flex; flex-direction: column; margin: 0; }

    /* Free from / until: side by side while each has at least 7.5em, stacked
       when the screen or the text size won't allow that. */
    .times { display: grid; grid-template-columns: repeat(auto-fit, minmax(7.5em, 1fr)); gap: 10px; }
    .times label { display: flex; flex-direction: column; min-width: 0; }

    .pickups :global(.field-input),
    .pickups :global(.field-select) {
        width: 100%;
        min-height: 46px;
        font-size: 1rem;
        box-sizing: border-box;
    }

    .chips {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(5.5em, 1fr));
        gap: 6px;
        margin: 4px 0 14px;
    }

    .chip {
        min-height: 44px;
        padding: 6px 8px;
        line-height: 1.15;
        border-radius: var(--radius);
        border: 1px solid #343a47;
        background: none;
        color: var(--color-text-muted);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
    }

    .chip[aria-checked='true'] {
        border-color: var(--color-accent);
        background: rgba(201, 161, 74, 0.16);
        color: var(--color-text-bright);
    }

    .venue-text { margin: -6px 0 14px; }

    .ask { width: 100%; min-height: 50px; font-size: 1.05rem; margin-top: 6px; }

    .disclaimer { margin: 10px 0 0; font-size: 0.8rem; line-height: 1.45; color: var(--color-text-faint); }

    .others { list-style: none; padding: 0; }
    .others li { padding: 12px 18px; border-top: 1px solid #1c2029; display: flex; flex-direction: column; }
    .others li:first-child { border-top: none; }
    .others li.open { background: rgba(201, 161, 74, 0.05); }
    .o-row { display: flex; align-items: center; gap: 12px; }
    .o-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .o-when { font-weight: 600; color: var(--color-accent); }
    .o-notes { font-size: 0.88rem; color: var(--color-text-muted); font-style: italic; }
    .o-side { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .o-side img { height: 20px; max-width: 96px; object-fit: contain; }
    .o-sys { font-size: 0.85rem; color: var(--color-text-muted); }
    .o-busy { font-size: 0.8rem; color: var(--color-text-faint); text-align: right; max-width: 7rem; }
    .o-claim {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 10px;
        margin-top: 12px;
    }
    .o-claim .field { margin: 0; flex: 1 1 11rem; min-width: 0; }
    .o-claim .field select, .o-claim .field input { width: 100%; }
    .o-claim .primary-button { flex: 1 1 100%; min-height: 46px; }
    .o-name { font-weight: 700; color: var(--color-text-bright); }
    .o-detail { font-size: 0.88rem; color: var(--color-text-dim); }

    .note { margin: 0 0 12px; color: var(--color-text-dim); }
    .message { margin: 0 0 12px; color: var(--color-win); font-weight: 600; }
    .error { margin: 0 0 12px; color: #d4786c; font-weight: 600; }

    @media (max-width: 560px) {
        .page-title { font-size: 2.1rem; }
        .panel { padding: 14px; }
    }
</style>
