<!--
  A night's games, one row each: the label, one player on the left, "v", the
  other mirrored on the right with their icon outermost. The caller's own game
  is picked out in gold, label and "v" both. Players sitting out are listed
  after the games rather than as a half-empty row.

  `detail` adds what the old pairings cards carried under each game (kind of
  game, arrival, points, levels, guest), for the pairings page; the home tab
  leaves it off.
-->
<script lang="ts">
    import FactionIcon from '../FactionIcon.svelte';
    import { gameLabel, type Matchup } from './api';

    let {
        matchups,
        playerId = null,
        folder,
        detail = false
    }: {
        matchups: Matchup[];
        playerId?: number | null;
        folder: string | null | undefined;
        detail?: boolean;
    } = $props();

    const games = $derived(matchups.filter((m) => !m.is_bye));
    const sittingOut = $derived(matchups.filter((m) => m.is_bye));

    function mine(m: Matchup): boolean {
        return playerId != null && (m.player_a_id === playerId || m.player_b_id === playerId);
    }

    /* Each kind of game keeps the colour it had on the old pairings cards, so
       regulars recognise a competitive table at a glance. Anything else (a
       club's own vibe) takes the gold. */
    const VIBE_COLOURS: Record<string, string> = {
        casual: '#6eb46e', competitive: '#d25050', intro: '#5a9bd4', standard: '#9c8bd1'
    };
    function vibeColour(gameType: string | null): string {
        return VIBE_COLOURS[(gameType ?? '').toLowerCase()] ?? '#c9a14a';
    }

    // Same ladder as the profile bar and the posted image, so a level reads in
    // the same colour wherever a player sees it.
    const LEVEL_BANDS: [number, string][] = [
        [60, '#ff8000'], [50, '#a335ee'], [40, '#e05fa8'], [30, '#8b7cf6'],
        [20, '#4a9eda'], [10, '#17c3b2'], [1, '#3fb950']
    ];
    function levelColour(level: number | null): string {
        for (const [floor, colour] of LEVEL_BANDS) if ((level ?? 0) >= floor) return colour;
        return LEVEL_BANDS[LEVEL_BANDS.length - 1][1];
    }

    const hasMeta = (m: Matchup) => !!(m.game_type || m.eta || m.points || m.prearranged);
</script>

