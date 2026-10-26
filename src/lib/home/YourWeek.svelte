<!--
  "Your week": what a signed-in member sees at their club's address. Their next
  game first, then the club's nights this week with one tap to sign up, that
  night's pairings with their own game picked out, and their season.

  Everything a player does from here lands on the page that already does it
  (signing up, dropping, re-arranging a game, call outs all stay on /signup),
  so this tab adds a front door and no second way of doing anything.
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import FactionIcon from '../FactionIcon.svelte';
    import GameList from './GameList.svelte';
    import { fetchPickups, needsMyAnswer, peekPickups, type PickupList } from '../pickups';
    import { systemFolder } from '../factions';
    import { getSystemsConfig, systemLogoUrl, FALLBACK_SYSTEMS_CONFIG, type SystemConfig } from '../systemsConfig';
    import { getClubSlugFromHostname } from '../clubSlug';
    import {
        fetchHome, fetchPairings, peekHome, peekPairings, gameLabel, longDay, myMatchup, shortDay, sides, weekday,
        type HomeData, type HomeNight, type PairingsData
    } from './api';

    let { clubName = null }: { clubName?: string | null } = $props();

    // Pick-up games: anything waiting on this player's answer leads the page.
    let pickups = $state<PickupList | null>(peekPickups());
    const pickupWaiting = $derived((pickups?.mine ?? []).filter(needsMyAnswer));
    const pickupOn = $derived((pickups?.mine ?? []).filter((r) => r.match?.status === 'confirmed'));

    // Seeded from the last visit, so coming back to Home paints at once.
    const seen = peekHome();
    let home = $state<HomeData | null>(seen);
    let loaded = $state(seen !== null);
    let systemsConfig = $state<SystemConfig[]>(FALLBACK_SYSTEMS_CONFIG);

    /** The night whose game leads the page: the first one the caller is in.
     *  Its pairings fill the pairings panel once they are published. */
    let gameNight = $state<HomeNight | null>(null);
    let pairings = $state<PairingsData | null>(null);
    /** The night the pairings panel shows. */
    let pairingsNight = $state<HomeNight | null>(null);

    onMount(async () => {
        getSystemsConfig(getClubSlugFromHostname(window.location.hostname)).then((c) => (systemsConfig = c));
        fetchPickups().then((p) => (pickups = p));
        if (home) await show(home, true);
        const fresh = await fetchHome();
        home = fresh;
        loaded = true;
        if (fresh) await show(fresh, false);
    });

    /** Work out the lead night and its pairings. `fromCache` uses pairings
     *  already fetched this page load, for the instant first paint. */
    async function show(h: HomeData, fromCache: boolean) {
        gameNight = h.nights.find((n) => n.mine) ?? null;
        // No game of their own: show whichever night has pairings out, so the
        // panel still answers "who's playing whom".
        const shown = gameNight
            ? (gameNight.published ? gameNight : null)
            : h.nights.find((n) => n.published) ?? null;
        if (!shown) {
            pairings = null;
            pairingsNight = null;
            return;
        }
        const p = fromCache ? peekPairings(shown.system, shown.week) : await fetchPairings(shown.system, shown.week);
        if (p) {
            pairings = p;
            pairingsNight = shown;
        }
    }

    const myGame = $derived(
        gameNight?.published && pairings ? myMatchup(pairings.matchups, home?.player_id) : null
    );
    const myGameIndex = $derived(
        myGame && pairings ? pairings.matchups.filter((m) => !m.is_bye).indexOf(myGame) : -1
    );
    const seat = $derived(myGame ? sides(myGame, home?.player_id) : null);
    const folder = $derived(gameNight ? systemFolder(gameNight.system, systemsConfig) : null);

    function logoFor(n: { system: string; logo_url: string | null }): string | null {
        return n.logo_url || systemLogoUrl(n.system, systemsConfig);
    }

    function signupHref(n: HomeNight, hash = ''): string {
        return `/signup?${new URLSearchParams({ system: n.system })}${hash}`;
    }

    function pairingsHref(n: HomeNight): string {
        return `/pairings?${new URLSearchParams({ system: n.system, week: n.week })}`;
    }

    function ordinal(n: number): string {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }
</script>

