<!--
  A night's games, one row each, laid out like Home's "This week" list: a
  standalone bar in the colour of the kind of game, then the game. "GAME 1"
  and its details (kind, time, points) across the top, then each player on a
  full-width line of their own: icon, name, level, and the faction in full.
  Option A on the design canvas's "Pairing cards" page (2026-10-25): the old
  mirrored rows cut factions short on a phone.

  The caller's own game is tinted gold. Players sitting out follow the games.
  `detail` adds the details line and levels; Home and Pairings both use it.
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

    function sidesOf(m: Matchup) {
        return [
            { id: m.player_a_id, name: m.player_a_name, faction: m.player_a_faction, level: m.player_a_level, guest: false },
            { id: m.player_b_id, name: m.player_b_name ?? '', faction: m.player_b_faction, level: m.player_b_level, guest: m.player_b_id == null }
        ];
    }
</script>

<ol class="games">
    {#each games as m, i (m.id ?? `${m.player_a_name}|${m.player_b_name}`)}
        {@const [a, b] = sidesOf(m)}
        <li class="game" class:mine={mine(m)}>
            <span class="bar" style={`background: ${vibeColour(m.game_type)}`} title={m.game_type ?? undefined}></span>
            <div class="body">
                <div class="top">
                    <span class="label">{gameLabel(m, i)}</span>
                    {#if detail}
                        <span class="meta">
                            {#if m.game_type}<b style={`color: ${vibeColour(m.game_type)}`}>{m.game_type}</b>{/if}
                            {#if m.eta}<b class="m-time">{m.eta}</b>{/if}
                            {#if m.points}<b class="m-points">{Number(m.points).toLocaleString('en-GB')} pts</b>{/if}
                            {#if m.prearranged}<b class="m-quiet">Arranged</b>{/if}
                        </span>
                    {/if}
                </div>
                {#each [a, b] as p, k}
                    {#if k === 1}<span class="vs">VS</span>{/if}
                    <div class="player">
                        <span class="icon"><FactionIcon faction={p.faction} {folder} class="game-icon" /></span>
                        <div class="who">
                            <span class="name-line">
                                <span class="name" class:me={p.id != null && p.id === playerId}>{p.name}</span>
                                {#if p.guest}
                                    <span class="tag">Guest</span>
                                {:else if detail && p.level}
                                    <span class="tag" style={`color: ${levelColour(p.level)}`}>Lvl {p.level}</span>
                                {/if}
                            </span>
                            <span class="faction">{p.faction ?? 'No faction given'}</span>
                        </div>
                    </div>
                {/each}
            </div>
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
        display: flex;
        gap: 14px;
        padding: 14px 18px;
        border-bottom: 1px solid #1c2029;
    }

    .game:last-child { border-bottom: none; }
    .game.mine { background: rgba(201, 161, 74, 0.08); }

    /* The kind of game, as a bar of its own: the same device as the night
       rows in Home's "This week". */
    .bar {
        width: 4px;
        flex: none;
        align-self: stretch;
        border-radius: 2px;
    }

    .body { flex: 1; min-width: 0; display: flex; flex-direction: column; }

    .top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 8px;
    }

    .label {
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 1.05rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--color-text-dim);
    }

    .game.mine .label { color: var(--color-accent); }

    .meta { display: flex; flex-wrap: wrap; gap: 2px 0; font-size: 0.85rem; }
    .meta b { font-weight: 700; font-variant-numeric: tabular-nums; }
    .meta b + b::before { content: '·'; margin: 0 7px; color: #4a5060; font-weight: 400; }
    .m-time { color: var(--color-text-bright); }
    .m-points { color: var(--color-accent); }
    .m-quiet { color: var(--color-text-dim); }

    .player { display: flex; align-items: center; gap: 12px; min-width: 0; }

    .icon { width: 38px; height: 38px; flex: none; }
    .icon :global(.game-icon) { width: 38px; height: 38px; display: block; }

    .who { display: flex; flex-direction: column; min-width: 0; }

    .name-line { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }

    .name { font-weight: 700; font-size: 1.02rem; color: var(--color-text-bright); }
    .name.me { color: var(--color-accent-bright); }

    .tag {
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-dim);
    }

    .faction { font-size: 0.88rem; color: var(--color-text-dim); }

    /* Just the word: no rules either side. Lined up with the names. */
    .vs {
        margin: 5px 0 5px 50px;
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: 0.8rem;
        letter-spacing: 0.16em;
        color: #5c6270;
    }

    .game.mine .vs { color: var(--color-accent); }

    .sitting-out {
        margin: 0;
        padding: 12px 18px;
        border-top: 1px dashed #343a47;
        font-size: 0.9rem;
        color: var(--color-text-dim);
    }

    @media (max-width: 560px) {
        .game { padding: 13px 14px; gap: 12px; }
        .sitting-out { padding: 11px 14px; }
    }
</style>