<ol class="games">
    {#each games as m, i (m.id ?? `${m.player_a_name}|${m.player_b_name}`)}
        {@const [kind, num] = gameLabel(m, i).split(' ')}
        <li class="game" class:mine={mine(m)} class:detail style={detail ? `--vibe: ${vibeColour(m.game_type)}` : ''}>
            <span class="label"><small>{kind}</small> {num}</span>
            <div class="side">
                <FactionIcon faction={m.player_a_faction} {folder} class="game-icon" />
                <div class="who">
                    <span class="name">
                        {m.player_a_name}
                        {#if detail && m.player_a_level}<span class="lvl lvl-top" style={`color: ${levelColour(m.player_a_level)}`}>Lvl {m.player_a_level}</span>{/if}
                    </span>
                    <span class="faction">{#if detail && m.player_a_level}<span class="lvl lvl-sub" style={`color: ${levelColour(m.player_a_level)}`}>Lvl {m.player_a_level}</span> {/if}{m.player_a_faction ?? '—'}</span>
                </div>
            </div>
            <span class="v">v</span>
            <div class="side side-b">
                <div class="who">
                    <span class="name">
                        {#if detail && m.player_b_level}<span class="lvl lvl-top" style={`color: ${levelColour(m.player_b_level)}`}>Lvl {m.player_b_level}</span>{/if}
                        {m.player_b_name}
                        {#if m.player_b_id == null}<span class="guest">guest</span>{/if}
                    </span>
                    <span class="faction">{m.player_b_faction ?? '—'}{#if detail && m.player_b_level} <span class="lvl lvl-sub" style={`color: ${levelColour(m.player_b_level)}`}>Lvl {m.player_b_level}</span>{/if}</span>
                </div>
                <FactionIcon faction={m.player_b_faction} {folder} class="game-icon" />
            </div>
            {#if detail && hasMeta(m)}
                <div class="meta">
                    {#if m.game_type}<b class="m-vibe">{m.game_type}</b>{/if}
                    {#if m.eta}<b class="m-time">{m.eta}</b>{/if}
                    {#if m.points}<b class="m-points">{Number(m.points).toLocaleString('en-GB')} pts</b>{/if}
                    {#if m.prearranged}<b class="m-quiet">Arranged</b>{/if}
                </div>
            {/if}
        </li>
    {/each}
</ol>

{#if sittingOut.length}
    <p class="sitting-out">
        Sitting out: {sittingOut.map((m) => m.player_a_name).join(', ')}
    </p>
{/if}

<style>
    .games {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .game {
        display: grid;
        grid-template-columns: 76px minmax(0, 1fr) 36px minmax(0, 1fr);
        align-items: center;
        gap: 10px;
        padding: 12px 20px;
        border-bottom: 1px solid #1c2029;
    }

    .game:last-child { border-bottom: none; }

    .game.mine { background: rgba(201, 161, 74, 0.08); }

    .label,
    .v {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.1rem;
        color: var(--color-text-dim);
        white-space: nowrap;
    }

    .v { text-align: center; }

    .label small { font-size: inherit; }

    .game.mine .label,
    .game.mine .v { color: var(--color-accent); }

    .side {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
    }

    .side-b {
        justify-content: flex-end;
        text-align: right;
    }

    .side :global(.game-icon) {
        width: 34px;
        height: 34px;
        flex: none;
    }

    .who {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .name {
        font-weight: 600;
        color: var(--color-text-bright);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .faction {
        font-size: 0.82rem;
        color: var(--color-text-dim);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .lvl,
    .guest {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--color-text-dim);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    /* The kind of game as a coloured edge on the row, and in its colour below. */
    .game.detail { box-shadow: inset 3px 0 0 var(--vibe); }

    .meta {
        grid-column: 2 / -1;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 4px 8px;
        margin-top: 2px;
    }

    /* Bold, coloured words rather than bubbles: the kind of game in its own
       colour, then the time and the points, dot-separated. */
    .meta b {
        font-weight: 700;
        font-size: 0.9rem;
        font-variant-numeric: tabular-nums;
    }

    .meta b + b::before {
        content: '·';
        margin-right: 8px;
        color: var(--color-text-faint);
        font-weight: 400;
    }

    .m-vibe { color: var(--vibe); }
    .m-time { color: var(--color-text-bright); }
    .m-points { color: var(--color-accent); }
    .m-quiet { color: var(--color-text-dim); }

    /* A level sits beside the name where there's room, and beside the faction
       on a phone, where it would otherwise squeeze the name off the row. */
    .lvl-sub { display: none; }

    .sitting-out {
        margin: 0;
        padding: 12px 20px;
        border-top: 1px dashed #343a47;
        font-size: 0.88rem;
        color: var(--color-text-dim);
    }

    @media (max-width: 560px) {
        .game {
            grid-template-columns: 34px minmax(0, 1fr) 14px minmax(0, 1fr);
            gap: 6px;
            padding: 10px 12px;
        }
        .label, .v { font-size: 1.05rem; }
        /* "Game" over the number: the word costs a third of a phone's width
           on one line, and the faction names were paying for it. */
        .label { display: flex; flex-direction: column; align-items: center; line-height: 1; }
        .label small { font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; }
        .side { gap: 6px; }
        .side :global(.game-icon) { width: 28px; height: 28px; }
        .name { font-size: 0.92rem; }
        .faction { font-size: 0.75rem; }
        .sitting-out { padding: 10px 12px; }
        .meta { grid-column: 1 / -1; }
        .lvl-top { display: none; }
        .lvl-sub { display: inline; font-size: 0.66rem; margin: 0 4px; }
        .meta b { font-size: 0.85rem; }
    }
</style>