{#if !loaded}
    <!-- The page's shape while the first answer is on its way, so a tap on
         Home shows Home immediately rather than an empty screen. -->
    <div class="week" aria-busy="true">
        <div class="week-head"><h1 class="page-title">Your week</h1></div>
        <div class="grid">
            <div class="panel next skeleton"></div>
            <div class="panel nights skeleton"></div>
        </div>
    </div>
{:else}
<div class="week">
    <div class="week-head">
        <h1 class="page-title">Your week</h1>
        {#if clubName}<span class="club-name">{clubName}</span>{/if}
    </div>

    {#if !home}
        <div class="empty-state">Couldn't load your week right now. Try refreshing.</div>
    {:else}
    {#each pickupWaiting as r (r.id)}
        <a class="pickup-strip waiting" href="/pickups">
            <span><b>Pick-up game found:</b> you vs {r.match?.opponent?.name}, {r.match?.when}. Accept or decline.</span>
            <span class="strip-go">Answer ›</span>
        </a>
    {/each}
    {#each pickupOn as r (r.id)}
        <a class="pickup-strip on" href="/pickups">
            <span><b>Pick-up game on:</b> you vs {r.match?.opponent?.name}, {r.match?.when}, {r.match?.where}.</span>
            <span class="strip-go">Details ›</span>
        </a>
    {/each}
    <div class="grid">
        <!-- ── Your next game ─────────────────────────────────────────── -->
        <section class="panel next">
            <header class="panel-head">
                <h2>Your next game</h2>
                {#if gameNight && logoFor(gameNight)}
                    <img class="panel-logo" src={logoFor(gameNight)} alt={gameNight.name} />
                {/if}
            </header>

            {#if gameNight && myGame && seat && !myGame.is_bye}
                <div class="next-body">
                    <div class="next-when">
                        <span class="when-long">{longDay(gameNight.date)}</span>
                        <span class="when-short">{shortDay(gameNight.date)}{#if myGame.eta} · {myGame.eta}{/if} · <b>{gameLabel(myGame, myGameIndex)}</b></span>
                        <span class="when-label">{gameLabel(myGame, myGameIndex)}</span>
                    </div>

                    <div class="versus">
                        <div class="vs-side">
                            <FactionIcon faction={seat.me.faction} {folder} class="vs-icon" />
                            <div>
                                <div class="vs-name">You</div>
                                <div class="vs-faction">{seat.me.faction ?? 'No faction yet'}</div>
                            </div>
                        </div>
                        <div class="vs-mid"><span class="vs-rule"></span><span class="vs-word">VS</span><span class="vs-rule"></span></div>
                        <div class="vs-side vs-side-b">
                            <div>
                                <div class="vs-name">{seat.them.name}</div>
                                <div class="vs-faction">{seat.them.faction ?? 'No faction yet'}</div>
                            </div>
                            <FactionIcon faction={seat.them.faction} {folder} class="vs-icon" />
                        </div>
                    </div>

                    <div class="tiles">
                        {#if myGame.points}
                            <div class="tile"><span class="tile-label">Points</span><span class="tile-value">{Number(myGame.points).toLocaleString('en-GB')}</span></div>
                        {/if}
                        {#if myGame.game_type}
                            <div class="tile"><span class="tile-label">Kind of game</span><span class="tile-value">{myGame.game_type}</span></div>
                        {/if}
                        {#if myGame.eta}
                            <div class="tile"><span class="tile-label">First dice</span><span class="tile-value">{myGame.eta}</span></div>
                        {/if}
                        {#if seat.them.level}
                            <div class="tile"><span class="tile-label">{seat.them.name}</span><span class="tile-value">Level {seat.them.level}</span></div>
                        {/if}
                    </div>
                </div>
                <footer class="panel-actions">
                    <a class="btn btn-gold" href={pairingsHref(gameNight)}>All of {weekday(gameNight.date)}'s games</a>
                    <a class="btn btn-line" href={signupHref(gameNight, '#rearrange')}>Re-arrange</a>
                    <a class="btn btn-line" href={signupHref(gameNight, '#drop')}>Can't make it</a>
                </footer>
            {:else if gameNight && myGame?.is_bye}
                <div class="next-body next-plain">
                    <p class="next-big">{longDay(gameNight.date)}</p>
                    <p class="next-note">You're sitting out this one. If someone drops, you're first in line for their opponent.</p>
                </div>
                <footer class="panel-actions">
                    <a class="btn btn-gold" href={pairingsHref(gameNight)}>See the pairings</a>
                    <a class="btn btn-line" href={signupHref(gameNight, '#drop')}>Can't make it</a>
                </footer>
            {:else if gameNight}
                <div class="next-body next-plain">
                    <p class="next-big">{longDay(gameNight.date)}</p>
                    <p class="next-note">
                        You're signed up, along with {gameNight.signed_up - 1}
                        {gameNight.signed_up - 1 === 1 ? 'other' : 'others'}. Pairings go up before the night.
                    </p>
                </div>
                <footer class="panel-actions">
                    <a class="btn btn-gold" href={signupHref(gameNight)}>Change my signup</a>
                    <a class="btn btn-line" href={signupHref(gameNight, '#drop')}>Can't make it</a>
                </footer>
            {:else}
                <!-- No button: This week, beside or below, signs up for any night. -->
                <div class="next-body next-plain">
                    <p class="next-big">No game yet this week</p>
                    <p class="next-note">Pick a night and you'll be paired before it starts.</p>
                </div>
            {/if}
        </section>

        <!-- ── Open pick-ups: other players looking for a game ────────── -->
        <section class="panel pickups">
            <header class="panel-head">
                <h2>Open pick-ups</h2>
                <a class="head-link" href="/pickups">Ask for a game</a>
            </header>
            {#if pickups?.others.length}
                <ul class="pick-list">
                    {#each pickups.others.slice(0, 4) as r (r.id)}
                        {@const night = home.nights.find((x) => x.system === r.system)}
                        {@const logo = systemLogoUrl(r.system, systemsConfig)}
                        <li>
                            <a class="pick-row" href="/pickups">
                                <span class="night-bar" style={`background: ${night?.accent_color ?? 'var(--color-accent)'}`}></span>
                                <span class="pick-who">
                                    <b>{r.player_name}</b>
                                    <span>{r.when}</span>
                                </span>
                                <span class="pick-sys">
                                    {#if logo}<img src={logo} alt={r.system} />{:else}<b>{r.system}</b>{/if}
                                    <span>{r.where}</span>
                                </span>
                                <span class="pick-go" aria-hidden="true">›</span>
                            </a>
                        </li>
                    {/each}
                </ul>
                {#if pickups.others.length > 4}
                    <a class="pick-more" href="/pickups">{pickups.others.length - 4} more</a>
                {/if}
            {:else}
                <p class="pick-empty">None open</p>
            {/if}
        </section>

        <!-- ── This week ──────────────────────────────────────────────── -->
        <section class="panel nights">
            <header class="panel-head"><h2>This week</h2></header>
            <ul class="night-list">
                {#each home.nights as n (n.system)}
                    <li class="night-row">
                        <span class="night-bar" style={`background: ${n.accent_color}`}></span>
                        <div class="night-id">
                            {#if logoFor(n)}
                                <img src={logoFor(n)} alt={n.name} />
                            {:else}
                                <span class="night-name">{n.name}</span>
                            {/if}
                            <span class="night-day" style={`color: ${n.accent_color}`}>{shortDay(n.date)}</span>
                        </div>
                        <div class="night-count"><b>{n.signed_up}</b><span>going</span></div>
                        <div class="night-action">
                            {#if n.mine}
                                <a class="night-in" href={signupHref(n)}>You're in</a>
                            {:else if n.is_full}
                                <span class="night-full">Full</span>
                            {:else}
                                <a class="night-join" href={signupHref(n)}>Sign up</a>
                            {/if}
                        </div>
                    </li>
                {/each}
            </ul>
        </section>

        <!-- ── Pairings ───────────────────────────────────────────────── -->
        {#if pairingsNight && pairings?.published && pairings.matchups.length}
            <section class="panel games" class:wide={!home.leagues.length}>
                <header class="panel-head">
                    <h2>{weekday(pairingsNight.date)}'s pairings</h2>
                    <a class="head-link" href={pairingsHref(pairingsNight)}>Open</a>
                </header>
                <GameList
                    matchups={pairings.matchups}
                    playerId={home.player_id}
                    folder={systemFolder(pairingsNight.system, systemsConfig)}
                    detail
                />
            </section>
        {/if}

        <!-- ── Your season ────────────────────────────────────────────── -->
        {#if home.leagues.length}
            <section class="panel season" class:wide={!(pairingsNight && pairings?.published && pairings.matchups.length)}>
                <header class="panel-head"><h2>Your season</h2></header>
                {#each home.leagues as lg (lg.system)}
                    <div class="league">
                        <div class="league-head">
                            {#if logoFor(lg)}
                                <img src={logoFor(lg)} alt={lg.name} />
                            {:else}
                                <span class="night-name">{lg.name}</span>
                            {/if}
                            <span class="league-rank">{ordinal(lg.rank)} <small>of {lg.of}</small></span>
                        </div>
                        <div class="record">
                            <div class="rec rec-w"><b>{lg.wins}</b><span>W</span></div>
                            <div class="rec rec-d"><b>{lg.draws}</b><span>D</span></div>
                            <div class="rec rec-l"><b>{lg.losses}</b><span>L</span></div>
                            <div class="rec rec-rating"><b>{Math.round(lg.rating).toLocaleString('en-GB')}</b><span>Rating</span></div>
                        </div>
                        <div class="level-line">
                            <span>Level {lg.level}</span>
                            <small>{lg.at_cap ? 'Top level' : `${lg.games_to_next} ${lg.games_to_next === 1 ? 'game' : 'games'} to level ${lg.level + 1}`}</small>
                        </div>
                        <div class="level-track"><div class="level-fill" style={`width: ${lg.level_percent}%`}></div></div>
                    </div>
                {/each}
                <footer class="panel-foot"><a href="/leagues">League tables</a></footer>
            </section>
        {/if}
    </div>
    {/if}
</div>
{/if}

<style>
    .week-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.25rem;
    }

    h1 {
        font-size: 2.6rem;
        font-weight: 700;
        line-height: 1;
        text-transform: uppercase;
    }

    .club-name { color: var(--color-text-dim); font-size: 0.95rem; }

    .grid {
        display: grid;
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 20px;
        align-items: stretch;
    }

    .panel {
        display: flex;
        flex-direction: column;
        background: #13161e;
        border: 1px solid #232733;
        border-radius: 6px;
        overflow: hidden;
        min-width: 0;
    }

    .next, .games, .pickups { grid-column: span 8; }
    .nights, .season { grid-column: span 4; }
    /* This week sits beside both Your next game and Open pick-ups. */
    .next, .pickups { grid-column: 1 / span 8; }
    .nights { grid-column: 9 / span 4; grid-row: 1 / span 2; align-self: start; }

    /* ── Open pick-ups ── */
    .pick-list { list-style: none; margin: 0; padding: 0; }
    .pick-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 22px;
        border-top: 1px solid #1c2029;
        color: inherit;
        text-decoration: none;
    }
    .pick-list li:first-child .pick-row { border-top: none; }
    .pick-row:hover { background: rgba(201, 161, 74, 0.05); }
    .pick-row .night-bar { align-self: stretch; }
    .pick-who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .pick-who b { color: var(--color-text-bright); font-size: 1.05rem; }
    .pick-who span { font-size: 0.9rem; font-weight: 600; color: var(--color-accent); }
    .pick-sys { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; min-width: 0; text-align: right; }
    .pick-sys img { height: 22px; width: auto; max-width: 120px; object-fit: contain; }
    .pick-sys span { font-size: 0.85rem; color: var(--color-text-dim); }
    .pick-go { color: var(--color-text-faint); font-size: 1.3rem; }
    .pick-empty, .pick-more {
        margin: 0;
        padding: 16px 22px;
        font-family: var(--font-heading);
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--color-text-faint);
        text-decoration: none;
    }
    .pick-more { display: block; padding-top: 10px; border-top: 1px solid #1c2029; color: var(--color-accent); }
    .wide { grid-column: span 12; }

    .skeleton {
        min-height: 360px;
        background: linear-gradient(100deg, #13161e 30%, #191d27 50%, #13161e 70%) 0 0 / 300% 100%;
        animation: shimmer 1.4s ease-in-out infinite;
    }

    @keyframes shimmer { to { background-position: -150% 0; } }

    @media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }

    .panel-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 22px;
        border-bottom: 1px solid #232733;
    }

    .panel-head h2 {
        font-size: 1rem;
        font-weight: 600;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--color-accent);
    }

    .panel-logo { height: 26px; width: auto; max-width: 180px; object-fit: contain; }

    .head-link { font-size: 0.9rem; font-weight: 600; color: var(--color-accent); }

    /* ── Next game ── */
    .next-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 28px;
        padding: 26px;
    }

    .next-when {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
    }

    .when-long {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.8rem;
        line-height: 1;
        text-transform: uppercase;
        color: var(--color-text-bright);
    }

    .when-label {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.35rem;
        color: var(--color-accent);
    }

    .when-short { display: none; color: var(--color-text-muted); }
    .when-short b { color: var(--color-text-bright); }

    .versus {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: center;
        gap: 24px;
    }

    .vs-side {
        display: flex;
        align-items: center;
        gap: 18px;
        min-width: 0;
    }

    .vs-side-b { justify-content: flex-end; text-align: right; }

    .vs-side :global(.vs-icon) { width: 104px; height: 104px; flex: none; }

    .vs-name {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 2.8rem;
        line-height: 1;
        text-transform: uppercase;
        color: var(--color-text-bright);
        overflow-wrap: anywhere;
    }

    .vs-faction { margin-top: 6px; font-size: 1.05rem; color: var(--color-text-muted); }

    .vs-mid { display: flex; align-items: center; gap: 12px; }
    .vs-rule { display: none; flex: 1; height: 1px; background: #232733; }

    .vs-word {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.9rem;
        letter-spacing: 0.2em;
        color: var(--color-accent);
    }

    .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 10px;
    }

    .tile {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 12px 14px;
        background: #0f1218;
        border: 1px solid #1c2029;
        border-radius: 5px;
        min-width: 0;
    }

    .tile-label {
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--color-text-dim);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .tile-value {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.45rem;
        line-height: 1.1;
        color: var(--color-text-bright);
    }

    .next-plain { gap: 8px; }

    .next-big {
        margin: 0;
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 2rem;
        line-height: 1.05;
        text-transform: uppercase;
        color: var(--color-text-bright);
    }

    .next-note { margin: 0; color: var(--color-text-muted); font-size: 1.05rem; }

    .panel-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        padding: 16px 22px;
        border-top: 1px solid #232733;
    }

    .btn {
        min-height: 44px;
        padding: 0 18px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 5px;
        font-weight: 600;
        text-decoration: none;
    }

    .btn-gold { background: var(--color-accent); color: #15120a; }
    .btn-gold:hover { background: var(--color-accent-bright); }
    .btn-line { border: 1px solid var(--color-accent-border); color: var(--color-accent); }
    .btn-line:hover { background: rgba(201, 161, 74, 0.08); }

    /* ── This week ── */
    .night-list { list-style: none; margin: 0; padding: 0; }

    .night-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px 20px;
        border-bottom: 1px solid #1c2029;
    }

    .night-row:last-child { border-bottom: none; }

    .night-bar { width: 4px; align-self: stretch; border-radius: 2px; flex: none; }

    .night-id { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }

    .night-id img {
        display: block;
        height: 24px;
        width: auto;
        max-width: 160px;
        object-fit: contain;
        object-position: left center;
    }

    .night-name { font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.85rem; }

    .night-day { font-size: 0.85rem; font-weight: 600; }

    .night-count {
        width: 52px;
        flex: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        line-height: 1.05;
    }

    .night-count b {
        font-family: var(--font-heading);
        font-size: 1.5rem;
        color: var(--color-text-bright);
    }

    .night-count span { font-size: 0.72rem; color: var(--color-text-dim); }

    .night-action { width: 96px; flex: none; display: flex; }

    .night-in,
    .night-join,
    .night-full {
        width: 100%;
        height: 38px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 5px;
        font-size: 0.9rem;
        font-weight: 600;
        text-decoration: none;
    }

    .night-in { color: var(--color-win); }
    .night-join { border: 1px solid var(--color-accent-border); color: var(--color-accent); }
    .night-join:hover { background: rgba(201, 161, 74, 0.08); }
    .night-full { color: var(--color-text-faint); }

    /* ── Season ── */
    .league { padding: 18px 22px; border-bottom: 1px solid #232733; }
    .league:last-of-type { border-bottom: none; }

    .league-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .league-head img {
        height: 28px;
        width: auto;
        max-width: 170px;
        object-fit: contain;
        object-position: left center;
    }

    .league-rank {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 2rem;
        line-height: 1;
        color: var(--color-text-bright);
    }

    .league-rank small { font-size: 1rem; color: var(--color-text-dim); }

    .record {
        margin-top: 14px;
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr)) 1.3fr;
        gap: 8px;
    }

    .rec {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 0;
        background: #0f1218;
        border: 1px solid #1c2029;
        border-radius: 5px;
    }

    .rec b {
        font-family: var(--font-heading);
        font-size: 1.9rem;
        line-height: 1;
        font-variant-numeric: tabular-nums;
    }

    .rec span {
        margin-top: 4px;
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 0.85rem;
        letter-spacing: 0.15em;
        text-transform: uppercase;
    }

    .rec-w { color: var(--color-win); }
    .rec-d { color: var(--color-text-muted); }
    .rec-l { color: #d4786c; }
    .rec-rating b { color: var(--color-text-bright); }
    .rec-rating span { color: var(--color-text-dim); }

    .level-line {
        margin-top: 14px;
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        font-weight: 600;
        color: var(--color-text-muted);
    }

    .level-line small { font-weight: 400; color: var(--color-text-dim); font-size: 0.85rem; }

    .level-track { margin-top: 6px; height: 8px; border-radius: 4px; background: #1c2029; }
    .level-fill { height: 8px; border-radius: 4px; background: var(--color-accent); }

    .panel-foot {
        margin-top: auto;
        padding: 14px 22px;
        border-top: 1px solid #232733;
        font-weight: 600;
    }

    .panel-foot a { color: var(--color-accent); }

    /* ── Tablet: one column ── */
    @media (max-width: 900px) {
        .next, .games, .nights, .season, .pickups { grid-column: 1 / -1; grid-row: auto; }
    }

    /* ── Phone ── */
    @media (max-width: 560px) {
        h1 { font-size: 2.2rem; }
        .club-name { display: none; }
        .grid { gap: 14px; }
        .panel-head { padding: 12px 14px; }
        .pick-row { padding: 12px 14px; }
        .pick-empty, .pick-more { padding-left: 14px; padding-right: 14px; }
        .panel-head h2 { font-size: 0.92rem; letter-spacing: 0.18em; }
        .panel-logo { height: 20px; }

        .next-body { padding: 16px 14px; gap: 16px; }
        .when-long, .when-label { display: none; }
        .when-short { display: inline; }

        /* Three lines: you, a VS rule across the card, them on the right. */
        .versus { display: flex; flex-direction: column; align-items: stretch; gap: 6px; }
        .vs-side { gap: 14px; }
        .vs-side :global(.vs-icon) { width: 60px; height: 60px; }
        .vs-name { font-size: 2.1rem; }
        .vs-faction { margin-top: 4px; font-size: 0.95rem; color: var(--color-text-dim); }
        .vs-rule { display: block; }
        .vs-word { font-size: 1.5rem; }
        .tiles { display: none; }

        .panel-actions { padding: 12px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .panel-actions .btn-gold { grid-column: 1 / -1; }

        .night-row { padding: 12px 14px; gap: 12px; }
        .night-id img { height: 22px; max-width: 150px; }
        .night-count { width: 44px; }
        .night-count b { font-size: 1.35rem; }
        .night-action { width: 86px; }

        .league { padding: 16px 14px; }
        .panel-foot { padding: 12px 14px; }
    }

    .pickup-strip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
        padding: 14px 18px;
        border-radius: 6px;
        text-decoration: none;
        color: var(--color-text-muted);
    }

    .pickup-strip b { color: var(--color-text-bright); }
    .pickup-strip.waiting { background: rgba(201, 161, 74, 0.1); border: 1px solid var(--color-accent); }
    .pickup-strip.on { background: rgba(111, 174, 114, 0.08); border: 1px solid rgba(111, 174, 114, 0.5); }
    .strip-go { flex: none; font-weight: 700; color: var(--color-accent); }
    .pickup-strip.on .strip-go { color: var(--color-win); }



    @media (max-width: 560px) {
        .pickup-strip { padding: 12px 14px; }
    }
</style>
